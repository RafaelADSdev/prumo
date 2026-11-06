import { describe, it, expect } from "vitest";
import {
  entrySchema,
  settleService,
  paid,
  balance,
  totals,
} from "../src/lib/finance";

const entry = (extra = {}) =>
  entrySchema.parse({
    type: "income",
    description: "Instalação",
    category: "Serviços",
    amount: 10000,
    competence: "2026-11-01",
    ...extra,
  });
describe("Recebimentos no serviço", () => {
  it("quita somente o saldo restante e não duplica em uma repetição", () => {
    const original = entry({
      payments: [
        { id: "partial", amount: 4000, date: "2026-11-05", method: "Pix" },
      ],
    });
    const receipt = {
      action: "settle" as const,
      date: "2026-11-06",
      method: "Dinheiro",
    };
    const result = settleService(original, receipt, "restante");
    expect(result.payments.at(-1)?.amount).toBe(6000);
    expect(result.payments.at(-1)?.method).toBe("Dinheiro");
    expect(balance({ ...result, id: "s" })).toBe(0);
    expect(settleService(result, receipt, "repetido").payments).toEqual(
      result.payments,
    );
  });
  it("estorna para não pago sem apagar a forma nem o histórico", () => {
    const original = entry({
      payments: [{ id: "p", amount: 10000, date: "2026-11-05", method: "Pix" }],
    });
    const result = settleService(original, { action: "unpaid" }, "unused");
    expect(paid(result)).toBe(0);
    expect(result.payments[0]).toMatchObject({
      id: "p",
      method: "Pix",
      voided: true,
    });
    expect(totals([{ ...result, id: "s" }], "2026", "11").income).toBe(0);
  });
  it("não aceita receber serviço sem preço, cancelado ou sem forma/data válidas", () => {
    const receipt = {
      action: "settle" as const,
      date: "2026-11-06",
      method: "Pix",
    };
    expect(() =>
      settleService(entry({ amount: null }), receipt, "p"),
    ).toThrow();
    expect(() =>
      settleService(entry({ cancelled: true }), receipt, "p"),
    ).toThrow();
    expect(() =>
      settleService(entry(), { ...receipt, method: " " }, "p"),
    ).toThrow();
    expect(() =>
      settleService(entry(), { ...receipt, date: "2026-02-30" }, "p"),
    ).toThrow();
  });
});
