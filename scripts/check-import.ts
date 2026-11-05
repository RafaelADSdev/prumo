import { prepare } from "../src/lib/importer";
import fs from "node:fs";
import path from "node:path";
const file = process.argv[2];
if (!file) throw Error("Informe o caminho do XLSX.");
const p = prepare(fs.readFileSync(file), path.basename(file));
console.log(
  JSON.stringify(
    {
      sheets: p.sheets,
      candidates: p.candidates.length,
      services: p.candidates.filter((c) => c.kind === "service").length,
      expenses: p.candidates.filter((c) => c.kind === "expense").length,
      reconciliation: p.reconciliation,
    },
    null,
    2,
  ),
);
