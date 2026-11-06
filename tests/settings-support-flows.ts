import type { Page } from "playwright";
import assert from "node:assert/strict";

export async function reviewSupport(page: Page, base: string) {
  let populated = false;
  await page.route("**/api/data", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.records = data.records.filter(
      (r: { kind: string }) => !["category", "employee"].includes(r.kind),
    );
    if (populated)
      for (const kind of ["category", "employee"])
        for (let i = 0; i < 14; i++) {
          data.records.push({
            id: `support-${kind}-${i}`,
            kind,
            name:
              i === 0
                ? "Nome extenso para conferir a quebra de linha e a edição correta do cadastro"
                : `${kind === "category" ? "Categoria" : "Colaborador"} ${i + 1}`,
          });
        }
    await route.fulfill({ response, json: data });
  });
  try {
    await page.goto(`${base}/?page=settings`);
    await page
      .getByText("Nenhuma categoria cadastrada.", { exact: true })
      .waitFor();
    await page
      .getByText("Nenhum colaborador cadastrado.", { exact: true })
      .waitFor();
    populated = true;
    await page.reload();
    await page.locator(".support-edit").first().waitFor();
    for (const width of [1440, 390])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 950 });
        if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
          await page
            .getByRole("button", { name: "Alternar entre modo claro e escuro" })
            .click();
          await page.waitForFunction(
            () =>
              !document.documentElement.classList.contains("theme-changing"),
          );
        }
        const lists = page.locator(".support-list");
        assert.equal(await lists.count(), 2);
        assert.deepEqual(await lists.locator("li").count(), 28);
        for (const list of await lists.all()) {
          assert.ok(
            await list.evaluate(
              (el) =>
                el.clientHeight <= 288 && el.scrollHeight > el.clientHeight,
            ),
          );
        }
        const groups = await page.locator(".support-group").evaluateAll((els) =>
          els.map((el) => {
            const b = el.getBoundingClientRect();
            return { x: b.x, y: b.y };
          }),
        );
        assert.equal(
          width > 760
            ? groups[0].y === groups[1].y
            : groups[0].x === groups[1].x,
          true,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page
          .locator(".support-panel")
          .screenshot({
            path: `.impeccable/review/support-${theme}-${width}.png`,
            animations: "disabled",
          });
      }
    for (const kind of ["category", "employee"]) {
      const list = page
        .locator(`#support-${kind}-title`)
        .locator("..")
        .locator("..")
        .locator(".support-list");
      await list.locator("button").last().focus();
      await page.keyboard.press("Enter");
      const dialog = page.locator(".editor-dialog[open]");
      await dialog.waitFor();
      assert.equal(await dialog.getAttribute("data-kind"), kind);
      assert.equal(
        await dialog.locator("input").first().inputValue(),
        `${kind === "category" ? "Categoria" : "Colaborador"} 14`,
      );
      await page.keyboard.press("Escape");
    }
    console.log(
      "Cadastros: grupos separados, listas longas, estados vazios, edição por teclado e layout nos dois temas em desktop e celular: OK.",
    );
  } finally {
    await page.unroute("**/api/data");
    await page.setViewportSize({ width: 1500, height: 1000 });
  }
}
