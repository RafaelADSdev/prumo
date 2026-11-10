import { z } from "zod";
import { guardWorkspace } from "@/lib/auth";
import { aiFailure, aiJson } from "@/lib/ai/errors";
import { readJson } from "@/lib/ai/http";
import {
  discardProposal,
  editProposalSchema,
  reviseProposal,
} from "@/lib/ai/proposals";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { db } = await guardWorkspace(true);
    const id = z.uuid().parse((await context.params).id);
    const input = editProposalSchema.parse(await readJson(request, 750_000));
    return aiJson(await reviseProposal(db, id, input));
  } catch (error) {
    return aiFailure(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { db } = await guardWorkspace(true);
    const id = z.uuid().parse((await context.params).id);
    const { version } = z
      .object({ version: z.number().int().positive() })
      .parse(await readJson(request));
    await discardProposal(db, id, version);
    return aiJson({ ok: true });
  } catch (error) {
    return aiFailure(error);
  }
}
