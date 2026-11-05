import type { Page } from "playwright";
import assert from "node:assert/strict";
export async function reviewForms(page: Page, base: string) {
  const cases = [
    ["entries", "Novo lançamento", "entry"],
    ["services", "Novo cliente", "client"],
    ["services", "Novo serviço", "service"],
    ["fixed", "Nova despesa fixa", "recurrence"],
    ["vehicles", "Cadastrar veículo", "vehicle"],
    ["vehicles", "Abastecimento", "fuel"],
    ["vehicles", "Registrar manutenção", "maintenance"],
    ["settings", "Editar configurações", "settings"],
    ["settings", "Nova categoria", "category"],
    ["settings", "Novo colaborador", "employee"],
    ["settings", "Registrar pagamento", "payroll"],
  ];
  for (const viewport of [
    { width: 2540, height: 1360 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [route, label, key] of cases) {
      await page.goto(`${base}/?page=${route}&year=2027&month=01`);
      await page
        .getByText("Atualizando dados…", { exact: true })
        .waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: label, exact: true })
        .first()
        .click();
      const dialog = page.locator("dialog[open]");
      await dialog.waitFor();
      await page.waitForTimeout(200);
      assert.ok(
        await dialog
          .locator("input:not([type=checkbox]),select,textarea")
          .first()
          .evaluate((el) => el === document.activeElement),
        `Foco inicial incorreto: ${key}`,
      );
      const b = await dialog.boundingBox();
      assert.ok(b, `Diálogo ausente: ${key}`);
      assert.ok(
        Math.abs(
          b.x +
            b.width / 2 -
            (await page.evaluate(() => document.documentElement.clientWidth)) /
              2,
        ) < 3,
        `Diálogo ${key} fora do centro em ${viewport.width}px: x=${b.x}, largura=${b.width}`,
      );
      assert.ok(
        b.y >= -1 && b.y + b.height <= viewport.height + 1,
        `Diálogo ${key} cortado verticalmente`,
      );
      const save = dialog.locator("button[type=submit]");
      const sb = await save.boundingBox();
      assert.ok(
        sb && sb.y >= b.y && sb.y + sb.height <= b.y + b.height + 1,
        `Salvar não está visível: ${key}`,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `Página transborda: ${key}`,
      );
      if (
        viewport.width === 2540 ||
        (viewport.width === 390 &&
          ["entry", "service", "fuel", "client"].includes(key))
      )
        await page.screenshot({
          path: `.impeccable/review/forms-${key}-${viewport.width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      if (["entry", "fuel", "service"].includes(key)) {
        await dialog.locator(".form-details>summary").first().click();
        if (key === "service")
          for (let i = 0; i < 3; i++)
            await dialog
              .getByRole("button", { name: "Adicionar item", exact: true })
              .click();
        await dialog
          .locator(".form-content")
          .evaluate((el) => (el.scrollTop = el.scrollHeight));
        const expanded = await dialog.boundingBox();
        const footer = await save.boundingBox();
        assert.ok(
          expanded &&
            footer &&
            footer.y >= expanded.y &&
            footer.y + footer.height <= expanded.y + expanded.height + 1 &&
            footer.y + footer.height <= viewport.height,
          `Salvar saiu da tela após expandir ${key}`,
        );
        if (viewport.width === 390 && key === "service")
          await page.screenshot({
            path: ".impeccable/review/forms-service-expanded-390.png",
            fullPage: true,
            animations: "disabled",
          });
      }
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
    }
    await page.goto(`${base}/?page=settings&year=2027&month=01`);
    await page
      .getByText("Atualizando dados…", { exact: true })
      .waitFor({ state: "hidden" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `.impeccable/review/settings-${viewport.width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.goto(`${base}/?page=settings&year=2027&month=01`);
  await page
    .getByText("Atualizando dados…", { exact: true })
    .waitFor({ state: "hidden" });
  const backup = await (await page.request.get(base + "/api/backup")).json();
  await page.getByLabel("Selecionar backup", { exact: true }).setInputFiles({
    name: "backup-teste.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page
    .getByRole("button", { name: "Confirmar restauração", exact: true })
    .click();
  const confirmation = page.locator(".confirmation-dialog[open]");
  await confirmation.waitFor();
  const c = await confirmation.boundingBox();
  assert.ok(
    c &&
      Math.abs(
        c.x +
          c.width / 2 -
          (await page.evaluate(() => document.documentElement.clientWidth)) / 2,
      ) < 3,
  );
  await page.keyboard.press("Escape");
  await page.getByLabel("Selecionar backup", { exact: true }).setInputFiles({
    name: "invalido.json",
    mimeType: "application/json",
    buffer: Buffer.from("nao e json"),
  });
  await page
    .locator(".workspace [role=alert]")
    .filter({ hasText: "Este arquivo não é um backup JSON válido." })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirmar restauração", exact: true })
      .count(),
    0,
  );
  await page.goto(`${base}/?page=entries&year=2026&month=12`);
  await page
    .getByText("Atualizando dados…", { exact: true })
    .waitFor({ state: "hidden" });
  await page
    .getByRole("button", {
      name: "Registrar baixa de Serviço de instalação",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "Registrar recebimento", exact: true })
    .waitFor();
  const payment = page.locator(".editor-dialog[open]");
  const pb = await payment.boundingBox();
  assert.ok(pb && pb.y >= 0 && pb.y + pb.height <= 844);
  await page.keyboard.press("Escape");
  console.log(
    "Revisão: 11 formulários em monitor amplo, notebook e celular; centralização, ações visíveis, Escape e ausência de transbordamento: OK.",
  );
}
