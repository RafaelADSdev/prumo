import { describe, it, expect } from "vitest";
import { entrySchema, type Entry, totals } from "../src/lib/finance";
import {
  reportRows,
  summarizeRows,
  reportTimeline,
  previousPeriod,
  reportQuality,
} from "../src/lib/reports";
const entry = (extra: Record<string, unknown> = {}): Entry => ({
  id: "e",
  ...entrySchema.parse({
    type: "income",
    description: "Trabalho",
    category: "Serviços",
    amount: 10000,
    discount: 1000,
    competence: "2026-02-01",
    ...extra,
  }),
});
const rows = [
  entry({
    payments: [
      { id: "a", amount: 3000, date: "2026-01-10", method: "Pix" },
      { id: "b", amount: 2000, date: "2026-02-10", method: "Dinheiro" },
      { id: "c", amount: 1000, date: null, method: "Pix" },
      {
        id: "d",
        amount: 1000,
        date: "2026-02-10",
        method: "Pix",
        voided: true,
      },
    ],
  }),
  entry({
    id: "expense",
    type: "expense",
    amount: 4000,
    discount: 0,
    vehicleId: "v",
    payments: [{ id: "p", amount: 1000, date: "2026-02-11", method: "Pix" }],
  }),
  entry({ id: "unknown", amount: null }),
  entry({ id: "review", review: true }),
  entry({ id: "cancelled", cancelled: true }),
];
describe("relatórios conciliados", () => {
  it("reconcilia caixa e competência com os totais oficiais, sem duplicar baixas", () => {
    for (const basis of ["cash", "accrual"] as const) {
      const detail = reportRows(rows, "2026", "02", basis);
      const sum = summarizeRows(detail);
      const expected = totals(rows, "2026", "02", basis);
      expect(sum).toMatchObject({
        income: expected.income,
        expense: expected.expense,
        net: expected.net,
      });
      expect(detail).toHaveLength(2);
      expect(sum.incomeCategories.reduce((s, x) => s + x.amount, 0)).toBe(
        sum.income,
      );
      expect(sum.expenseCategories.reduce((s, x) => s + x.amount, 0)).toBe(
        sum.expense,
      );
    }
  });
  it("usa dias do mês com zeros e acumula apenas o resultado do período", () => {
    const timeline = reportTimeline(
      reportRows(rows, "2026", "02", "cash"),
      "2026",
      "02",
    );
    expect(timeline).toHaveLength(28);
    expect(timeline.at(-1)?.net).toBe(1000);
    expect(timeline[9].income).toBe(2000);
    expect(reportTimeline([], "2028", "02")).toHaveLength(29);
  });
  it("compara janeiro com dezembro anterior e anos completos com o ano anterior", () => {
    expect(previousPeriod("2026", "01")).toEqual({ year: "2025", month: "12" });
    expect(previousPeriod("2026", "all")).toEqual({
      year: "2025",
      month: "all",
    });
  });
  it("informa lacunas sem atribuir datas fictícias às baixas", () => {
    expect(reportQuality(rows, "2026", "02")).toEqual({
      unresolved: 2,
      undatedCount: 1,
      undatedIncome: 1000,
      undatedExpense: 0,
    });
  });
});
