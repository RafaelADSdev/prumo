import { useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import type { Client, Entry, Service } from "@/lib/finance";
import { reportMonths } from "@/lib/reports";
import { ServiceAppointment } from "./service-appointment";

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const agendaTabs = [
  ["upcoming", "Próximos serviços"],
  ["day", "Serviços do dia"],
] as const;
const upcomingPageSize = 5;

export function ServiceCalendar({
  period,
  today,
  services,
  clients,
  entries,
  onPeriod,
  onCreate,
  onEdit,
}: {
  period: string;
  today: string;
  services: Service[];
  clients: Map<string, Client>;
  entries: Map<string, Entry>;
  onPeriod: (year: string, month: string) => void;
  onCreate: (date: string) => void;
  onEdit: (service: Service, status?: Service["status"]) => void;
}) {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const [tab, setTab] = useState<"upcoming" | "day">("upcoming");
  const [pickedDate, setPickedDate] = useState("");
  const [visibleCount, setVisibleCount] = useState(upcomingPageSize);
  const tabList = useRef<HTMLDivElement>(null);
  const agendaPanel = useRef<HTMLElement>(null);
  const byDate = new Map<string, Service[]>();
  for (const service of services) {
    if (service.archived || !service.date?.startsWith(period + "-")) continue;
    const list = byDate.get(service.date) ?? [];
    list.push(service);
    byDate.set(service.date, list);
  }
  const date = pickedDate.startsWith(period + "-")
    ? pickedDate
    : today.startsWith(period + "-")
      ? today
      : ([...byDate.keys()].sort()[0] ?? period + "-01");
  const selected = byDate.get(date) ?? [];
  const upcoming = services
    .filter(
      (service): service is Service & { date: string } =>
        !service.archived &&
        service.date !== null &&
        service.date >= today &&
        (service.status === "Agendado" || service.status === "Em andamento"),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.description.localeCompare(b.description, "pt-BR"),
    );
  const heading = reportMonths[month - 1] + " de " + year;
  function showDay(day: string) {
    setPickedDate(day);
    setTab("day");
    if (!day.startsWith(period + "-"))
      onPeriod(day.slice(0, 4), day.slice(5, 7));
    requestAnimationFrame(() => {
      tabList.current
        ?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
        ?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 1050px)").matches)
        agendaPanel.current?.scrollIntoView({ block: "start" });
    });
  }
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
                aria-pressed={tab === "day" && dayDate === date}
                aria-controls="agenda-panel-day"
                aria-label={`${day} de ${heading}, ${appointments.length} serviço${appointments.length === 1 ? "" : "s"}`}
                onClick={() => showDay(dayDate)}
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
      <section
        className="panel calendar-agenda"
        aria-label="Serviços na agenda"
        ref={agendaPanel}
      >
        <div className="calendar-toolbar">
          <div
            className="calendar-tabs"
            role="tablist"
            aria-label="Consultar agenda"
            ref={tabList}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "upcoming"
                  : event.key === "End" || tab === "upcoming"
                    ? "day"
                    : "upcoming";
              setTab(next);
              tabList.current
                ?.querySelector<HTMLButtonElement>(`#agenda-tab-${next}`)
                ?.focus();
            }}
          >
            {agendaTabs.map(([id, label]) => (
              <button
                key={id}
                id={`agenda-tab-${id}`}
                type="button"
                role="tab"
                aria-controls={`agenda-panel-${id}`}
                aria-selected={tab === id}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="primary"
            onClick={() => {
              setPickedDate(date);
              setTab("day");
              onCreate(date);
            }}
          >
            <Plus size={16} /> Agendar serviço
          </button>
        </div>
        <div
          id="agenda-panel-upcoming"
          role="tabpanel"
          aria-labelledby="agenda-tab-upcoming"
          hidden={tab !== "upcoming"}
        >
          {upcoming.length ? (
            <ul className="calendar-upcoming">
              {upcoming.slice(0, visibleCount).map((service) => (
                <li key={service.id}>
                  <button onClick={() => showDay(service.date)}>
                    <time dateTime={service.date} className="upcoming-date">
                      <strong>{service.date.slice(8, 10)}</strong>
                      <small>
                        {reportMonths[
                          Number(service.date.slice(5, 7)) - 1
                        ].slice(0, 3)}{" "}
                        {service.date.slice(0, 4)}
                      </small>
                    </time>
                    <span className="upcoming-service">
                      <strong>{service.description}</strong>
                      <small>
                        {clients.get(service.clientId)?.name ||
                          entries.get(service.id)?.party ||
                          "Cliente não informado"}{" "}
                        · {service.status}
                      </small>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="calendar-empty">
              Nenhum serviço agendado a partir de hoje.
            </p>
          )}
          {visibleCount < upcoming.length && (
            <button
              className="calendar-more"
              onClick={() => setVisibleCount(visibleCount + upcomingPageSize)}
            >
              Ver mais serviços
            </button>
          )}
        </div>
        <div
          id="agenda-panel-day"
          role="tabpanel"
          aria-labelledby="agenda-tab-day"
          hidden={tab !== "day"}
        >
          <h2 id="agenda-day">
            {Number(date.slice(8))} de {reportMonths[month - 1]} de {year}
          </h2>
          {selected.length === 0 ? (
            <p className="calendar-empty">Nenhum serviço neste dia.</p>
          ) : (
            <ul className="calendar-appointments">
              {selected.map((service) => (
                <ServiceAppointment
                  key={service.id}
                  service={service}
                  client={clients.get(service.clientId)}
                  entry={entries.get(service.id)}
                  onEdit={onEdit}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
