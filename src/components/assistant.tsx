"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  FileText,
  History,
  Info,
  LoaderCircle,
  Paperclip,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { aiRequest, jsonRequest } from "@/lib/ai/client";
import {
  acceptedAttachments,
  maxAttachmentBytes,
  maxMessageLength,
  providers,
  type Conversation,
  type Message,
  type Proposal,
  type ProviderConnection,
  type ProviderId,
  type Source,
} from "@/lib/ai/types";
import { AiReview, SourceLinks, type ReviewRecord } from "./ai-review";

type Connections = { ready: boolean; providers: ProviderConnection[] };
type HistoryPage = { conversations: Conversation[]; next: string | null };
type ChatPage = {
  conversation: Conversation;
  messages: Message[];
  proposals: Proposal[];
  next: string | null;
};
type Turn = {
  conversation: Conversation;
  messages: Message[];
  proposal: Proposal | null;
};

const suggestions = [
  { text: "Qual é a próxima visita da Agenda?", icon: CalendarDays },
  { text: "Quanto recebi este mês?", icon: Wallet },
];

export function Assistant({
  records,
  onSettings,
  onSource,
  onCommitted,
}: {
  records: ReviewRecord[];
  onSettings: () => void;
  onSource: (source: Source) => void;
  onCommitted: () => void;
}) {
  const [connection, setConnection] = useState<Connections>();
  const [history, setHistory] = useState<HistoryPage>({
    conversations: [],
    next: null,
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Conversation>();
  const [chat, setChat] = useState<Conversation>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [nextMessage, setNextMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderId | "">("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const turnId = useRef("");
  const operation = useRef(false);
  const scrollToLatest = useRef(false);

  const connected =
    connection?.providers.filter((item) => item.connected) ?? [];
  const selectedProvider = chat?.provider ?? provider;
  const canSend = Boolean(
    connection?.ready &&
    selectedProvider &&
    connected.some((item) => item.id === selectedProvider),
  );

  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      aiRequest<Connections>("/providers", { signal: abort.signal }),
      aiRequest<HistoryPage>("/conversations", { signal: abort.signal }),
    ])
      .then(([connections, history]) => {
        setConnection(connections);
        setHistory(history);
        setProvider(
          connections.providers.find((item) => item.connected)?.id ?? "",
        );
      })
      .catch((error: Error) => {
        if (!abort.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoaded(true);
      });
    return () => abort.abort();
  }, [retry]);

  useEffect(() => {
    if (scrollToLatest.current && thread.current) {
      thread.current.scrollTop = thread.current.scrollHeight;
      scrollToLatest.current = false;
    }
  }, [messages, busy]);

  function setProposal(proposal: Proposal) {
    setProposals((current) => ({ ...current, [proposal.turnId]: proposal }));
  }

  function clearComposer() {
    setFile(undefined);
    setText("");
    turnId.current = "";
  }

  function newChat() {
    setChat(undefined);
    setMessages([]);
    setProposals({});
    setNextMessage(null);
    setHistoryOpen(false);
    setPendingDelete(undefined);
    setError("");
    clearComposer();
    requestAnimationFrame(() => composer.current?.focus());
  }

  function remember(conversation: Conversation) {
    setHistory((current) => ({
      ...current,
      conversations: [
        conversation,
        ...current.conversations.filter((item) => item.id !== conversation.id),
      ],
    }));
  }

  async function act(label: string, action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      operation.current = false;
      setBusy("");
    }
  }

  async function send() {
    if (!text.trim() || !canSend || !selectedProvider) return;
    scrollToLatest.current = true;
    await act("send", async () => {
      const current =
        chat ??
        (await aiRequest<Conversation>(
          "/conversations",
          jsonRequest("POST", { provider: selectedProvider }),
        ));
      if (!chat) {
        setChat(current);
        remember(current);
      }
      const body = new FormData();
      turnId.current ||= crypto.randomUUID();
      body.set("turnId", turnId.current);
      body.set("text", text.trim());
      if (file) body.set("file", file);
      const result = await aiRequest<Turn>(
        `/conversations/${current.id}/messages`,
        { method: "POST", body },
      );
      scrollToLatest.current = true;
      setChat(result.conversation);
      remember(result.conversation);
      setMessages((current) => [
        ...current,
        ...result.messages.filter(
          (message) => !current.some(({ id }) => id === message.id),
        ),
      ]);
      if (result.proposal) setProposal(result.proposal);
      clearComposer();
      requestAnimationFrame(() =>
        composer.current?.focus({ preventScroll: true }),
      );
    });
  }

  async function openChat(id: string, cursor?: string) {
    await act("history", async () => {
      const response = await aiRequest<ChatPage>(
        `/conversations/${id}` + (cursor ? `?cursor=${cursor}` : ""),
      );
      if (!cursor) {
        scrollToLatest.current = true;
        setChat(response.conversation);
        setHistoryOpen(false);
        setPendingDelete(undefined);
        setProposals({});
        clearComposer();
      }
      const oldHeight = thread.current?.scrollHeight ?? 0;
      setMessages((current) =>
        cursor ? [...response.messages, ...current] : response.messages,
      );
      for (const proposal of response.proposals) setProposal(proposal);
      setNextMessage(response.next);
      if (cursor)
        requestAnimationFrame(() => {
          if (thread.current)
            thread.current.scrollTop += thread.current.scrollHeight - oldHeight;
        });
    });
  }

  async function removeChat(conversation: Conversation) {
    await act("history", async () => {
      await aiRequest("/conversations/" + conversation.id, {
        method: "DELETE",
      });
      setHistory((current) => ({
        ...current,
        conversations: current.conversations.filter(
          ({ id }) => id !== conversation.id,
        ),
      }));
      setPendingDelete(undefined);
      if (chat?.id === conversation.id) newChat();
    });
  }

  function chooseFile(next?: File) {
    if (!next) return;
    setError("");
    if (next.size > maxAttachmentBytes) {
      setError("O limite é de 4 MB por anexo. Envie um arquivo menor.");
      return;
    }
    if (
      !acceptedAttachments
        .split(",")
        .includes("." + next.name.split(".").at(-1)?.toLowerCase())
    ) {
      setError("Escolha PDF, Word, XLSX, CSV ou uma foto JPG, PNG ou WEBP.");
      return;
    }
    setFile(next);
    turnId.current = "";
    composer.current?.focus();
  }

  const blank = messages.length === 0 && busy !== "send";
  return (
    <section
      className={`ai-shell${blank ? " ai-shell-empty" : ""}`}
      aria-labelledby="assistant-title"
    >
      <header className="ai-toolbar">
        <div className="ai-toolbar-title">
          <Sparkles size={17} aria-hidden="true" />
          <h1 id="assistant-title">Assistente IA</h1>
          {chat && <span className="ai-chat-title">{chat.title}</span>}
        </div>
        <div className="ai-row-actions">
          <button type="button" disabled={Boolean(busy)} onClick={newChat}>
            <Plus size={16} aria-hidden="true" /> Nova conversa
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            aria-expanded={historyOpen}
            aria-controls="ai-history"
            onClick={() => {
              setHistoryOpen(!historyOpen);
              setPendingDelete(undefined);
            }}
          >
            <History size={16} aria-hidden="true" /> Histórico
          </button>
        </div>
      </header>
      {historyOpen && (
        <section
          className="ai-history"
          id="ai-history"
          aria-labelledby="ai-history-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setHistoryOpen(false);
              setPendingDelete(undefined);
            }
          }}
        >
          <div className="ai-history-heading">
            <h2 id="ai-history-title">Conversas</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar histórico"
              onClick={() => setHistoryOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          {history.conversations.length === 0 && (
            <p className="ai-status">Suas conversas aparecerão aqui.</p>
          )}
          <ul>
            {history.conversations.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  className="ai-history-chat"
                  aria-current={chat?.id === item.id}
                  onClick={() => void openChat(item.id)}
                >
                  <strong>{item.title}</strong>
                  <small>{providers[item.provider].label}</small>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={Boolean(busy)}
                  aria-label={`Excluir conversa ${item.title}`}
                  onClick={() => setPendingDelete(item)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          {pendingDelete && (
            <div className="ai-history-delete">
              <p>Excluir a conversa “{pendingDelete.title}” do histórico?</p>
              <div className="ai-row-actions">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  className="danger"
                  onClick={() => void removeChat(pendingDelete)}
                >
                  Excluir conversa
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => setPendingDelete(undefined)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {history.next && (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                void act("history", async () => {
                  const page = await aiRequest<HistoryPage>(
                    `/conversations?cursor=${history.next}`,
                  );
                  setHistory((current) => ({
                    next: page.next,
                    conversations: [
                      ...current.conversations,
                      ...page.conversations.filter(
                        (item) =>
                          !current.conversations.some(
                            ({ id }) => id === item.id,
                          ),
                      ),
                    ],
                  }));
                })
              }
            >
              Mais conversas
            </button>
          )}
        </section>
      )}
      {!blank && (
        <div
          className="ai-thread"
          ref={thread}
          aria-label="Mensagens da conversa"
          tabIndex={0}
        >
          <div className="ai-thread-inner">
            {nextMessage && chat && (
              <button
                className="ai-load-older"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void openChat(chat.id, nextMessage)}
              >
                Mensagens anteriores
              </button>
            )}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`ai-message ai-message-${message.role}`}
              >
                <h2>{message.role === "user" ? "Você" : "Prumo"}</h2>
                {message.attachment && (
                  <span className="ai-attachment">
                    <FileText size={14} aria-hidden="true" />{" "}
                    {message.attachment}
                  </span>
                )}
                <p>{message.text}</p>
                {message.sources.length > 0 && (
                  <SourceLinks sources={message.sources} onOpen={onSource} />
                )}
                {message.role === "assistant" && proposals[message.turnId] && (
                  <AiReview
                    key={proposals[message.turnId].id}
                    proposal={proposals[message.turnId]}
                    records={records}
                    onChange={setProposal}
                    onCommitted={onCommitted}
                    onSource={onSource}
                  />
                )}
              </article>
            ))}
            {busy === "send" && (
              <>
                <article className="ai-message ai-message-user">
                  <h2>Você</h2>
                  <p>{text}</p>
                </article>
                <p className="ai-working" role="status">
                  <LoaderCircle size={17} className="spin" />{" "}
                  {file
                    ? "Lendo o anexo e preparando a resposta…"
                    : "Consultando o Prumo…"}
                </p>
              </>
            )}
          </div>
        </div>
      )}
      <div className="ai-compose-wrap">
        <div className="ai-compose-inner">
          {blank && (
            <div className="ai-welcome">
              <span className="ai-mark ai-welcome-mark">
                <Sparkles size={23} aria-hidden="true" />
              </span>
              <h2>Como posso ajudar?</h2>
              <p>
                Pergunte sobre seus registros ou envie um documento para
                preparar cadastros.
              </p>
            </div>
          )}
          {error && (
            <p className="ai-inline-error" role="alert">
              {error}{" "}
              {!connection && loaded && (
                <button
                  type="button"
                  onClick={() => {
                    setLoaded(false);
                    setError("");
                    setRetry((value) => value + 1);
                  }}
                >
                  Tentar novamente
                </button>
              )}
            </p>
          )}
          {!loaded && (
            <p className="ai-status" role="status">
              Carregando assistente…
            </p>
          )}
          {loaded && connection && !canSend && (
            <div className="ai-connect-prompt">
              <p>
                {connection.ready
                  ? "Conecte uma chave de API para enviar mensagens."
                  : "O cofre do Assistente IA precisa ser configurado no servidor."}
              </p>
              <button type="button" onClick={onSettings}>
                <Settings size={16} aria-hidden="true" /> Abrir configurações
              </button>
            </div>
          )}
          <form
            className="ai-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <textarea
              ref={composer}
              aria-label="Mensagem para o assistente"
              placeholder="Escreva sua pergunta ou diga o que deseja cadastrar…"
              rows={2}
              maxLength={maxMessageLength}
              value={text}
              disabled={!canSend || Boolean(busy)}
              onChange={(event) => {
                setText(event.target.value);
                turnId.current = "";
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            {file && (
              <span className="ai-attachment ai-selected-file">
                <FileText size={15} aria-hidden="true" />{" "}
                <span>{file.name}</span>
                <button
                  type="button"
                  className="icon-button"
                  disabled={Boolean(busy)}
                  aria-label="Remover anexo"
                  onClick={() => {
                    setFile(undefined);
                    turnId.current = "";
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            )}
            <div className="ai-composer-actions">
              <input
                ref={attachmentInput}
                type="file"
                accept={acceptedAttachments}
                hidden
                onChange={(event) => {
                  chooseFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
                aria-label="Arquivo para anexar"
              />
              <button
                type="button"
                className="icon-button ai-attach-button"
                aria-label="Anexar documento ou foto"
                title="Anexar documento ou foto"
                onClick={() => attachmentInput.current?.click()}
                disabled={!canSend || Boolean(busy)}
              >
                <Paperclip size={18} aria-hidden="true" />
                <span>Anexar</span>
              </button>
              <div className="ai-row-actions">
                {chat ? (
                  <span className="ai-provider-tag">
                    <span className="ai-provider-dot" aria-hidden="true" />
                    {providers[chat.provider].label}
                  </span>
                ) : (
                  <span className="ai-provider-picker">
                    <span className="ai-provider-dot" aria-hidden="true" />
                    <select
                      aria-label="Provedor da conversa"
                      disabled={Boolean(busy) || !connected.length}
                      value={provider}
                      onChange={(event) =>
                        setProvider(event.target.value as ProviderId)
                      }
                    >
                      {!connected.length && <option value="">Provedor</option>}
                      {connected.map(({ id }) => (
                        <option key={id} value={id}>
                          {providers[id].label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} aria-hidden="true" />
                  </span>
                )}
                <button
                  className="primary ai-send"
                  aria-label="Enviar mensagem"
                  title="Enviar mensagem"
                  disabled={!canSend || !text.trim() || Boolean(busy)}
                >
                  {busy === "send" ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <ArrowUp size={19} />
                  )}
                </button>
              </div>
            </div>
          </form>
          <p className="ai-privacy">
            <Info size={13} aria-hidden="true" />
            <span>
              A pergunta e os trechos usados na resposta são enviados ao
              provedor selecionado.
            </span>
          </p>
          {blank && canSend && (
            <div className="ai-suggestions" aria-label="Sugestões de pergunta">
              {suggestions.map(({ text: suggestion, icon: Icon }) => (
                <button
                  type="button"
                  key={suggestion}
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setText(suggestion);
                    turnId.current = "";
                    composer.current?.focus();
                  }}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{suggestion}</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
