"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  FileCheck2,
  Plus,
  X,
} from "lucide-react";
import { aiRequest, jsonRequest } from "@/lib/ai/client";
import { draftCatalog, type FieldSpec } from "@/lib/ai/draft-fields";
import type {
  DraftItem,
  DraftKind,
  DraftLine,
  DraftValue,
  Proposal,
  Source,
} from "@/lib/ai/types";

export type ReviewRecord = {
  id: string;
  kind: string;
  name?: string;
  description?: string;
  archived?: boolean;
  city?: string;
};

const overviewFields: Record<DraftKind, string[]> = {
  client: ["phone", "city"],
  visit: ["clientId", "date", "appointmentTime"],
  service: ["clientId", "competence", "status"],
  entry: ["type", "amount", "competence", "category"],
  recurrence: ["amount", "day", "start"],
  vehicle: ["plate", "model"],
  employee: [],
  category: [],
  payroll: ["employeeId", "competence", "base"],
};

function ReviewItemSummary({
  item,
  items,
  records,
}: {
  item: DraftItem;
  items: DraftItem[];
  records: ReviewRecord[];
}) {
  const keys = overviewFields[item.kind];
  if (!keys.length) return null;
  return (
    <dl className="ai-review-summary">
      {keys.map((key) => {
        const field = draftCatalog[item.kind].fields.find(
          (field) => field.key === key,
        )!;
        const value = item.data[key];
        let display = typeof value === "string" ? value : "";
        if (display && field.type === "link") {
          const record = records.find(({ id }) => "record:" + id === display);
          const draft = items.find(({ id }) => "draft:" + id === display);
          display =
            record?.name ||
            record?.description ||
            String(draft?.data.name || draft?.data.description || "");
        }
        if (display && field.type === "select")
          display =
            field.options?.find(([option]) => option === display)?.[1] ?? "";
        if (display && field.type === "money" && !display.startsWith("R$"))
          display = "R$ " + display;
        if (field.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(display))
          display = display.split("-").reverse().join("/");
        if (field.type === "month" && /^\d{4}-\d{2}/.test(display))
          display = display.slice(0, 7).split("-").reverse().join("/");
        return (
          <div key={key}>
            <dt>{field.label}</dt>
            <dd>{display || (field.required ? "A preencher" : "A definir")}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function DraftField({
  field,
  value,
  change,
  items,
  records,
}: {
  field: FieldSpec;
  value: DraftValue | undefined;
  change: (value: DraftValue) => void;
  items: DraftItem[];
  records: ReviewRecord[];
}) {
  const stringValue = typeof value === "string" ? value : "";
  if (field.type === "items") {
    const lines: DraftLine[] = Array.isArray(value) ? value : [];
    return (
      <fieldset className="ai-review-lines">
        <legend>{field.label}</legend>
        {lines.map((line, index) => (
          <div className="ai-review-line" key={index}>
            {(
              [
                ["description", "Descrição do item"],
                ["quantity", "Quantidade"],
                ["unit", "Unidade"],
                ["amount", "Valor (R$)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={line[key]}
                  inputMode={key === "amount" ? "decimal" : undefined}
                  onChange={(event) =>
                    change(
                      lines.map((item, position) =>
                        position === index
                          ? { ...item, [key]: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <button
              type="button"
              className="icon-button"
              aria-label={`Remover item ${index + 1}`}
              onClick={() =>
                change(lines.filter((_, position) => position !== index))
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={lines.length >= 20}
          onClick={() =>
            change([
              ...lines,
              { description: "", quantity: "", unit: "", amount: "" },
            ])
          }
        >
          <Plus size={15} /> Adicionar item
        </button>
      </fieldset>
    );
  }
  if (field.type === "check") {
    return (
      <label className="ai-review-check">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => change(event.target.checked)}
        />{" "}
        {field.label}
      </label>
    );
  }
  return (
    <label>
      <span>
        {field.label}
        {field.required && <span className="ai-required"> *</span>}
      </span>
      {field.type === "link" ? (
        <select
          value={stringValue}
          onChange={(event) => change(event.target.value)}
          aria-required={field.required}
        >
          <option value="">Selecione…</option>
          {stringValue &&
            !records.some(
              (record) =>
                record.kind === field.target &&
                !record.archived &&
                "record:" + record.id === stringValue,
            ) &&
            !items.some(
              (item) =>
                item.kind === field.target &&
                "draft:" + item.id === stringValue,
            ) && <option value={stringValue}>Vínculo a conferir</option>}
          {records
            .filter(
              (record) => record.kind === field.target && !record.archived,
            )
            .map((record) => (
              <option key={record.id} value={"record:" + record.id}>
                {record.name || record.description || "Registro"}
                {record.city ? " · " + record.city : ""}
              </option>
            ))}
          {items
            .filter((item) => item.kind === field.target)
            .map((item) => (
              <option key={item.id} value={"draft:" + item.id}>
                {String(
                  item.data.name || item.data.description || "Novo cadastro",
                )}{" "}
                · nesta proposta
              </option>
            ))}
        </select>
      ) : field.type === "select" ? (
        <select
          value={stringValue}
          onChange={(event) => change(event.target.value)}
          aria-required={field.required}
        >
          <option value="">Selecione…</option>
          {field.options?.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      ) : field.type === "notes" ? (
        <textarea
          value={stringValue}
          onChange={(event) => change(event.target.value)}
          maxLength={2000}
          rows={2}
        />
      ) : (
        <input
          type={
            field.type === "date" ||
            field.type === "time" ||
            field.type === "month"
              ? field.type
              : "text"
          }
          value={field.type === "month" ? stringValue.slice(0, 7) : stringValue}
          inputMode={
            field.type === "money"
              ? "decimal"
              : field.type === "integer"
                ? "numeric"
                : undefined
          }
          onChange={(event) => change(event.target.value)}
          aria-required={field.required}
          maxLength={2000}
        />
      )}
    </label>
  );
}

export function SourceLinks({
  sources,
  onOpen,
}: {
  sources: Source[];
  onOpen: (source: Source) => void;
}) {
  return (
    <ul className="ai-sources" aria-label="Registros e telas de origem">
      {sources.map((source) => (
        <li key={JSON.stringify(source)}>
          <button type="button" onClick={() => onOpen(source)}>
            <ArrowUpRight size={14} aria-hidden="true" /> {source.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AiReview({
  proposal,
  records,
  onChange,
  onCommitted,
  onSource,
}: {
  proposal: Proposal;
  records: ReviewRecord[];
  onChange: (proposal: Proposal) => void;
  onCommitted: () => void;
  onSource: (source: Source) => void;
}) {
  const [items, setItems] = useState(proposal.items);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const selected = items.filter((item) => item.selected).length;

  function edit(id: string, patch: (item: DraftItem) => DraftItem) {
    setItems((current) =>
      current.map((item) => (item.id === id ? patch(item) : item)),
    );
    setDirty(true);
    setNotice("");
    setError("");
  }

  async function apply(action: "save" | "confirm" | "discard") {
    setBusy(action);
    setError("");
    setNotice("");
    const url = "/proposals/" + proposal.id;
    try {
      let version = proposal.version;
      if (action === "discard") {
        await aiRequest(url, jsonRequest("DELETE", { version }));
        onChange({ ...proposal, status: "discarded" });
        return;
      }
      if (dirty) {
        const updated = await aiRequest<Proposal>(
          url,
          jsonRequest("PATCH", {
            version,
            items: items.map(({ id, selected, data }) => ({
              id,
              selected,
              data,
            })),
          }),
        );
        version = updated.version;
        onChange(updated);
        setItems(updated.items);
        setDirty(false);
      }
      if (action === "confirm") {
        onChange(
          await aiRequest<Proposal>(
            url + "/confirm",
            jsonRequest("POST", { version }),
          ),
        );
        onCommitted();
      } else setNotice("Revisão salva.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="ai-review" aria-label="Revisão de cadastros">
      <header className="ai-review-header">
        <span className="ai-mark">
          <FileCheck2 size={18} aria-hidden="true" />
        </span>
        <div>
          <h3>Revisão de cadastros</h3>
          <p>{proposal.filename}</p>
        </div>
      </header>
      {proposal.status === "pending" ? (
        <>
          <p className="ai-review-instruction">
            Confira o destino, os valores e os vínculos. Selecione apenas os
            itens que deseja incluir.
          </p>
          <fieldset className="ai-review-set" disabled={Boolean(busy)}>
            {items.map((item) => (
              <article key={item.id} className="ai-review-item">
                <label className="ai-review-item-title">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(event) =>
                      edit(item.id, (old) => ({
                        ...old,
                        selected: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>
                      {draftCatalog[item.kind].label} ·{" "}
                      {String(
                        item.data.name ||
                          item.data.description ||
                          "Cadastro proposto",
                      )}
                    </strong>
                    <small>{item.location}</small>
                  </span>
                </label>
                <ReviewItemSummary
                  item={item}
                  items={items}
                  records={records}
                />
                {item.warnings.length > 0 && (
                  <ul className="ai-review-warnings">
                    {item.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                )}
                <details>
                  <summary>
                    <ChevronDown size={15} aria-hidden="true" /> Editar campos
                  </summary>
                  <div className="ai-review-fields">
                    {draftCatalog[item.kind].fields.map((field) => (
                      <DraftField
                        key={field.key}
                        field={field}
                        value={item.data[field.key]}
                        items={items}
                        records={records}
                        change={(value) =>
                          edit(item.id, (old) => ({
                            ...old,
                            data: { ...old.data, [field.key]: value },
                          }))
                        }
                      />
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </fieldset>
          {error && (
            <p className="ai-inline-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="ai-status" role="status">
              {notice}
            </p>
          )}
          <div className="ai-row-actions ai-review-actions">
            <button
              type="button"
              className="primary"
              disabled={Boolean(busy) || !selected}
              onClick={() => void apply("confirm")}
            >
              <Check size={16} />{" "}
              {busy === "confirm"
                ? "Confirmando…"
                : `Confirmar ${selected} ${selected === 1 ? "inclusão" : "inclusões"}`}
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || !dirty}
              onClick={() => void apply("save")}
            >
              Salvar revisão
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void apply("discard")}
            >
              Descartar proposta
            </button>
          </div>
        </>
      ) : proposal.status === "confirmed" ? (
        <div className="ai-review-result">
          <p>
            <Check size={16} aria-hidden="true" />{" "}
            {proposal.receipt?.length ?? 0} cadastro(s) incluído(s).
          </p>
          {proposal.receipt?.length ? (
            <SourceLinks sources={proposal.receipt} onOpen={onSource} />
          ) : null}
        </div>
      ) : (
        <p className="ai-status">
          {proposal.status === "expired"
            ? "Proposta encerrada após a restauração do banco."
            : "Proposta descartada."}
        </p>
      )}
    </section>
  );
}
