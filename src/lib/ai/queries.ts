import type { PrismaClient } from "@prisma/client";
import { tool } from "ai";
import { z } from "zod";
import {
  balance,
  clientAddress,
  date,
  inPeriod,
  money,
  paid,
  schemas,
  serviceAmount,
  status,
  type Client,
  type Entry,
  type Kind,
} from "../finance";
import {
  compareAppointments,
  saoPauloDateTime,
  upcomingAppointments,
} from "../appointments";
import {
  periodLabel,
  reportQuality,
  reportRows,
  summarizeRows,
  type ReportBasis,
} from "../reports";
import type { Source } from "./types";

export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export const brDate = (value: string) => value.split("-").reverse().join("/");

export function matchClients(clients: Client[], query: string, city?: string) {
  const name = normalize(query);
  const location = normalize(city ?? "");
  const active = clients.filter(
    (client) =>
      !client.archived && (!location || normalize(client.city) === location),
  );
  if (!name) return active;
  const exact = active.filter((client) =>
    [client.name, client.nickname].some((v) => normalize(v) === name),
  );
  return exact.length
    ? exact
    : active.filter((client) =>
        [client.name, client.nickname].some((v) => normalize(v).includes(name)),
      );
}

export async function readKind<K extends Kind>(db: PrismaClient, kind: K) {
  const rows = await db.record
    .findMany({ where: { kind }, select: { id: true, data: true } })
    .catch(() => {
      throw Error("Não foi possível consultar os registros deste espaço.");
    });
  return rows.flatMap(({ id, data }) => {
    const parsed = schemas[kind].safeParse(JSON.parse(data));
    return parsed.success
      ? [
          { ...parsed.data, id } as unknown as z.infer<(typeof schemas)[K]> & {
            id: string;
          },
        ]
      : [];
  });
}

export function reportFacts(
  entries: Entry[],
  year: string,
  month: string,
  basis: ReportBasis,
) {
  const summary = summarizeRows(reportRows(entries, year, month, basis));
  let payable = 0;
  let receivable = 0;
  for (const entry of entries) {
    if (
      entry.cancelled ||
      entry.review ||
      !inPeriod(entry.competence, year, month)
    )
      continue;
    const open = balance(entry);
    if (open === null || open <= 0) continue;
    if (entry.type === "expense") payable += open;
    else receivable += open;
  }
  return {
    summary,
    payable,
    receivable,
    quality: reportQuality(entries, year, month),
  };
}

const guide = {
  calendar: [
    "Agenda",
    "Abra a Agenda, escolha um dia no calendário e selecione Agendar serviço. Escolha ou cadastre o cliente e preencha os dados. Em Serviços do dia, use Confirmar serviço para registrar a execução e Dar baixa para registrar o recebimento no financeiro.",
  ],
  services: [
    "Serviços e clientes",
    "Abra Serviços e clientes para cadastrar clientes e serviços ou abrir a ficha de um cliente com o histórico de atendimentos.",
  ],
  entries: [
    "Lançamentos",
    "Use Novo lançamento para cadastrar um compromisso. Abra o lançamento e use Registrar baixa quando o valor for recebido ou pago.",
  ],
  fixed: [
    "Despesas fixas",
    "Cadastre a recorrência com valor, dia e início. Gere as contas para o período e registre as baixas conforme os pagamentos.",
  ],
  vehicles: [
    "Veículos",
    "Abra Veículos para cadastrar um veículo ou registrar despesas de combustível, manutenção e outros custos vinculados.",
  ],
  reports: [
    "Relatórios",
    "Em Relatórios, selecione período e perspectiva. Caixa usa a data da baixa. Competência usa o mês do compromisso. O relatório de serviços pode ser aberto pelo seletor de relatório.",
  ],
  settings: [
    "Configurações",
    "Em Configurações, você encontra cadastros de apoio, importação de planilha, backup e as conexões do Assistente IA.",
  ],
  assistant: [
    "Assistente IA",
    "Envie uma pergunta ou anexe um arquivo e diga o que deseja cadastrar. Confira os campos da proposta e confirme os itens que quiser incluir.",
  ],
} as const;

const recordKinds = [
  "client",
  "service",
  "entry",
  "recurrence",
  "vehicle",
  "category",
  "employee",
  "payroll",
] as const;
const term = z.string().trim().max(160).optional();
const boundary = date.optional();
const limit = z.number().int().min(1).max(12).optional();

export function queryTools(
  db: PrismaClient,
  addSource: (source: Source) => void,
  exact: (text: string) => void,
  clarify: (text: string) => void,
) {
  return {
    consultar_agenda: tool({
      description:
        "Consulta visitas reais. Para próxima visita, use proximas=true e informe nome ou apelido quando o usuário indicou um cliente. Para resolver homônimos, preencha cidade ou o código da ficha indicado na resposta anterior.",
      inputSchema: z.object({
        cliente: term,
        cidade: term,
        ficha: z.string().trim().max(180).optional(),
        proximas: z.boolean(),
        inicio: boundary,
        fim: boundary,
        limite: limit,
        endereco: z.boolean().optional(),
      }),
      execute: async ({
        cliente,
        cidade,
        ficha,
        proximas,
        inicio,
        fim,
        limite,
        endereco,
      }) => {
        if (inicio && fim && inicio > fim)
          return { erro: "O fim deve ser posterior ao início." };
        const clients = await readKind(db, "client");
        const identifiesClient = Boolean(cliente || ficha);
        const matches = matchClients(clients, cliente ?? "", cidade).filter(
          ({ id }) => !ficha || id === ficha || id.slice(-8) === ficha,
        );
        if (identifiesClient && matches.length !== 1) {
          const identify = (client: Client) =>
            [
              client.name,
              client.nickname,
              client.city,
              "ficha " + client.id.slice(-8),
            ]
              .filter(Boolean)
              .join(" · ");
          for (const client of matches.slice(0, 8))
            addSource({
              type: "record",
              kind: "client",
              id: client.id,
              label: identify(client),
            });
          const question = matches.length
            ? `Encontrei mais de um cliente com esses dados. Qual ficha você quer consultar? ${matches
                .slice(0, 8)
                .map(identify)
                .join(", ")}.`
            : "Não encontrei um cliente ativo com esses dados. Você pode informar o nome completo ou o apelido cadastrado?";
          clarify(question);
          return { esclarecimento: question };
        }
        const now = saoPauloDateTime();
        const clientIds = new Set(matches.map(({ id }) => id));
        const services = (await readKind(db, "service")).filter(
          (service) =>
            !service.archived &&
            !!service.date &&
            (!(identifiesClient || cidade) ||
              clientIds.has(service.clientId)) &&
            (!inicio || service.date >= inicio) &&
            (!fim || service.date <= fim),
        );
        const ordered = proximas
          ? upcomingAppointments(services, now.date, now.time)
          : services.sort(compareAppointments);
        const result = ordered
          .slice(0, limite ?? (proximas ? 1 : 6))
          .map((service) => {
            const client = clients.find(({ id }) => id === service.clientId);
            const when = `${brDate(service.date!)} · ${service.appointmentTime || "horário não informado"}`;
            addSource({
              type: "record",
              kind: "service",
              id: service.id,
              visit: true,
              label: `${service.description} · ${when}`,
            });
            return {
              cliente: client?.name ?? "Cliente não informado",
              servico: service.description,
              quando: when,
              situacao: service.status,
              endereco: endereco
                ? service.address || clientAddress(client) || null
                : null,
            };
          });
        const text = result.length
          ? result
              .map(
                (item) =>
                  `${item.cliente} — ${item.servico}: ${item.quando} (${item.situacao})${item.endereco ? ". " + item.endereco : ""}.`,
              )
              .join("\n")
          : "Não encontrei visitas com esse recorte na Agenda.";
        exact(text);
        return { visitas: result, total: ordered.length };
      },
    }),
    buscar_cadastros: tool({
      description:
        "Busca registros por tipo, nome, descrição ou vínculo. Tipos: client cliente; service serviço; entry lançamento; recurrence despesa fixa; vehicle veículo; category categoria; employee colaborador; payroll folha. Use detalhe=true apenas quando o usuário pediu contato, endereço ou observações do cliente.",
      inputSchema: z.object({
        tipo: z.enum(recordKinds),
        busca: term,
        detalhe: z.boolean().optional(),
        inicio: boundary,
        fim: boundary,
        limite: limit,
      }),
      execute: async ({ tipo, busca, detalhe, inicio, fim, limite }) => {
        const query = normalize(busca ?? "");
        const rows = await readKind(db, tipo);
        const people =
          tipo === "service" && query ? await readKind(db, "client") : [];
        const employees =
          tipo === "payroll" && query ? await readKind(db, "employee") : [];
        const matches = rows.filter((item) => {
          if (
            ("archived" in item && item.archived) ||
            ("cancelled" in item && item.cancelled)
          )
            return false;
          const recordDate =
            "date" in item
              ? (item.date ?? item.competence)
              : "competence" in item
                ? item.competence
                : "start" in item
                  ? item.start
                  : "";
          if ((inicio && recordDate < inicio) || (fim && recordDate > fim))
            return false;
          return (
            !query ||
            [
              "name" in item && item.name,
              "nickname" in item && item.nickname,
              "description" in item && item.description,
              "party" in item && item.party,
              "plate" in item && item.plate,
              "category" in item && item.category,
              "clientId" in item &&
                people.find(({ id }) => id === item.clientId)?.name,
              "employeeId" in item &&
                employees.find(({ id }) => id === item.employeeId)?.name,
            ].some(
              (value) =>
                typeof value === "string" && normalize(value).includes(query),
            )
          );
        });
        return {
          total: matches.length,
          registros: matches.slice(0, limite ?? 6).map((item) => {
            const title =
              "name" in item
                ? item.name
                : "description" in item
                  ? item.description
                  : "Pagamento de colaborador";
            addSource({
              type: "record",
              kind: tipo,
              id: item.id,
              label: title,
            });
            if ("nickname" in item)
              return {
                nome: item.name,
                apelido: item.nickname,
                ...(detalhe && {
                  telefone: item.phone || item.contact,
                  endereco: clientAddress({ ...item }),
                  observacoes: item.notes,
                }),
              };
            if ("items" in item) {
              const value = serviceAmount(item.items);
              return {
                descricao: title,
                data: item.date,
                horario: item.appointmentTime ?? null,
                situacao: item.status,
                valor: value === null ? null : money(value - item.discount),
              };
            }
            if ("payments" in item) {
              const open = balance(item);
              return {
                descricao: title,
                tipo: item.type === "income" ? "Receita" : "Despesa",
                categoria: item.category,
                valor:
                  item.amount === null
                    ? null
                    : money(item.amount - item.discount),
                saldo: open === null ? null : money(open),
                pago: money(paid(item)),
                situacao: status(item),
                competencia: item.competence,
                vencimento: item.due,
                parte: item.party,
              };
            }
            if ("base" in item)
              return {
                valor: money(item.base + item.extras - item.discount),
                competencia: item.competence,
              };
            if ("day" in item)
              return {
                descricao: title,
                categoria: item.category,
                valor: money(item.amount),
                dia: item.day,
                inicio: item.start,
                fim: item.end,
                ativa: item.active,
              };
            if ("plate" in item)
              return { nome: item.name, placa: item.plate, modelo: item.model };
            return { nome: title };
          }),
        };
      },
    }),
    consultar_relatorio: tool({
      description:
        "Calcula valores do financeiro. Caixa=cash, competência=accrual. Não adivinhe período nem regime. Use o mês 01 a 12 ou all para ano completo. Para saldo a receber/a pagar use accrual.",
      inputSchema: z.object({
        ano: z.string().regex(/^(?:19\d\d|20\d\d|21\d\d|2200)$/),
        mes: z.string().regex(/^(?:0[1-9]|1[0-2]|all)$/),
        regime: z.enum(["cash", "accrual"]),
        metrica: z.enum([
          "receitas",
          "despesas",
          "resultado",
          "a_receber",
          "a_pagar",
          "resumo",
          "detalhes",
        ]),
        categoria: term,
        pessoa: term,
      }),
      execute: async ({ ano, mes, regime, metrica, categoria, pessoa }) => {
        const basis =
          metrica === "a_receber" || metrica === "a_pagar" ? "accrual" : regime;
        const entries = (await readKind(db, "entry")).filter(
          (item) =>
            (!categoria || normalize(item.category) === normalize(categoria)) &&
            (!pessoa || normalize(item.party).includes(normalize(pessoa))),
        );
        const { summary, receivable, payable, quality } = reportFacts(
          entries,
          ano,
          mes,
          basis,
        );
        const period = periodLabel(ano, mes);
        const label = `${period} · ${basis === "cash" ? "Caixa" : "Competência"}`;
        const selection = [categoria, pessoa].filter(Boolean).join(" · ");
        addSource({
          type: "report",
          year: ano,
          month: mes,
          basis,
          label: `Relatório · ${label}`,
        });
        const amounts = {
          receitas: `Receitas ${money(summary.income)}`,
          despesas: `Despesas ${money(summary.expense)}`,
          resultado: `Resultado ${money(summary.net)}`,
          a_receber: `Saldo atual a receber ${money(receivable)}`,
          a_pagar: `Saldo atual a pagar ${money(payable)}`,
        };
        if (metrica !== "detalhes") {
          const body =
            metrica === "resumo"
              ? [amounts.receitas, amounts.despesas, amounts.resultado].join(
                  "\n",
                )
              : amounts[metrica];
          const gap =
            basis === "accrual" && quality.unresolved
              ? `\n${quality.unresolved} registro(s) a conferir ou sem valor ficaram fora do total.`
              : basis === "cash" && quality.undatedCount
                ? "\nBaixas sem data informada ficam fora do caixa do período."
                : "";
          exact(`${label}${selection ? " · " + selection : ""}\n${body}${gap}`);
        }
        return {
          periodo: label,
          recorte: selection,
          valores: amounts,
          lacunas: quality,
          categorias_de_receita: summary.incomeCategories
            .slice(0, 10)
            .map((row) => ({ nome: row.name, valor: money(row.amount) })),
          categorias_de_despesa: summary.expenseCategories
            .slice(0, 10)
            .map((row) => ({ nome: row.name, valor: money(row.amount) })),
        };
      },
    }),
    ajuda_prumo: tool({
      description: "Explica como usar uma tela do Prumo.",
      inputSchema: z.object({
        tela: z.enum([
          "calendar",
          "services",
          "entries",
          "fixed",
          "vehicles",
          "reports",
          "settings",
          "assistant",
        ]),
      }),
      execute: async ({ tela }) => {
        const [label, text] = guide[tela];
        addSource({ type: "help", page: tela, label });
        return { ajuda: text };
      },
    }),
    pedir_esclarecimento: tool({
      description:
        "Pede a informação que falta, por exemplo nome do cliente, período ou se o usuário quer caixa ou competência.",
      inputSchema: z.object({ pergunta: z.string().min(1).max(400) }),
      execute: async ({ pergunta }) => {
        clarify(pergunta);
        return { pergunta };
      },
    }),
  };
}
