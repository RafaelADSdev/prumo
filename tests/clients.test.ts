import { describe, expect, it } from "vitest";
import { schemas } from "../src/lib/finance";

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
  });
});
