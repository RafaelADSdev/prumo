import type { Service } from "./finance";

export function saoPauloDateTime(now = new Date()) {
  const date = now.toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
  const time = now.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return { date, time };
}

export function compareAppointments(a: Service, b: Service) {
  return (
    (a.date ?? "").localeCompare(b.date ?? "") ||
    (a.appointmentTime ?? "24:00").localeCompare(
      b.appointmentTime ?? "24:00",
    ) ||
    a.description.localeCompare(b.description, "pt-BR")
  );
}

export function upcomingAppointments(
  services: Service[],
  date: string,
  time?: string,
) {
  return services
    .filter(
      (service): service is Service & { date: string } =>
        !service.archived &&
        service.date !== null &&
        service.date >= date &&
        (service.status === "Agendado" || service.status === "Em andamento") &&
        (service.date > date ||
          !time ||
          !service.appointmentTime ||
          service.appointmentTime >= time),
    )
    .sort(compareAppointments);
}
