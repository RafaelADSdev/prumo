import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

async function main() {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!rawUrl || !key)
    throw Error(
      "Configure SUPABASE_URL e SUPABASE_SECRET_KEY no .env do servidor.",
    );
  const url = new URL(rawUrl);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    url.username ||
    url.password
  )
    throw Error("SUPABASE_URL deve ser a URL HTTPS do projeto Supabase.");
  let response;
  try {
    response = await fetch(new URL("/rest/v1/", url), {
      headers: { apikey: key },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Error(
      "Não foi possível alcançar o Supabase. Confira a conexão e a URL do projeto.",
    );
  }
  if (!response.ok)
    throw Error(
      `Supabase recusou a conexão (HTTP ${response.status}). Confira a chave secreta do servidor.`,
    );
  const schema = await response.json();
  const count = Object.keys(schema.paths || {}).filter(
    (path) => path !== "/" && !path.startsWith("/rpc/"),
  ).length;
  console.log(
    `Conexão com a API Supabase: OK. Tabelas disponíveis na API: ${count}.`,
  );
  console.log(
    "Este teste não altera dados. A aplicação continua usando o banco definido em DATABASE_URL.",
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
