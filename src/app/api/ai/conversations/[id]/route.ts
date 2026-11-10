import { z } from "zod";
import { guardWorkspace } from "@/lib/auth";
import {
  conversationView,
  getConversation,
  messageOrder,
  messageView,
} from "@/lib/ai/conversations";
import { AiError, aiFailure, aiJson } from "@/lib/ai/errors";
import { proposalView } from "@/lib/ai/proposals";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { db } = await guardWorkspace();
    const id = z.uuid().parse((await context.params).id);
    const conversation = await getConversation(db, id);
    const cursor = z
      .uuid()
      .nullable()
      .parse(new URL(request.url).searchParams.get("cursor"));
    const rows = await db.aiMessage.findMany({
      where: { conversationId: id },
      orderBy: messageOrder,
      take: 41,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const messages = rows.slice(0, 40).reverse().map(messageView);
    const proposals = await db.aiProposal.findMany({
      where: {
        conversationId: id,
        turnId: { in: messages.map(({ turnId }) => turnId) },
      },
    });
    return aiJson({
      conversation: conversationView(conversation),
      messages,
      proposals: proposals.map(proposalView),
      next: rows.length > 40 ? messages[0].id : null,
    });
  } catch (error) {
    return aiFailure(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { db } = await guardWorkspace(true);
    const id = z.uuid().parse((await context.params).id);
    const result = await db.aiConversation.deleteMany({ where: { id } });
    if (!result.count) throw new AiError("Conversa não encontrada.", 404);
    return aiJson({ ok: true });
  } catch (error) {
    return aiFailure(error);
  }
}
