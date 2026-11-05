import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
if (!fs.existsSync(".env")) fs.copyFileSync(".env.example", ".env");
process.loadEnvFile(".env");
const url = process.env.DATABASE_URL || "file:./finance.db";
if (!url.startsWith("file:")) throw Error("Esta versão utiliza SQLite local.");
const target = path.resolve("prisma", url.slice(5));
fs.mkdirSync(path.dirname(target), { recursive: true });
if (!fs.existsSync(target)) fs.closeSync(fs.openSync(target, "wx"));
for (const args of [["generate"], ["db", "push"]])
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", ...args],
    { stdio: "inherit", env: process.env },
  );
console.log("Banco pronto. Configure o administrador com npm run admin.");
