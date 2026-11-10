import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
if (!fs.existsSync(".env")) fs.copyFileSync(".env.example", ".env");
process.loadEnvFile(".env");
const url = process.env.DATABASE_URL || "file:./finance.db";
const postgres = /^postgres(ql)?:\/\//.test(url);
if (!postgres && !url.startsWith("file:"))
  throw Error("Conexão de banco inválida.");
if (!postgres) {
  const target = path.resolve("prisma", url.slice(5));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.closeSync(fs.openSync(target, "wx"));
}
const schema = postgres ? "prisma/supabase.prisma" : "prisma/schema.prisma";
for (const args of [
  ["generate", "--schema", "prisma/schema.prisma"],
  ["generate", "--schema", "prisma/supabase.prisma"],
  ["db", "push", "--schema", schema, "--skip-generate"],
])
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", ...args],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        ...(postgres ? { SUPABASE_DATABASE_URL: url } : {}),
      },
    },
  );
if (postgres)
  execFileSync(process.execPath, ["scripts/migrate-ai.mjs"], {
    stdio: "inherit",
  });
console.log("Banco pronto. Configure o administrador com npm run admin.");
