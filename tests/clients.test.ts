import { describe, expect, it } from "vitest";
import {
  clientAddress,
  formatClientPhone,
  normalizeClientPhone,
  schemas,
} from "../src/lib/finance";

describe("Cadastro de clientes", () => {
  it("preserva os dados antigos e deixa os novos campos opcionais", () => {
    const client = schemas.client.parse({
      name: "Cliente antigo",
      contact: "Contato existente",
      notes: "Observação existente",
    });
    expect(client.contact).toBe("Contato existente");
    expect(client.notes).toBe("Observação existente");
    expect(client.phone).toBe("");
    expect(client.nickname).toBe("");
    expect(client.street).toBe("");
  });
  it("salva apelido, telefone e endereço sem perder observações", () => {
    const input = {
      name: "João da Silva",
      nickname: "João",
      phone: "(11) 99999-0000",
      contact: "joao@exemplo.com",
      street: "Rua das Flores",
      number: "123",
      complement: "Casa 2",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zipCode: "01000-000",
      notes: "Ligar antes da visita.",
    };
    expect(schemas.client.parse(input)).toEqual(input);
    expect(clientAddress(schemas.client.parse(input))).toContain(
      "Rua das Flores, 123",
    );
    expect(
      clientAddress(schemas.client.parse({ ...input, address: "Rua B, 2" })),
    ).toBe("Rua B, 2");
  });
  it("identifica o mesmo telefone com DDD independentemente da formatação", () => {
    for (const value of [
      "81999990100",
      "(81) 99999-0100",
      "+55 (81) 99999-0100",
      "5581999990100",
    ])
      expect(normalizeClientPhone(value)).toBe("81999990100");
    expect(formatClientPhone("8133334444")).toBe("(81) 3333-4444");
    for (const value of [
      "99999-0100",
      "+55 99999-0100",
      "telefone 81999990100",
      "",
    ])
      expect(normalizeClientPhone(value)).toBe("");
  });
});
