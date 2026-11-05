import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prepare } from "../src/lib/importer";
import { templateFixture } from "./template-fixture";

const income = [
  "Receita",
  "Venda teste",
  "Vendas",
  "125.50",
  "2027-03",
  "15/04/2027",
  "Cliente teste",
  "Observação",
];
describe("Modelo de importação para download", () => {
  it("vem vazio e não importa os exemplos das instruções", () => {
    expect(() =>
      prepare(
        readFileSync("public/modelo-importacao-prumo.xlsx"),
        "modelo.xlsx",
      ),
    ).toThrow("planilha está vazia");
  });
  it("lê receitas e despesas com competência própria, datas e valores brasileiros", () => {
    const expense = [
      "Despesa",
      "Material",
      "",
      "1.234,56",
      "31/12/2028",
      "",
      "",
      "",
    ];
    const p = prepare(
      templateFixture([income, expense, []]),
      "preenchida.xlsx",
    );
    expect(p.candidates).toHaveLength(2);
    expect(p.candidates[0]).toMatchObject({
      kind: "income",
      amount: 12550,
      competence: "2027-03-01",
      due: "2027-04-15",
      received: null,
      party: "Cliente teste",
    });
    expect(p.candidates[1]).toMatchObject({
      kind: "expense",
      amount: 123456,
      competence: "2028-12-31",
      category: "A conferir",
      due: null,
    });
    expect(p.reconciliation[0]).toMatchObject({
      gross: 12550,
      expenses: 123456,
    });
  });
  it("aceita datas numéricas do Excel", () => {
    const row = [...income];
    row[4] = "46388";
    row[5] = "46389";
    expect(
      prepare(templateFixture([row]), "datas.xlsx").candidates[0],
    ).toMatchObject({ competence: "2027-01-01", due: "2027-01-02" });
  });
  it.each([
    [0, "Outro"],
    [1, ""],
    [3, "-10"],
    [3, "0"],
    [3, ""],
    [4, "31/02/2027"],
    [4, ""],
  ])("rejeita campos inválidos com a linha do erro (%s)", (column, value) => {
    const row = [...income];
    row[Number(column)] = String(value);
    expect(() => prepare(templateFixture([row]), "invalida.xlsx")).toThrow(
      "linha 2",
    );
  });
  it("não usa resultados em cache de fórmulas", () => {
    expect(() =>
      prepare(templateFixture([income], true), "formula.xlsx"),
    ).toThrow("substitua as fórmulas");
  });
});
