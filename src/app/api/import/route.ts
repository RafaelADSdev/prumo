import { guard, failure } from "@/lib/auth";

import { prepare } from "@/lib/importer";

import { db } from "@/lib/db";

import { entrySchema } from "@/lib/finance";

export async function POST(req: Request) {
  try {
    await guard(true);
    const form = await req.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 10000000 ||
      !file.name.endsWith(".xlsx")
    )
      throw Error("Selecione uma planilha XLSX de até 10 MB");
    const p = prepare(new Uint8Array(await file.arrayBuffer()), file.name);
    const exists = await db.importBatch.findUnique({ where: { id: p.hash } });
    if (exists)
      throw Error("Este arquivo já foi importado. Nenhum dado foi duplicado.");
    if (form.get("action") !== "confirm") return Response.json(p);
    const edits = JSON.parse(String(form.get("edits") || "[]"));
    const selections = new Map(edits.map((e: any) => [e.key, e]));
    const result = await db.$transaction(
      async (tx) => {
        await tx.importBatch.create({
          data: { id: p.hash, filename: p.filename },
        });
        let count = 0;
        for (const c of p.candidates) {
          const edit: any = selections.get(c.key);
          if (!edit?.selected) continue;
          const id = "import-" + p.hash + "-" + c.key;
          const amount =
            edit.amount === null ? null : (edit.amount ?? c.amount);
          if (c.kind === "legacy" && !edit.resolved)
            throw Error("Concilie os controles antigos antes de selecionar.");
          const source = JSON.stringify({
            file: p.filename,
            batch: p.hash,
            sheet: c.sheet,
            row: c.row,
            original: c.original,
          });
          let serviceId = "";
          if (c.kind === "service") {
            const clientId = id + "-client";
            await tx.record.create({
              data: {
                id: clientId,
                kind: "client",
                data: JSON.stringify({
                  name: c.party,
                  contact: "",
                  notes: source,
                }),
              },
            });
            serviceId = id + "-service";
            await tx.record.create({
              data: {
                id: serviceId,
                kind: "service",
                data: JSON.stringify({
                  clientId,
                  description: c.description,
                  date: c.date,
                  competence: c.competence,
                  due: c.due,
                  status: /finalizado/i.test(c.notes)
                    ? "Concluído"
                    : "A conferir",
                  items: [
                    {
                      description:
                        c.items
                          ?.map((i) => `${i.description}: ${i.quantity}`)
                          .join("; ") || "Serviço",
                      quantity: "",
                      unit: "",
                      amount,
                    },
                  ],
                  discount: 0,
                  notes: c.notes,
                }),
              },
            });
          }
          const e = entrySchema.parse({
            type: c.kind === "expense" ? "expense" : "income",
            description: edit.description || c.description,
            category: c.category,
            amount,
            competence: c.competence,
            due: c.due,
            party: c.party,
            method: c.method,
            serviceId,
            review: !edit.resolved,
            notes: c.notes,
            source,
            payments:
              c.received &&
              c.received > 0 &&
              amount !== null &&
              c.received <= amount
                ? [
                    {
                      id: id + "-received",
                      amount: c.received,
                      date: null,
                      method: c.method,
                      voided: false,
                    },
                  ]
                : [],
            confirmedZero: amount === 0 && !!edit.resolved,
          });
          await tx.record.create({
            data: {
              id: serviceId ? "service-" + serviceId : id,
              kind: "entry",
              data: JSON.stringify(e),
            },
          });
          count++;
        }
        await tx.audit.create({
          data: {
            action: "import",
            entityId: p.hash,
            after: JSON.stringify({ count, reference: p.reference }),
          },
        });
        return count;
      },
      { timeout: 60000 },
    );
    return Response.json({ count: result });
  } catch (e) {
    return failure(e);
  }
}
