import { z } from "zod";
import { guardWorkspace } from "@/lib/auth";
import { aiFailure, aiJson } from "@/lib/ai/errors";
import { readJson } from "@/lib/ai/http";
import { confirmProposal } from "@/lib/ai/proposals";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await guardWorkspace(true);
    const id = z.uuid().parse((await context.params).id);
    const { version } = z
      .object({ version: z.number().int().positive() })
      .parse(await readJson(request));
    return aiJson(await confirmProposal(db, id, version));
  } catch (error) {
    return aiFailure(error);
  }
}
