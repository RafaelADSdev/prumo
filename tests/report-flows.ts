import type { Page } from "playwright";
import assert from "node:assert/strict";
import { reportRows, summarizeRows } from "../src/lib/reports";
import { money } from "../src/lib/finance";

export async function reviewReports(page: Page, base: string) {
  const response = await page.request.get(base + "/api/data");
  const { records } = await response.json();
  const entries = records.filter((r: { kind: string }) => r.kind === "entry");
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(base + "/?page=reports&year=2027&month=all");
    await page.locator('.financial-reports[aria-busy="false"]').waitFor();
    await page
      .getByRole("heading", { name: "De onde veio o dinheiro", exact: true })
      .waitFor();
    for (const basis of ["cash", "accrual"] as const) {
      await page
        .getByRole("button", {
          name: basis === "cash" ? "Caixa" : "Competência",
          exact: true,
        })
        .click();
      const expected = summarizeRows(reportRows(entries, "2027", "all", basis));
      await page
        .locator(".report-metrics")
        .getByText(money(expected.income), { exact: true })
        .first()
        .waitFor();
      assert.equal(
        await page
          .locator(".report-metric.report-expense > strong")
          .textContent(),
        money(expected.expense),
      );
      assert.equal(
        await page.locator(".report-metric.report-net > strong").textContent(),
        money(expected.net),
      );
      const category = await page
        .getByLabel("Categoria do relatório", { exact: true })
        .locator("option")
        .nth(1)
        .textContent();
      if (category) {
        await page
          .getByLabel("Categoria do relatório", { exact: true })
          .selectOption(category);
        const filtered = summarizeRows(
          reportRows(entries, "2027", "all", basis).filter(
            (r) => r.entry.category === category,
          ),
        );
        assert.equal(
          await page
            .locator(".report-metric.report-net > strong")
            .textContent(),
          money(filtered.net),
        );
        await page
          .getByRole("button", { name: "Limpar filtros", exact: true })
          .click();
      }
    }
    await page.getByRole("button", { name: "Caixa", exact: true }).click();
    await page
      .getByLabel("Buscar no detalhamento", { exact: true })
      .fill("naoexiste12345");
    await page
      .getByText("Nenhuma movimentação encontrada.", { exact: true })
      .waitFor();
    await page.getByLabel("Buscar no detalhamento", { exact: true }).fill("");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar CSV", exact: true })
      .click();
    assert.equal(
      (await download).suggestedFilename(),
      "relatorio-cash-2027-all.csv",
    );
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({
        colorScheme: theme as "light" | "dark",
        reducedMotion: "reduce",
      });
      await page.reload();
      await page.locator('.financial-reports[aria-busy="false"]').waitFor();
      await page.screenshot({
        path: `.impeccable/review/reports-${viewport.width}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Relatório transborda a tela",
      );
      assert.ok(
        (await page.locator(".report-chart .recharts-surface").count()) >= 1,
      );
    }
    await page.goto(base + "/?page=reports&year=2027&month=01");
    await page.locator('.financial-reports[aria-busy="false"]').waitFor();
    await page.getByText(/Comparação dia a dia/).waitFor();
    assert.equal(
      await page.locator(".report-metric.report-net > strong").textContent(),
      money(summarizeRows(reportRows(entries, "2027", "01", "cash")).net),
    );
  }
  console.log(
    "Relatórios: totais, regimes, filtros, busca, CSV, período mensal, temas e responsividade: OK",
  );
}
