import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { money, serviceAmount, type Service } from "@/lib/finance";
import { reportMonths } from "@/lib/reports";

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function ServiceCalendar({
  period,
  today,
  services,
  clientNames,
  onPeriod,
  onCreate,
  onEdit,
}: {
  period: string;
  today: string;
  services: Service[];
  clientNames: Map<string, string>;
  onPeriod: (year: string, month: string) => void;
  onCreate: (date: string) => void;
  onEdit: (service: Service, status?: Service["status"]) => void;
}) {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const byDate = new Map<string, Service[]>();
  for (const service of services) {
    if (service.archived || !service.date?.startsWith(period + "-")) continue;
    const list = byDate.get(service.date) ?? [];
    list.push(service);
    byDate.set(service.date, list);
  }
  const [date, setDate] = useState(
    today.startsWith(period + "-")
      ? today
      : ([...byDate.keys()].sort()[0] ?? period + "-01"),
  );
  const selected = byDate.get(date) ?? [];
  const heading = reportMonths[month - 1] + " de " + year;
  function move(delta: number) {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    onPeriod(
      String(next.getUTCFullYear()),
      String(next.getUTCMonth() + 1).padStart(2, "0"),
    );
  }
  return (
    <div className="service-calendar">
      <section
        className="panel calendar-month"
        aria-labelledby="calendar-title"
      >
        <div className="calendar-toolbar">
          <h2 id="calendar-title">
            <CalendarDays size={20} /> {heading}
          </h2>
          <div>
            <button
              className="icon-button"
              aria-label="Mês anterior"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Próximo mês"
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {weekdays.map((day) => (
            <span className="calendar-weekday" key={day}>
              {day}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={"offset-" + i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const dayDate = period + "-" + String(day).padStart(2, "0");
            const appointments = byDate.get(dayDate) ?? [];
            return (
              <button
                className="calendar-day"
                key={dayDate}
                aria-current={dayDate === today ? "date" : undefined}
                aria-pressed={dayDate === date}
                aria-label={`${day} de ${heading}, ${appointments.length} serviço${appointments.length === 1 ? "" : "s"}`}
                onClick={() => setDate(dayDate)}
              >
                <strong>{day}</strong>
                {appointments.length > 0 && (
                  <small>{appointments.length}</small>
                )}
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel calendar-agenda" aria-labelledby="agenda-day">
        <div className="calendar-toolbar">
          <div>
            <p className="muted">Serviços do dia</p>
            <h2 id="agenda-day">
              {Number(date.slice(8))} de {reportMonths[month - 1]}
            </h2>
          </div>
          <button className="primary" onClick={() => onCreate(date)}>
            <Plus size={16} /> Agendar serviço
          </button>
        </div>
        {selected.length === 0 ? (
          <p className="calendar-empty">Nenhum serviço neste dia.</p>
        ) : (
          <ul className="calendar-appointments">
            {selected.map((service) => {
              const amount = serviceAmount(service.items);
              const canConfirm =
                service.status === "Agendado" ||
                service.status === "Em andamento";
              return (
                <li key={service.id}>
                  <span className="status">{service.status}</span>
                  <h3>{service.description}</h3>
                  <p>
                    {clientNames.get(service.clientId) ||
                      "Cliente não informado"}
                  </p>
                  <p>
                    {amount === null
                      ? "Preço a definir"
                      : money(amount - service.discount)}
                    {service.method && ` · ${service.method}`}
                  </p>
                  <div className="service-actions">
                    {canConfirm && (
                      <button onClick={() => onEdit(service, "Concluído")}>
                        Confirmar serviço
                      </button>
                    )}
                    {canConfirm && (
                      <button onClick={() => onEdit(service, "Cancelado")}>
                        Cancelar serviço
                      </button>
                    )}
                    <button onClick={() => onEdit(service)}>Editar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
