import { reviewLogin } from "../tests/login-flows";
import { reviewReports } from "../tests/report-flows";
import { reviewServiceActions } from "../tests/service-action-flows";
import { reviewClientsAndExpenses } from "../tests/client-expense-flows";
import { reviewSupport } from "../tests/settings-support-flows";
import { reviewTheme } from "../tests/theme-flows";
import { reviewMotion, assertCashBars } from "../tests/motion-flows";
import { reviewForms } from "../tests/ui-flows";
import { reviewTemplate } from "../tests/template-flows";
import { fixture } from "../tests/workbook-fixture";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { entrySchema, totals, balance } from "../src/lib/finance";
const dir = mkdtempSync(path.join(tmpdir(), "finance-e2e-")),
  file = path.join(dir, "test.db");
const source = new DatabaseSync("prisma/finance.db", { readOnly: true }),
  target = new DatabaseSync(file);
for (const row of source
  .prepare(
    "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'",
  )
  .all())
  target.exec(String(row.sql));
source.close();
target.close();
const url = "file:" + file.replaceAll("\\", "/"),
  db = new PrismaClient({ datasourceUrl: url });
const password = randomBytes(20).toString("hex");
await db.admin.create({
  data: { id: 1, email: "teste@local.test", hash: await hash(password, 12) },
});
let server: ChildProcess;
const base = "http://127.0.0.1:3101";
async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3101",
    ],
    {
      env: { ...process.env, DATABASE_URL: url, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: "pipe",
    },
  );
  let logs = "";
  server.stderr?.on("data", (b) => (logs += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error("Servidor não iniciou: " + logs);
}
async function stop() {
  if (
    server &&
    !server.killed &&
    server.exitCode === null &&
    server.signalCode === null
  ) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
}
let cookie = "";
async function call(route: string, body?: any, method = "POST") {
  const r = await fetch(base + route, {
    method,
    headers: {
      Origin: base,
      Cookie: cookie,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
try {
  await start();
  assert.equal((await fetch(base + "/api/data")).status, 401);
  assert.equal((await fetch(base + "/api/backup")).status, 401);
  const login = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: "teste@local.test", password }),
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie")!.split(";")[0];
  const entry = entrySchema.parse({
    type: "income",
    description: "Serviço de instalação",
    category: "Serviços",
    amount: 100000,
    competence: "2026-12-01",
    due: "2027-02-01",
  });
  const { id } = await call("/api/data", { kind: "entry", data: entry });
  await call("/api/data", {
    action: "payment",
    id,
    amount: 40000,
    date: "2027-01-10",
    method: "Pix",
  });
  const v = await call("/api/data", {
    kind: "vehicle",
    data: { name: "Veículo de teste", model: "Utilitário" },
  });
  await call("/api/data", {
    kind: "entry",
    data: entrySchema.parse({
      type: "expense",
      description: "Abastecimento",
      category: "Combustível",
      amount: 15000,
      competence: "2027-01-10",
      vehicleId: v.id,
      payments: [
        { id: "fuel-paid", amount: 15000, date: "2027-01-10", method: "Pix" },
      ],
    }),
  });
  await call("/api/data", {
    kind: "recurrence",
    data: {
      description: "Contador",
      category: "Contador",
      amount: 30000,
      day: 31,
      start: "2027-01-01",
      end: null,
      active: true,
    },
  });
  assert.equal(
    (await call("/api/data", { action: "generate", year: 2027, month: 2 }))
      .count,
    1,
  );
  assert.equal(
    (await call("/api/data", { action: "generate", year: 2027, month: 2 }))
      .count,
    0,
  );
  const client = await call("/api/data", {
    kind: "client",
    data: { name: "Cliente de teste" },
  });
  const service = await call("/api/data", {
    kind: "service",
    data: {
      clientId: client.id,
      description: "Serviço sem preço",
      date: null,
      competence: "2027-01-01",
      status: "Agendado",
      items: [
        {
          description: "Elétrica",
          quantity: "a definir",
          unit: "",
          amount: null,
        },
      ],
      discount: 0,
    },
  });
  let state = await call("/api/data", undefined, "GET");
  let es = state.records.filter((r: any) => r.kind === "entry");
  assert.equal(balance(es.find((e: any) => e.id === id)), 60000);
  assert.equal(totals(es, "2027", "01").income, 40000);
  assert.equal(totals(es, "2026", "12", "accrual").income, 100000);
  assert.equal(totals(es, "2027", "01").expense, 15000);
  assert.equal(es.find((e: any) => e.serviceId === service.id).amount, null);
  const backup = await call("/api/backup", undefined, "GET");
  await call("/api/data", {
    kind: "entry",
    id,
    data: {
      ...entry,
      description: "Valor editado",
      amount: 120000,
      payments: es.find((e: any) => e.id === id).payments,
    },
  });
  state = await call("/api/data", undefined, "GET");
  assert.equal(state.records.find((e: any) => e.id === id).amount, 120000);
  await call("/api/backup", { backup });
  await call("/api/backup", { backup, confirm: "RESTAURAR" });
  await stop();
  await start();
  state = await call("/api/data", undefined, "GET");
  assert.equal(state.records.find((e: any) => e.id === id).amount, 100000);
  assert.equal(
    state.records.filter((r: any) => r.kind === "vehicle").length,
    1,
  );
  const browser = await chromium.launch({
    headless: true,
    executablePath: [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ].find(existsSync),
  });
  const loginContext = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1440, height: 950 },
  });
  const loginPage = await loginContext.newPage();
  if (process.argv.includes("--review-theme")) {
    await reviewTheme(loginPage, base, "login");
    await loginPage
      .getByRole("button", { name: "Alternar entre modo claro e escuro" })
      .click();
    await loginPage.waitForFunction(
      () => !document.documentElement.classList.contains("theme-changing"),
    );
  }
  await reviewLogin(loginPage, base);
  await loginPage
    .getByLabel("E-mail", { exact: true })
    .fill("teste@local.test");
  await loginPage.getByLabel("Senha", { exact: true }).fill(password);
  await loginPage
    .getByRole("button", { name: "Mostrar senha", exact: true })
    .click();
  assert.equal(
    await loginPage.getByLabel("Senha", { exact: true }).getAttribute("type"),
    "text",
  );
  await loginPage
    .getByRole("button", { name: "Ocultar senha", exact: true })
    .click();
  await loginPage
    .getByRole("button", { name: "Entrar no financeiro", exact: true })
    .click();
  await loginPage
    .getByRole("heading", { name: "Visão geral", exact: true })
    .waitFor();
  await loginContext.close();
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
  });
  await context.addCookies([
    { name: "finance-session", value: cookie.split("=")[1], url: base },
  ]);
  const page = await context.newPage();
  if (process.argv.includes("--review-support"))
    await reviewSupport(page, base);
  if (process.argv.includes("--review-theme"))
    await reviewTheme(page, base, "workspace");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/?year=2027&month=all");
  if (
    process.env.REVIEW_FORMS === "1" ||
    process.argv.includes("--review-forms")
  ) {
    await reviewForms(page, base);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(base + "/?year=2027&month=all");
  }
  await page.getByText("Recebimentos efetivos", { exact: true }).waitFor();
  await page
    .getByText("Atualizando dados…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.waitForTimeout(700);
  assert.ok(
    await page
      .locator(".recharts-bar-rectangle")
      .evaluateAll(
        (els) =>
          els.filter((e) => e.getBoundingClientRect().height > 0).length >= 2,
      ),
    "As duas séries do gráfico precisam mostrar os dados reais",
  );
  await assertCashBars(page);
  await page.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Novo lançamento", exact: true })
    .click();
  await page.getByRole("heading", { name: "Novo lançamento" }).waitFor();
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Entrada pela interface");
  await page.getByLabel("Tipo", { exact: true }).selectOption("income");
  await page.getByLabel("Valor (R$)", { exact: true }).fill("75,90");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await page.getByText("Entrada pela interface", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("Entrada pela interface", { exact: true }).waitFor();
  await page
    .getByText("Atualizando dados…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  console.log(
    "mobile overflow",
    await page.evaluate(() =>
      Array.from(document.querySelectorAll("*"))
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 2)
        .map((e) => ({ tag: e.tagName, cls: e.className }))
        .slice(0, 8),
    ),
  );
  await assertCashBars(page);
  await page.screenshot({
    path: ".impeccable/review/mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  if (process.argv.includes("--review-motion")) await reviewMotion(page, base);
  if (process.argv.includes("--review-clients"))
    await reviewClientsAndExpenses(page, base);
  if (process.argv.includes("--review-services"))
    await reviewServiceActions(page, base);
  if (process.argv.includes("--review-reports"))
    await reviewReports(page, base);
  assert.deepEqual(errors, []);
  await db.record.deleteMany();
  await page.goto(base + "/?page=overview&year=2026&month=all");
  await page
    .getByText("Atualizando dados…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.getByText("Um começo simples. Uma visão mais clara.").waitFor();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: ".impeccable/review/prumo-empty.png",
    fullPage: true,
    animations: "disabled",
  });
  await reviewTemplate(page, base);
  assert.deepEqual(errors, []);
  await browser.close();
  const imp = new FormData();
  imp.set("file", new File([fixture()], "teste.xlsx"));
  const prep = await call("/api/import", imp);
  assert.equal(
    prep.candidates
      .filter((c: any) => c.kind === "expense")
      .reduce((n: number, c: any) => n + c.amount, 0),
    38995,
  );
  imp.set("action", "confirm");
  imp.set("edits", JSON.stringify(prep.candidates));
  await call("/api/import", imp);
  const repeat = await fetch(base + "/api/import", {
    method: "POST",
    headers: { Origin: base, Cookie: cookie },
    body: imp,
  });
  assert.equal(repeat.status, 400);
  const imported = (await call("/api/data", undefined, "GET")).records;
  const importedService = imported.find(
    (r: any) => r.kind === "service" && r.description === "Cliente teste",
  );
  await call("/api/data", {
    kind: "service",
    id: importedService.id,
    data: {
      ...importedService,
      items: [
        {
          description: "Serviço revisto",
          quantity: "1",
          unit: "un",
          amount: 120000,
        },
      ],
    },
  });
  const afterService = (
    await call("/api/data", undefined, "GET")
  ).records.filter(
    (r: any) => r.kind === "entry" && r.serviceId === importedService.id,
  );
  assert.equal(afterService.length, 1);
  assert.equal(afterService[0].amount, 120000);
  await call("/api/data", {
    kind: "entry",
    id: afterService[0].id,
    data: { ...afterService[0], review: false },
  });
  const importedBackup = await call("/api/backup", undefined, "GET");
  await call("/api/backup", { backup: importedBackup });
  console.log("Importação e reimportação idempotente: OK");
  console.log(
    "E2E: autenticação, persistência após reinício, baixas parciais, caixa/competência, veículo sem duplicação, recorrência idempotente, serviço sem preço, edição, backup/restauração e formulário no navegador: OK.",
  );
} finally {
  await stop();
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
}
