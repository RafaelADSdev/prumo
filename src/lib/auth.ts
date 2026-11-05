import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "./db";
export const hashToken = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export async function authenticated() {
  const c = (await cookies()).get("finance-session")?.value;
  if (!c) return false;
  const s = await db.session.findUnique({ where: { id: hashToken(c) } });
  return !!s && s.expires > new Date();
}
export async function guard(write = false) {
  if (!(await authenticated())) throw Error("Não autenticado");
  if (write) {
    const h = await headers();
    const origin = h.get("origin");
    if (!origin || new URL(origin).host !== h.get("host"))
      throw Error("Origem inválida");
  }
}
export function failure(e: unknown) {
  return Response.json(
    { error: e instanceof Error ? e.message : "Operação inválida" },
    {
      status: e instanceof Error && e.message === "Não autenticado" ? 401 : 400,
    },
  );
}
