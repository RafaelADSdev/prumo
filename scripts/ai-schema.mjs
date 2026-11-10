const tables = [
  "AiCredential",
  "AiConversation",
  "AiMessage",
  "AiProposal",
  "AiQuota",
];

const statements = [
  `CREATE TABLE IF NOT EXISTS "AiCredential" (
    provider TEXT PRIMARY KEY, "encryptedKey" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "AiConversation" (
    id TEXT PRIMARY KEY, provider TEXT NOT NULL, title TEXT NOT NULL,
    "pendingTurn" TEXT, "pendingUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "AiMessage" (
    id TEXT PRIMARY KEY, "conversationId" TEXT NOT NULL REFERENCES "AiConversation"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "turnId" TEXT NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, sources TEXT NOT NULL DEFAULT '[]',
    attachment TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "AiProposal" (
    id TEXT PRIMARY KEY, "conversationId" TEXT NOT NULL REFERENCES "AiConversation"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "turnId" TEXT NOT NULL, filename TEXT NOT NULL, "fileHash" TEXT NOT NULL, items TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending', receipt TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "AiQuota" (
    id TEXT PRIMARY KEY, "window" INTEGER NOT NULL, count INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "AiConversation_updatedAt_id_idx" ON "AiConversation" ("updatedAt", id)`,
  `CREATE INDEX IF NOT EXISTS "AiMessage_conversationId_createdAt_id_idx" ON "AiMessage" ("conversationId", "createdAt", id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AiMessage_conversationId_turnId_role_key" ON "AiMessage" ("conversationId", "turnId", role)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AiProposal_conversationId_turnId_key" ON "AiProposal" ("conversationId", "turnId")`,
];

export async function installAiSchema(tx, schema) {
  if (!/^prumo(?:_[a-f0-9]{32})?$/.test(schema))
    throw Error("Espaço inválido.");
  const [row] =
    await tx.$queryRaw`SELECT to_regclass(${schema + '."Record"'})::text AS present`;
  if (!row?.present)
    throw Error(
      "Provisione o espaço financeiro " + schema + " antes do assistente.",
    );
  await tx.$queryRaw`SELECT set_config('search_path', quote_ident(${schema}), true)`;
  for (const statement of statements) await tx.$executeRawUnsafe(statement);
  for (const table of tables) {
    await tx.$executeRawUnsafe(
      `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
    );
    await tx.$executeRawUnsafe(
      `REVOKE ALL ON TABLE "${table}" FROM PUBLIC, anon, authenticated`,
    );
  }
}
