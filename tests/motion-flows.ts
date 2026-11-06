import type { Page } from "playwright";
import assert from "node:assert/strict";
export async function reviewMotion(page: Page, base: string) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(base + "/?page=overview&year=2027&month=all");
  await page
    .getByText("Atualizando dados…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "full",
  );
  await page
    .getByRole("button", { name: "Serviços e clientes", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Serviços e clientes", exact: true })
    .waitFor();
  assert.ok(
    await page
      .locator(".page-content")
      .evaluate((e) =>
        e.getAnimations().some((a) => a.playState === "running"),
      ),
    "A navegação não iniciou animação",
  );
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+k");
  await page
    .getByRole("combobox", { name: "Buscar tela ou ação" })
    .fill("veículos");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Veículos", exact: true }).waitFor();
  assert.equal(await page.locator(".command-dialog[open]").count(), 0);
  assert.equal(
    await page.getByLabel("Ano", { exact: true }).inputValue(),
    "2027",
  );
  assert.equal(
    await page.getByLabel("Mês", { exact: true }).inputValue(),
    "all",
  );
  await page
    .getByRole("button", { name: "Novo lançamento", exact: true })
    .click();
  await page.locator(".editor-dialog[open]").waitFor();
  assert.ok(
    await page
      .locator(".editor-dialog")
      .evaluate((e) =>
        e.getAnimations().some((a) => a.playState === "running"),
      ),
    "O formulário não iniciou animação",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".editor-dialog[open]").count(), 0);
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByRole("switch", { name: "Ativar animações" }).waitFor();
  await page.getByRole("switch", { name: "Ativar animações" }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "reduced",
  );
  await page
    .getByRole("button", { name: "Novo lançamento", exact: true })
    .click();
  assert.equal(
    await page
      .locator(".editor-dialog")
      .evaluate(
        (e) =>
          e.getAnimations().filter((a) => a.playState === "running").length,
      ),
    0,
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await page
    .getByText("Atualizando dados…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "reduced",
  );
  assert.equal(
    await page
      .getByRole("switch", { name: "Ativar animações" })
      .getAttribute("aria-checked"),
    "false",
  );
  await page.getByRole("switch", { name: "Ativar animações" }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "full",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "reduced",
  );
  await page
    .getByRole("button", { name: "Novo lançamento", exact: true })
    .click();
  assert.equal(
    await page
      .locator(".editor-dialog")
      .evaluate(
        (e) =>
          e.getAnimations().filter((a) => a.playState === "running").length,
      ),
    0,
  );
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Registro com movimento reduzido");
  await page.getByLabel("Valor (R$)", { exact: true }).fill("15,00");
  await page.getByLabel("Mês de referência", { exact: true }).fill("2027-01");
  await page
    .getByRole("button", { name: "Salvar lançamento", exact: true })
    .click();
  await page.locator(".editor-dialog[open]").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await page
    .getByText("Registro com movimento reduzido", { exact: true })
    .waitFor();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "full",
  );
  for (const route of ["Visão geral", "Relatórios", "Veículos"])
    await page
      .getByRole("button", { name: route, exact: true })
      .click({ force: true });
  await page.getByRole("heading", { name: "Veículos", exact: true }).waitFor();
  await page.waitForTimeout(350);
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await page
    .getByRole("button", { name: "Abrir navegação rápida", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Buscar tela ou ação" })
    .fill("relatórios");
  await page.getByRole("option", { name: /Relatórios/ }).click();
  await page
    .getByRole("heading", { name: "Relatórios", exact: true })
    .waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: ".impeccable/review/perspective-reports.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "Movimento: navegação e formulários animam; teclado, cliques rápidos, busca, preferência persistente e movimento reduzido com gravação funcional: OK.",
  );
}

export async function assertCashBars(page: Page) {
  const g = await page.locator(".comparison").evaluate((el) => {
    const ticks = Array.from(el.querySelectorAll("svg text")).map((t) => ({
      label: t.textContent,
      y: t.getBoundingClientRect().y,
    }));
    const top = ticks.find((t) => t.label === "400"),
      zero = ticks.find((t) => t.label === "0");
    const grid = Array.from(
      el.querySelectorAll(".recharts-cartesian-grid-horizontal line"),
    ).map((l) => l.getBoundingClientRect().y);
    const paths = Array.from(
      el.querySelectorAll(".recharts-bar-rectangle path"),
    ).map((p) => ({
      income: Boolean(p.closest(".cash-income")),
      expense: Boolean(p.closest(".cash-outgoing")),
      height: p.getBoundingClientRect().height,
    }));
    return {
      range:
        top && zero && grid.length > 1
          ? Math.max(...grid) - Math.min(...grid)
          : 0,
      income: Math.max(
        0,
        ...paths.filter((p) => p.income).map((p) => p.height),
      ),
      expense: Math.max(
        0,
        ...paths.filter((p) => p.expense).map((p) => p.height),
      ),
    };
  });
  assert.ok(g.range > 0, "Escala financeira não encontrada");
  assert.ok(
    Math.abs(g.income - g.range) < 2,
    `Entrada R$400 deve coincidir com eixo400: ${JSON.stringify(g)}`,
  );
  assert.ok(
    Math.abs(g.expense - (g.range * 150) / 400) < 2,
    `Saída R$150 deve manter proporção exata: ${JSON.stringify(g)}`,
  );
}
