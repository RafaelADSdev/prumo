import { guard, failure } from "@/lib/auth";
import { db } from "@/lib/db";
import { allRecords, save, generate } from "@/lib/store";
import { schemas, Kind, entrySchema } from "@/lib/finance";
import { randomUUID } from "node:crypto";
export async function GET() {
  try {
    await guard();
    return Response.json({
      records: await allRecords(),
      audit: await db.audit.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await guard(true);
    const b = await req.json();
    if (b.action === "delete")
      return Response.json(
        await db.$transaction(async (tx) => {
          const old = await tx.record.findUniqueOrThrow({
            where: { id: b.id },
          });
          if (
            ![
              "client",
              "vehicle",
              "employee",
              "category",
              "recurrence",
            ].includes(old.kind)
          )
            throw Error("Este registro deve ser cancelado, não excluído");
          const linked = (await tx.record.findMany()).some(
            (r) => r.id !== b.id && r.data.includes(JSON.stringify(b.id)),
          );
          if (linked)
            throw Error(
              "Há registros vinculados. Preserve o cadastro e edite ou encerre sua recorrência.",
            );
          await tx.record.delete({ where: { id: b.id } });
          await tx.audit.create({
            data: { action: "delete", entityId: b.id, before: old.data },
          });
          return { ok: true };
        }),
      );
    if (b.action === "generate") {
      if (
        !Number.isInteger(b.year) ||
        b.year < 1900 ||
        b.year > 2200 ||
        !Number.isInteger(b.month) ||
        b.month < 1 ||
        b.month > 12
      )
        throw Error("Período inválido");
      return Response.json(await generate(b.year, b.month));
    }
    if (["payment", "reverse", "cancel"].includes(b.action)) {
      return Response.json(
        await db.$transaction(async (tx) => {
          const old = await tx.record.findUniqueOrThrow({
            where: { id: b.id },
          });
          if (old.kind !== "entry") throw Error("Lançamento inválido");
          const e = JSON.parse(old.data);
          if (e.cancelled && b.action !== "cancel")
            throw Error("Lançamento cancelado");
          if (b.action === "payment")
            e.payments.push({
              id: randomUUID(),
              amount: b.amount,
              date: b.date,
              method: b.method,
              voided: false,
            });
          if (b.action === "reverse") {
            const p = e.payments.find((p: any) => p.id === b.paymentId);
            if (!p) throw Error("Baixa não encontrada");
            p.voided = true;
          }
          if (b.action === "cancel") e.cancelled = true;
          const next = entrySchema.parse(e);
          await tx.record.update({
            where: { id: b.id },
            data: { data: JSON.stringify(next) },
          });
          await tx.audit.create({
            data: {
              action: b.action,
              entityId: b.id,
              before: old.data,
              after: JSON.stringify(next),
            },
          });
          return { ok: true };
        }),
      );
    }
    if (!(b.kind in schemas)) throw Error("Tipo inválido");
    return Response.json(await save(b.kind as Kind, b.data, b.id, b.scope));
  } catch (e) {
    return failure(e);
  }
}
