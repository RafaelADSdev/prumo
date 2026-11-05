import { PrismaClient } from "@prisma/client";
import { PrismaClient as SupabaseClient } from "@prumo/supabase-client";
import path from "node:path";
const g = globalThis as unknown as { prisma: PrismaClient };
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw Error("Configure DATABASE_URL no servidor.");
  if (url.startsWith("file:")) return new PrismaClient({ datasourceUrl: url });
  if (!/^postgres(ql)?:\/\//.test(url))
    throw Error("Tipo de banco não suportado.");
  const connection = new URL(url);
  const certificate = connection.searchParams.get("sslcert");
  if (certificate && !path.isAbsolute(certificate))
    connection.searchParams.set("sslcert", path.resolve("prisma", certificate));
  // Both generated clients share the same models; only their connector differs.
  return new SupabaseClient({
    datasourceUrl: connection.toString(),
  }) as unknown as PrismaClient;
}
export const db = g.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
