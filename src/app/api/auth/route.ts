import { db } from "@/lib/db";
import { hashToken, failure, guard } from "@/lib/auth";
import { compare } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
let attempts: { at: number }[] = [];
export async function POST(req: Request) {
  try {
    if (
      new URL(req.headers.get("origin") || "http://invalid").host !==
      req.headers.get("host")
    )
      throw Error("Origem inválida");
    attempts = attempts.filter((a) => Date.now() - a.at < 60000);
    if (attempts.length >= 10)
      return Response.json(
        { error: "Aguarde um minuto para tentar novamente." },
        { status: 429 },
      );
    attempts.push({ at: Date.now() });
    const { email, password } = await req.json();
    const a = await db.admin.findUnique({ where: { id: 1 } });
    if (
      !a ||
      email !== a.email ||
      typeof password !== "string" ||
      !(await compare(password, a.hash))
    )
      throw Error("E-mail ou senha incorretos");
    const token = randomBytes(32).toString("hex");
    await db.session.create({
      data: { id: hashToken(token), expires: new Date(Date.now() + 86400000) },
    });
    (await cookies()).set("finance-session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge: 86400,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE() {
  try {
    await guard(true);
    const c = await cookies();
    const token = c.get("finance-session")?.value;
    if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
    c.delete("finance-session");
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
