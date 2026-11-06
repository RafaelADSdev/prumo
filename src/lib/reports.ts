import { inPeriod, type Entry } from "./finance";

export type ReportBasis = "cash" | "accrual";
export type ReportRow = {
  id: string;
  entry: Entry;
  date: string;
  amount: number;
  method: string;
  origin: string;
};
export const reportMonths = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export function periodLabel(year: string, month: string) {
  return month === "all"
    ? year
    : `${reportMonths[Number(month) - 1]} de ${year}`;
}
export function previousPeriod(year: string, month: string) {
  if (month === "all") return { year: String(Number(year) - 1), month };
  if (month === "01") return { year: String(Number(year) - 1), month: "12" };
  return { year, month: String(Number(month) - 1).padStart(2, "0") };
}
export function entryOrigin(e: Entry) {
  if (e.serviceId) return "Serviços";
  if (e.recurrenceId) return "Despesas fixas";
  if (e.vehicleId) return "Veículos";
  if (e.employeeId) return "Colaboradores";
  return "Lançamentos avulsos";
}
// Every cash row is one dated payment; accrual rows are net commitments.
// Never substitute competence for a missing payment date.
export function reportRows(
  entries: Entry[],
  year: string,
  month: string,
  basis: ReportBasis,
): ReportRow[] {
  return entries
    .flatMap((entry): ReportRow[] => {
      if (entry.cancelled) return [];
      const common = { entry, origin: entryOrigin(entry) };
      if (basis === "cash")
        return entry.payments
          .filter((p) => !p.voided && inPeriod(p.date, year, month))
          .map((p) => ({
            ...common,
            id: `${entry.id}:${p.id}`,
            date: p.date!,
            amount: p.amount,
            method: p.method || "Não informada",
          }));
      if (
        entry.review ||
        entry.amount === null ||
        !inPeriod(entry.competence, year, month)
      )
        return [];
      return [
        {
          ...common,
          id: entry.id,
          date: entry.competence,
          amount: entry.amount - entry.discount,
          method: entry.method || "Não informada",
        },
      ];
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export type ReportGroup = { name: string; amount: number; count: number };
export function groupRows(
  rows: ReportRow[],
  key: (row: ReportRow) => string,
): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  for (const row of rows) {
    const name = key(row) || "Não informado";
    const group = groups.get(name) || { name, amount: 0, count: 0 };
    group.amount += row.amount;
    group.count++;
    groups.set(name, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "pt-BR"),
  );
}
export function summarizeRows(rows: ReportRow[]) {
  const incoming = rows.filter((r) => r.entry.type === "income");
  const outgoing = rows.filter((r) => r.entry.type === "expense");
  const income = incoming.reduce((s, r) => s + r.amount, 0);
  const expense = outgoing.reduce((s, r) => s + r.amount, 0);
  return {
    income,
    expense,
    net: income - expense,
    incomeCount: incoming.length,
    expenseCount: outgoing.length,
    incomeCategories: groupRows(incoming, (r) => r.entry.category),
    expenseCategories: groupRows(outgoing, (r) => r.entry.category),
    incomeParties: groupRows(
      incoming,
      (r) => r.entry.party || "Cliente / origem não informado",
    ),
    expenseParties: groupRows(
      outgoing,
      (r) => r.entry.party || "Favorecido não informado",
    ),
  };
}
export function reportTimeline(rows: ReportRow[], year: string, month: string) {
  const count =
    month === "all"
      ? 12
      : new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const buckets = Array.from({ length: count }, (_, index) => ({
    date:
      month === "all"
        ? `${year}-${String(index + 1).padStart(2, "0")}`
        : `${year}-${month}-${String(index + 1).padStart(2, "0")}`,
    name:
      month === "all"
        ? reportMonths[index].slice(0, 3)
        : String(index + 1).padStart(2, "0"),
    income: 0,
    expense: 0,
    result: 0,
    net: 0,
  }));
  for (const row of rows) {
    const bucket =
      buckets[
        Number(
          row.date.slice(month === "all" ? 5 : 8, month === "all" ? 7 : 10),
        ) - 1
      ];
    if (bucket) bucket[row.entry.type] += row.amount;
  }
  let cumulative = 0;
  return buckets.map((b) => ({
    ...b,
    result: b.income - b.expense,
    net: (cumulative += b.income - b.expense),
  }));
}
export function reportQuality(entries: Entry[], year: string, month: string) {
  let unresolved = 0,
    undatedCount = 0,
    undatedIncome = 0,
    undatedExpense = 0;
  for (const e of entries) {
    if (e.cancelled) continue;
    if (inPeriod(e.competence, year, month) && (e.review || e.amount === null))
      unresolved++;
    // Missing dates cannot be assigned to any period; report as a global data gap.
    for (const p of e.payments)
      if (!p.voided && !p.date) {
        undatedCount++;
        if (e.type === "income") undatedIncome += p.amount;
        else undatedExpense += p.amount;
      }
  }
  return { unresolved, undatedCount, undatedIncome, undatedExpense };
}
