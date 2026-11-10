import { z } from "zod";
import { guardWorkspace } from "@/lib/auth";
import { encryptApiKey, vaultReady } from "@/lib/ai/credentials";
import { aiFailure, aiJson } from "@/lib/ai/errors";
import { providerId, readJson } from "@/lib/ai/http";
import { testApiKey } from "@/lib/ai/provider";
import { reserveQuota } from "@/lib/ai/quota";
import { providerIds } from "@/lib/ai/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { db } = await guardWorkspace();
    const stored = await db.aiCredential.findMany({
      select: { provider: true, updatedAt: true },
    });
    return aiJson({
      ready: vaultReady(),
      providers: providerIds.map((id) => {
        const credential = stored.find(({ provider }) => provider === id);
        return {
          id,
          connected: Boolean(credential),
          updatedAt: credential?.updatedAt.toISOString() ?? null,
        };
      }),
    });
  } catch (error) {
    return aiFailure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { db, workspace } = await guardWorkspace(true);
    const { provider, key } = z
      .object({
        provider: providerId,
        key: z
          .string()
          .trim()
          .min(8)
          .max(1024)
          .regex(/^[\x21-\x7e]+$/),
      })
      .parse(await readJson(request));
    const encryptedKey = encryptApiKey(key, provider, workspace);
    await reserveQuota(db, "key-test");
    await testApiKey(provider, key, request.signal);
    const { updatedAt } = await db.aiCredential.upsert({
      where: { provider },
      create: { provider, encryptedKey },
      update: { encryptedKey },
      select: { updatedAt: true },
    });
    return aiJson({
      id: provider,
      connected: true,
      updatedAt: updatedAt.toISOString(),
    });
  } catch (error) {
    return aiFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { db } = await guardWorkspace(true);
    const { provider } = z
      .object({ provider: providerId })
      .parse(await readJson(request));
    await db.aiCredential.deleteMany({ where: { provider } });
    return aiJson({ id: provider, connected: false, updatedAt: null });
  } catch (error) {
    return aiFailure(error);
  }
}
