import type { Page } from "playwright";
import assert from "node:assert/strict";
import { totals, paid, type Entry } from "../src/lib/finance";

export async function reviewServiceActions(page: Page, base: string) {
  const request = async (body: unknown) => {
    const response = await page.request.post(base + "/api/data", {
      headers: { Origin: base },
      data: body,
    });
    const json = await response.json();
    assert.ok(response.ok(), JSON.stringify(json));
    return json;
  };
  const records = async () =>
    (await (await page.request.get(base + "/api/data")).json())
      .records as Record<string, any>[];
  const client = await request({
    kind: "client",
    data: {
      name: "Cliente para recebimentos",
      phone: "81911110003",
      address: "Rua de teste, 3",
    },
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/?page=services&year=2032&month=01");
  await page
    .getByRole("button", { name: "Novo serviço", exact: true })
    .first()
    .click();
  const dialog = page.locator(".editor-dialog[open]");
  await dialog.getByLabel("Cliente", { exact: true }).selectOption(client.id);
  await dialog
    .getByLabel("Descrição", { exact: true })
    .first()
    .fill("Instalação com recebimento");
  await dialog.getByLabel("Total do item (R$)", { exact: true }).fill("100,00");
  await dialog
    .getByLabel("Situação do pagamento", { exact: true })
    .selectOption("settle");
  await dialog
    .getByLabel("Data do recebimento", { exact: true })
    .fill("2032-01-05");
  await dialog.getByLabel("Forma de recebimento", { exact: true }).fill("Pix");
  await dialog
    .getByRole("button", { name: "Salvar serviço", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  const serviceRow = page
    .getByRole("row")
    .filter({ hasText: "Instalação com recebimento" });
  await serviceRow.getByText("Pago", { exact: true }).waitFor();
  assert.ok((await serviceRow.innerText()).includes("Pix"));
  let state = await records();
  const service = state.find(
    (r) =>
      r.kind === "service" && r.description === "Instalação com recebimento",
  )!;
  let linked = state.find(
    (r) => r.kind === "entry" && r.serviceId === service.id,
  )!;
  assert.equal(paid(linked as Entry), 10000);
  await request({
    kind: "service",
    id: service.id,
    data: service,
    receipt: { action: "settle", date: "2032-01-05", method: "Pix" },
  });
  linked = (await records()).find((r) => r.id === linked.id)!;
  assert.equal(
    linked.payments.length,
    1,
    "Repetir a quitação não duplica recebimento",
  );
  await serviceRow.getByRole("button", { name: "Editar", exact: true }).click();
  await dialog
    .getByLabel("Situação do pagamento", { exact: true })
    .selectOption("unpaid");
  await dialog
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Marcar serviço como não pago?",
      exact: true,
    })
    .waitFor();
  await page
    .locator(".confirmation-dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await serviceRow.getByText("Não pago", { exact: true }).waitFor();
  linked = (await records()).find((r) => r.id === linked.id)!;
  assert.equal(paid(linked as Entry), 0);
  assert.equal(linked.payments[0].method, "Pix");
  assert.equal(linked.payments[0].voided, true);
  await request({
    action: "payment",
    id: linked.id,
    amount: 3000,
    date: "2032-01-06",
    method: "Transferência",
  });
  await page.reload();
  await serviceRow
    .getByRole("button", {
      name: "Receber serviço: Instalação com recebimento",
      exact: true,
    })
    .click();
  await dialog
    .getByLabel("Data do recebimento", { exact: true })
    .fill("2032-01-07");
  await dialog
    .getByLabel("Forma de recebimento", { exact: true })
    .fill("Dinheiro");
  await dialog
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  linked = (await records()).find((r) => r.id === linked.id)!;
  assert.equal(linked.payments.at(-1).amount, 7000);
  assert.equal(paid(linked as Entry), 10000);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
        await page
          .getByRole("button", { name: "Alternar entre modo claro e escuro" })
          .click();
        await page.waitForFunction(
          () => !document.documentElement.classList.contains("theme-changing"),
        );
      }
      await serviceRow
        .getByRole("button", { name: "Editar", exact: true })
        .click();
      await dialog
        .getByLabel("Situação do pagamento", { exact: true })
        .selectOption("settle");
      await dialog.locator(".service-receipt").scrollIntoViewIfNeeded();
      await dialog.screenshot({
        path: `.impeccable/review/service-payment-${theme}-${width}.png`,
        animations: "disabled",
      });
      const bounds = await dialog.boundingBox();
      assert.ok(
        bounds &&
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= width + 1,
      );
      await page.keyboard.press("Escape");
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const unknown = await request({
    kind: "service",
    data: {
      clientId: client.id,
      description: "Sem preço preservado",
      date: null,
      competence: "2032-01-01",
      status: "Em andamento",
      items: [
        { description: "Item", quantity: "1", unit: "un.", amount: null },
      ],
    },
  });
  const unknownRecord = (await records()).find((r) => r.id === unknown.id)!;
  const invalid = await page.request.post(base + "/api/data", {
    headers: { Origin: base },
    data: {
      kind: "service",
      id: unknown.id,
      data: { ...unknownRecord, description: "Não deve salvar" },
      receipt: { action: "settle", date: "2032-01-07", method: "Pix" },
    },
  });
  assert.equal(invalid.ok(), false);
  assert.equal(
    (await records()).find((r) => r.id === unknown.id)!.description,
    "Sem preço preservado",
    "Erro de recebimento desfaz toda a transação",
  );

  await serviceRow
    .getByRole("button", {
      name: "Remover serviço: Instalação com recebimento",
      exact: true,
    })
    .click();
  await page
    .locator(".confirmation-dialog")
    .getByRole("button", { name: "Voltar", exact: true })
    .click();
  assert.equal(
    (await records()).find((r) => r.id === service.id)!.archived,
    undefined,
  );
  await serviceRow
    .getByRole("button", {
      name: "Remover serviço: Instalação com recebimento",
      exact: true,
    })
    .click();
  await page
    .locator(".confirmation-dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await serviceRow.waitFor({ state: "hidden" });
  state = await records();
  assert.equal(state.find((r) => r.id === service.id)!.archived, true);
  assert.equal(paid(state.find((r) => r.id === linked.id) as Entry), 10000);
  assert.equal(
    totals(state.filter((r) => r.kind === "entry") as Entry[], "2032", "01")
      .income,
    10000,
  );
  await request({ action: "archive", id: service.id });
  const history = await (await page.request.get(base + "/api/data")).json();
  assert.equal(
    history.audit.filter(
      (a: { action: string; entityId: string }) =>
        a.action === "archive" && a.entityId === service.id,
    ).length,
    1,
  );
  const invalidArchive = await page.request.post(base + "/api/data", {
    headers: { Origin: base },
    data: { action: "archive", id: linked.id },
  });
  assert.equal(invalidArchive.ok(), false);
  await page
    .getByRole("button", {
      name: "Ver cliente: Cliente para recebimentos",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Remover cliente", exact: true })
    .click();
  await page
    .locator(".confirmation-dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Ver cliente: Cliente para recebimentos",
      exact: true,
    })
    .waitFor({ state: "hidden" });
  assert.equal(
    (await records()).find((r) => r.id === client.id)!.archived,
    true,
  );
  assert.ok(
    (await records()).some((r) => r.id === unknown.id),
    "Remover cliente preserva serviços vinculados",
  );
  await page
    .getByRole("button", { name: "Novo serviço", exact: true })
    .first()
    .click();
  assert.equal(
    await dialog
      .getByLabel("Cliente", { exact: true })
      .locator(`option[value="${client.id}"]`)
      .count(),
    0,
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1500, height: 1000 });
  console.log(
    "Serviços: pago/não pago, quitação parcial sem duplicar, forma/data, estorno confirmado, atomicidade, remoção de serviços/clientes sem perder caixa, dois temas e celular: OK.",
  );
}
