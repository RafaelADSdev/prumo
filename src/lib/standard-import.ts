import { date as dateSchema, entrySchema, parseMoney } from "./finance";
import type { Candidate, Sheet } from "./importer";

const headers = [
  "Tipo",
  "Descrição",
  "Categoria",
  "Valor (R$)",
  "Competência",
  "Vencimento",
  "Pessoa",
  "Observações",
];
const normalize = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function parseDate(value: string): string {
  let result = value.trim();
  if (/^\d{5}(\.\d+)?$/.test(result)) {
    result = new Date(
      Date.UTC(1899, 11, 30) + Math.floor(Number(result)) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(result)) {
    result = result.split("/").reverse().join("-");
  }
  return dateSchema.parse(result);
}

export function prepareStandard(
  sheets: Sheet[],
  filename: string,
  hash: string,
) {
  const sheet = sheets.find((s) => normalize(s.name) === "lancamentos");
  if (!sheet) return null;
  const header = sheet.rows[1] || {};
  const columns = headers.map((name) =>
    Object.keys(header).find(
      (col) => normalize(header[col]) === normalize(name),
    ),
  );
  if (columns.some((col) => !col))
    throw Error(
      "Modelo Prumo: mantenha os oito cabeçalhos da primeira linha. Baixe o modelo novamente.",
    );
  const candidates: Candidate[] = [];
  for (const [number, row] of Object.entries(sheet.rows)) {
    const r = Number(number);
    if (r === 1) continue;
    const values = columns.map((col) => (row[col!] || "").trim());
    const hasFormula = columns.some((col) => sheet.formulas.has(`${col}${r}`));
    if (!values.some(Boolean) && !hasFormula) continue;
    try {
      if (hasFormula)
        throw Error("substitua as fórmulas pelos valores das células");
      const [type, description, category, value, period, due, party, notes] =
        values;
      if (!["receita", "despesa"].includes(normalize(type)))
        throw Error("Tipo deve ser Receita ou Despesa");
      if (!description) throw Error("preencha a Descrição");
      if (!value) throw Error("preencha o Valor (R$)");
      if (
        !/^\d+(\.\d{1,2})?$/.test(value) &&
        !/^(R\$\s*)?(\d+|\d{1,3}(\.\d{3})+),\d{1,2}$/.test(value)
      )
        throw Error(
          "Valor (R$) inválido; use um número com até duas casas decimais, como 125,50",
        );
      const amount = /^\d+(\.\d{1,2})?$/.test(value)
        ? Math.round(Number(value) * 100)
        : parseMoney(value);
      if (amount <= 0) throw Error("informe um valor maior que zero");
      if (!period)
        throw Error("preencha a Competência (AAAA-MM ou DD/MM/AAAA)");
      const competence = parseDate(
        /^\d{4}-\d{2}$/.test(period) ? `${period}-01` : period,
      );
      const entry = entrySchema.parse({
        type: normalize(type) === "receita" ? "income" : "expense",
        description,
        category: category || "A conferir",
        amount,
        competence,
        due: due ? parseDate(due) : null,
        party,
        notes,
        review: true,
      });
      candidates.push({
        key: `${sheet.name}:${r}`,
        kind: entry.type === "income" ? "income" : "expense",
        sheet: sheet.name,
        row: r,
        description: entry.description,
        amount,
        date: null,
        competence,
        category: entry.category,
        party,
        received: null,
        due: entry.due,
        method: "",
        notes,
        original: row,
        selected: true,
        review: true,
      });
    } catch (error) {
      const detail =
        error instanceof Error && error.name !== "ZodError"
          ? error.message
          : "confira os valores, os tamanhos dos textos e as datas informadas";
      throw Error(`Lançamentos, linha ${r}: ${detail}.`);
    }
  }
  if (!candidates.length)
    throw Error(
      "A planilha está vazia. Preencha a aba Lançamentos antes de importar.",
    );
  return {
    hash,
    filename,
    candidates,
    sheets: [sheet.name],
    reference: [],
    warnings: [
      "Confira os dados antes de confirmar. Nenhum lançamento é marcado como pago automaticamente; registre as baixas após a importação.",
    ],
    reconciliation: [
      {
        month: "Lançamentos",
        gross: candidates
          .filter((c) => c.kind === "income")
          .reduce((sum, c) => sum + (c.amount || 0), 0),
        expenses: candidates
          .filter((c) => c.kind === "expense")
          .reduce((sum, c) => sum + (c.amount || 0), 0),
        referenceGross: null,
        referenceExpenses: null,
        grossDifference: null,
        expenseDifference: null,
        notes: "Totais das linhas preenchidas no modelo Prumo.",
      },
    ],
  };
}
