import { createOpenAI } from "@ai-sdk/openai";
import { createGoogle } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createXai } from "@ai-sdk/xai";
import { APICallError, generateText, type LanguageModel } from "ai";
import { providers, type ProviderId } from "./types";
import { AiError } from "./errors";

const directFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, redirect: "error" });

export function modelFor(
  provider: ProviderId,
  apiKey: string,
): {
  model: LanguageModel;
  providerOptions?: Parameters<typeof generateText>[0]["providerOptions"];
} {
  const settings = { apiKey, fetch: directFetch };
  const { model } = providers[provider];
  switch (provider) {
    case "openai":
      return {
        model: createOpenAI({
          ...settings,
          baseURL: "https://api.openai.com/v1",
        }).responses(model),
        providerOptions: {
          openai: {
            store: false,
            reasoningEffort: "low",
            include: ["reasoning.encrypted_content"],
          },
        },
      };
    case "google":
      return {
        model: createGoogle({
          ...settings,
          baseURL: "https://generativelanguage.googleapis.com/v1beta",
        })(model),
      };
    case "anthropic":
      return {
        model: createAnthropic({
          ...settings,
          baseURL: "https://api.anthropic.com/v1",
        })(model),
      };
    case "deepseek":
      return {
        model: createDeepSeek({
          ...settings,
          baseURL: "https://api.deepseek.com/v1",
        })(model),
        providerOptions: { deepseek: { thinking: { type: "disabled" } } },
      };
    case "xai":
      return {
        model: createXai({
          ...settings,
          baseURL: "https://api.x.ai/v1",
        }).responses(model),
        providerOptions: {
          xai: {
            store: false,
            reasoningEffort: "low",
            include: ["reasoning.encrypted_content"],
          },
        },
      };
  }
}

export function providerFailure(error: unknown, signal: AbortSignal) {
  if (signal.aborted)
    return new AiError(
      "O provedor demorou para responder. Tente novamente.",
      504,
    );
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403)
      return new AiError(
        "O provedor recusou a chave. Confira a chave e o acesso ao modelo.",
        422,
      );
    if (error.statusCode === 402 || error.statusCode === 429)
      return new AiError(
        "O provedor atingiu um limite de uso. Confira o saldo e os limites da sua conta.",
        429,
      );
    if (error.statusCode === 404)
      return new AiError(
        "O modelo do assistente está indisponível para esta chave.",
        422,
      );
  }
  return new AiError(
    "O provedor não conseguiu responder. Tente novamente.",
    502,
  );
}

export async function testApiKey(
  provider: ProviderId,
  key: string,
  signal: AbortSignal,
) {
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  try {
    await generateText({
      ...modelFor(provider, key),
      prompt: "Este é um teste de conexão. Responda apenas OK.",
      maxOutputTokens: 128,
      maxRetries: 0,
      abortSignal: timeout,
    });
  } catch (error) {
    throw providerFailure(error, timeout);
  }
}
