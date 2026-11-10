import assert from "node:assert/strict";
import type { Page } from "playwright";
import {
  money,
  totals,
  type Client,
  type Entry,
  type Service,
} from "../src/lib/finance";

export async function reviewCalendar(page: Page, base: string) {
  const description = "Instalação de cerca para a agenda";
  const records = async () => {
    const response = await page.request.get(base + "/api/data");
    assert.ok(response.ok());
    return (await response.json()).records as (
      | (Entry & { kind: "entry" })
      | (Client & { kind: "client" })
      | (Service & { kind: "service" })
    )[];
  };
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(base + "/?page=calendar&year=2034&month=11");
  const day = page.getByRole("button", { name: /^22 de Novembro de 2034/ });
  const dialog = page.locator(".editor-dialog[open]");
  await day.click();
  await page.getByRole("button", { name: "Agendar serviço" }).click();
  await dialog.getByLabel("Cliente", { exact: true }).selectOption("new");
  const clientFields = [
    ["name", "Nome do novo cliente", "Cliente da cerca"],
    ["nickname", "Apelido (opcional)", "Dona Ana"],
    ["phone", "Telefone (opcional)", "(11) 99999-0000"],
    ["contact", "Contato (opcional)", "ana@exemplo.com"],
    ["street", "Rua / logradouro", "Rua das Flores"],
    ["number", "Número", "123"],
    ["complement", "Complemento", "Casa 2"],
    ["neighborhood", "Bairro", "Centro"],
    ["city", "Cidade", "São Paulo"],
    ["state", "Estado / UF", "SP"],
    ["zipCode", "CEP", "01000-000"],
    ["notes", "Descrição / observações (opcional)", "Ligar antes da visita."],
  ] as const;
  for (const [, label, value] of clientFields)
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog
    .getByLabel("Descrição", { exact: true })
    .first()
    .fill(description);
  await dialog
    .getByLabel("Endereço do serviço (opcional)")
    .fill("Rua da Cerca, 30");
  await dialog.getByLabel("Horário (opcional)", { exact: true }).fill("09:15");
  await dialog
    .getByLabel("Forma prevista de pagamento")
    .fill("Cartão de crédito");
  await dialog.getByLabel("Quantidade").fill("30");
  await dialog.getByLabel("Unidade", { exact: true }).fill("m");
  await dialog.getByLabel("Total do item (R$)").fill("1200,00");
  await dialog.getByText("Desconto e observações", { exact: true }).click();
  await dialog
    .getByLabel("Observações", { exact: true })
    .fill("Levar os postes de fixação.");
  await dialog.getByRole("button", { name: "Salvar serviço" }).click();
  await dialog.waitFor({ state: "hidden" });

  const linked = async () => {
    const data = await records();
    const service = data
      .filter((r) => r.kind === "service")
      .find((r) => r.description === description);
    assert.ok(service);
    const entries = data
      .filter((r) => r.kind === "entry")
      .filter((r) => r.serviceId === service.id);
    return { service, entries };
  };
  const initial = await linked();
  assert.equal(initial.service.date, "2034-11-22");
  assert.equal(initial.service.appointmentTime, "09:15");
  assert.equal(initial.service.status, "Agendado");
  assert.equal(initial.service.notes, "Levar os postes de fixação.");
  assert.equal(initial.entries.length, 0);
  const client = (await records())
    .filter((r) => r.kind === "client")
    .find((r) => r.id === initial.service.clientId);
  assert.ok(client);
  for (const [key, , value] of clientFields)
    assert.equal(client[key], value, key);
  const upcomingTab = page.getByRole("tab", { name: "Próximos serviços" });
  const dayPanel = page.getByRole("tabpanel", { name: "Serviços do dia" });
  await upcomingTab.click();
  await page.getByLabel("Mês", { exact: true }).selectOption("10");
  await page
    .getByRole("tabpanel", { name: "Próximos serviços" })
    .getByRole("button", { name: new RegExp(description) })
    .click();
  assert.equal(
    await page.getByLabel("Mês", { exact: true }).inputValue(),
    "11",
  );
  await dayPanel
    .getByRole("heading", { name: "22 de Novembro de 2034" })
    .waitFor();
  for (const value of [
    "Rua da Cerca, 30",
    "09:15",
    "Serviço · 30 m",
    "Cartão de crédito",
    "Levar os postes de fixação.",
  ]) {
    await dayPanel.getByText(value, { exact: true }).waitFor();
  }
  await page
    .getByRole("button", { name: "Cancelar serviço", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Salvar cancelamento" }).click();
  await page
    .locator(".calendar-appointments")
    .getByText("Cancelado", { exact: true })
    .waitFor();
  assert.equal((await linked()).entries.length, 0);
  await upcomingTab.click();
  assert.equal(
    await page
      .getByRole("tabpanel", { name: "Próximos serviços" })
      .getByRole("button", { name: new RegExp(description) })
      .count(),
    0,
  );
  await upcomingTab.press("ArrowRight");
  await page
    .locator(".calendar-appointments")
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  await dialog.getByLabel("Situação operacional").selectOption("Agendado");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await dialog.waitFor({ state: "hidden" });

  await page
    .getByRole("button", { name: "Confirmar serviço", exact: true })
    .click();
  await dialog.getByLabel("Total do item (R$)").fill("1300,00");
  await dialog.getByRole("button", { name: "Confirmar execução" }).click();
  await page
    .locator(".calendar-appointments")
    .getByText("Concluído", { exact: true })
    .waitFor();
  const confirmed = await linked();
  assert.equal(confirmed.entries.length, 1);
  const [entry] = confirmed.entries;
  assert.equal(entry.competence, "2034-11-01");
  assert.equal(entry.method, "Cartão de crédito");
  assert.equal(
    totals(confirmed.entries, "2034", "11", "accrual").income,
    130000,
  );
  assert.equal(totals(confirmed.entries, "2034", "11").income, 0);
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: description })
    .getByText(money(130000), { exact: true })
    .first()
    .waitFor();

  const report = page.getByRole("region", { name: "Serviços do período" });
  const reportRow = report.getByRole("row").filter({ hasText: description });
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  await page
    .getByRole("button", { name: "Serviços do período", exact: true })
    .click();
  await report
    .getByLabel("Buscar nos serviços do relatório")
    .fill("rua da cerca");
  await report
    .getByLabel("Forma de pagamento no relatório")
    .selectOption("Cartão de crédito");
  await reportRow.getByText("Rua da Cerca, 30", { exact: true }).waitFor();
  assert.match(await reportRow.innerText(), /Cliente da cerca.*22\/11\/2034/s);
  await reportRow.getByRole("button", { name: /^Editar serviço:/ }).click();
  await dialog.getByLabel("Situação do pagamento").selectOption("settle");
  assert.equal(
    await dialog.getByLabel("Forma de recebimento").inputValue(),
    "Cartão de crédito",
  );
  await dialog.getByLabel("Data do recebimento").fill("2034-11-22");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await reportRow.getByText(/Cartão de crédito · 22\/11\/2034/).waitFor();
  assert.equal(totals((await linked()).entries, "2034", "11").income, 130000);

  await reportRow.getByRole("button", { name: /^Editar serviço:/ }).click();
  await dialog.getByText("Histórico de recebimentos").click();
  await dialog
    .getByRole("button", { name: "Editar baixa", exact: true })
    .click();
  await dialog.getByLabel("Data efetiva").fill("2034-12-01");
  await dialog.getByLabel("Forma de pagamento", { exact: true }).fill("Pix");
  await dialog.getByRole("button", { name: "Salvar baixa" }).click();
  await reportRow.getByText(/Pix · 01\/12\/2034/).waitFor();
  const corrected = (await linked()).entries;
  assert.equal(corrected.length, 1);
  assert.equal(corrected[0].payments.length, 1);
  assert.equal(totals(corrected, "2034", "11").income, 0);
  assert.equal(totals(corrected, "2034", "12").income, 130000);
  await page.getByLabel("Mês", { exact: true }).selectOption("12");
  assert.equal(await reportRow.count(), 0);
  await page.getByLabel("Mês", { exact: true }).selectOption("all");
  await reportRow.waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  const fitsViewport = () => document.documentElement.scrollWidth <= innerWidth;
  await page.waitForFunction(fitsViewport);
  await report.screenshot({
    path: ".impeccable/review/service-report-mobile.png",
    animations: "disabled",
  });
  await page.goto(base + "/?page=calendar&year=2034&month=11");
  await day.click();
  await page.locator(".calendar-appointments").getByText(description).waitFor();
  await dayPanel.getByText("Pix · 01/12/2034", { exact: true }).waitFor();
  await page.waitForFunction(fitsViewport);
  await page.locator(".service-calendar").screenshot({
    path: ".impeccable/review/agenda-mobile.png",
    animations: "disabled",
  });
  await dayPanel.getByRole("button", { name: "Editar", exact: true }).click();
  await dialog.getByLabel("Cliente", { exact: true }).selectOption("new");
  await dialog.getByLabel("Nome do novo cliente").fill("Novo titular da cerca");
  const phone = dialog.getByLabel("Telefone (opcional)", { exact: true });
  assert.equal(await phone.getAttribute("type"), "tel");
  await phone.fill("(21) 99999-1234");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await dialog.waitFor({ state: "hidden" });
  const updated = await linked();
  assert.notEqual(updated.service.clientId, client.id);
  const clients = (await records()).filter((r) => r.kind === "client");
  const replacement = clients.find((r) => r.id === updated.service.clientId);
  assert.equal(replacement?.phone, "(21) 99999-1234");
  assert.equal(clients.find((r) => r.id === client.id)?.phone, client.phone);

  await page.goto(base + "/?page=overview&year=2034&month=12");
  const receipts = page.getByRole("button", { name: /Recebimentos efetivos/ });
  await receipts.getByText(money(130000), { exact: true }).waitFor();
  console.log(
    "Agenda e relatório: previsão, cancelamento, confirmação, baixa, correção, filtros e celular: OK.",
  );
}
