import { randomUUID } from "node:crypto";

const endpoints = new Set([
  "api.openai.com",
  "generativelanguage.googleapis.com",
  "api.anthropic.com",
  "api.deepseek.com",
  "api.x.ai",
]);
const usage = { input_tokens: 10, output_tokens: 10, total_tokens: 20 };
const call = (name, args) => ({
  type: "function_call",
  id: "fc_" + randomUUID(),
  call_id: "call_" + randomUUID(),
  name,
  arguments: JSON.stringify(args),
});
const message = (text) => ({
  type: "message",
  role: "assistant",
  id: "msg_" + randomUUID(),
  status: "completed",
  content: [{ type: "output_text", text, annotations: [] }],
});
const fields = (record) =>
  Object.entries(record).map(([campo, valor]) => ({ campo, valor }));

function respondToChat(body) {
  const names = body.tools?.map((tool) => tool.name) ?? [];
  const input = JSON.stringify(body.input);
  const hasResult =
    Array.isArray(body.input) &&
    body.input.some((part) => part.type === "function_call_output");
  if (names.includes("ler_anexo")) {
    if (input.includes("IGNORE_AS_REGRAS"))
      throw Error(
        "O conteúdo do arquivo chegou antes de definir a finalidade.",
      );
    const latest = Array.isArray(body.input)
      ? body.input.findLast((part) => part.role === "user")
      : null;
    return call("ler_anexo", {
      finalidade: JSON.stringify(latest).includes("Resuma")
        ? "consulta"
        : "inclusao",
    });
  }
  if (input.includes("IGNORE_AS_REGRAS")) {
    if (names.length)
      throw Error("Uma consulta de anexo expôs ferramentas adicionais.");
    return message("O arquivo contém uma linha de texto para consulta.");
  }
  if (names.includes("propor_inclusao")) {
    if (!hasResult)
      throw Error("A revisão foi iniciada sem a leitura do anexo.");
    return call("propor_inclusao", {
      itens: [
        {
          tipo: "visit",
          origem: "Linha 2",
          campos: fields({
            description: "Visita importada",
            clientId: "Cliente importado IA",
            date: "2039-11-12",
            appointmentTime: "14:00",
          }),
        },
        {
          tipo: "client",
          origem: "Linha 2",
          campos: fields({ name: "Cliente importado IA" }),
        },
        {
          tipo: "entry",
          origem: "Linha 2",
          campos: fields({
            type: "expense",
            description: "Despesa sem data",
            category: "Outros",
            amount: "80,00",
          }),
        },
      ],
    });
  }
  if (names.includes("consultar_agenda") && !hasResult)
    return call("consultar_agenda", {
      cliente: "Cliente Assistente",
      proximas: true,
    });
  return message(hasResult ? "Consulta concluída." : "OK");
}

export function fixtureFetch(original) {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (!endpoints.has(url.hostname)) return original(input, init);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const key =
      headers.get("authorization") ??
      headers.get("x-api-key") ??
      headers.get("x-goog-api-key") ??
      url.searchParams.get("key");
    if (!key?.includes("prumo-chave-teste")) {
      return Response.json(
        {
          error: {
            message: "Segredo de fixture",
            type: "invalid_request_error",
            code: "invalid_api_key",
          },
        },
        { status: 401 },
      );
    }
    const body = JSON.parse(init?.body ?? "{}");
    if (url.hostname === "generativelanguage.googleapis.com") {
      return Response.json({
        candidates: [
          {
            content: { role: "model", parts: [{ text: "OK" }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 2,
          totalTokenCount: 12,
        },
      });
    }
    if (url.hostname === "api.anthropic.com") {
      return Response.json({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: body.model,
        content: [{ type: "text", text: "OK" }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage,
      });
    }
    if (url.hostname === "api.deepseek.com") {
      return Response.json({
        id: "completion_test",
        object: "chat.completion",
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "OK" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      });
    }
    return Response.json({
      id: "resp_" + randomUUID(),
      object: "response",
      created_at: 1,
      status: "completed",
      model: body.model,
      output: [
        url.hostname === "api.openai.com" ? respondToChat(body) : message("OK"),
      ],
      usage,
    });
  };
}

if (process.env.PRUMO_E2E_PROVIDER_FIXTURE === "1")
  globalThis.fetch = fixtureFetch(globalThis.fetch);
