"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Pencil, Plus, ArrowRight } from "lucide-react";
import type { z } from "zod";
import { schemas, money } from "@/lib/finance";

type Client = z.infer<typeof schemas.client> & { id: string };
type Service = {
  id: string;
  description: string;
  date: string | null;
  status: string;
  financialStatus: string;
  receiptSummary?: string;
  amount: number | null;
};
const tabs = ["Contato", "Endereço", "Serviços"] as const;

export function ClientProfile({
  client,
  services,
  onClose,
  onEdit,
  onNewService,
  onEditService,
  onRemove,
}: {
  client: Client;
  services: Service[];
  onClose: () => void;
  onEdit: () => void;
  onNewService: () => void;
  onEditService: (id: string) => void;
  onRemove: () => void;
}) {
  const [tab, setTab] = useState(0);
  const tablist = useRef<HTMLDivElement>(null);
  return (
    <section
      className="panel client-profile"
      aria-label={`Ficha de ${client.name}`}
    >
      <div className="panel-heading">
        <div>
          <h2>{client.name}</h2>
          {client.nickname && <p>Apelido: {client.nickname}</p>}
        </div>
        <div className="client-actions">
          <button type="button" onClick={onEdit}>
            <Pencil size={16} />
            Editar cliente
          </button>
          <button type="button" className="danger" onClick={onRemove}>
            Remover cliente
          </button>
          <button type="button" onClick={onClose}>
            <ArrowLeft size={16} />
            Todos os clientes
          </button>
        </div>
      </div>
      <div
        className="client-tabs"
        role="tablist"
        aria-label="Informações do cliente"
        ref={tablist}
        onKeyDown={(event) => {
          const index =
            event.key === "ArrowRight"
              ? (tab + 1) % tabs.length
              : event.key === "ArrowLeft"
                ? (tab + tabs.length - 1) % tabs.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : null;
          if (index === null) return;
          event.preventDefault();
          setTab(index);
          tablist.current
            ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
            [index]?.focus();
        }}
      >
        {tabs.map((label, index) => (
          <button
            type="button"
            key={label}
            id={`client-tab-${index}`}
            role="tab"
            aria-selected={tab === index}
            aria-controls={`client-panel-${index}`}
            tabIndex={tab === index ? 0 : -1}
            onClick={() => setTab(index)}
          >
            {label}
            {index === 2 && <span>{services.length}</span>}
          </button>
        ))}
      </div>
      <div
        className="client-tab-content"
        role="tabpanel"
        id={`client-panel-${tab}`}
        aria-labelledby={`client-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 0 && (
          <>
            <dl className="client-contact">
              <div>
                <dt>Telefone</dt>
                <dd>{client.phone || "Não informado"}</dd>
              </div>
              <div>
                <dt>Outro contato</dt>
                <dd>{client.contact || "Não informado"}</dd>
              </div>
            </dl>
            <h3>Descrição / observações</h3>
            <p className="client-notes">
              {client.notes || "Nenhuma observação cadastrada."}
            </p>
          </>
        )}
        {tab === 1 && (
          <dl className="client-contact">
            <div>
              <dt>Rua e número</dt>
              <dd>
                {[client.street, client.number].filter(Boolean).join(", ") ||
                  "Não informado"}
              </dd>
            </div>
            <div>
              <dt>Complemento</dt>
              <dd>{client.complement || "Não informado"}</dd>
            </div>
            <div>
              <dt>Bairro</dt>
              <dd>{client.neighborhood || "Não informado"}</dd>
            </div>
            <div>
              <dt>Cidade / estado</dt>
              <dd>
                {[client.city, client.state].filter(Boolean).join(" / ") ||
                  "Não informado"}
              </dd>
            </div>
            <div>
              <dt>CEP</dt>
              <dd>{client.zipCode || "Não informado"}</dd>
            </div>
          </dl>
        )}
        {tab === 2 && (
          <>
            <div className="client-history-heading">
              <p>Histórico completo · todos os períodos</p>
              <button type="button" onClick={onNewService}>
                <Plus size={16} />
                Novo serviço para este cliente
              </button>
            </div>
            {services.length ? (
              <ul className="client-history">
                {services.map((service) => (
                  <li key={service.id}>
                    <button
                      type="button"
                      onClick={() => onEditService(service.id)}
                      aria-label={`Abrir serviço: ${service.description}`}
                    >
                      <span>
                        <strong>{service.description}</strong>
                        <small>
                          {service.date
                            ? service.date.split("-").reverse().join("/")
                            : "Data não informada"}{" "}
                          · {service.status} · {service.financialStatus}
                        </small>
                        {service.receiptSummary && (
                          <small>{service.receiptSummary}</small>
                        )}
                      </span>
                      <span className="client-service-value">
                        {service.amount === null
                          ? "Sem preço"
                          : money(service.amount)}
                        <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="client-empty">
                Nenhum serviço cadastrado para este cliente.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
