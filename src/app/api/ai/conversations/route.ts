import { z } from "zod";
import { guardWorkspace } from "@/lib/auth";
import { conversationView } from "@/lib/ai/conversations";
import { vaultReady } from "@/lib/ai/credentials";
import { AiError, aiFailure, aiJson } from "@/lib/ai/errors";
import { providerId, readJson } from "@/lib/ai/http";

export async function GET(request: Request) {
  try {
    const { db } = await guardWorkspace();
    const cursor = z
      .uuid()
      .nullable()
      .parse(new URL(request.url).searchParams.get("cursor"));
    const rows = await db.aiConversation.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const conversations = rows.slice(0, 30).map(conversationView);
    return aiJson({
      conversations,
      next: rows.length > 30 ? conversations.at(-1)?.id : null,
    });
  } catch (error) {
    return aiFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db } = await guardWorkspace(true);
    const { provider } = z
      .object({ provider: providerId })
      .parse(await readJson(request));
    if (!vaultReady())
      throw new AiError(
        "O cofre do Assistente IA precisa ser configurado no servidor.",
        503,
      );
    const credential = await db.aiCredential.findUnique({
      where: { provider },
      select: { provider: true },
    });
    if (!credential)
      throw new AiError("Conecte uma chave antes de iniciar a conversa.", 409);
    const row = await db.aiConversation.create({
      data: { provider, title: "Nova conversa" },
    });
    return aiJson(conversationView(row));
  } catch (error) {
    return aiFailure(error);
  }
}
