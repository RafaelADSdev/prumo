import { PrismaClient } from "@prumo/supabase-client";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { installAiSchema } from "./ai-schema.mjs";

if (existsSync(".env")) process.loadEnvFile(".env");
const connection = new URL(process.env.DATABASE_URL || "file:");
if (
  !["postgres:", "postgresql:"].includes(connection.protocol) ||
  connection.searchParams.get("schema") !== "prumo"
) {
  console.error(
    "Use a conexão PostgreSQL do Prumo com schema=prumo. Para SQLite, execute npm run setup.",
  );
  process.exit(1);
}
const certificate = connection.searchParams.get("sslcert");
if (certificate && !path.isAbsolute(certificate))
  connection.searchParams.set("sslcert", path.resolve("prisma", certificate));

const primary = process.env.SUPABASE_PRUMO_PRIMARY_USER_ID?.trim();
const schemas = new Set(["prumo"]);
for (const raw of process.env.SUPABASE_PRUMO_USER_IDS?.split(",") ?? []) {
  const id = raw.trim();
  if (id && id !== primary)
    schemas.add(
      "prumo_" + createHash("sha256").update(id).digest("hex").slice(0, 32),
    );
}

const db = new PrismaClient({ datasourceUrl: connection.toString() });
try {
  await db.$transaction(
    async (tx) => {
      for (const schema of schemas) await installAiSchema(tx, schema);
    },
    { timeout: 60000 },
  );
  console.log(
    "Tabelas privadas do Assistente IA preparadas em " +
      schemas.size +
      " espaço(s).",
  );
} catch (error) {
  console.error(
    error instanceof Error && error.message.startsWith("Provisione o espaço")
      ? error.message
      : "Falha ao preparar o Assistente IA. Confira a conexão e as permissões do banco.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
