import { describe, expect, it } from "vitest";
import { upcomingAppointments } from "../src/lib/appointments";
import { matchClients, reportFacts } from "../src/lib/ai/queries";
import { entrySchema, schemas } from "../src/lib/finance";

describe("consultas do assistente", () => {
  it("reconhece apelidos e mantém homônimos para esclarecimento", () => {
    const clients = [
      {
        id: "1",
        ...schemas.client.parse({
          name: "José da Silva",
          nickname: "Zé",
          city: "São Paulo",
        }),
      },
      {
        id: "2",
        ...schemas.client.parse({
          name: "José da Costa",
          nickname: "Zé",
          city: "Santos",
        }),
      },
    ];
    expect(matchClients(clients, "  ze  ").map(({ id }) => id)).toEqual([
      "1",
      "2",
    ]);
    expect(matchClients(clients, "Jose da Costa").map(({ id }) => id)).toEqual([
      "2",
    ]);
    expect(
      matchClients(clients, "Zé", "sao paulo").map(({ id }) => id),
    ).toEqual(["1"]);
  });

  it("retorna horários válidos e visitas antigas sem horário, em ordem", () => {
    const base = schemas.service.parse({
      clientId: "1",
      description: "Visita",
      date: "2026-11-10",
      competence: "2026-11-01",
      status: "Agendado",
      items: [{ description: "Visita", quantity: "", unit: "", amount: null }],
    });
    expect(
      upcomingAppointments(
        [
          { ...base, id: "cancelada", status: "Cancelado" },
          { ...base, id: "sem-hora" },
          { ...base, id: "futura", appointmentTime: "15:00" },
          { ...base, id: "passada", appointmentTime: "08:00" },
        ],
        "2026-11-10",
        "10:00",
      ).map(({ id }) => id),
    ).toEqual(["futura", "sem-hora"]);
  });

  it("reusa caixa e competência e ignora baixas estornadas", () => {
    const entry = {
      id: "1",
      ...entrySchema.parse({
        type: "income",
        description: "Serviço",
        category: "Serviços",
        amount: 15000,
        discount: 1000,
        competence: "2026-10-01",
        payments: [
          { id: "p1", amount: 2000, date: "2026-11-02", method: "Pix" },
          {
            id: "p2",
            amount: 3000,
            date: "2026-11-03",
            method: "Pix",
            voided: true,
          },
        ],
      }),
    };
    expect(reportFacts([entry], "2026", "11", "cash").summary.income).toBe(
      2000,
    );
    expect(reportFacts([entry], "2026", "11", "accrual").summary.income).toBe(
      0,
    );
    expect(reportFacts([entry], "2026", "10", "accrual").summary.income).toBe(
      14000,
    );
    expect(reportFacts([entry], "2026", "10", "accrual").receivable).toBe(
      12000,
    );
  });
});
