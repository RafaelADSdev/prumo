import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { db, workspaceDb } from "./db";
export const hashToken = (v: string) =>
  createHash("sha256")
    .update("prumo-v2:" + v)
    .digest("hex");
export const workspaceId = (id: string) =>
  createHash("sha256").update(id).digest("hex").slice(0, 32);

async function sessionWorkspace() {
  const c = (await cookies()).get("finance-session")?.value;
  const match = c?.match(/^v2\.(primary|[a-f0-9]{32})\.[a-f0-9]{64}$/);
  if (!c || !match) return null;
  const workspace = match[1];
  if (
    workspace !== "primary" &&
    !process.env.SUPABASE_PRUMO_USER_IDS?.split(",").some(
      (id) => workspaceId(id.trim()) === workspace,
    )
  )
    return null;
  const s = await db.session.findUnique({ where: { id: hashToken(c) } });
  return s && s.expires > new Date() ? workspace : null;
}
export async function authenticated() {
  return Boolean(await sessionWorkspace());
}
export async function guardWorkspace(write = false) {
  const workspace = await sessionWorkspace();
  if (!workspace) throw Error("Não autenticado");
  if (write) {
    const h = await headers();
    const origin = h.get("origin");
    if (!origin || new URL(origin).host !== h.get("host"))
      throw Error("Origem inválida");
  }
  return { db: workspaceDb(workspace), workspace };
}
export async function guard(write = false) {
  return (await guardWorkspace(write)).db;
}
export function failure(e: unknown) {
  return Response.json(
    { error: e instanceof Error ? e.message : "Operação inválida" },
    {
      status: e instanceof Error && e.message === "Não autenticado" ? 401 : 400,
    },
  );
}
