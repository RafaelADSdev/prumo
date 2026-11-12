import type { Page } from "playwright";
import assert from "node:assert/strict";

export async function reviewClientsAndExpenses(page: Page, base: string) {
  const save = async (body: unknown) => {
    const response = await page.request.post(base + "/api/data", {
      headers: { Origin: base },
      data: body,
    });
    const json = await response.json();
    assert.ok(response.ok(), JSON.stringify(json));
    return json;
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/?page=services&year=2027&month=01");
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  const dialog = page.locator(".editor-dialog[open]");
  const fields = {
    "Número com DDD": "(11) 99999-0000",
    "Nome do cliente": "Cliente com ficha completa",
    Endereço: "Rua das Flores, 123",
    "Observações (opcional)": "Ligar antes da visita.",
  };
  for (const [name, value] of Object.entries(fields))
    await dialog.getByLabel(name, { exact: true }).fill(value);
  await dialog
    .getByRole("button", { name: "Salvar cliente", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  const search = page.getByRole("searchbox", { name: "Pesquisar clientes" });
  await search.fill("+55 (11) 99999-0000");
  await page
    .getByRole("button", {
      name: "Ver cliente: Cliente com ficha completa",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Endereço", exact: true }).click();
  await page.getByText("Rua das Flores, 123", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Editar cliente", exact: true })
    .click();
  assert.equal(
    await dialog.getByLabel("Número com DDD", { exact: true }).inputValue(),
    fields["Número com DDD"],
  );
  await dialog
    .getByLabel("Observações (opcional)", { exact: true })
    .fill("Confirmar antes da visita.");
  await dialog
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  const data = await (await page.request.get(base + "/api/data")).json();
  const client = data.records.find(
    (r: { name: string }) => r.name === fields["Nome do cliente"],
  );
  assert.equal(client.phone, "11999990000");
  assert.equal(client.notes, "Confirmar antes da visita.");
  for (const [phone, error] of [
    ["", /telefone com DDD/],
    ["999990000", /telefone com DDD/],
    ["+55 (11) 99999-0000", /número já pertence/],
  ] as const) {
    const invalid = await page.request.post(base + "/api/data", {
      headers: { Origin: base },
      data: {
        kind: "client",
        data: { name: "Outro cadastro", address: "Rua B, 2", phone },
      },
    });
    assert.equal(invalid.status(), 400);
    assert.match((await invalid.json()).error, error);
  }
  for (const [description, date, amount] of [
    ["Serviço antigo do cliente", "2024-02-01", 50000],
    ["Serviço recente sem preço", "2028-03-01", null],
  ] as const) {
    await save({
      kind: "service",
      data: {
        clientId: client.id,
        description,
        date,
        competence: date,
        status: "Concluído",
        items: [
          { description: "Instalação", quantity: "1", unit: "un.", amount },
        ],
      },
    });
  }
  const other = await save({
    kind: "client",
    data: {
      name: "Outro cliente isolado",
      phone: "11999990001",
      address: "Rua B, 2",
    },
  });
  await save({
    kind: "service",
    data: {
      clientId: other.id,
      description: "Não pertence ao cliente",
      date: "2027-01-01",
      competence: "2027-01-01",
      status: "Concluído",
      items: [
        { description: "Outro", quantity: "1", unit: "un.", amount: 10000 },
      ],
    },
  });
  await page.reload();
  await page
    .getByRole("button", {
      name: "Ver cliente: Cliente com ficha completa",
      exact: true,
    })
    .click();
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
      for (const tab of ["Contato", "Endereço", "Serviços"]) {
        await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
        if (tab === "Serviços") {
          assert.equal(await page.locator(".client-history li").count(), 2);
          assert.ok(
            (await page.locator(".client-history").innerText()).includes(
              "Sem preço",
            ),
          );
          assert.equal(
            await page
              .getByText("Não pertence ao cliente", { exact: true })
              .count(),
            0,
          );
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.locator(".client-profile").screenshot({
          path: `.impeccable/review/client-${tab}-${theme}-${width}.png`,
          animations: "disabled",
        });
      }
    }
  }
  await page.getByRole("tab", { name: "Contato", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("tab", { name: "Endereço", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("tab", { name: /^Serviços/ }).click();
  await page
    .getByRole("button", {
      name: "Novo serviço para este cliente",
      exact: true,
    })
    .click();
  assert.equal(
    await dialog.getByLabel("Cliente", { exact: true }).inputValue(),
    client.id,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", {
      name: "Abrir serviço: Serviço antigo do cliente",
      exact: true,
    })
    .click();
  assert.equal(
    await dialog.getByLabel("Descrição", { exact: true }).first().inputValue(),
    "Serviço antigo do cliente",
  );
  await page.keyboard.press("Escape");
  const backup = await (await page.request.get(base + "/api/backup")).json();
  const backedUpClient = JSON.parse(
    backup.records.find((r: { id: string }) => r.id === client.id).data,
  );
  assert.equal(backedUpClient.address, fields.Endereço);
  assert.equal(backedUpClient.phone, "11999990000");

  for (const [category, amount] of [
    ["Despesas fixas", 10000],
    ["Combustível", 20000],
    ["Colaboradores", 30000],
    ["Materiais", 40000],
  ] as const) {
    const result = await save({
      kind: "entry",
      data: {
        type: "expense",
        description: category,
        category,
        amount,
        competence: "2031-01-01",
      },
    });
    if (category === "Combustível")
      await save({
        action: "payment",
        id: result.id,
        amount: 5000,
        date: "2031-02-01",
        method: "Pix",
      });
  }
  await save({
    kind: "entry",
    data: {
      type: "expense",
      description: "Gasto sem valor",
      category: "Outros",
      amount: null,
      competence: "2031-01-01",
    },
  });
  await page.goto(base + "/?page=overview&year=2031&month=01");
  const summary = page.locator(".expense-summary");
  await summary.getByText("R$ 1.000,00", { exact: true }).waitFor();
  assert.deepEqual(
    await summary.locator(".expense-summary-values dd").allTextContents(),
    ["R$ 1.000,00", "R$ 50,00", "R$ 950,00"],
  );
  assert.equal(await summary.locator(".expense-origins dd").count(), 4);
  await summary.getByText(/1 gasto\(s\) a conferir/).waitFor();
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
      await summary.screenshot({
        path: `.impeccable/review/expenses-${theme}-${width}.png`,
        animations: "disabled",
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
  }
  await summary
    .getByRole("button", { name: "Ver gastos", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Lançamentos", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 1500, height: 1000 });
  console.log(
    "Clientes e gastos: cadastro completo, edição, backup, histórico entre anos, isolamento por cliente, teclado, totais de todas as origens, baixa em outro mês e dois temas em desktop/celular: OK.",
  );
}
