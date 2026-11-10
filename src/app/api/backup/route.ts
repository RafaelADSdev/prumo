import { guard, failure } from "@/lib/auth";
import { schemas, Kind } from "@/lib/finance";
import { z } from "zod";
const backupSchema = z.object({
  format: z.literal("nautica-finance-v1"),
  records: z
    .array(
      z.object({
        id: z.string().max(200),
        kind: z.enum([
          "entry",
          "service",
          "client",
          "vehicle",
          "employee",
          "category",
          "recurrence",
          "payroll",
          "settings",
        ]),
        data: z.string().max(100000),
      }),
    )
    .max(100000),
  batches: z.array(z.object({ id: z.string(), filename: z.string() })),
  audit: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      entityId: z.string(),
      before: z.string().nullable(),
      after: z.string().nullable(),
      createdAt: z.string().datetime(),
    }),
  ),
});
export async function GET() {
  try {
    const db = await guard();
    const backup = await db.$transaction(async (tx) => ({
      format: "nautica-finance-v1",
      records: await tx.record.findMany(),
      batches: await tx.importBatch.findMany(),
      audit: await tx.audit.findMany(),
    }));
    return new Response(JSON.stringify(backup), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="financeiro-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const db = await guard(true);
    if (Number(req.headers.get("content-length") || 0) > 20000000)
      throw Error("Backup maior que 20 MB");
    const body = await req.json();
    const b = backupSchema.parse(body.backup);
    const ids = new Set<string>();
    for (const r of b.records) {
      if (ids.has(r.id)) throw Error("Identificador repetido");
      ids.add(r.id);
      schemas[r.kind as Kind].parse(JSON.parse(r.data));
    }
    if (body.confirm !== "RESTAURAR")
      return Response.json({ valid: true, count: b.records.length });
    await db.$transaction(
      async (tx) => {
        await tx.record.deleteMany();
        await tx.importBatch.deleteMany();
        await tx.audit.deleteMany();
        await tx.aiProposal.updateMany({
          where: { status: "pending" },
          data: { status: "expired" },
        });
        for (const r of b.records) await tx.record.create({ data: r });
        for (const r of b.batches) await tx.importBatch.create({ data: r });
        for (const a of b.audit)
          await tx.audit.create({
            data: { ...a, createdAt: new Date(a.createdAt) },
          });
        await tx.audit.create({
          data: {
            action: "restore",
            entityId: "database",
            after: JSON.stringify({ count: b.records.length }),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
