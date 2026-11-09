import { useState } from "react";
import { Pencil, Search } from "lucide-react";
import {
  inPeriod,
  money,
  paid,
  serviceAmount,
  serviceStatuses,
  status,
  type Entry,
  type Service,
  type schemas,
} from "@/lib/finance";
import { periodLabel } from "@/lib/reports";
import type { z } from "zod";

type Client = z.infer<typeof schemas.client> & { id: string };
const pageSize = 20;
const formatDate = (date: string) => date.split("-").reverse().join("/");
const normalize = (value: string) =>
  value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");

function clientAddress(client?: Client) {
  if (!client) return "";
  return [
    [client.street, client.number].filter(Boolean).join(", "),
    client.complement,
    client.neighborhood,
    [client.city, client.state].filter(Boolean).join(" / "),
    client.zipCode,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ServiceReport({
  services,
  clients,
  entries,
  year,
  month,
  onEdit,
}: {
  services: Service[];
  clients: Client[];
  entries: Map<string, Entry>;
  year: string;
  month: string;
  onEdit: (service: Service) => void;
}) {
  const [search, setSearch] = useState("");
  const [operation, setOperation] = useState("");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const rows = services
    .filter(
      (service) =>
        !service.archived &&
        inPeriod(service.date || service.competence, year, month),
    )
    .map((service) => {
      const entry = entries.get(service.id);
      const client = clientsById.get(service.clientId);
      const payments = entry?.cancelled
        ? []
        : (entry?.payments.filter((p) => !p.voided) ?? []);
      const expected = service.method ?? entry?.method ?? "";
      const methods = [
        ...new Set(
          [expected, ...payments.map((p) => p.method)].filter(Boolean),
        ),
      ];
      const items = service.items
        .map((item) =>
          [item.description, item.quantity, item.unit]
            .filter(Boolean)
            .join(" "),
        )
        .join(" · ");
      return {
        service,
        client: client?.name || entry?.party || "",
        address: service.address || clientAddress(client),
        entry,
        amount: entry ? entry.amount : serviceAmount(service.items),
        payments,
        expected,
        methods,
        items,
      };
    })
    .sort((a, b) =>
      (b.service.date || b.service.competence).localeCompare(
        a.service.date || a.service.competence,
      ),
    );
  const methods = [...new Set(rows.flatMap((row) => row.methods))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  const selectedMethod = methods.includes(method) ? method : "";
  const query = normalize(search.trim());
  const filtered = rows.filter(
    (row) =>
      (!operation || row.service.status === operation) &&
      (!selectedMethod || row.methods.includes(selectedMethod)) &&
      normalize(
        [
          row.service.description,
          row.client,
          row.address,
          row.items,
          ...row.methods,
        ].join(" "),
      ).includes(query),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  return (
    <section
      className="panel report-service-panel"
      aria-labelledby="report-service-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="report-service-title">Serviços do período</h2>
          <p>
            Filtrado pela data do serviço. Quando faltar o dia, vale o mês de
            referência.
          </p>
        </div>
      </div>
      <div className="toolbar report-service-filters">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Buscar nos serviços do relatório"
            placeholder="Buscar serviço, cliente, endereço…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Situação operacional no relatório"
          value={operation}
          onChange={(e) => {
            setOperation(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as situações</option>
          {serviceStatuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Forma de pagamento no relatório"
          value={selectedMethod}
          onChange={(e) => {
            setMethod(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as formas de pagamento</option>
          {methods.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="report-service-count" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "serviço" : "serviços"} ·{" "}
        {periodLabel(year, month)}
      </div>
      {filtered.length ? (
        <div className="table-scroll">
          <table className="service-report-table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col">Serviço</th>
                <th scope="col">Cliente</th>
                <th scope="col">Endereço</th>
                <th scope="col">Data</th>
                <th scope="col">Preço</th>
                <th scope="col">Pagamento</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {filtered
                .slice((current - 1) * pageSize, current * pageSize)
                .map(
                  ({
                    service,
                    client,
                    address,
                    entry,
                    amount,
                    payments,
                    expected,
                    items,
                  }) => (
                    <tr key={service.id} role="row">
                      <td role="cell">
                        <strong>{service.description}</strong>
                        {items && <small>{items}</small>}
                      </td>
                      <td role="cell" data-label="Cliente">
                        {client || "—"}
                      </td>
                      <td role="cell" data-label="Endereço">
                        {address || "—"}
                      </td>
                      <td role="cell" data-label="Data">
                        {service.date ? (
                          formatDate(service.date)
                        ) : (
                          <>
                            <span>Dia não informado</span>
                            <small>
                              {service.competence.slice(5, 7)}/
                              {service.competence.slice(0, 4)}
                            </small>
                          </>
                        )}
                      </td>
                      <td role="cell" data-label="Preço">
                        {amount === null
                          ? "A definir"
                          : money(
                              amount - (entry?.discount ?? service.discount),
                            )}
                      </td>
                      <td role="cell" data-label="Pagamento">
                        {payments.map((p) => (
                          <small key={p.id}>
                            {money(p.amount)} ·{" "}
                            {p.method || "Forma não informada"}
                            {p.date && ` · ${formatDate(p.date)}`}
                          </small>
                        ))}
                        {expected && (
                          <small>
                            {entry?.source && !service.method
                              ? "Planilha"
                              : "Previsto"}
                            : {expected}
                          </small>
                        )}
                        {!payments.length && !expected && "—"}
                      </td>
                      <td role="cell" data-label="Situação">
                        <span className="status">{service.status}</span>
                        {entry && !entry.cancelled && (
                          <small>
                            {status(entry)}
                            {paid(entry) > 0 &&
                              ` · ${money(paid(entry))} recebido`}
                          </small>
                        )}
                      </td>
                      <td role="cell">
                        <button
                          className="icon-button"
                          aria-label={`Editar serviço: ${service.description}`}
                          onClick={() => onEdit(service)}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="report-service-count">
          Nenhum serviço para os filtros selecionados.
        </p>
      )}
      {pages > 1 && (
        <div className="report-service-pages">
          <button disabled={current === 1} onClick={() => setPage(current - 1)}>
            Anterior
          </button>
          <span>
            Página {current} de {pages}
          </span>
          <button
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </section>
  );
}
