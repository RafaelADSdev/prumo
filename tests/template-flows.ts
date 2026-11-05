import type { Page } from "playwright";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { templateFixture } from "./template-fixture";

export async function reviewTemplate(page: Page, base: string) {
  await page.goto(`${base}/?page=settings&year=2027&month=all`);
  const link = page.getByRole("link", { name: "Baixar modelo de planilha" });
  await link.waitFor();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    link.click(),
  ]);
  assert.equal(download.suggestedFilename(), "modelo-importacao-prumo.xlsx");
  const downloaded = await download.path();
  assert.ok(downloaded);
  assert.deepEqual(
    readFileSync(downloaded),
    readFileSync("public/modelo-importacao-prumo.xlsx"),
  );
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `.impeccable/review/template-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  const buffer = Buffer.from(
    templateFixture([
      [
        "Receita",
        "Receita modelo teste",
        "Vendas",
        "125.50",
        "2027-03",
        "15/04/2027",
        "Cliente teste",
        "",
      ],
      [
        "Despesa",
        "Despesa modelo teste",
        "Materiais",
        "48,90",
        "2027-03",
        "",
        "",
        "",
      ],
    ]),
  );
  await page
    .getByLabel("Selecionar planilha", { exact: true })
    .setInputFiles({
      name: "modelo-preenchido.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
  await page
    .getByRole("button", { name: "Preparar importação", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Revisão · modelo-preenchido.xlsx" })
    .waitFor();
  let state = await (await page.request.get(`${base}/api/data`)).json();
  assert.equal(
    state.records.filter((r: any) => r.description?.endsWith("modelo teste"))
      .length,
    0,
  );
  await page
    .getByRole("button", { name: "Confirmar importação", exact: true })
    .click();
  await page
    .locator(".confirmation-dialog[open]")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await page.locator(".confirmation-dialog[open]").waitFor({ state: "hidden" });
  state = await (await page.request.get(`${base}/api/data`)).json();
  const rows = state.records.filter((r: any) =>
    r.description?.endsWith("modelo teste"),
  );
  assert.equal(rows.length, 2);
  assert.ok(
    rows.every(
      (r: any) => r.competence === "2027-03-01" && r.payments.length === 0,
    ),
  );
  assert.equal(rows.find((r: any) => r.type === "income").amount, 12550);
  assert.equal(rows.find((r: any) => r.type === "expense").amount, 4890);
  const repeat = await page.request.post(`${base}/api/import`, {
    headers: { Origin: base },
    multipart: {
      file: {
        name: "modelo-preenchido.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer,
      },
    },
  });
  assert.equal(repeat.status(), 400);
  console.log(
    "Modelo XLSX: download, revisão sem gravar, importação e proteção contra reimportação: OK",
  );
}
