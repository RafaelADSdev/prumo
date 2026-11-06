import { db } from "./db";
import {
  schemas,
  Kind,
  entrySchema,
  paid,
  recurrenceDate,
  settleService,
  serviceReceiptSchema,
} from "./finance";
import { randomUUID } from "node:crypto";
export async function allRecords() {
  return (await db.record.findMany({ orderBy: { createdAt: "asc" } })).map(
    (r) => ({ id: r.id, kind: r.kind, ...JSON.parse(r.data) }),
  );
}
export async function save(
  kind: Kind,
  input: unknown,
  id?: string,
  scope = "one",
  receiptInput?: unknown,
) {
  const data = schemas[kind].parse(input);
  const receipt =
    receiptInput === undefined
      ? undefined
      : serviceReceiptSchema.parse(receiptInput);
  if (receipt && kind !== "service")
    throw Error("Recebimento direto disponível somente em serviços.");
  id = id || (kind === "settings" ? "settings" : randomUUID());
  return db.$transaction(async (tx) => {
    const old = await tx.record.findUnique({ where: { id } });
    if (old && old.kind !== kind) throw Error("Tipo de registro inválido");
    if (
      old &&
      ["client", "service"].includes(kind) &&
      JSON.parse(old.data).archived
    )
      throw Error(
        "Este cadastro foi removido das listas e não pode ser alterado.",
      );
    const persist = async (
      k: string,
      d: unknown,
      key: string,
      action?: string,
    ) => {
      const prev = await tx.record.findUnique({ where: { id: key } });
      await tx.record.upsert({
        where: { id: key },
        create: { id: key, kind: k, data: JSON.stringify(d) },
        update: { data: JSON.stringify(d) },
      });
      await tx.audit.create({
        data: {
          action: action || (prev ? "edit" : "create"),
          entityId: key,
          before: prev?.data,
          after: JSON.stringify(d),
        },
      });
    };
    if (kind === "entry" && old) {
      const prev = JSON.parse(old.data);
      const next = data as any;
      if (
        prev.source !== next.source ||
        prev.serviceId !== next.serviceId ||
        prev.recurrenceId !== next.recurrenceId
      )
        throw Error("Vínculos de origem são preservados");
      if (JSON.stringify(prev.payments) !== JSON.stringify(next.payments))
        throw Error("Use a baixa ou o estorno para alterar pagamentos");
      if (
        prev.serviceId &&
        ["amount", "discount", "description", "competence"].some(
          (k) => prev[k] !== next[k],
        )
      )
        throw Error("Edite valores e descrição no serviço de origem");
    }
    for (const [field, expected] of [
      ["clientId", "client"],
      ["vehicleId", "vehicle"],
      ["employeeId", "employee"],
      ["serviceId", "service"],
      ["recurrenceId", "recurrence"],
    ] as const) {
      const linkedId = (data as any)[field];
      if (linkedId) {
        const linked = await tx.record.findUnique({ where: { id: linkedId } });
        if (!linked || linked.kind !== expected)
          throw Error("Vínculo inválido: " + field);
        if (
          field === "clientId" &&
          kind === "service" &&
          JSON.parse(linked.data).archived &&
          (!old || JSON.parse(old.data).clientId !== linkedId)
        )
          throw Error("O cliente foi removido. Selecione um cliente ativo.");
      }
    }
    await persist(kind, data, id!);
    if (kind === "service") {
      const s = data as any;
      const linked = await tx.record.findUnique({
        where: { id: "service-" + id },
      });
      const prev = linked ? JSON.parse(linked.data) : {};
      const client = await tx.record.findUnique({ where: { id: s.clientId } });
      const amount = s.items.some((i: any) => i.amount === null)
        ? null
        : s.items.reduce((n: number, i: any) => n + i.amount, 0);
      let e = entrySchema.parse({
        ...prev,
        payments:
          receipt?.action === "unpaid"
            ? (prev.payments || []).map((p: any) => ({ ...p, voided: true }))
            : prev.payments || [],
        type: "income",
        description: s.description,
        category: "Serviços",
        amount,
        discount: s.discount,
        competence: s.competence,
        party: client ? JSON.parse(client.data).name : "",
        serviceId: id,
        cancelled: prev.cancelled || s.status === "Cancelado",
        confirmedZero: amount === 0,
      });
      if (receipt) e = settleService(e, receipt, randomUUID());
      await persist(
        "entry",
        e,
        "service-" + id,
        receipt
          ? receipt.action === "unpaid"
            ? "reverse"
            : "payment"
          : undefined,
      );
    }
    if (kind === "payroll") {
      const p = data as any;
      const key = "payroll-" + p.employeeId + "-" + p.competence.slice(0, 7);
      const oldEntry = await tx.record.findUnique({ where: { id: key } });
      const prev = oldEntry ? JSON.parse(oldEntry.data) : {};
      const emp = await tx.record.findUnique({ where: { id: p.employeeId } });
      if (!emp) throw Error("Colaborador não encontrado");
      await persist(
        "entry",
        entrySchema.parse({
          ...prev,
          type: "expense",
          description: "Pagamento de " + JSON.parse(emp.data).name,
          category: "Colaboradores",
          amount: p.base + p.extras,
          discount: p.discount,
          employeeId: p.employeeId,
          competence: p.competence,
          notes: `Base ${p.base}; extras ${p.extras}; descontos ${p.discount} centavos`,
        }),
        key,
      );
    }
    if (kind === "recurrence" && scope === "future") {
      const r = data as any;
      for (const row of await tx.record.findMany({
        where: { kind: "entry" },
      })) {
        const e = JSON.parse(row.data);
        if (
          e.recurrenceId === id &&
          e.competence >= r.start &&
          paid(e) === 0 &&
          !e.cancelled
        ) {
          const date = recurrenceDate(
            Number(e.competence.slice(0, 4)),
            Number(e.competence.slice(5, 7)),
            r.day,
          );
          await persist(
            "entry",
            {
              ...e,
              description: r.description,
              category: r.category,
              amount: r.amount,
              due: date,
            },
            row.id,
          );
        }
      }
    }
    return { id };
  });
}

export async function archive(id: string) {
  return db.$transaction(async (tx) => {
    const record = await tx.record.findUniqueOrThrow({ where: { id } });
    if (record.kind !== "client" && record.kind !== "service")
      throw Error("Este cadastro não pode ser removido por esta ação.");
    const data = JSON.parse(record.data);
    if (data.archived) return { ok: true };
    const next = JSON.stringify({ ...data, archived: true });
    await tx.record.update({ where: { id }, data: { data: next } });
    await tx.audit.create({
      data: {
        action: "archive",
        entityId: id,
        before: record.data,
        after: next,
      },
    });
    return { ok: true };
  });
}
export async function generate(year: number, month: number) {
  return db.$transaction(async (tx) => {
    let count = 0;
    for (const row of await tx.record.findMany({
      where: { kind: "recurrence" },
    })) {
      const r = JSON.parse(row.data);
      const due = recurrenceDate(year, month, r.day),
        competence = due.slice(0, 7) + "-01";
      if (!r.active || due < r.start || (r.end && due > r.end)) continue;
      const id = `recurrence-${row.id}-${year}-${month}`;
      if (await tx.record.findUnique({ where: { id } })) continue;
      const e = entrySchema.parse({
        type: "expense",
        description: r.description,
        category: r.category,
        amount: r.amount,
        competence,
        due,
        recurrenceId: row.id,
      });
      await tx.record.create({
        data: { id, kind: "entry", data: JSON.stringify(e) },
      });
      await tx.audit.create({
        data: { action: "generate", entityId: id, after: JSON.stringify(e) },
      });
      count++;
    }
    return { count };
  });
}
