import type { PrismaClient } from "@prisma/client";
import { AiError, hasCode } from "./errors";

export async function reserveQuota(
  db: PrismaClient,
  action: "message" | "key-test",
) {
  const limit = action === "message" ? 10 : 5;
  const window = Math.floor(Date.now() / 60_000);
  for (let attempt = 0; ; attempt++) {
    try {
      await db.$transaction(
        async (tx) => {
          const bucket = await tx.aiQuota.findUnique({ where: { id: action } });
          const count = bucket?.window === window ? bucket.count : 0;
          if (count >= limit)
            throw new AiError(
              "Aguarde um minuto antes de tentar novamente.",
              429,
            );
          const data = { window, count: count + 1 };
          await tx.aiQuota.upsert({
            where: { id: action },
            create: { id: action, ...data },
            update: data,
          });
        },
        { isolationLevel: "Serializable" },
      );
      return;
    } catch (error) {
      if (attempt < 2 && (hasCode(error, "P2034") || hasCode(error, "P2002")))
        continue;
      throw error;
    }
  }
}
