import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appointmentTime, schemas } from "../src/lib/finance";
import { decryptApiKey, encryptApiKey } from "../src/lib/ai/credentials";

describe("horário da Agenda", () => {
  it("aceita hora local válida e mantém o cadastro anterior sem horário", () => {
    expect(appointmentTime.parse("09:05")).toBe("09:05");
    expect(appointmentTime.safeParse("24:00").success).toBe(false);
    expect(appointmentTime.safeParse("9:05").success).toBe(false);
    const service = {
      clientId: "cliente",
      description: "Visita",
      date: "2026-11-12",
      competence: "2026-11-01",
      status: "Agendado",
      items: [{ description: "Visita", quantity: "", unit: "", amount: null }],
    };
    expect(schemas.service.parse(service).appointmentTime).toBeUndefined();
  });
});

describe("cofre de chaves do assistente", () => {
  it("protege o segredo e vincula o conteúdo ao provedor e à conta", () => {
    const masterKey = randomBytes(32).toString("base64");
    const secret = "chave-ficticia-openai";
    const encrypted = encryptApiKey(secret, "openai", "primary", masterKey);
    expect(encrypted).not.toContain(secret);
    expect(encryptApiKey(secret, "openai", "primary", masterKey)).not.toBe(
      encrypted,
    );
    expect(decryptApiKey(encrypted, "openai", "primary", masterKey)).toBe(
      secret,
    );
    expect(() =>
      decryptApiKey(encrypted, "google", "primary", masterKey),
    ).toThrow();
    expect(() =>
      decryptApiKey(encrypted, "openai", "outra-conta", masterKey),
    ).toThrow();
    expect(() =>
      decryptApiKey(encrypted, "openai", "primary", "invalid"),
    ).toThrow();
  });
});
