import { z } from "zod";
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    "Data inválida",
  );
const cents = z.number().int().min(0).max(999999999999);
const text = z.string().max(2000);
export const paymentSchema = z.object({
  id: z.string(),
  amount: cents.positive(),
  date: date.nullable(),
  method: text,
  voided: z.boolean().default(false),
});
export const entrySchema = z
  .object({
    type: z.enum(["income", "expense"]),
    description: text.min(1),
    category: text.min(1),
    amount: cents.nullable(),
    discount: cents.default(0),
    competence: date,
    due: date.nullable().default(null),
    party: text.default(""),
    method: text.default(""),
    notes: text.default(""),
    review: z.boolean().default(false),
    confirmedZero: z.boolean().default(false),
    vehicleId: text.default(""),
    employeeId: text.default(""),
    serviceId: text.default(""),
    recurrenceId: text.default(""),
    source: z.string().max(100000).default(""),
    cancelled: z.boolean().default(false),
    payments: z.array(paymentSchema).default([]),
    fuel: z
      .object({
        liters: z.string(),
        odometer: z.string(),
        station: text,
        fuelType: text,
      })
      .optional(),
  })
  .superRefine((e, c) => {
    if (
      e.amount !== null &&
      (e.discount > e.amount || paid(e) > e.amount - e.discount)
    )
      c.addIssue({
        code: "custom",
        message: "Desconto ou baixas ultrapassam o valor devido",
      });
    if (e.amount === null && e.payments.some((p) => !p.voided))
      c.addIssue({
        code: "custom",
        message: "Defina o valor antes de registrar baixas",
      });
    if (e.amount === 0 && !e.confirmedZero)
      c.addIssue({
        code: "custom",
        message: "Confirme explicitamente o valor zero",
      });
  });
export type Entry = z.infer<typeof entrySchema> & { id: string };
export const itemSchema = z.object({
  description: text.min(1),
  quantity: z.string().max(50),
  unit: z.string().max(50),
  amount: cents.nullable(),
});
export const schemas = {
  entry: entrySchema,
  client: z.object({
    name: text.min(1),
    contact: text.default(""),
    notes: text.default(""),
  }),
  vehicle: z.object({
    name: text.min(1),
    model: text.default(""),
    plate: text.default(""),
    notes: text.default(""),
  }),
  employee: z.object({ name: text.min(1) }),
  category: z.object({ name: text.min(1) }),
  service: z.object({
    clientId: text,
    description: text.min(1),
    date: date.nullable(),
    competence: date,
    status: z.enum([
      "Agendado",
      "Em andamento",
      "Concluído",
      "Cancelado",
      "A conferir",
    ]),
    items: z.array(itemSchema).min(1),
    discount: cents.default(0),
    notes: text.default(""),
  }),
  recurrence: z.object({
    description: text.min(1),
    category: text.min(1),
    amount: cents,
    day: z.number().int().min(1).max(31),
    start: date,
    end: date.nullable(),
    active: z.boolean().default(true),
  }),
  payroll: z
    .object({
      employeeId: text.min(1),
      competence: date,
      base: cents,
      extras: cents,
      discount: cents,
    })
    .refine(
      (x) => x.discount <= x.base + x.extras,
      "Desconto superior ao pagamento",
    ),
  settings: z.object({
    name: text,
    years: z.array(z.number().int().min(1900).max(2200)),
    initialBalance: z.number().int().nullable(),
    initialDate: date.nullable(),
    goal: cents.nullable(),
  }),
};
export type Kind = keyof typeof schemas;
export function paid(e: { payments: { amount: number; voided?: boolean }[] }) {
  return e.payments.filter((p) => !p.voided).reduce((a, p) => a + p.amount, 0);
}
export function balance(e: Entry) {
  return e.amount === null ? null : e.amount - e.discount - paid(e);
}
export function status(
  e: Entry,
  today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }),
) {
  if (e.cancelled) return "Cancelado";
  if (e.review) return "A conferir";
  if (e.amount === null) return "Sem valor informado";
  if (balance(e) === 0) return "Quitado";
  if (e.due && e.due < today) return "Vencido";
  if (paid(e) > 0) return "Parcial";
  return "Em aberto";
}
export function money(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n / 100);
}
export function parseMoney(s: string) {
  const normalized = s
    .trim()
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw Error("Valor inválido. Use 1.000,00");
  const [a, b = ""] = normalized.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 999999999999)
    throw Error("Valor muito alto");
  return n;
}
export function inPeriod(d: string | null, year: string, month: string) {
  return !!d && d.startsWith(year + (month === "all" ? "" : "-" + month));
}
export function totals(
  entries: Entry[],
  year: string,
  month: string,
  basis = "cash",
) {
  let income = 0,
    expense = 0;
  const categories: Record<string, number> = {};
  for (const e of entries) {
    if (e.cancelled) continue;
    const n =
      basis === "cash"
        ? e.payments
            .filter((p) => !p.voided && inPeriod(p.date, year, month))
            .reduce((s, p) => s + p.amount, 0)
        : !e.review && inPeriod(e.competence, year, month) && e.amount !== null
          ? e.amount - e.discount
          : 0;
    if (e.type === "income") income += n;
    else {
      expense += n;
      categories[e.category] = (categories[e.category] || 0) + n;
    }
  }
  return { income, expense, net: income - expense, categories };
}
export function recurrenceDate(year: number, month: number, day: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
