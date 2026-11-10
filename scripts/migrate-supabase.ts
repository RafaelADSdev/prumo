import { PrismaClient as LocalClient } from "@prisma/client";
import { PrismaClient as CloudClient } from "@prumo/supabase-client";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { installAiSchema } from "./ai-schema.mjs";

process.loadEnvFile(".env");
const sourceUrl = process.env.DATABASE_URL || "";
const cloudUrl = process.env.SUPABASE_DATABASE_URL || "";
if (!sourceUrl.startsWith("file:"))
  throw Error(
    "A origem deve ser o SQLite local; a migração não sobrescreve um banco já ativo na nuvem.",
  );
const parsed = new URL(cloudUrl);
if (
  parsed.searchParams.get("schema") !== "prumo" ||
  parsed.searchParams.get("sslmode") !== "require" ||
  parsed.searchParams.get("sslaccept") !== "strict"
)
  throw Error(
    "Use o schema prumo, sslmode=require e sslaccept=strict na conexão Supabase.",
  );

const destination = new CloudClient({ datasourceUrl: cloudUrl });
let snapshot: LocalClient | undefined;
let live: LocalClient | undefined;
const models = [
  "admin",
  "session",
  "record",
  "audit",
  "importBatch",
  "aiCredential",
  "aiConversation",
  "aiMessage",
  "aiProposal",
  "aiQuota",
] as const;
async function contents(client: any, local = false) {
  return client.$transaction(
    async (tx: any) => {
      const localTables = local
        ? new Set(
            (
              await tx.$queryRaw`SELECT name FROM sqlite_master WHERE type = 'table'`
            ).map((row: { name: string }) => row.name),
          )
        : null;
      return Object.fromEntries(
        await Promise.all(
          models.map(async (model) => [
            model,
            model.startsWith("ai") &&
            localTables &&
            !localTables.has("A" + model.slice(1))
              ? []
              : await tx[model].findMany({
                  orderBy:
                    model === "aiCredential"
                      ? { provider: "asc" }
                      : { id: "asc" },
                }),
          ]),
        ),
      );
    },
    { timeout: 60000 },
  );
}
try {
  await destination.$queryRaw`SELECT 1`;
  const existing = await destination.$queryRaw<
    { table_name: string }[]
  >`SELECT table_name FROM information_schema.tables WHERE table_schema = 'prumo'`;
  if (existing.length)
    throw Error(
      "O schema prumo já contém tabelas. Nenhum dado foi substituído; confira a migração anterior antes de continuar.",
    );
  const folder = path.resolve(
    "backups",
    `antes-supabase-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  mkdirSync(folder, { recursive: true });
  const file = path.join(folder, "finance.db");
  const source = new DatabaseSync(path.resolve("prisma", sourceUrl.slice(5)), {
    readOnly: true,
  });
  try {
    await backup(source, file);
  } finally {
    source.close();
  }
  copyFileSync(".env", path.join(folder, "environment.env"));
  snapshot = new LocalClient({
    datasourceUrl: `file:${file.replaceAll("\\", "/")}`,
  });
  live = new LocalClient({ datasourceUrl: sourceUrl });
  const data = await contents(snapshot, true);
  await destination.$transaction(
    async (tx) => {
      await tx.$executeRaw`CREATE SCHEMA prumo`;
      await tx.$executeRaw`REVOKE ALL ON SCHEMA prumo FROM PUBLIC, anon, authenticated`;
      await tx.$executeRaw`CREATE TABLE prumo."Admin" (id INTEGER PRIMARY KEY DEFAULT 1, email TEXT NOT NULL UNIQUE, hash TEXT NOT NULL)`;
      await tx.$executeRaw`CREATE TABLE prumo."WorkspaceSession" (id TEXT PRIMARY KEY, expires TIMESTAMP(3) NOT NULL)`;
      await tx.$executeRaw`CREATE TABLE prumo."Record" (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL)`;
      await tx.$executeRaw`CREATE TABLE prumo."Audit" (id TEXT PRIMARY KEY, action TEXT NOT NULL, "entityId" TEXT NOT NULL, "before" TEXT, "after" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
      await tx.$executeRaw`CREATE TABLE prumo."ImportBatch" (id TEXT PRIMARY KEY, filename TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
      for (const table of [
        "Admin",
        "WorkspaceSession",
        "Record",
        "Audit",
        "ImportBatch",
      ]) {
        await tx.$executeRawUnsafe(
          `ALTER TABLE prumo."${table}" ENABLE ROW LEVEL SECURITY`,
        );
        await tx.$executeRawUnsafe(
          `REVOKE ALL ON TABLE prumo."${table}" FROM PUBLIC, anon, authenticated`,
        );
      }
      await installAiSchema(tx, "prumo");
      for (const model of models) {
        // Small batches keep large import histories within pooler query limits.
        for (let offset = 0; offset < data[model].length; offset += 100)
          await (tx[model] as any).createMany({
            data: data[model].slice(offset, offset + 100),
          });
      }
      for (const model of models)
        assert.deepEqual(
          await (tx[model] as any).findMany({
            orderBy:
              model === "aiCredential" ? { provider: "asc" } : { id: "asc" },
          }),
          data[model],
          `Divergência na cópia: ${model}`,
        );
    },
    { timeout: 120000, maxWait: 15000 },
  );
  assert.deepEqual(
    await contents(live, true),
    data,
    "O banco local mudou durante a migração. Mantenha o banco local ativo e concilie os novos registros antes de ativar o Supabase.",
  );
  assert.deepEqual(
    await contents(destination),
    data,
    "A verificação final divergiu. O banco local continua ativo.",
  );
  const environment = readFileSync(".env", "utf8");
  const next = environment
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("DATABASE_URL="))
    .join("\n");
  writeFileSync(".env", `DATABASE_URL=${JSON.stringify(cloudUrl)}\n${next}`);
  console.log("Migração verificada. Supabase ativado em DATABASE_URL.");
  console.log(
    JSON.stringify({
      copied: Object.fromEntries(
        models.map((model) => [model, data[model].length]),
      ),
      backup: folder,
    }),
  );
  console.log(
    "Reinicie o servidor para usar a conexão nova. O SQLite original foi preservado.",
  );
} catch (error) {
  // Prisma errors can contain a datasource URL; never print their raw message.
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "Migração não concluída. O SQLite continua preservado; confira o acesso, o schema e o backup antes de repetir.",
  );
  process.exitCode = 1;
} finally {
  await Promise.all([
    destination.$disconnect(),
    snapshot?.$disconnect(),
    live?.$disconnect(),
  ]);
}
