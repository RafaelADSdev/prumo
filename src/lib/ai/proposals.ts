import { randomUUID } from "node:crypto";
import type { AiProposal, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { parseMoney, schemas, type Kind } from "../finance";
import { save } from "../store";
import type { Attachment } from "./attachments";
import { draftCatalog, draftKinds, maxDraftItems } from "./draft-fields";
import { AiError, hasCode } from "./errors";
import { normalize } from "./queries";
import type {
  DraftItem,
  DraftKind,
  DraftValue,
  Proposal,
  Source,
} from "./types";

const fieldText = z.string().trim().max(2000);
const lineSchema = z.object({
  description: fieldText,
  quantity: fieldText.max(50),
  unit: fieldText.max(50),
  amount: fieldText.max(35),
});
const draftLineList = z.array(lineSchema).max(20);
const draftData = z.record(
  z.string().max(36),
  z.union([fieldText, z.boolean(), draftLineList]),
);
const modelItems = z
  .array(
    z.object({
      tipo: z.enum(draftKinds),
      origem: z.string().max(180),
      campos: z
        .array(z.object({ campo: z.string().max(36), valor: fieldText }))
        .max(32),
      itensServico: draftLineList.optional(),
      incertezas: z.array(z.string().max(200)).max(5).optional(),
    }),
  )
  .min(1)
  .max(maxDraftItems);
export const modelProposalSchema = z.object({ itens: modelItems });
export const editProposalSchema = z.object({
  version: z.number().int().positive(),
  items: z
    .array(z.object({ id: z.uuid(), selected: z.boolean(), data: draftData }))
    .max(maxDraftItems),
});

type RecordData = { id: string; kind: string; data: Record<string, unknown> };
type DraftContext = Pick<Prisma.TransactionClient, "record" | "audit">;

function cleanData(kind: DraftKind, data: Record<string, DraftValue>) {
  const clean: DraftItem["data"] = {};
  for (const field of draftCatalog[kind].fields) {
    const value = data[field.key];
    if (field.type === "items")
      clean[field.key] = Array.isArray(value) ? value : [];
    else if (field.type === "check")
      clean[field.key] = value === true || value === "true";
    else clean[field.key] = typeof value === "string" ? value.trim() : "";
  }
  return clean;
}

export function proposalView(row: AiProposal): Proposal {
  return {
    id: row.id,
    turnId: row.turnId,
    filename: row.filename,
    version: row.version,
    status: row.status as Proposal["status"],
    items: JSON.parse(row.items),
    receipt: row.receipt ? JSON.parse(row.receipt) : null,
  };
}

async function draftRecords(db: DraftContext): Promise<RecordData[]> {
  const rows = await db.record.findMany({
    where: {
      kind: {
        in: [
          "client",
          "vehicle",
          "employee",
          "recurrence",
          "category",
          "service",
          "entry",
          "payroll",
        ],
      },
    },
    select: { id: true, kind: true, data: true },
  });
  return rows
    .map((row) => ({ ...row, data: JSON.parse(row.data) }))
    .filter(({ data }) => !data.archived && !data.cancelled);
}

export const recordKind = (kind: DraftKind) =>
  kind === "visit" ? "service" : kind;
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const lower = (value: unknown) => normalize(text(value));

function toCents(value: DraftValue | undefined) {
  const raw = text(value);
  if (!raw) return null;
  if (!/^(?:R\$\s*)?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw))
    throw new AiError(
      "Use o formato brasileiro para valores, por exemplo 1.250,00.",
      422,
    );
  return parseMoney(raw);
}

function looksSimilar(item: DraftItem, record: RecordData) {
  if (record.kind !== recordKind(item.kind)) return false;
  const target = item.data;
  const existing = record.data;
  if (item.kind === "vehicle" && lower(target.plate))
    return lower(target.plate) === lower(existing.plate);
  if (lower(target.name)) return lower(target.name) === lower(existing.name);
  if (
    !lower(target.description) ||
    lower(target.description) !== lower(existing.description)
  )
    return false;
  if (item.kind === "entry") {
    try {
      return (
        existing.type === target.type &&
        text(existing.competence).slice(0, 7) ===
          text(target.competence).slice(0, 7) &&
        existing.amount === toCents(target.amount)
      );
    } catch {
      return false;
    }
  }
  if (item.kind === "service" || item.kind === "visit")
    return Boolean(target.date) && existing.date === target.date;
  return item.kind === "recurrence" && existing.start === target.start;
}

export async function prepareProposal(
  db: DraftContext,
  attachment: Attachment,
  input: z.infer<typeof modelProposalSchema>,
) {
  const [records, imports] = await Promise.all([
    draftRecords(db),
    db.audit.findMany({
      where: { action: "ai-import", entityId: attachment.hash },
      select: { after: true },
    }),
  ]);
  const existingIds = new Set(records.map(({ id }) => id));
  const previous = new Set<string>();
  for (const { after } of imports) {
    try {
      const { records } = JSON.parse(after ?? "{}") as {
        records?: { id: string; kind: string; location: string }[];
      };
      for (const record of records ?? [])
        if (existingIds.has(record.id))
          previous.add(record.kind + ":" + record.location);
    } catch {
      // Audit entries from earlier backups may not have an item list.
    }
  }

  const items = input.itens.map((candidate): DraftItem => {
    const block = attachment.blocks.find(
      (block) => block.location === candidate.origem,
    );
    const data = cleanData(candidate.tipo, {
      ...(candidate.tipo === "recurrence" && { active: true }),
      ...(candidate.tipo === "service" && { status: "A conferir" }),
      ...(candidate.tipo === "visit" && { status: "Agendado" }),
      ...Object.fromEntries(
        candidate.campos.map(({ campo, valor }) => [campo, valor]),
      ),
      items: candidate.itensServico ?? [],
    });
    const warnings = [...(candidate.incertezas ?? [])];
    if (!block)
      warnings.push(
        "Confira a origem. O trecho indicado não pôde ser localizado.",
      );
    if (block?.uncertain)
      warnings.push("Confira os campos lidos deste trecho.");
    if (candidate.tipo === "entry" && !data.amount)
      warnings.push("O lançamento está sem valor informado.");
    if (candidate.tipo === "service" || candidate.tipo === "visit") {
      if (Array.isArray(data.items) && !data.items.length)
        data.items = [
          {
            description: text(data.description),
            quantity: "",
            unit: "",
            amount: "",
          },
        ];
    }
    const item: DraftItem = {
      id: randomUUID(),
      kind: candidate.tipo,
      location: block?.location ?? "Origem a conferir",
      data,
      selected: true,
      warnings,
    };
    if (
      previous.has(item.kind + ":" + item.location) ||
      records.some((record) => looksSimilar(item, record))
    ) {
      warnings.push(
        "Possível duplicata. Compare com o cadastro existente antes de selecionar.",
      );
      item.selected = false;
    }
    return item;
  });

  for (const item of items) {
    for (const field of draftCatalog[item.kind].fields) {
      if (field.type !== "link") continue;
      const query = lower(item.data[field.key]);
      if (!query) continue;
      const hasName = (data: Record<string, unknown>) =>
        [data.name, data.nickname, data.plate, data.description].some(
          (value) => lower(value) === query,
        );
      const existing = records.filter(
        (record) =>
          record.kind === field.target &&
          (record.id === query || hasName(record.data)),
      );
      const proposed = items.filter(
        (candidate) =>
          candidate.kind === field.target && hasName(candidate.data),
      );
      item.data[field.key] = "";
      if (existing.length + proposed.length === 1) {
        item.data[field.key] = existing.length
          ? "record:" + existing[0].id
          : "draft:" + proposed[0].id;
      } else {
        item.warnings.push(
          `${field.label} sugerido: ${query}. Confira o vínculo na revisão.`,
        );
      }
    }
  }
  return items;
}

function reviewedData(
  item: DraftItem,
  targets: Map<string, DraftItem>,
  ids: Map<string, string>,
  filename: string,
  fileHash: string,
) {
  const data: Record<string, unknown> = {};
  for (const field of draftCatalog[item.kind].fields) {
    const value = item.data[field.key];
    if (field.required && (!value || (Array.isArray(value) && !value.length)))
      throw new AiError(`Preencha ${field.label}.`, 422);
    switch (field.type) {
      case "link": {
        const [source, ...parts] = text(value).split(":");
        const id = parts.join(":");
        if (!source) data[field.key] = "";
        else if (source === "record" && id) data[field.key] = id;
        else if (
          source === "draft" &&
          targets.get(id)?.kind === field.target &&
          ids.has(id)
        )
          data[field.key] = ids.get(id);
        else
          throw new AiError(
            `Selecione o cadastro vinculado em ${field.label} ou escolha um registro existente.`,
            422,
          );
        break;
      }
      case "month":
        data[field.key] = text(value).length === 7 ? value + "-01" : value;
        break;
      case "date":
      case "time":
        data[field.key] = text(value) || null;
        break;
      case "money":
        data[field.key] = toCents(value) ?? (field.key === "amount" ? null : 0);
        break;
      case "integer":
        data[field.key] = /^\d+$/.test(text(value)) ? Number(value) : NaN;
        break;
      case "check":
        data[field.key] = value === true;
        break;
      case "items":
        data[field.key] = (Array.isArray(value) ? value : []).map((line) => ({
          ...line,
          amount: toCents(line.amount),
        }));
        break;
      default:
        data[field.key] = text(value);
    }
  }
  if (item.kind === "visit") {
    data.agenda = true;
    data.competence = text(data.date).slice(0, 7) + "-01";
  }
  if (
    item.kind === "recurrence" &&
    data.end &&
    text(data.end) < text(data.start)
  )
    throw new AiError(
      "O fim da recorrência deve ser posterior ao início.",
      422,
    );
  if (item.kind === "entry") {
    const fuel = {
      liters: data.liters,
      odometer: data.odometer,
      station: data.station,
      fuelType: data.fuelType,
    };
    if (Object.values(fuel).some(Boolean)) data.fuel = fuel;
    if (data.recurrenceId && data.type !== "expense")
      throw new AiError("Vincule a recorrência a uma despesa.", 422);
    data.source = JSON.stringify({
      file: filename,
      location: item.location,
      batch: fileHash,
      via: "assistant",
    });
    data.payments = [];
  }
  const parsed = schemas[recordKind(item.kind)].safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const label = draftCatalog[item.kind].fields.find(
      ({ key }) => key === issue.path[0],
    )?.label;
    throw new AiError(label ? `Confira o campo ${label}.` : issue.message, 422);
  }
  return parsed.data;
}

export async function reviseProposal(
  db: PrismaClient,
  id: string,
  input: z.infer<typeof editProposalSchema>,
) {
  const row = await db.aiProposal.findUnique({ where: { id } });
  if (!row) throw new AiError("Proposta não encontrada.", 404);
  const current = proposalView(row);
  if (current.status !== "pending" || current.version !== input.version)
    throw staleProposal();
  const edits = new Map(input.items.map((item) => [item.id, item]));
  if (
    edits.size !== current.items.length ||
    input.items.length !== current.items.length
  )
    throw new AiError("Abra novamente a revisão e tente salvar.");
  const items = current.items.map((item) => {
    const edit = edits.get(item.id);
    if (!edit) throw new AiError("Item de revisão inválido.");
    return {
      ...item,
      selected: edit.selected,
      data: cleanData(item.kind, edit.data),
    };
  });
  const result = await db.aiProposal.updateMany({
    where: { id, status: "pending", version: input.version },
    data: { items: JSON.stringify(items), version: { increment: 1 } },
  });
  if (!result.count) throw staleProposal();
  return { ...current, items, version: input.version + 1 };
}

const staleProposal = () =>
  new AiError(
    "Esta proposta mudou ou foi encerrada. Reabra a conversa para conferir.",
    409,
  );
const insertionOrder: Record<DraftKind, number> = {
  client: 0,
  category: 0,
  vehicle: 0,
  employee: 0,
  recurrence: 1,
  service: 2,
  visit: 2,
  entry: 3,
  payroll: 3,
};

export async function confirmProposal(
  db: PrismaClient,
  id: string,
  version: number,
): Promise<Proposal> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const row = await tx.aiProposal.findUnique({ where: { id } });
          if (!row) throw new AiError("Proposta não encontrada.", 404);
          const current = proposalView(row);
          if (current.status === "confirmed") return current;
          if (current.status !== "pending" || current.version !== version)
            throw staleProposal();
          const selected = current.items.filter(({ selected }) => selected);
          if (!selected.length)
            throw new AiError("Selecione pelo menos um item da proposta.", 422);
          const updated = await tx.aiProposal.updateMany({
            where: { id, status: "pending", version },
            data: { status: "confirmed" },
          });
          if (!updated.count) throw staleProposal();
          const targets = new Map(selected.map((item) => [item.id, item]));
          const ids = new Map(
            selected.map((item) => [item.id, "ai-" + item.id]),
          );
          const results: { id: string; kind: DraftKind; location: string }[] =
            [];
          const receipt: Source[] = [];
          for (const item of selected.sort(
            (a, b) => insertionOrder[a.kind] - insertionOrder[b.kind],
          )) {
            const kind = recordKind(item.kind) as Exclude<Kind, "settings">;
            let recordId = ids.get(item.id)!;
            try {
              const data = reviewedData(
                item,
                targets,
                ids,
                row.filename,
                row.fileHash,
              );
              if (
                kind === "entry" &&
                "recurrenceId" in data &&
                data.recurrenceId
              ) {
                const [year, month] = data.competence.split("-");
                recordId = `recurrence-${data.recurrenceId}-${year}-${Number(month)}`;
              }
              await save(tx, kind, data, recordId, "one", undefined, {
                createOnly: true,
              });
              results.push({
                id: recordId,
                kind: item.kind,
                location: item.location,
              });
              receipt.push({
                type: "record",
                kind,
                id: recordId,
                visit: item.kind === "visit",
                label:
                  text(item.data.name) ||
                  text(item.data.description) ||
                  draftCatalog[item.kind].label,
              });
            } catch (error) {
              if (error instanceof Error && !error.name.startsWith("Prisma")) {
                throw new AiError(
                  `${draftCatalog[item.kind].label} (${item.location}). ${error.message}`,
                  422,
                );
              }
              throw error;
            }
          }
          await tx.audit.create({
            data: {
              action: "ai-import",
              entityId: row.fileHash,
              after: JSON.stringify({
                proposalId: id,
                file: row.filename,
                records: results,
              }),
            },
          });
          await tx.aiProposal.update({
            where: { id },
            data: { receipt: JSON.stringify(receipt) },
          });
          return { ...current, status: "confirmed", receipt };
        },
        { isolationLevel: "Serializable", timeout: 20_000 },
      );
    } catch (error) {
      if (attempt < 2 && (hasCode(error, "P2034") || hasCode(error, "P1008")))
        continue;
      throw error;
    }
  }
}

export async function discardProposal(
  db: PrismaClient,
  id: string,
  version: number,
) {
  const result = await db.aiProposal.updateMany({
    where: { id, status: "pending", version },
    data: { status: "discarded", version: { increment: 1 } },
  });
  if (!result.count) throw staleProposal();
}
