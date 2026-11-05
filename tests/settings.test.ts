import { describe, expect, it } from "vitest";
import { schemas } from "../src/lib/finance";

const settings = {
  name: "",
  years: [2026],
  initialBalance: null,
  initialDate: null,
  goal: null,
};

describe("Organização opcional", () => {
  it("permite salvar preferências sem definir uma organização", () => {
    expect(schemas.settings.parse(settings).name).toBe("");
  });
  it("preserva o nome informado pelo usuário", () => {
    expect(
      schemas.settings.parse({ ...settings, name: "Minha empresa" }).name,
    ).toBe("Minha empresa");
  });
});
