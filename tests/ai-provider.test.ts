import { afterEach, expect, it, vi } from "vitest";
import { testApiKey } from "../src/lib/ai/provider";
import { providerIds } from "../src/lib/ai/types";
import { fixtureFetch } from "./ai-provider-fixture.mjs";

afterEach(() => vi.unstubAllGlobals());

it.each(providerIds)(
  "testa a conexão de %s pelo adaptador direto",
  async (id) => {
    vi.stubGlobal("fetch", fixtureFetch(globalThis.fetch));
    await expect(
      testApiKey(id, "prumo-chave-teste", new AbortController().signal),
    ).resolves.toBeUndefined();
  },
);

it("omite a mensagem bruta do provedor quando a chave é recusada", async () => {
  vi.stubGlobal("fetch", fixtureFetch(globalThis.fetch));
  await expect(
    testApiKey("openai", "chave-invalida", new AbortController().signal),
  ).rejects.toMatchObject({
    message:
      "O provedor recusou a chave. Confira a chave e o acesso ao modelo.",
  });
});
