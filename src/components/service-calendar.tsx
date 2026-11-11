import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Search } from "lucide-react";
import { compareAppointments } from "@/lib/appointments";
import {
  clientAddress,
  formatCpf,
  inPeriod,
  money,
  paid,
  serviceAmount,
  type Client,
  type Entry,
  type Service,
} from "@/lib/finance";
import { periodLabel, reportMonths } from "@/lib/reports";

const shortMonths = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const columns = [
  "Dia da semana",
  "Data",
  "Nome do cliente",
  "CPF",
  "Endereço",
  "Serviço",
  "Metragem",
  "Valor",
  "Execução",
  "Pagamento",
  "Ações",
];
const dateLabel = (date: string) => date.split("-").reverse().join("/");
const weekday = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  timeZone: "UTC",
});
const normalize = (value: string) =>
  value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");

function agendaRow(service: Service, client?: Client, entry?: Entry) {
  const amount = entry ? entry.amount : serviceAmount(service.items);
  const value =
    amount === null ? null : amount - (entry?.discount ?? service.discount);
  const received = entry && !entry.cancelled ? paid(entry) : 0;
  const cancelled = service.status === "Cancelado";
  const settled = !!entry && !entry.cancelled && value === received;
  const payments = entry?.cancelled
    ? []
    : (entry?.payments.filter((p) => !p.voided) ?? []);
  const methods = [
    ...new Set(payments.map((p) => p.method).filter(Boolean)),
  ].join(" · ");
  const address = service.address || clientAddress(client);
  const cpf = formatCpf(client?.cpf);
  const name = client?.name || entry?.party || "";
  const meters =
    service.serviceType === "Manutenção"
      ? ""
      : service.meters
        ? service.meters + " m"
        : service.items
            .filter((item) => item.quantity && /^m$/i.test(item.unit.trim()))
            .map((item) => item.quantity + " m")
            .join(" · ");
  return {
    service,
    value,
    received,
    cancelled,
    settled,
    address,
    cpf,
    name,
    meters,
    methods,
  };
}

export function ServiceCalendar({
  year,
  month,
  focusedService,
  services,
  clients,
  entries,
  loading,
  onMonth,
  onEdit,
}: {
  year: string;
  month: string;
  focusedService?: string;
  services: Service[];
  clients: Map<string, Client>;
  entries: Map<string, Entry>;
  loading: boolean;
  onMonth: (month: string) => void;
  onEdit: (service: Service, action?: "confirm" | "settle") => void;
}) {
  const [search, setSearch] = useState("");
  const activeTab = useRef<HTMLButtonElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const focusedRow = useRef<HTMLTableRowElement>(null);
  const rows = services
    .filter(
      (service) =>
        !service.archived &&
        inPeriod(service.date || service.competence, year, month),
    )
    .sort(
      (a, b) =>
        (a.date || a.competence).localeCompare(b.date || b.competence) ||
        compareAppointments(a, b),
    )
    .map((service) =>
      agendaRow(
        service,
        clients.get(service.clientId),
        entries.get(service.id),
      ),
    );
  const query = normalize(search.trim());
  const matches = rows.filter((row) =>
    normalize(
      [
        row.name,
        row.cpf,
        row.cpf.replace(/\D/g, ""),
        row.address,
        row.service.serviceType,
        row.service.description,
      ].join(" "),
    ).includes(query),
  );
  const total = rows.reduce(
    (sum, row) =>
      row.cancelled
        ? sum
        : {
            value: sum.value + (row.value ?? 0),
            received: sum.received + row.received,
            open: sum.open + Math.max(0, (row.value ?? 0) - row.received),
          },
    { value: 0, received: 0, open: 0 },
  );
  const heading =
    month === "all" ? `Total de ${year}` : periodLabel(year, month);
  const hasFocusedRow = matches.some(
    (row) => row.service.id === focusedService,
  );
  useEffect(() => {
    if (hasFocusedRow) focusedRow.current?.scrollIntoView({ block: "nearest" });
  }, [hasFocusedRow, focusedService]);
  useEffect(() => {
    const tab = activeTab.current;
    const list = tabs.current;
    if (!tab || !list) return;
    const button = tab.getBoundingClientRect();
    const viewport = list.getBoundingClientRect();
    if (button.right > viewport.right || button.left < viewport.left)
      list.scrollLeft += button.left - viewport.left;
  }, [month]);

  return (
    <section className="service-calendar" aria-labelledby="agenda-month">
      <div className="agenda-toolbar">
        <label className="agenda-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar na agenda"
            placeholder="Buscar cliente, CPF ou endereço…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span aria-live="polite">
          {query ? `${matches.length} de ` : ""}
          {rows.length} {rows.length === 1 ? "serviço" : "serviços"}
        </span>
      </div>
      <div className="agenda-workbook">
        <h2 id="agenda-month">{heading}</h2>
        <div
          className="agenda-scroll"
          tabIndex={0}
          role="region"
          aria-label="Planilha de serviços"
        >
          <table className="agenda-table" aria-labelledby="agenda-month">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col">
                    <span>{column}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map(
                ({
                  service,
                  value,
                  received,
                  cancelled,
                  settled,
                  address,
                  cpf,
                  name,
                  meters,
                  methods,
                }) => (
                  <tr
                    key={service.id}
                    ref={service.id === focusedService ? focusedRow : undefined}
                    data-focused={service.id === focusedService || undefined}
                  >
                    <td>
                      {service.date
                        ? weekday
                            .format(new Date(service.date))
                            .replace("-feira", "")
                        : "—"}
                    </td>
                    <td>
                      {service.date ? (
                        <time dateTime={service.date}>
                          {dateLabel(service.date)}
                        </time>
                      ) : (
                        "—"
                      )}
                      {service.appointmentTime && (
                        <small>{service.appointmentTime}</small>
                      )}
                    </td>
                    <th scope="row">{name || "—"}</th>
                    <td className="agenda-number">{cpf || "—"}</td>
                    <td>{address || "—"}</td>
                    <td>
                      <span>{service.serviceType || service.description}</span>
                      {service.serviceType &&
                        service.description !== service.serviceType && (
                          <small>{service.description}</small>
                        )}
                    </td>
                    <td>{meters || "—"}</td>
                    <td className="agenda-number">
                      {value === null
                        ? "A definir"
                        : money(value).replace("\u00a0", " ")}
                    </td>
                    <td>
                      <span
                        className="agenda-status"
                        data-done={service.status === "Concluído"}
                      >
                        {service.status}
                      </span>
                    </td>
                    <td>
                      <span className="agenda-status" data-done={settled}>
                        {cancelled
                          ? "—"
                          : settled
                            ? "Pago"
                            : received > 0
                              ? "Parcial"
                              : "Em aberto"}
                      </span>
                      {!cancelled && received > 0 && !settled && (
                        <small>{money(received)} recebido</small>
                      )}
                      {!cancelled && methods && <small>{methods}</small>}
                      {!cancelled && !settled && value !== 0 && (
                        <button
                          className="agenda-settle"
                          onClick={() => onEdit(service, "settle")}
                        >
                          Dar baixa
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="agenda-actions">
                        <button
                          onClick={() => onEdit(service)}
                          title="Editar serviço"
                          aria-label="Editar serviço"
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        {!cancelled && service.status !== "Concluído" && (
                          <button
                            onClick={() => onEdit(service, "confirm")}
                            title="Confirmar serviço"
                            aria-label="Confirmar serviço"
                          >
                            <Check size={16} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
              {!matches.length && (
                <tr className="agenda-empty">
                  <td colSpan={columns.length}>
                    {loading
                      ? "Carregando serviços…"
                      : query
                        ? "Nenhum serviço encontrado."
                        : "Nenhum serviço neste período."}
                  </td>
                </tr>
              )}
              {Array.from(
                { length: Math.max(0, 9 - matches.length) },
                (_, index) => (
                  <tr key={index} className="agenda-blank" aria-hidden="true">
                    {columns.map((column) => (
                      <td key={column} />
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <div
          className="agenda-months"
          ref={tabs}
          role="group"
          aria-label="Meses da agenda"
        >
          {[...reportMonths, "Total"].map((label, index) => {
            const key =
              index === 12 ? "all" : String(index + 1).padStart(2, "0");
            return (
              <button
                key={key}
                ref={month === key ? activeTab : undefined}
                aria-pressed={month === key}
                aria-label={label}
                onClick={() => onMonth(key)}
              >
                {shortMonths[index] ?? label}
              </button>
            );
          })}
        </div>
      </div>
      <dl className="agenda-totals">
        <div>
          <dt>Total {month === "all" ? "do ano" : "do mês"}</dt>
          <dd>{money(total.value)}</dd>
        </div>
        <div>
          <dt>Recebido</dt>
          <dd>{money(total.received)}</dd>
        </div>
        <div>
          <dt>Saldo a receber</dt>
          <dd>{money(total.open)}</dd>
        </div>
      </dl>
    </section>
  );
}
