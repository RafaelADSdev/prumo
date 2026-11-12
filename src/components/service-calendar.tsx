import { useEffect, useRef, useState, type Ref } from "react";
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
const periods = [
  ...reportMonths.map((label, index) => ({
    value: String(index + 1).padStart(2, "0"),
    label,
    short: shortMonths[index],
  })),
  { value: "all", label: "Total", short: "Total" },
];
const columns = [
  "Data",
  "Cliente",
  "Serviço",
  "Valor",
  "Situação",
  "Observação",
  "Ações",
];
const weekday = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  timeZone: "UTC",
});
const normalize = (value: string) =>
  value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");

type EditService = (service: Service, action?: "confirm" | "settle") => void;

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

function AgendaServiceRow({
  row,
  rowRef,
  onEdit,
}: {
  row: ReturnType<typeof agendaRow>;
  rowRef?: Ref<HTMLTableRowElement>;
  onEdit: EditService;
}) {
  const {
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
  } = row;
  const completed = service.status === "Concluído";
  const canSettle = !cancelled && !settled && value !== 0;
  const payment = settled ? "Pago" : received > 0 ? "Parcial" : "Em aberto";
  const note = service.notes?.trim();
  const longNote = note && (note.length > 120 || note.split("\n").length > 2);

  return (
    <tr
      role="row"
      className="agenda-row"
      ref={rowRef}
      data-focused={!!rowRef || undefined}
      data-has-note={!!note || undefined}
    >
      <td role="cell" className="agenda-date">
        {service.date ? (
          <time dateTime={service.date}>
            {service.date.split("-").reverse().join("/")}
          </time>
        ) : (
          <span className="agenda-meta">Sem data</span>
        )}
        {(service.date || service.appointmentTime) && (
          <small className="agenda-meta agenda-date-meta">
            {service.date && (
              <span>
                {weekday.format(new Date(service.date)).replace("-feira", "")}
              </span>
            )}
            {service.appointmentTime && <span>{service.appointmentTime}</span>}
          </small>
        )}
      </td>
      <th scope="row" role="rowheader" className="agenda-client">
        <span>{name || "Cliente não informado"}</span>
        {cpf && (
          <small className="agenda-meta">
            CPF <span>{cpf}</span>
          </small>
        )}
        {address && <small className="agenda-meta">{address}</small>}
      </th>
      <td role="cell" className="agenda-service">
        <span>{service.serviceType || service.description}</span>
        {meters && <small className="agenda-meta">{meters}</small>}
        {service.serviceType && service.description !== service.serviceType && (
          <small className="agenda-meta">{service.description}</small>
        )}
      </td>
      <td
        role="cell"
        className="agenda-value"
        data-unknown={value === null || undefined}
      >
        {value === null ? "A definir" : money(value).replace("\u00a0", " ")}
      </td>
      <td role="cell" className="agenda-state">
        <div className="agenda-statuses">
          <span
            className="agenda-status"
            data-state={completed ? "done" : "neutral"}
          >
            {service.status}
          </span>
          {!cancelled && (
            <span
              className="agenda-status"
              data-state={settled ? "done" : "pending"}
            >
              {payment}
            </span>
          )}
        </div>
        {!cancelled && received > 0 && !settled && (
          <small className="agenda-meta">{money(received)} recebido</small>
        )}
        {!cancelled && methods && (
          <small className="agenda-meta">{methods}</small>
        )}
      </td>
      <td
        role="cell"
        className="agenda-observation"
        data-empty={!note || undefined}
      >
        <span className="agenda-observation-label">Observação</span>
        {longNote ? (
          <details className="agenda-note">
            <summary>Ver observação</summary>
            <p>{note}</p>
          </details>
        ) : (
          <span className="agenda-note-text">{note || "—"}</span>
        )}
      </td>
      <td role="cell" className="agenda-action-cell">
        <div className="agenda-actions">
          <button
            type="button"
            aria-label="Editar serviço"
            onClick={() => onEdit(service)}
          >
            <Pencil size={14} aria-hidden="true" /> Editar
          </button>
          {!cancelled && !completed && (
            <button
              type="button"
              aria-label="Confirmar serviço"
              onClick={() => onEdit(service, "confirm")}
            >
              <Check size={15} aria-hidden="true" /> Confirmar
            </button>
          )}
          {canSettle && (
            <button
              type="button"
              className="agenda-settle"
              onClick={() => onEdit(service, "settle")}
            >
              Dar baixa
            </button>
          )}
        </div>
      </td>
    </tr>
  );
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
  onEdit: EditService;
}) {
  const [search, setSearch] = useState("");
  const focusedRow = useRef<HTMLTableRowElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
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
        row.service.notes,
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
            unpriced: sum.unpriced + Number(row.value === null),
          },
    { value: 0, received: 0, open: 0, unpriced: 0 },
  );
  const heading =
    month === "all" ? `Total de ${year}` : periodLabel(year, month);
  const hasFocusedRow = matches.some(
    (row) => row.service.id === focusedService,
  );
  useEffect(() => {
    if (hasFocusedRow) focusedRow.current?.scrollIntoView({ block: "nearest" });
  }, [hasFocusedRow, focusedService]);

  return (
    <section className="service-calendar" aria-labelledby="agenda-month">
      <div className="agenda-workbook">
        <div className="agenda-toolbar">
          <div>
            <h2 id="agenda-month">{heading}</h2>
            <p className="agenda-count" aria-live="polite">
              {query ? `${matches.length} de ` : ""}
              {rows.length} {rows.length === 1 ? "serviço" : "serviços"}
            </p>
          </div>
          <div className="agenda-tools">
            <select
              className="agenda-month-select"
              aria-label="Mês da agenda"
              value={month}
              onChange={(event) => onMonth(event.target.value)}
            >
              {periods.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.value === "all" ? "Ano completo" : period.label}
                </option>
              ))}
            </select>
            <label className="agenda-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={searchInput}
                type="search"
                aria-label="Buscar na agenda"
                placeholder="Buscar…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
        </div>
        <div
          className="agenda-months"
          role="group"
          aria-label="Meses da agenda"
        >
          {periods.map((period) => (
            <button
              type="button"
              key={period.value}
              aria-pressed={month === period.value}
              aria-label={period.label}
              onClick={() => onMonth(period.value)}
            >
              {period.short}
            </button>
          ))}
        </div>
        <div
          className="agenda-table-scroll"
          role="region"
          aria-label="Planilha de serviços"
          tabIndex={0}
        >
          <table
            className="agenda-table"
            role="table"
            aria-labelledby="agenda-month"
          >
            <thead role="rowgroup">
              <tr role="row">
                {columns.map((column) => (
                  <th key={column} scope="col" role="columnheader">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {matches.map((row) => (
                <AgendaServiceRow
                  key={row.service.id}
                  row={row}
                  rowRef={
                    row.service.id === focusedService ? focusedRow : undefined
                  }
                  onEdit={onEdit}
                />
              ))}
              {!matches.length && (
                <tr className="agenda-empty" role="row">
                  <td colSpan={columns.length} role="cell">
                    <p>
                      {loading
                        ? "Carregando serviços…"
                        : query
                          ? "Nenhum serviço encontrado."
                          : "Nenhum serviço neste período."}
                    </p>
                    {!loading && query && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          searchInput.current?.focus();
                        }}
                      >
                        Limpar busca
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="agenda-summary">
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
              <dt>A receber</dt>
              <dd>{money(total.open)}</dd>
            </div>
          </dl>
          {total.unpriced > 0 && (
            <p className="agenda-summary-note">
              {total.unpriced === 1
                ? "1 serviço com valor a definir"
                : `${total.unpriced} serviços com valor a definir`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
