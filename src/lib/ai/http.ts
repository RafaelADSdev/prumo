import { z } from "zod";
import { AiError } from "./errors";
import { providers, type ProviderId } from "./types";

export const providerId = z.custom<ProviderId>(
  (value) => typeof value === "string" && Object.hasOwn(providers, value),
);

export async function boundedBody(request: Request, limit: number) {
  const tooLarge = new AiError(
    "O arquivo ou a mensagem excede o tamanho permitido.",
    413,
  );
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge;
  const reader = request.body?.getReader();
  if (!reader) throw new AiError("Envie os dados da operação.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel().catch(() => {});
        throw tooLarge;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

export async function readJson(
  request: Request,
  limit = 8_192,
): Promise<unknown> {
  const bytes = await boundedBody(request, limit);
  return JSON.parse(bytes.toString("utf8"));
}
