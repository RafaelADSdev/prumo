import { readFileSync } from "node:fs";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

export function templateFixture(rows: string[][], formula = false) {
  const files = unzipSync(readFileSync("public/modelo-importacao-prumo.xlsx"));
  const escape = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const xml = strFromU8(files["xl/worksheets/sheet1.xml"]);
  const data = rows
    .map(
      (values, i) =>
        `<x:row r="${i + 2}">${values.map((v, j) => `<x:c r="${String.fromCharCode(65 + j)}${i + 2}" t="inlineStr">${formula && j === 3 ? "<x:f>1+1</x:f>" : ""}<x:is><x:t>${escape(v)}</x:t></x:is></x:c>`).join("")}</x:row>`,
    )
    .join("");
  // Replace the blank styled input rows, retaining the shipped workbook headers.
  files["xl/worksheets/sheet1.xml"] = strToU8(
    xml
      .replace(/<x:row\b[^>]*\br="(?:[2-9]|\d{2,})"[\s\S]*?<\/x:row>/g, "")
      .replace("</x:sheetData>", `${data}</x:sheetData>`),
  );
  return zipSync(files);
}
