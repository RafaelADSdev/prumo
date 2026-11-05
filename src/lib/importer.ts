import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { entrySchema } from "./finance";
import { prepareStandard } from "./standard-import";
const array = (x: any): any[] =>
  x === undefined ? [] : Array.isArray(x) ? x : [x];
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  processEntities: false,
});
function texts(x: any): string {
  if (x == null) return "";
  if (typeof x !== "object") return String(x);
  if (x.t !== undefined) return texts(x.t);
  if (x["#text"] !== undefined) return String(x["#text"]);
  if (x.r) return array(x.r).map(texts).join("");
  return "";
}
export type Sheet = {
  name: string;
  rows: Record<number, Record<string, string>>;
  formulas: Set<string>;
};
export function readWorkbook(bytes: Uint8Array): Sheet[] {
  const files = unzipSync(bytes, {
    filter: (f) => {
      if (f.originalSize > 20000000)
        throw Error("Arquivo interno grande demais");
      return true;
    },
  });
  if (Object.values(files).reduce((s, f) => s + f.length, 0) > 50000000)
    throw Error("Planilha descompactada excede 50 MB");
  const xml = (p: string) => {
    if (!files[p]) throw Error("XLSX inválido: " + p);
    return parser.parse(strFromU8(files[p]));
  };
  const wb = xml("xl/workbook.xml");
  const rels = array(
    xml("xl/_rels/workbook.xml.rels").Relationships.Relationship,
  );
  const shared = files["xl/sharedStrings.xml"]
    ? array(xml("xl/sharedStrings.xml").sst.si).map(texts)
    : [];
  return array(wb.workbook.sheets.sheet).map((s) => {
    const rel = rels.find((r) => r.Id === s.id);
    let path = rel?.Target || "";
    path = path.startsWith("/") ? path.slice(1) : "xl/" + path;
    const doc = xml(path);
    const rows: Sheet["rows"] = {},
      formulas = new Set<string>();
    for (const r of array(doc.worksheet.sheetData?.row)) {
      const row: Record<string, string> = {};
      for (const c of array(r.c)) {
        const col = c.r.replace(/\d/g, "");
        row[col] =
          c.t === "s"
            ? shared[Number(c.v)] || ""
            : c.t === "inlineStr"
              ? texts(c.is)
              : String(c.v ?? "");
        if (c.f !== undefined) formulas.add(c.r);
      }
      rows[Number(r.r)] = row;
    }
    return { name: s.name, rows, formulas };
  });
}
const numeric = (s: string | undefined) =>
  s !== undefined && s.trim() !== "" && /^-?\d+(\.\d+)?$/.test(s)
    ? Math.round(Number(s) * 100)
    : null;
const excelDate = (s: string | undefined) =>
  s && /^\d{5}(\.\d+)?$/.test(s)
    ? new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000)
        .toISOString()
        .slice(0, 10)
    : null;
export type Candidate = {
  key: string;
  kind: "service" | "expense" | "income" | "legacy";
  sheet: string;
  row: number;
  description: string;
  amount: number | null;
  date: string | null;
  competence: string;
  category: string;
  party: string;
  received: number | null;
  due: string | null;
  method: string;
  notes: string;
  original: unknown;
  selected: boolean;
  review: boolean;
  items?: any[];
};
export function prepare(bytes: Uint8Array, filename: string) {
  const sheets = readWorkbook(bytes);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const standard = prepareStandard(sheets, filename, hash);
  if (standard) return standard;
  const candidates: Candidate[] = [];
  const monthly = sheets.filter((s) => !/total|contas|como/i.test(s.name));
  const warnings: string[] = [];
  monthly.forEach((s, mi) => {
    const header = Object.entries(s.rows).find(
      ([, r]) =>
        Object.values(r).some((v) => v.trim().toUpperCase() === "CLIENTE") &&
        Object.values(r).some((v) => v.includes("VALOR NF")),
    );
    if (!header) {
      warnings.push(`${s.name}: cabeçalho mensal não reconhecido`);
      return;
    }
    const h = Number(header[0]),
      jan = h === 7;
    const col = (normal: string, january: string) => (jan ? january : normal);
    const monthIndex = [
      "jan",
      "fev",
      "mar",
      "abr",
      "mai",
      "jun",
      "jul",
      "ago",
      "set",
      "out",
      "nov",
      "dez",
    ].findIndex((n) => s.name.toLowerCase().startsWith(n));
    if (monthIndex < 0) throw Error("Aba mensal não reconhecida: " + s.name);
    const competence = `2026-${String(monthIndex + 1).padStart(2, "0")}-01`;
    const add = (
      c: Partial<Candidate> & {
        row: number;
        description: string;
        kind: Candidate["kind"];
      },
    ) =>
      candidates.push({
        key: `${s.name}:${c.row}:${c.category || c.kind}`,
        sheet: s.name,
        amount: null,
        date: null,
        competence,
        category: "A conferir",
        party: "",
        received: null,
        due: null,
        method: "",
        notes: "",
        original: s.rows[c.row],
        selected: true,
        review: true,
        ...c,
      });
    for (let r = h + 1; r <= (jan ? 54 : 52); r++) {
      const row = s.rows[r] || {},
        party = row[col("C", "D")]?.trim(),
        raw = numeric(row[col("I", "J")]);
      const controls = s.rows[95 + r - (h + 1)] || {};
      if (party) {
        const items = ["Concertina", "Elétrica", "Manutenção", "Venda"].flatMap(
          (description, i) => {
            const q = row[String.fromCharCode((jan ? 70 : 69) + i)];
            return q
              ? [{ description, quantity: q, unit: "", amount: null }]
              : [];
          },
        );
        const method = [row[col("L", "M")], row[col("M", "N")]]
          .filter((v) => v && !/^(ok|pg)$/i.test(v.trim()))
          .join(" / ");
        add({
          kind: "service",
          category: "Serviços",
          due: excelDate(controls.C),
          original: {
            serviceRow: r,
            service: row,
            receiptsRow: 95 + r - (h + 1),
            receipts: controls,
          },
          row: r,
          description: party,
          party,
          amount: raw === 0 ? null : raw,
          date: excelDate(row[col("D", "E")]),
          received: numeric(controls.B),
          method,
          items: items.length
            ? items
            : [
                {
                  description: "Serviço",
                  quantity: "",
                  unit: "",
                  amount: null,
                },
              ],
          notes: `${controls.F || ""} | Marcadores originais: ${row[col("L", "M")] || ""} ${row[col("M", "N")] || ""}. Recebido informado sem data efetiva; não incluído no caixa.`,
        });
      } else if (raw !== null && raw !== 0)
        add({
          kind: "legacy",
          row: r,
          description: "Valor sem cliente — revisar origem",
          amount: raw,
          selected: false,
          notes: "Diferença não convertida em desconto.",
        });
      const dc = excelDate(row[col("O", "P")]);
      for (const [column, category] of [
        [col("P", "R"), "Combustível"],
        [col("Q", "Q"), "Alimentação"],
        [col("S", "T"), "Materiais"],
      ]) {
        if (jan && category === "Combustível") continue;
        const value = numeric(row[column]);
        if (
          r < (jan ? 54 : 52) &&
          !s.formulas.has(column + r) &&
          value !== null &&
          value > 0
        )
          add({
            kind: "expense",
            row: r,
            description: row[col("R", "S")] || category,
            amount: value,
            date: dc,
            category,
            notes: "Despesa registrada; pagamento e veículo a conferir.",
          });
      }
    }
    for (let r = jan ? 58 : 56; r <= (jan ? 66 : 64); r++) {
      const row = s.rows[r] || {};
      const desc = row[col("B", "C")];
      const v = numeric(row[col("D", "E")]);
      if (desc && !/total/i.test(desc) && v && v > 0)
        add({
          kind: "expense",
          row: r,
          description: desc,
          amount: v,
          category: "Despesas fixas",
        });
      const car = row[col("I", "J")],
        cv = numeric(row[col("K", "L")]);
      if (car && !/total|cartao|dinheiro|boleto/i.test(car) && cv && cv > 0)
        add({
          kind: "expense",
          row: r,
          description: car,
          amount: cv,
          category: "Manutenção de veículos",
          notes: "Veículo a vincular; pagamento não confirmado.",
        });
      const name = row[col("O", "P")],
        base = numeric(row[col("P", "Q")]),
        extra = numeric(row[col("Q", "R")]) || 0,
        discount = numeric(row[col("R", "S")]) || 0;
      if (
        name &&
        !/nome|total|liquido/i.test(name) &&
        base !== null &&
        base + extra - discount > 0
      )
        add({
          kind: "expense",
          row: r,
          description: "Colaborador: " + name,
          amount: base + extra - discount,
          category: "Colaboradores",
          notes: `Base ${base}; extras ${extra}; descontos ${discount} centavos`,
        });
    }
    for (let r = jan ? 74 : 72; r <= (jan ? 84 : 82); r++) {
      const row = s.rows[r] || {};
      for (const [nc, vc] of [
        [col("B", "C"), col("D", "E")],
        [col("H", "I"), col("J", "K")],
      ]) {
        const name = row[nc],
          value = numeric(row[vc]);
        if (name && value && value > 0)
          add({
            kind: "legacy",
            row: r,
            description: "Controle antigo: " + name,
            amount: value,
            selected: false,
            notes:
              "Possível duplicidade de serviço. Exige conciliação antes de gerar dívida.",
            category: "Controle antigo",
          });
      }
    }
    // Detalhe de outubro é somente proveniência: os lançamentos já estão nos blocos principais.
    if (s.name.toLowerCase() === "outubro") {
      for (let r = 151; r <= 154; r++) {
        const detail = s.rows[r];
        if (!detail) continue;
        const match = candidates.find(
          (c) =>
            c.sheet === s.name &&
            c.kind === "expense" &&
            c.amount === numeric(detail.F) &&
            (c.description.trim().toLowerCase() ===
              detail.C?.trim().toLowerCase() ||
              (c.category === "Alimentação" &&
                detail.C?.trim().toLowerCase() === "almoço")),
        );
        if (match) {
          match.date = excelDate(detail.B);
          match.original = {
            primary: match.original,
            detail: { row: r, ...detail },
          };
        }
      }
    }
  });
  const summary = sheets.find((s) => s.name.toUpperCase() === "TOTAL");
  const reconciliation = monthly.map((s, i) => {
    const row = summary?.rows[4 + i * 2] || {};
    const cs = candidates.filter((c) => c.sheet === s.name);
    const gross = cs
      .filter((c) => c.kind === "service")
      .reduce((n, c) => n + (c.amount || 0), 0);
    const expenses = cs
      .filter((c) => c.kind === "expense")
      .reduce((n, c) => n + (c.amount || 0), 0);
    return {
      month: s.name,
      gross,
      expenses,
      referenceGross: numeric(row.D),
      referenceExpenses: numeric(row.F),
      grossDifference: numeric(row.D) === null ? null : gross - numeric(row.D)!,
      expenseDifference:
        numeric(row.F) === null ? null : expenses - numeric(row.F)!,
      notes:
        "Diferenças podem incluir valores sem cliente, preços ausentes, descontos não confirmados e classificações históricas. Não há ajuste automático.",
    };
  });
  const reference = sheets
    .filter((s) => /total|contas|como/i.test(s.name))
    .map((s) => ({ name: s.name, rows: s.rows }));
  warnings.push(
    "Competência segue a aba mensal de 2026; data de operação ausente permanece desconhecida.",
    "Valores recebidos sem data não alimentam caixa. Nenhuma despesa é marcada como paga automaticamente.",
    "Blocos antigos desmarcados por possível duplicidade. TOTAL é referência de conciliação; não gera lançamentos.",
  );
  return {
    hash,
    filename,
    candidates,
    warnings,
    reference,
    reconciliation,
    sheets: sheets.map((s) => s.name),
  };
}
