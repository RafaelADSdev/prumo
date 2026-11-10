import { serviceStatuses } from "../finance";
import type { DraftKind } from "./types";

type Link = "client" | "vehicle" | "employee" | "recurrence";
export type FieldSpec = {
  key: string;
  label: string;
  type?:
    | "text"
    | "notes"
    | "date"
    | "month"
    | "time"
    | "money"
    | "integer"
    | "select"
    | "check"
    | "link"
    | "items";
  required?: boolean;
  options?: ReadonlyArray<readonly [string, string]>;
  target?: Link;
};

const name: FieldSpec = { key: "name", label: "Nome", required: true };
const notes: FieldSpec = { key: "notes", label: "Observações", type: "notes" };
const description: FieldSpec = {
  key: "description",
  label: "Descrição",
  required: true,
};
const category: FieldSpec = {
  key: "category",
  label: "Categoria",
  required: true,
};
const competence: FieldSpec = {
  key: "competence",
  label: "Competência",
  type: "month",
  required: true,
};
const amount: FieldSpec = { key: "amount", label: "Valor (R$)", type: "money" };
const discount: FieldSpec = {
  key: "discount",
  label: "Desconto (R$)",
  type: "money",
};
const method: FieldSpec = {
  key: "method",
  label: "Forma prevista de pagamento",
};
const serviceFields: FieldSpec[] = [
  { key: "clientId", label: "Cliente", type: "link", target: "client" },
  description,
  { key: "date", label: "Dia do serviço", type: "date" },
  { key: "appointmentTime", label: "Horário", type: "time" },
  {
    key: "status",
    label: "Situação",
    type: "select",
    options: serviceStatuses.map((value) => [value, value]),
  },
  { key: "address", label: "Endereço do serviço" },
  method,
  discount,
  notes,
  { key: "items", label: "Itens do serviço", type: "items", required: true },
];

export const draftCatalog: Record<
  DraftKind,
  { label: string; fields: FieldSpec[] }
> = {
  client: {
    label: "Cliente",
    fields: [
      name,
      { key: "nickname", label: "Apelido" },
      { key: "phone", label: "Telefone" },
      { key: "contact", label: "Contato" },
      { key: "street", label: "Rua" },
      { key: "number", label: "Número" },
      { key: "complement", label: "Complemento" },
      { key: "neighborhood", label: "Bairro" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "Estado" },
      { key: "zipCode", label: "CEP" },
      notes,
    ],
  },
  service: { label: "Serviço", fields: [...serviceFields, competence] },
  visit: {
    label: "Visita na Agenda",
    fields: serviceFields.map((field) =>
      ["clientId", "date"].includes(field.key)
        ? { ...field, required: true }
        : field,
    ),
  },
  entry: {
    label: "Lançamento",
    fields: [
      {
        key: "type",
        label: "Tipo",
        type: "select",
        required: true,
        options: [
          ["income", "Receita"],
          ["expense", "Despesa"],
        ],
      },
      description,
      category,
      amount,
      {
        key: "competence",
        label: "Data de competência",
        type: "date",
        required: true,
      },
      { key: "due", label: "Vencimento", type: "date" },
      { key: "party", label: "Cliente ou fornecedor" },
      method,
      discount,
      notes,
      { key: "vehicleId", label: "Veículo", type: "link", target: "vehicle" },
      {
        key: "employeeId",
        label: "Colaborador",
        type: "link",
        target: "employee",
      },
      {
        key: "recurrenceId",
        label: "Recorrência",
        type: "link",
        target: "recurrence",
      },
      { key: "liters", label: "Litros" },
      { key: "odometer", label: "Quilometragem" },
      { key: "station", label: "Posto" },
      { key: "fuelType", label: "Combustível" },
      { key: "review", label: "Marcar como a conferir", type: "check" },
      { key: "confirmedZero", label: "Confirmo valor zero", type: "check" },
    ],
  },
  recurrence: {
    label: "Despesa fixa",
    fields: [
      description,
      category,
      { ...amount, required: true },
      {
        key: "day",
        label: "Dia do vencimento",
        type: "integer",
        required: true,
      },
      { key: "start", label: "Início", type: "date", required: true },
      { key: "end", label: "Fim", type: "date" },
      { key: "active", label: "Recorrência ativa", type: "check" },
    ],
  },
  vehicle: {
    label: "Veículo",
    fields: [
      name,
      { key: "model", label: "Modelo" },
      { key: "plate", label: "Placa" },
      notes,
    ],
  },
  category: { label: "Categoria", fields: [name] },
  employee: { label: "Colaborador", fields: [name] },
  payroll: {
    label: "Lançamento de colaborador",
    fields: [
      {
        key: "employeeId",
        label: "Colaborador",
        type: "link",
        target: "employee",
        required: true,
      },
      competence,
      { key: "base", label: "Valor base (R$)", type: "money", required: true },
      { key: "extras", label: "Extras (R$)", type: "money" },
      discount,
    ],
  },
};

export const draftKinds = Object.keys(draftCatalog) as [
  DraftKind,
  ...DraftKind[],
];
export const maxDraftItems = 25;
