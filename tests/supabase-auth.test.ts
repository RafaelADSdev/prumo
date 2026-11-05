import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifySupabaseLogin } from "../src/lib/supabase-auth";

const email = "authorized@example.test";
const password = "test-only-password";
const identity = {
  id: "approved-user",
  email,
  email_confirmed_at: "2026-11-05T12:00:00Z",
};
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("SUPABASE_PRUMO_USER_IDS", "approved-user");
  request = vi.fn();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function session(user = identity) {
  request.mockResolvedValueOnce(
    Response.json({ user, access_token: "temporary-provider-token" }),
  );
  request.mockResolvedValueOnce(new Response(null, { status: 204 }));
}

describe("Acesso autorizado do Supabase ao Prumo", () => {
  it("aceita a identidade aprovada e encerra a sessão temporária do provedor", async () => {
    session();
    expect(await verifySupabaseLogin(email, password)).toBe(true);
    expect(String(request.mock.calls[1][0])).toContain(
      "/auth/v1/logout?scope=local",
    );
  });
  it("não concede acesso a outro usuário válido do mesmo Supabase", async () => {
    session({ ...identity, id: "unapproved-user" });
    expect(await verifySupabaseLogin(email, password)).toBe(false);
  });
  it("confere o e-mail retornado pelo provedor", async () => {
    session({ ...identity, email: "someone-else@example.test" });
    expect(await verifySupabaseLogin(email, password)).toBe(false);
  });
  it("rejeita identidade com e-mail não confirmado", async () => {
    session({ ...identity, email_confirmed_at: "" });
    expect(await verifySupabaseLogin(email, password)).toBe(false);
  });
  it("rejeita senha incorreta", async () => {
    request.mockResolvedValue(
      Response.json({ error: "invalid_credentials" }, { status: 400 }),
    );
    expect(await verifySupabaseLogin(email, "wrong-password")).toBe(false);
  });
  it("não consulta o provedor para instalações e testes SQLite", async () => {
    vi.stubEnv("DATABASE_URL", "file:./test.db");
    expect(await verifySupabaseLogin(email, password)).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("nega acesso sem uma lista explícita de usuários aprovados", async () => {
    vi.stubEnv("SUPABASE_PRUMO_USER_IDS", "");
    expect(await verifySupabaseLogin(email, password)).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("não revela a resposta interna quando o provedor está indisponível", async () => {
    request.mockRejectedValue(Error("internal sensitive details"));
    await expect(verifySupabaseLogin(email, password)).rejects.toThrow(
      "Não foi possível validar o acesso",
    );
  });
});
