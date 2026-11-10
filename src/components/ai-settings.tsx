"use client";

import { useEffect, useState } from "react";
import { KeyRound, Sparkles } from "lucide-react";
import { aiRequest, jsonRequest } from "@/lib/ai/client";
import {
  providers,
  type ProviderConnection,
  type ProviderId,
} from "@/lib/ai/types";

export function AiSettings() {
  const [state, setState] = useState<{
    ready: boolean;
    providers: ProviderConnection[];
  }>();
  const [active, setActive] = useState<ProviderId>();
  const [action, setAction] = useState<"connect" | "remove">("connect");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function load(signal?: AbortSignal) {
    aiRequest<NonNullable<typeof state>>("/providers", { signal })
      .then(setState)
      .catch((error: Error) => {
        if (!signal?.aborted) setError(error.message);
      });
  }
  useEffect(() => {
    const abort = new AbortController();
    load(abort.signal);
    return () => abort.abort();
  }, []);

  async function change(provider: ProviderId, key?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const connection = await aiRequest<ProviderConnection>(
        "/providers",
        jsonRequest(key === undefined ? "DELETE" : "PUT", { provider, key }),
      );
      setState(
        (current) =>
          current && {
            ...current,
            providers: current.providers.map((item) =>
              item.id === provider ? connection : item,
            ),
          },
      );
      setActive(undefined);
      setNotice(
        key === undefined
          ? "Chave removida."
          : "Conexão testada e chave salva.",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="panel settings-panel ai-settings"
      id="settings-ai"
      tabIndex={-1}
      aria-labelledby="settings-ai-title"
    >
      <div className="ai-settings-heading">
        <span className="ai-mark">
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 id="settings-ai-title">Assistente IA</h2>
          <p>
            Conecte suas chaves de API e escolha o provedor ao iniciar uma
            conversa.
          </p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {state?.ready === false && (
        <p role="status">
          O cofre do Assistente IA precisa ser configurado no servidor.
        </p>
      )}
      {!state &&
        (error ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              load();
            }}
          >
            Tentar novamente
          </button>
        ) : (
          <p role="status">Carregando conexões…</p>
        ))}
      {state && (
        <ul className="ai-provider-list">
          {state.providers.map(({ id, connected }) => (
            <li key={id}>
              <div className="ai-provider-row">
                <KeyRound size={17} aria-hidden="true" />
                <div className="ai-provider-name">
                  <strong>{providers[id].label}</strong>
                  <small className={connected ? "ai-connected" : ""}>
                    {connected ? "Conectado" : "Disponível para conectar"}
                  </small>
                </div>
                <div className="ai-row-actions">
                  <button
                    type="button"
                    disabled={!state.ready || busy}
                    onClick={() => {
                      setActive(id);
                      setAction("connect");
                      setError("");
                    }}
                  >
                    {connected ? "Substituir" : "Conectar"}
                    <span className="sr-only"> {providers[id].label}</span>
                  </button>
                  {connected && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setActive(id);
                        setAction("remove");
                        setError("");
                      }}
                    >
                      Remover
                      <span className="sr-only"> {providers[id].label}</span>
                    </button>
                  )}
                </div>
              </div>
              {active === id && action === "connect" && (
                <form
                  className="ai-key-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const input = new FormData(event.currentTarget).get("key");
                    if (typeof input === "string") void change(id, input);
                  }}
                >
                  <label>
                    Chave de API do {providers[id].label}
                    <input
                      type="password"
                      name="key"
                      required
                      minLength={8}
                      maxLength={1024}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={busy}
                    />
                  </label>
                  <div className="ai-row-actions">
                    <button className="primary" disabled={busy}>
                      {busy ? "Testando…" : "Testar e salvar"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setActive(undefined)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
              {active === id && action === "remove" && (
                <div className="ai-key-form">
                  <p>
                    As conversas ficam no histórico. Você pode reconectar a
                    chave depois.
                  </p>
                  <div className="ai-row-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void change(id)}
                    >
                      Remover chave
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setActive(undefined)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
