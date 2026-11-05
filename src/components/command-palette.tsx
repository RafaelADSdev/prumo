"use client";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Search, ArrowUp, ArrowDown, CornerDownLeft, X } from "lucide-react";
import { revealDialog } from "@/lib/motion";
export type Command = {
  id: string;
  label: string;
  description: string;
  Icon: LucideIcon;
  action: () => void;
};
export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const ref = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(0);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const filtered = commands.filter((c) =>
    normalize(c.label + " " + c.description).includes(normalize(query)),
  );
  useEffect(() => {
    if (open && filtered[selected])
      document
        .getElementById("command-" + filtered[selected].id)
        ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [open, selected, query]);
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      if (!ref.current?.open) ref.current?.showModal();
      input.current?.focus();
      if (ref.current) revealDialog(ref.current);
    } else ref.current?.close();
  }, [open]);
  const select = (c: Command) => {
    onClose();
    c.action();
  };
  return (
    <dialog
      ref={ref}
      className="command-dialog"
      aria-labelledby="command-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="command-title" className="sr-only">
        Navegação rápida
      </h2>
      <div className="command-search">
        <Search size={21} />
        <input
          ref={input}
          role="combobox"
          aria-expanded={open}
          aria-controls="command-results"
          aria-activedescendant={
            filtered[selected] ? "command-" + filtered[selected].id : undefined
          }
          aria-label="Buscar tela ou ação"
          placeholder="Para onde vamos?"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((v) => Math.min(v + 1, filtered.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((v) => Math.max(v - 1, 0));
            }
            if (e.key === "Enter" && filtered[selected]) {
              e.preventDefault();
              select(filtered[selected]);
            }
          }}
        />
        <button
          className="icon-button"
          aria-label="Fechar navegação rápida"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div
        className="command-results"
        role="listbox"
        id="command-results"
        aria-label="Telas e ações"
      >
        {filtered.map((c, i) => (
          <button
            role="option"
            aria-selected={i === selected}
            className={i === selected ? "selected" : ""}
            id={"command-" + c.id}
            key={c.id}
            onMouseEnter={() => setSelected(i)}
            onClick={() => select(c)}
          >
            <span className="command-icon">
              <c.Icon size={19} />
            </span>
            <span>
              {c.label}
              <small>{c.description}</small>
            </span>
            <CornerDownLeft size={15} />
          </button>
        ))}
        {!filtered.length && (
          <p className="command-empty">Nenhuma tela ou ação encontrada.</p>
        )}
      </div>
      <div className="command-footer">
        <span>
          <ArrowUp size={12} />
          <ArrowDown size={12} /> Navegar
        </span>
        <span>
          <CornerDownLeft size={13} /> Abrir
        </span>
        <kbd>Esc para fechar</kbd>
      </div>
    </dialog>
  );
}
