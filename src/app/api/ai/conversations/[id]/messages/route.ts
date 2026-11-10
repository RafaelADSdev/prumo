import { z } from "zod";
import { guardWorkspace } from "@/lib/auth";
import { sendMessage } from "@/lib/ai/conversations";
import { AiError, aiFailure, aiJson } from "@/lib/ai/errors";
import { boundedBody } from "@/lib/ai/http";
import { maxAttachmentBytes, maxMessageLength } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { db, workspace } = await guardWorkspace(true);
    const id = z.uuid().parse((await context.params).id);
    const contentType = request.headers.get("content-type");
    if (
      !contentType?.startsWith("multipart/form-data;") ||
      contentType.length > 250
    )
      throw new AiError("Envie a mensagem pelo formulário do assistente.");
    const bytes = await boundedBody(request, maxAttachmentBytes + 60_000);
    const form = await new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": contentType },
    })
      .formData()
      .catch(() => {
        throw new AiError("Mensagem ou anexo inválido.");
      });
    const input = z
      .object({
        turnId: z.uuid(),
        text: z.string().trim().min(1).max(maxMessageLength),
      })
      .parse({ turnId: form.get("turnId"), text: form.get("text") });
    const files = form.getAll("file");
    const file = files[0];
    if (files.length > 1 || (file !== undefined && !(file instanceof File)))
      throw new AiError("Envie um arquivo por mensagem.");
    return aiJson(
      await sendMessage(db, workspace, id, { ...input, file }, request.signal),
    );
  } catch (error) {
    return aiFailure(error);
  }
}
