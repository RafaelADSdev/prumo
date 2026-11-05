import type { Page } from "playwright";
import assert from "node:assert/strict";

export async function reviewLogin(page: Page, base: string) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(base);
  await page.getByRole("heading", { name: "Acesse seu financeiro" }).waitFor();
  assert.equal(await page.locator(".access-page img").count(), 0);
  assert.ok(
    await page
      .locator(".access-line")
      .evaluateAll((elements) =>
        elements.some((el) =>
          el
            .getAnimations()
            .some((animation) => animation.playState === "running"),
        ),
      ),
    "A entrada decorativa deve animar",
  );
  await page.evaluate(() => document.fonts.ready);
  for (const viewport of [
    { width: 2540, height: 1360 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(80);
    const geometry = await page.locator(".access-stage").boundingBox();
    assert.ok(geometry);
    assert.ok(
      Math.abs(geometry.x + geometry.width / 2 - viewport.width / 2) < 2,
      `Login centralizado horizontalmente: ${JSON.stringify({ viewport, geometry })}`,
    );
    assert.ok(geometry.y >= 0, "Topo do login acessível");
    assert.ok(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
      "Login sem rolagem horizontal",
    );
    const action = await page
      .getByRole("button", { name: "Entrar no financeiro" })
      .boundingBox();
    assert.ok(
      action && action.y + action.height <= viewport.height,
      "Ação visível",
    );
    await page.screenshot({
      path: `.impeccable/review/login-central-${viewport.width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.getByRole("heading", { name: "Acesse seu financeiro" }).waitFor();
  assert.equal(
    await page
      .locator(".access-stage, .access-line")
      .evaluateAll(
        (elements) =>
          elements
            .flatMap((el) => el.getAnimations())
            .filter((animation) => animation.playState === "running").length,
      ),
    0,
  );
  await page.getByLabel("E-mail", { exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.ok(
    await page
      .getByLabel("Senha", { exact: true })
      .evaluate((el) => el === document.activeElement),
    "Tab alcança senha",
  );
  await page.getByLabel("E-mail", { exact: true }).fill("teste@local.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("senha-incorreta-para-teste");
  await page.route("**/api/auth", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });
  await page.getByRole("button", { name: "Entrar no financeiro" }).click();
  await page.getByRole("button", { name: "Entrando…" }).waitFor();
  assert.ok(await page.getByLabel("Senha", { exact: true }).isDisabled());
  await page
    .getByRole("alert")
    .filter({ hasText: "E-mail ou senha incorretos" })
    .waitFor();
  assert.equal(
    await page
      .locator(".access-error p")
      .evaluate((el) => getComputedStyle(el).color),
    "rgb(255, 209, 187)",
    "Mensagem de erro legível no tema escuro",
  );
  assert.equal(
    await page.getByLabel("E-mail", { exact: true }).inputValue(),
    "teste@local.test",
  );
  assert.ok(
    await page
      .getByRole("button", { name: "Entrar no financeiro" })
      .isEnabled(),
  );
  await page.screenshot({
    path: ".impeccable/review/login-central-error.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.unroute("**/api/auth");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  console.log(
    "Login: centralização em 4 tamanhos, teclado, erro recuperável, carregamento e movimento reduzido: OK.",
  );
}
