import { randomUUID } from "node:crypto";
import type { AiConversation, AiMessage, PrismaClient } from "@prisma/client";
import type { ModelMessage } from "ai";
import { answerQuestion } from "./answer";
import { extractAttachment } from "./attachments";
import { decryptApiKey } from "./credentials";
import { AiError } from "./errors";
import { proposalView } from "./proposals";
import { reserveQuota } from "./quota";
import type { Conversation, Message, ProviderId } from "./types";

export const messageOrder = [
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

export function conversationView(row: AiConversation): Conversation {
  return {
    id: row.id,
    provider: row.provider as ProviderId,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function messageView(row: AiMessage): Message {
  return {
    id: row.id,
    turnId: row.turnId,
    role: row.role as Message["role"],
    text: row.text,
    sources: JSON.parse(row.sources),
    attachment: row.attachment,
  };
}

export async function getConversation(db: PrismaClient, id: string) {
  const row = await db.aiConversation.findUnique({ where: { id } });
  if (!row) throw new AiError("Conversa não encontrada.", 404);
  return row;
}

export async function getTurn(
  db: PrismaClient,
  conversationId: string,
  turnId: string,
) {
  const messages = await db.aiMessage.findMany({
    where: { conversationId, turnId },
    orderBy: messageOrder,
  });
  if (!messages.length) return null;
  const proposal = await db.aiProposal.findUnique({
    where: { conversationId_turnId: { conversationId, turnId } },
  });
  return {
    messages: messages.reverse().map(messageView),
    proposal: proposal ? proposalView(proposal) : null,
  };
}

export async function sendMessage(
  db: PrismaClient,
  workspace: string,
  conversationId: string,
  input: { turnId: string; text: string; file?: File },
  signal: AbortSignal,
) {
  const conversation = await getConversation(db, conversationId);
  const existing = await getTurn(db, conversationId, input.turnId);
  if (existing)
    return { ...existing, conversation: conversationView(conversation) };
  const provider = conversation.provider as ProviderId;
  const credential = await db.aiCredential.findUnique({
    where: { provider },
    select: { encryptedKey: true },
  });
  if (!credential)
    throw new AiError("Conecte a chave deste provedor nas Configurações.", 409);
  const key = decryptApiKey(credential.encryptedKey, provider, workspace);
  const now = new Date();
  const lease = randomUUID();
  const acquired = await db.aiConversation.updateMany({
    where: {
      id: conversationId,
      OR: [{ pendingUntil: null }, { pendingUntil: { lte: now } }],
    },
    data: {
      pendingTurn: lease,
      pendingUntil: new Date(now.getTime() + 65_000),
    },
  });
  if (!acquired.count)
    throw new AiError(
      "A conversa já está processando uma mensagem. Aguarde e tente novamente.",
      409,
    );
  try {
    const repeated = await getTurn(db, conversationId, input.turnId);
    if (repeated)
      return { ...repeated, conversation: conversationView(conversation) };
    await reserveQuota(db, "message");
    const total = AbortSignal.any([signal, AbortSignal.timeout(53_000)]);
    const attachment = input.file
      ? await extractAttachment(input.file, total)
      : undefined;
    const history = await db.aiMessage.findMany({
      where: { conversationId },
      orderBy: messageOrder,
      take: 12,
      select: { role: true, text: true },
    });
    const messages: ModelMessage[] = history
      .reverse()
      .map(({ role, text }) => ({
        role: role === "assistant" ? "assistant" : "user",
        content: text.slice(0, 4_000),
      }));
    messages.push({ role: "user", content: input.text });
    const result = await answerQuestion(
      db,
      provider,
      key,
      messages,
      attachment,
      total,
    );
    if (total.aborted)
      throw new AiError("O assistente demorou demais. Tente novamente.", 504);
    const saved = await db.$transaction(async (tx) => {
      const current = await tx.aiConversation.findUnique({
        where: { id: conversationId },
      });
      if (!current || current.pendingTurn !== lease)
        throw new AiError("A conversa foi encerrada durante o envio.", 409);
      const createdAt = new Date();
      const user = await tx.aiMessage.create({
        data: {
          conversationId,
          turnId: input.turnId,
          role: "user",
          text: input.text,
          attachment: attachment?.filename,
          createdAt,
        },
      });
      const assistant = await tx.aiMessage.create({
        data: {
          conversationId,
          turnId: input.turnId,
          role: "assistant",
          text: result.text,
          sources: JSON.stringify(result.sources),
          createdAt: new Date(createdAt.getTime() + 1),
        },
      });
      const draft =
        attachment && result.proposal
          ? await tx.aiProposal.create({
              data: {
                conversationId,
                turnId: input.turnId,
                filename: attachment.filename,
                fileHash: attachment.hash,
                items: JSON.stringify(result.proposal),
              },
            })
          : null;
      const updated = await tx.aiConversation.update({
        where: { id: conversationId },
        data: {
          title: history.length
            ? current.title
            : input.text.replace(/\s+/g, " ").slice(0, 72),
          pendingUntil: null,
          pendingTurn: null,
        },
      });
      return {
        conversation: conversationView(updated),
        messages: [messageView(user), messageView(assistant)],
        proposal: draft ? proposalView(draft) : null,
      };
    });
    return saved;
  } finally {
    await db.aiConversation
      .updateMany({
        where: { id: conversationId, pendingTurn: lease },
        data: { pendingTurn: null, pendingUntil: null },
      })
      .catch(() => {});
  }
}
