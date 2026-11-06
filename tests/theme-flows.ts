import type { Page } from "playwright";
import assert from "node:assert/strict";

export async function reviewTheme(page: Page, base: string, surface: string) {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.goto(base);
  const toggle = page.getByRole("button", {
    name: "Alternar entre modo claro e escuro",
  });
  await toggle.waitFor();
  const theme = () => page.locator("html").getAttribute("data-theme");
  const settle = () =>
    page.waitForFunction(
      () => !document.documentElement.classList.contains("theme-changing"),
    );
  assert.equal(await theme(), "light", "Primeiro acesso segue o sistema");
  await toggle.click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await settle();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("prumo-theme")),
    "dark",
  );
  await page.reload();
  await toggle.waitFor();
  assert.equal(await theme(), "dark", "Tema persiste após recarregar");
  if (surface === "workspace") {
    await page
      .getByRole("button", { name: "Novo lançamento", exact: true })
      .click();
    const dialog = page.locator(".editor-dialog[open]");
    await dialog.waitFor();
    assert.equal(
      await dialog.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(24, 36, 30)",
    );
    await page.screenshot({
      path: ".impeccable/review/theme-dark-dialog.png",
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Configurações", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Configurações", exact: true })
      .waitFor();
    await page.screenshot({
      path: ".impeccable/review/theme-dark-settings.png",
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Visão geral", exact: true })
      .click();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    for (const expected of ["dark", "light"]) {
      if ((await theme()) !== expected) {
        await toggle.click();
        await settle();
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `.impeccable/review/theme-${surface}-${expected}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await toggle.click();
  assert.equal(await theme(), "dark");
  assert.equal(
    await page
      .locator("html")
      .evaluate((el) => el.classList.contains("theme-changing")),
    false,
  );
  await toggle.focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await theme(),
    "light",
    "Teclado alterna sem bloquear a interface",
  );
  await page.evaluate(() => localStorage.removeItem("prumo-theme"));
  await page.emulateMedia({
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  await page.reload();
  await toggle.waitFor();
  assert.equal(await theme(), "dark", "Tema escuro do sistema é respeitado");
  // Restore a known light workspace for the existing regression checks.
  await toggle.click();
  await settle();
  await page.setViewportSize({ width: 1500, height: 1000 });
  console.log(
    `Temas (${surface}): persistência, sistema, desktop, celular, teclado e movimento reduzido: OK.`,
  );
}
