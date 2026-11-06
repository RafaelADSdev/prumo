import { fixture } from "./workbook-fixture";
import { describe, it, expect } from "vitest";
import {
  entrySchema,
  balance,
  status,
  totals,
  parseMoney,
  recurrenceDate,
  Entry,
  expenseSummary,
} from "../src/lib/finance";
import { prepare } from "../src/lib/importer";
import { zipSync, strToU8 } from "fflate";
const entry = (extra: any = {}) =>
  ({
    id: "one",
    ...entrySchema.parse({
      type: "income",
      description: "Serviço",
      category: "Serviços",
      amount: 100000,
      competence: "2026-12-01",
      due: "2027-02-01",
      ...extra,
    }),
  }) as Entry;
describe("regras financeiras", () => {
  it("engloba todas as origens de gastos sem duplicar e separa pagos de pendentes", () => {
    const rows = [
      entry({ type: "expense", amount: 10000, recurrenceId: "fixa" }),
      entry({
        type: "expense",
        amount: 20000,
        vehicleId: "carro",
        discount: 1000,
        payments: [
          { id: "p", amount: 5000, date: "2027-01-01", method: "Pix" },
          { id: "v", amount: 1000, date: null, method: "Pix", voided: true },
        ],
      }),
      entry({ type: "expense", amount: 30000, employeeId: "equipe" }),
      entry({ type: "expense", amount: 40000 }),
      entry({ type: "expense", amount: null }),
      entry({ type: "expense", review: true }),
      entry({ type: "expense", cancelled: true }),
      entry({ type: "expense", competence: "2025-12-01" }),
      entry(),
    ];
    const result = expenseSummary(rows, "2026", "12");
    expect(result.total).toBe(99000);
    expect(result.paid).toBe(5000);
    expect(result.outstanding).toBe(94000);
    expect(result.unresolved).toBe(2);
    expect(result.groups.reduce((sum, group) => sum + group.amount, 0)).toBe(
      result.total,
    );
    expect(result.groups.map((group) => group.amount)).toEqual([
      10000, 19000, 30000, 40000,
    ]);
  });
  it("preserva centavos sem erro de ponto flutuante", () => {
    expect(
      parseMoney("71,95") +
        parseMoney("130,00") +
        parseMoney("140,00") +
        parseMoney("48,00"),
    ).toBe(38995);
    expect(() => parseMoney("1,234")).toThrow();
  });
  it("R$ 1.000 com recebimento de R$ 400 mantém R$ 600", () => {
    const e = entry({
      payments: [{ id: "p", amount: 40000, date: "2027-01-10", method: "Pix" }],
    });
    expect(balance(e)).toBe(60000);
    expect(status(e, "2027-01-11")).toBe("Parcial");
    expect(totals([e], "2026", "12", "accrual").income).toBe(100000);
    expect(totals([e], "2026", "12").income).toBe(0);
    expect(totals([e], "2027", "01").income).toBe(40000);
  });
  it("pagamento sem data não inventa caixa", () =>
    expect(
      totals(
        [
          entry({
            payments: [
              { id: "p", amount: 40000, date: null, method: "Histórico" },
            ],
          }),
        ],
        "2026",
        "all",
      ).income,
    ).toBe(0));
  it("sem preço não é zero e histórico não é dívida", () => {
    expect(status(entry({ amount: null }))).toBe("Sem valor informado");
    expect(
      totals([entry({ amount: null })], "2026", "all", "accrual").income,
    ).toBe(0);
    expect(status(entry({ review: true }))).toBe("A conferir");
    expect(() => entry({ amount: 0 })).toThrow();
    expect(status(entry({ amount: 0, confirmedZero: true }))).toBe("Quitado");
  });
  it("rejeita excesso de baixa e descontos", () => {
    expect(() => entry({ discount: 100001 })).toThrow();
    expect(() =>
      entry({
        payments: [
          { id: "p", amount: 100001, date: "2026-01-01", method: "Pix" },
        ],
      }),
    ).toThrow();
  });
  it("cancelamento e estorno atualizam caixa", () => {
    expect(
      totals(
        [
          entry({
            cancelled: true,
            payments: [
              { id: "p", amount: 100000, date: "2026-01-01", method: "Pix" },
            ],
          }),
        ],
        "2026",
        "all",
      ).income,
    ).toBe(0);
    expect(
      totals(
        [
          entry({
            payments: [
              {
                id: "p",
                amount: 100000,
                date: "2026-01-01",
                method: "Pix",
                voided: true,
              },
            ],
          }),
        ],
        "2026",
        "all",
      ).income,
    ).toBe(0);
  });
  it("vence no último dia quando o mês não tem o dia configurado", () => {
    expect(recurrenceDate(2027, 2, 31)).toBe("2027-02-28");
    expect(recurrenceDate(2028, 2, 31)).toBe("2028-02-29");
  });
  it("rejeita datas inexistentes", () =>
    expect(() => entry({ due: "2026-02-31" })).toThrow());
});
describe("importação", () => {
  it("aceita namespaces com prefixo e não duplica detalhe de outubro", () => {
    const p = prepare(fixture(), "teste.xlsx");
    const expenses = p.candidates.filter((c) => c.kind === "expense");
    expect(expenses.reduce((s, c) => s + (c.amount || 0), 0)).toBe(38995);
    expect(
      expenses.filter((c) => c.description === "Vistoria do carro"),
    ).toHaveLength(2);
    expect(p.candidates.find((c) => c.kind === "service")?.received).toBe(
      100000,
    );
    expect(p.candidates.find((c) => c.kind === "service")?.date).toBeNull();
  });
  it("identifica o mesmo arquivo pelo conteúdo", () =>
    expect(prepare(fixture(), "a.xlsx").hash).toBe(
      prepare(fixture(), "b.xlsx").hash,
    ));
});
