import { z } from "zod";
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    "Data inválida",
  );
export const appointmentTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Horário inválido. Use HH:mm.");
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
export const serviceStatuses = [
  "Agendado",
  "Em andamento",
  "Concluído",
  "Cancelado",
  "A conferir",
] as const;
export const serviceTypes = ["Concertina", "Cerca", "Manutenção"] as const;
const cpf = z
  .string()
  .trim()
  .regex(
    /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})?$/,
    "Informe um CPF com 11 dígitos.",
  )
  .transform((value) => value.replace(/\D/g, ""));
export const paymentMethods = [
  "Pix",
  "Dinheiro",
  "Transferência",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
];
export const schemas = {
  entry: entrySchema,
  client: z.object({
    archived: z.boolean().optional(),
    name: text.min(1),
    cpf: cpf.optional(),
    nickname: text.default(""),
    phone: text.default(""),
    address: text.optional(),
    street: text.default(""),
    number: text.default(""),
    complement: text.default(""),
    neighborhood: text.default(""),
    city: text.default(""),
    state: text.default(""),
    zipCode: text.default(""),
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
    archived: z.boolean().optional(),
    agenda: z.boolean().optional(),
    clientId: text,
    description: text.min(1),
    serviceType: z.enum(serviceTypes).optional(),
    meters: z
      .string()
      .trim()
      .max(50)
      .refine(
        (value) =>
          /^\d+(?:[,.]\d+)?$/.test(value) &&
          Number(value.replace(",", ".")) > 0,
        "Informe a metragem em metros.",
      )
      .optional(),
    date: date.nullable(),
    appointmentTime: appointmentTime.nullable().optional(),
    competence: date,
    status: z.enum(serviceStatuses),
    address: text.optional(),
    method: text.optional(),
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
export type Client = z.infer<typeof schemas.client> & { id: string };
export type Service = z.infer<typeof schemas.service> & { id: string };
export function normalizeClientPhone(value = "") {
  const input = value.trim();
  if (!/^(?:\+55)?[\d().\s-]+$/.test(input)) return "";
  const digits = input.replace(/\D/g, "");
  const hasCountryCode =
    input.startsWith("+55") || (digits.length > 11 && digits.startsWith("55"));
  const local = hasCountryCode ? digits.slice(2) : digits;
  return /^[1-9]\d{9,10}$/.test(local) ? local : "";
}
export function formatClientPhone(value = "") {
  const phone = normalizeClientPhone(value);
  return phone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") || value;
}
export function clientAddress(client?: Omit<Client, "id">) {
  if (!client) return "";
  return (
    client.address?.trim() ||
    [
      [client.street, client.number].filter(Boolean).join(", "),
      client.complement,
      client.neighborhood,
      [client.city, client.state].filter(Boolean).join(" / "),
      client.zipCode,
    ]
      .filter(Boolean)
      .join(" · ")
  );
}
export const serviceInputSchema = schemas.service.extend({
  newClient: schemas.client
    .omit({ archived: true })
    .extend({ name: text.trim().min(1), creationId: z.uuid() })
    .optional(),
  newClientName: text.trim().default(""),
  clientUpdate: z
    .object({
      name: text.trim().min(1).optional(),
      cpf: cpf.optional(),
      phone: text.optional(),
      address: text.optional(),
      notes: text.optional(),
    })
    .optional(),
});
export function formatCpf(value = "") {
  return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}
export function serviceAmount(items: Service["items"]) {
  let total = 0;
  for (const item of items) {
    if (item.amount === null) return null;
    total += item.amount;
  }
  return total;
}
export type Kind = keyof typeof schemas;
export const serviceReceiptSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settle"), date, method: text.trim().min(1) }),
  z.object({ action: z.literal("unpaid") }),
]);
export function settleService(
  entry: z.infer<typeof entrySchema>,
  input: unknown,
  paymentId: string,
) {
  const receipt = serviceReceiptSchema.parse(input);
  if (entry.cancelled)
    throw Error("Não é possível alterar recebimentos de um serviço cancelado.");
  if (receipt.action === "unpaid")
    return entrySchema.parse({
      ...entry,
      payments: entry.payments.map((payment) => ({ ...payment, voided: true })),
    });
  if (entry.amount === null)
    throw Error(
      "Defina o preço de todos os itens antes de marcar o serviço como pago.",
    );
  const remaining = entry.amount - entry.discount - paid(entry);
  return entrySchema.parse({
    ...entry,
    payments:
      remaining > 0
        ? [
            ...entry.payments,
            {
              id: paymentId,
              amount: remaining,
              date: receipt.date,
              method: receipt.method,
              voided: false,
            },
          ]
        : entry.payments,
  });
}
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

function isVehicleExpense(entry: Entry) {
  return (
    Boolean(entry.vehicleId) ||
    ["Combustível", "Manutenção de veículos"].includes(entry.category)
  );
}

// Recorded values include entries awaiting review, independently of cash flow.
export function recordedMonths(entries: Entry[], year: string, month: string) {
  const months = new Map<
    string,
    {
      month: string;
      services: number;
      serviceValue: number;
      expenses: number;
      vehicleExpenses: number;
    }
  >();
  for (const entry of entries) {
    if (entry.cancelled || !inPeriod(entry.competence, year, month)) continue;
    const service =
      entry.type === "income" &&
      (Boolean(entry.serviceId) || entry.category === "Serviços");
    if (!service && entry.type !== "expense") continue;

    const key = entry.competence.slice(5, 7);
    const row = months.get(key) ?? {
      month: key,
      services: 0,
      serviceValue: 0,
      expenses: 0,
      vehicleExpenses: 0,
    };
    const value = entry.amount === null ? 0 : entry.amount - entry.discount;
    if (service) {
      if (entry.serviceId) row.services++;
      row.serviceValue += value;
    } else {
      row.expenses += value;
      if (isVehicleExpense(entry)) row.vehicleExpenses += value;
    }
    months.set(key, row);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// Use a single cohort of expenses so total = paid + outstanding, even when
// payments happen in another month. Cash totals keep their payment-date basis.
export function expenseSummary(entries: Entry[], year: string, month: string) {
  const groups = [
    { name: "Despesas fixas", amount: 0 },
    { name: "Veículos", amount: 0 },
    { name: "Colaboradores", amount: 0 },
    { name: "Demais gastos", amount: 0 },
  ];
  let total = 0,
    paidAmount = 0,
    unresolved = 0;
  for (const entry of entries) {
    if (
      entry.type !== "expense" ||
      entry.cancelled ||
      !inPeriod(entry.competence, year, month)
    )
      continue;
    if (entry.review || entry.amount === null) {
      unresolved++;
      continue;
    }
    const amount = entry.amount - entry.discount;
    total += amount;
    paidAmount += paid(entry);
    const group =
      entry.recurrenceId || entry.category === "Despesas fixas"
        ? 0
        : isVehicleExpense(entry)
          ? 1
          : entry.employeeId || entry.category === "Colaboradores"
            ? 2
            : 3;
    groups[group].amount += amount;
  }
  return {
    total,
    paid: paidAmount,
    outstanding: total - paidAmount,
    unresolved,
    groups,
  };
}
