import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { ProviderId } from "./types";
import { AiError } from "./errors";

function encryptionKey(value = process.env.PRUMO_AI_ENCRYPTION_KEY) {
  if (
    !value ||
    !/^[A-Za-z0-9+/]{43}=$/.test(value) ||
    Buffer.from(value, "base64").length !== 32
  )
    throw new AiError(
      "O cofre do Assistente IA precisa ser configurado no servidor.",
      503,
    );
  return Buffer.from(value, "base64");
}

export function vaultReady() {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptApiKey(
  secret: string,
  provider: ProviderId,
  workspace: string,
  masterKey?: string,
) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(masterKey), nonce);
  cipher.setAAD(
    Buffer.from(JSON.stringify(["prumo-ai-v1", workspace, provider])),
  );
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [
    "v1",
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}

export function decryptApiKey(
  encrypted: string,
  provider: ProviderId,
  workspace: string,
  masterKey?: string,
) {
  const key = encryptionKey(masterKey);
  try {
    const [version, nonce, tag, data] = encrypted.split(".");
    if (version !== "v1" || !data) throw Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(nonce, "base64url"),
      { authTagLength: 16 },
    );
    decipher.setAAD(
      Buffer.from(JSON.stringify(["prumo-ai-v1", workspace, provider])),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AiError(
      "Reconecte a chave deste provedor nas Configurações.",
      409,
    );
  }
}
