import assert from "node:assert/strict";
import type { Page } from "playwright";
import {
  paid,
  totals,
  type Client,
  type Entry,
  type Service,
} from "../src/lib/finance";

export async function reviewCalendar(page: Page, base: string) {
  const records = async () => {
    const response = await page.request.get(base + "/api/data");
    assert.ok(response.ok());
    return (await response.json()).records as (
      | (Entry & { kind: "entry" })
      | (Client & { kind: "client" })
      | (Service & { kind: "service" })
    )[];
  };
  const linked = async () => {
    const data = await records();
    const service = data.find(
      (r) =>
        r.kind === "service" &&
        r.description === "Instalação de cerca da agenda",
    ) as Service | undefined;
    assert.ok(service);
    return {
      service,
      client: data.find(
        (r) => r.kind === "client" && r.id === service.clientId,
      ) as Client,
      entries: data.filter(
        (r) => r.kind === "entry" && r.serviceId === service.id,
      ) as Entry[],
    };
  };
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(base + "/?page=calendar&year=2034&month=11");
  const dialog = page.locator(".editor-dialog[open]");
  const sheet = page.getByRole("region", { name: "Planilha de serviços" });
  const months = page.getByRole("group", { name: "Meses da agenda" });
  const row = sheet
    .getByRole("row")
    .filter({ hasText: "Instalação de cerca da agenda" });
  const add = page.getByRole("button", { name: "Agendar serviço" });

  await add.click();
  await dialog
    .getByLabel("Data do serviço", { exact: true })
    .fill("2034-11-22");
  await dialog.getByLabel("Horário (opcional)").fill("09:15");
  await dialog
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente da cerca");
  await dialog.getByLabel("CPF", { exact: true }).fill("123.456.789-09");
  await dialog
    .getByLabel("Endereço do serviço", { exact: true })
    .fill("Rua da Cerca, 30");
  await dialog.getByLabel("Tipo de serviço").selectOption("Cerca");
  await dialog.getByLabel("Metragem (m)").fill("30,5");
  await dialog.getByLabel("Valor (R$)").fill("1200,00");
  const inputOrder = await dialog
    .locator(".form-content :is(input, select, textarea)[aria-label]:visible")
    .evaluateAll((fields) =>
      fields.map((field) => field.getAttribute("aria-label")),
    );
  assert.deepEqual(inputOrder, [
    "Data do serviço",
    "Horário (opcional)",
    "Cliente",
    "Nome do cliente",
    "CPF",
    "Endereço do serviço",
    "Tipo de serviço",
    "Metragem (m)",
    "Valor (R$)",
    "Situação operacional",
    "Situação do pagamento",
    "Observação",
  ]);
  await dialog
    .getByLabel("Observação", { exact: true })
    .fill("Levar os postes de fixação.");
  await dialog.getByText("Mais detalhes do serviço").click();
  await dialog
    .getByLabel("Descrição", { exact: true })
    .fill("Instalação de cerca da agenda");
  await dialog.getByText("Pagamento previsto e desconto").click();
  await dialog
    .getByLabel("Forma prevista de pagamento")
    .fill("Cartão de crédito");
  await dialog.getByRole("button", { name: "Salvar serviço" }).click();
  await dialog.waitFor({ state: "hidden" });

  for (const value of [
    "quarta",
    "22/11/2034",
    "09:15",
    "Cliente da cerca",
    "123.456.789-09",
    "Rua da Cerca, 30",
    "Cerca",
    "30,5 m",
    "Agendado",
    "Em aberto",
    "Levar os postes de fixação.",
  ])
    await row.getByText(value, { exact: true }).waitFor();
  const initial = await linked();
  assert.deepEqual(await sheet.getByRole("columnheader").allTextContents(), [
    "Data",
    "Cliente",
    "Serviço",
    "Valor",
    "Situação",
    "Observação",
    "Ações",
  ]);
  assert.equal(initial.client.cpf, "12345678909");
  assert.equal(initial.service.notes, "Levar os postes de fixação.");
  assert.equal(initial.service.meters, "30,5");
  assert.equal(initial.entries.length, 0);

  await months.getByRole("button", { name: "Outubro" }).click();
  await row.waitFor({ state: "hidden" });
  await months.getByRole("button", { name: "Total" }).click();
  await row.waitFor();
  await months.getByRole("button", { name: "Novembro" }).click();
  const search = page.getByRole("searchbox", { name: "Buscar na agenda" });
  await search.fill("12345678909");
  await row.waitFor();
  await search.fill("postes de fixação");
  await row.waitFor();
  await search.fill("sem correspondência");
  await sheet.getByText("Nenhum serviço encontrado.").waitFor();
  await sheet.getByRole("button", { name: "Limpar busca" }).click();
  assert.equal(await search.inputValue(), "");
  assert.ok(
    await search.evaluate((element) => element === document.activeElement),
  );

  await row.getByRole("button", { name: "Confirmar serviço" }).click();
  await dialog.getByRole("button", { name: "Confirmar execução" }).click();
  await row.getByText("Concluído", { exact: true }).waitFor();
  assert.equal((await linked()).entries.length, 0);

  await row.getByRole("button", { name: "Editar serviço" }).click();
  await dialog
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente atualizado");
  await dialog.getByLabel("CPF", { exact: true }).fill("98765432100");
  await dialog.getByLabel("Valor (R$)").fill("1300,00");
  const note =
    "Levar os postes de fixação.\nConfirmar o acesso com a portaria.\n" +
    "Revisar o acesso antes de levar material para a instalação.\n"
      .repeat(20)
      .trimEnd();
  await dialog.getByLabel("Observação", { exact: true }).fill(note);
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await row.getByText("987.654.321-00", { exact: true }).waitFor();
  const updated = await linked();
  assert.equal(updated.client.id, initial.client.id);
  assert.equal(updated.service.notes, note);
  const noteToggle = row.getByText("Ver observação", { exact: true });
  await noteToggle.click();
  await row.getByText(/Confirmar o acesso com a portaria/).waitFor();
  assert.ok(
    await sheet.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      const headerTop = element
        .querySelector("thead th")!
        .getBoundingClientRect().top;
      const scrolled =
        element.scrollTop > 0 &&
        Math.abs(headerTop - element.getBoundingClientRect().top) < 2;
      element.scrollTop = 0;
      return scrolled;
    }),
  );
  await noteToggle.click();

  await row.getByRole("button", { name: "Dar baixa" }).click();
  assert.equal(
    await dialog.getByLabel("Forma de recebimento").inputValue(),
    "Cartão de crédito",
  );
  await dialog.getByLabel("Data do recebimento").fill("2034-12-01");
  await dialog.getByLabel("Forma de recebimento").fill("Pix");
  await dialog.getByRole("button", { name: "Confirmar baixa" }).click();
  await row.getByText("Pago", { exact: true }).waitFor();
  await row.getByText("Pix", { exact: true }).waitFor();
  const settled = await linked();
  assert.equal(settled.entries.length, 1);
  assert.equal(settled.entries[0].party, "Cliente atualizado");
  assert.equal(settled.entries[0].competence, "2034-11-01");
  assert.equal(settled.entries[0].payments.length, 1);
  assert.equal(paid(settled.entries[0]), 130000);
  assert.equal(totals(settled.entries, "2034", "11").income, 0);
  assert.equal(totals(settled.entries, "2034", "12").income, 130000);
  assert.equal(await row.getByRole("button", { name: "Dar baixa" }).count(), 0);
  const retry = await page.request.post(base + "/api/data", {
    headers: { Origin: base },
    data: {
      kind: "service",
      id: settled.service.id,
      data: settled.service,
      receipt: { action: "settle", date: "2034-12-01", method: "Pix" },
    },
  });
  assert.ok(retry.ok());
  assert.equal((await linked()).entries[0].payments.length, 1);

  await add.click();
  await dialog
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente da manutenção");
  await dialog.getByLabel("Tipo de serviço").selectOption("Manutenção");
  assert.equal(await dialog.getByLabel("Metragem (m)").count(), 0);
  await dialog.getByLabel("Valor (R$)").fill("300,00");
  await dialog.getByLabel("Situação do pagamento").selectOption("settle");
  await dialog.getByLabel("Data do recebimento").fill("2034-11-01");
  await dialog.getByLabel("Forma de recebimento").fill("Dinheiro");
  await dialog.getByRole("button", { name: "Confirmar baixa" }).click();
  const maintenance = sheet
    .getByRole("row")
    .filter({ hasText: "Cliente da manutenção" });
  await maintenance.getByText("Agendado", { exact: true }).waitFor();
  await maintenance.getByText("Pago", { exact: true }).waitFor();

  await add.click();
  await dialog
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Helena Martins de Albuquerque");
  await dialog
    .getByLabel("Data do serviço", { exact: true })
    .fill("2034-11-18");
  await dialog
    .getByLabel("Endereço do serviço", { exact: true })
    .fill("Avenida das Palmeiras, 1280 · Condomínio Jardim do Sol");
  await dialog.getByLabel("Tipo de serviço").selectOption("Concertina");
  await dialog.getByLabel("Metragem (m)").fill("24");
  await dialog.getByRole("button", { name: "Salvar serviço" }).click();
  const pending = sheet
    .getByRole("row")
    .filter({ hasText: "Helena Martins de Albuquerque" });
  await pending.getByText("A definir", { exact: true }).waitFor();
  await page
    .getByText("1 serviço com valor a definir", { exact: true })
    .waitFor();

  const dismissNotice = async () => {
    const close = page.getByRole("button", { name: "Fechar aviso" });
    if (await close.isVisible()) await close.click();
  };
  const chooseTheme = async (theme: "light" | "dark") => {
    if ((await page.locator("html").getAttribute("data-theme")) === theme)
      return;
    await page
      .getByRole("button", { name: "Alternar entre modo claro e escuro" })
      .click();
    await page.waitForFunction(
      (value) =>
        document.documentElement.dataset.theme === value &&
        !document.documentElement.classList.contains("theme-changing"),
      theme,
    );
  };
  await dismissNotice();
  await chooseTheme("dark");
  await page.screenshot({
    path: ".impeccable/review/agenda-desktop.png",
    animations: "disabled",
  });
  await chooseTheme("light");
  await page.setViewportSize({ width: 1080, height: 950 });
  await page.screenshot({
    path: ".impeccable/review/agenda-intermediate.png",
    animations: "disabled",
  });
  for (const width of [390, 320, 768, 1024, 1080]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok(
      await sheet.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const monthSelect = page.getByRole("combobox", { name: "Mês da agenda" });
  await monthSelect.selectOption("10");
  await row.waitFor({ state: "hidden" });
  await monthSelect.selectOption("11");
  await monthSelect.focus();
  await page.keyboard.press("Tab");
  assert.ok(
    await search.evaluate((element) => element === document.activeElement),
  );
  await pending.getByRole("button", { name: "Confirmar serviço" }).waitFor();
  await pending.getByRole("button", { name: "Dar baixa" }).waitFor();
  await row.getByRole("button", { name: "Editar serviço" }).click();
  await dialog.getByText("Histórico de recebimentos").click();
  await dialog.getByRole("button", { name: "Editar baixa" }).click();
  await dialog.getByLabel("Data efetiva").fill("2034-12-02");
  await dialog.getByRole("button", { name: "Salvar baixa" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal((await linked()).entries[0].payments[0].date, "2034-12-02");
  await dismissNotice();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".impeccable/review/agenda-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  await page
    .getByRole("button", { name: "Serviços do período", exact: true })
    .click();
  const report = page.getByRole("region", { name: "Serviços do período" });
  await report
    .getByLabel("Buscar nos serviços do relatório")
    .fill("rua da cerca");
  await report
    .getByLabel("Forma de pagamento no relatório")
    .selectOption("Pix");
  await report
    .getByRole("row")
    .filter({ hasText: "Instalação de cerca da agenda" })
    .getByText(/Pix · 02\/12\/2034/)
    .waitFor();
  console.log("Agenda mensal: edição, CPF, confirmação, baixa e celular: OK.");
}
