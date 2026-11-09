import {
  balance,
  clientAddress,
  money,
  paid,
  serviceAmount,
  status,
  type Client,
  type Entry,
  type Service,
} from "@/lib/finance";

export function ServiceAppointment({
  service,
  client,
  entry,
  onEdit,
}: {
  service: Service;
  client?: Client;
  entry?: Entry;
  onEdit: (service: Service, status?: Service["status"]) => void;
}) {
  const amount = entry ? entry.amount : serviceAmount(service.items);
  const discount = entry?.discount ?? service.discount;
  const method = service.method ?? entry?.method;
  const openBalance = entry && !entry.cancelled ? balance(entry) : null;
  const payments = entry?.payments ?? [];
  const canConfirm =
    service.status === "Agendado" || service.status === "Em andamento";

  return (
    <li>
      <span className="status">{service.status}</span>
      <h3>{service.description}</h3>
      <dl className="appointment-details">
        <div>
          <dt>Cliente</dt>
          <dd>{client?.name || entry?.party || "Não informado"}</dd>
        </div>
        {(client?.phone || client?.contact) && (
          <div>
            <dt>Contato</dt>
            <dd>
              {[client.contact, client.phone].filter(Boolean).join(" · ")}
            </dd>
          </div>
        )}
        <div className="appointment-wide">
          <dt>Endereço do serviço</dt>
          <dd>{service.address || clientAddress(client) || "Não informado"}</dd>
        </div>
        <div className="appointment-wide">
          <dt>Itens do serviço</dt>
          <dd>
            <ul className="appointment-items">
              {service.items.map((item, index) => (
                <li key={index}>
                  <span>
                    {[
                      item.description,
                      [item.quantity, item.unit].filter(Boolean).join(" "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span>
                    {item.amount === null
                      ? "Preço a definir"
                      : money(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Valor total</dt>
          <dd>{amount === null ? "A definir" : money(amount - discount)}</dd>
          {discount > 0 && (
            <dd className="muted">Desconto de {money(discount)}</dd>
          )}
        </div>
        <div>
          <dt>Forma prevista de pagamento</dt>
          <dd>{method || "Não informada"}</dd>
        </div>
        {entry && (
          <div className="appointment-wide">
            <dt>Situação financeira</dt>
            <dd>
              {status(entry)}
              {openBalance !== null && (
                <>
                  {" "}
                  · {money(paid(entry))} recebido · {money(openBalance)} em
                  aberto
                </>
              )}
            </dd>
          </div>
        )}
        {payments.length > 0 && (
          <div className="appointment-wide">
            <dt>Histórico de recebimentos</dt>
            <dd>
              <ul className="appointment-items">
                {payments.map((payment) => (
                  <li key={payment.id}>
                    <span>
                      {payment.method || "Forma não informada"} ·{" "}
                      {payment.date?.split("-").reverse().join("/") ||
                        "Data não informada"}
                      {payment.voided && " · Estornado"}
                    </span>
                    <span>{money(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {service.notes && (
          <div className="appointment-wide">
            <dt>Observações</dt>
            <dd className="appointment-notes">{service.notes}</dd>
          </div>
        )}
      </dl>
      <div className="service-actions">
        {canConfirm && (
          <button onClick={() => onEdit(service, "Concluído")}>
            Confirmar serviço
          </button>
        )}
        {canConfirm && (
          <button onClick={() => onEdit(service, "Cancelado")}>
            Cancelar serviço
          </button>
        )}
        <button onClick={() => onEdit(service)}>Editar</button>
      </div>
    </li>
  );
}
