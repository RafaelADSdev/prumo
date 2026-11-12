"use client";
import { LoginScreen } from "@/components/login-screen";
import { ThemeToggle } from "@/components/theme-toggle";
import { ClientProfile } from "@/components/client-profile";
import { FinancialReports } from "@/components/financial-reports";
import { ServiceCalendar } from "@/components/service-calendar";
import { ServiceReport } from "@/components/service-report";
import { CommandPalette } from "@/components/command-palette";
import { useMotion } from "@/hooks/use-motion";
import { changeView, revealDialog, dismissDialog } from "@/lib/motion";
import { FilePicker } from "@/components/file-picker";
import { Brand } from "@/components/brand";
import { AiSettings } from "@/components/ai-settings";
import { Assistant } from "@/components/assistant";
import type { Source } from "@/lib/ai/types";
import {
  useMemo,
  useEffect,
  useState,
  useRef,
  cloneElement,
  isValidElement,
} from "react";
import {
  Sparkles,
  RotateCw,
  LoaderCircle,
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  BriefcaseBusiness,
  CalendarDays,
  Repeat2,
  Car,
  ChartNoAxesCombined,
  Settings,
  Plus,
  Search,
  LogOut,
  ArrowRight,
  Download,
  Check,
  X,
  Wallet,
  Menu,
  FileUp,
  ShieldCheck,
  Fuel,
  Pencil,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Entry,
  money,
  parseMoney,
  totals,
  balance,
  status,
  inPeriod,
  schemas,
  expenseSummary,
  recordedMonths,
  paid,
  paymentMethods,
  serviceAmount,
  serviceStatuses,
  serviceTypes,
  clientAddress,
  formatCpf,
  type Client,
  type Service,
} from "@/lib/finance";
type Rec = Record<string, any>;
const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const nav = [
  ["overview", "Visão geral", LayoutDashboard],
  ["entries", "Lançamentos", ArrowLeftRight],
  ["calendar", "Agenda", CalendarDays],
  ["services", "Serviços e clientes", BriefcaseBusiness],
  ["fixed", "Despesas fixas", Repeat2],
  ["vehicles", "Veículos", Car],
  ["reports", "Relatórios", ChartNoAxesCombined],
  ["assistant", "Assistente IA", Sparkles],
  ["settings", "Configurações", Settings],
] as const;
const defaults = {
  name: "",
  years: [2026, 2027],
  initialBalance: null,
  initialDate: null,
  goal: null,
};
const categories = [
  "Serviços",
  "Vendas",
  "Alimentação",
  "Materiais",
  "Combustível",
  "Manutenção de veículos",
  "Despesas fixas",
  "Impostos",
  "Contador",
  "Divulgação",
  "Colaboradores",
  "Outros",
];
const iso = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const dec = (v: number | null | undefined) =>
  v == null ? "" : (v / 100).toFixed(2).replace(".", ",");
const br = (s: string | null) =>
  s ? s.split("-").reverse().join("/") : "Não informada";
const normalizeClientSearch = (value: string) =>
  value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");
async function api(url: string, body?: any, method = "POST") {
  const r = await fetch(
    url,
    body
      ? {
          method,
          headers:
            body instanceof FormData
              ? {}
              : { "Content-Type": "application/json" },
          body: body instanceof FormData ? body : JSON.stringify(body),
        }
      : { method },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Não foi possível concluir.");
  return data;
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement<any>, {
            "aria-label": label,
          })
        : children}
    </label>
  );
}
function ReceiptFields({
  date,
  method,
  onChange,
}: {
  date: string;
  method: string;
  onChange: (key: "receiptDate" | "receiptMethod", value: string) => void;
}) {
  return (
    <div className="form-grid">
      <Field label="Data do recebimento">
        <input
          type="date"
          required
          value={date}
          onChange={(event) => onChange("receiptDate", event.target.value)}
        />
      </Field>
      <Field label="Forma de recebimento">
        <input
          required
          list="receipt-methods"
          value={method}
          onChange={(event) => onChange("receiptMethod", event.target.value)}
        />
      </Field>
    </div>
  );
}
type ClientForm = Omit<Client, "id" | "archived">;
function ClientFields({
  client,
  onChange,
  nameLabel = "Nome / identificação",
  autoFocus,
  extraOnly = false,
}: {
  client: Partial<ClientForm>;
  onChange: (key: keyof ClientForm, value: string) => void;
  nameLabel?: string;
  autoFocus?: boolean;
  extraOnly?: boolean;
}) {
  return (
    <>
      {!extraOnly && (
        <>
          <Field label={nameLabel}>
            <input
              autoFocus={autoFocus}
              required
              value={client.name ?? ""}
              onChange={(e) => onChange("name", e.target.value)}
            />
          </Field>
          <Field label="CPF">
            <input
              inputMode="numeric"
              maxLength={14}
              value={client.cpf ?? ""}
              onChange={(e) => onChange("cpf", e.target.value)}
            />
          </Field>
        </>
      )}
      <Field label="Apelido (opcional)">
        <input
          value={client.nickname ?? ""}
          onChange={(e) => onChange("nickname", e.target.value)}
        />
      </Field>
      <Field label="Telefone (opcional)">
        <input
          type="tel"
          autoComplete="tel"
          value={client.phone ?? ""}
          onChange={(e) => onChange("phone", e.target.value)}
        />
      </Field>
      <Field label="Contato (opcional)">
        <input
          value={client.contact ?? ""}
          onChange={(e) => onChange("contact", e.target.value)}
        />
      </Field>
      <details className="form-details" open>
        <summary>Endereço (opcional)</summary>
        <Field label="Rua / logradouro">
          <input
            autoComplete="street-address"
            value={client.street ?? ""}
            onChange={(e) => onChange("street", e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="Número">
            <input
              value={client.number ?? ""}
              onChange={(e) => onChange("number", e.target.value)}
            />
          </Field>
          <Field label="Complemento">
            <input
              value={client.complement ?? ""}
              onChange={(e) => onChange("complement", e.target.value)}
            />
          </Field>
          <Field label="Bairro">
            <input
              value={client.neighborhood ?? ""}
              onChange={(e) => onChange("neighborhood", e.target.value)}
            />
          </Field>
          <Field label="Cidade">
            <input
              autoComplete="address-level2"
              value={client.city ?? ""}
              onChange={(e) => onChange("city", e.target.value)}
            />
          </Field>
          <Field label="Estado / UF">
            <input
              autoComplete="address-level1"
              value={client.state ?? ""}
              onChange={(e) => onChange("state", e.target.value)}
            />
          </Field>
          <Field label="CEP">
            <input
              autoComplete="postal-code"
              value={client.zipCode ?? ""}
              onChange={(e) => onChange("zipCode", e.target.value)}
            />
          </Field>
        </div>
      </details>
      <Field label="Descrição / observações (opcional)">
        <textarea
          value={client.notes ?? ""}
          onChange={(e) => onChange("notes", e.target.value)}
        />
      </Field>
    </>
  );
}
export default function App({
  loggedIn,
  needsSetup = false,
  cloudStorage = false,
}: {
  loggedIn: boolean;
  needsSetup?: boolean;
  cloudStorage?: boolean;
}) {
  const motion = useMotion();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [agendaFocus, setAgendaFocus] = useState<string>();
  const [clientSearch, setClientSearch] = useState("");
  const [commandOpen, setCommandOpen] = useState(false),
    [hasLoaded, setHasLoaded] = useState(false);
  const [backupFilename, setBackupFilename] = useState("");
  const [compactChart, setCompactChart] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width:760px)");
    const update = () => setCompactChart(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [logged, setLogged] = useState(loggedIn),
    [records, setRecords] = useState<Rec[]>([]),
    [audit, setAudit] = useState<Rec[]>([]),
    [loading, setLoading] = useState(loggedIn),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [page, setPage] = useState("overview"),
    [year, setYear] = useState("2026"),
    [month, setMonth] = useState("all"),
    [basis, setBasis] = useState("cash"),
    [reportView, setReportView] = useState<"financial" | "services">(
      "financial",
    ),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [category, setCategory] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [menu, setMenu] = useState(false);
  const [editor, setEditor] = useState<Rec | null>(null),
    [form, setForm] = useState<Rec>({}),
    [payment, setPayment] = useState<Entry | null>(null),
    [confirm, setConfirm] = useState<Rec | null>(null),
    [importFile, setImportFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Rec | null>(null),
    [restore, setRestore] = useState<Rec | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    confirmation = useRef<HTMLDialogElement>(null);
  const settings = {
    ...defaults,
    ...records.find((r) => r.kind === "settings"),
  };
  const entries = useMemo(
    () => records.filter((r) => r.kind === "entry") as Entry[],
    [records],
  );
  const clients = records.filter((r) => r.kind === "client"),
    vehicles = records.filter((r) => r.kind === "vehicle"),
    employees = records.filter((r) => r.kind === "employee");
  const services = useMemo(
    () => records.filter((r) => r.kind === "service") as Service[],
    [records],
  );
  const serviceEntries = useMemo(
    () =>
      new Map(entries.filter((e) => e.serviceId).map((e) => [e.serviceId, e])),
    [entries],
  );
  const cats = Array.from(
    new Set([
      ...categories,
      ...records.filter((r) => r.kind === "category").map((r) => r.name),
      ...entries.map((e) => e.category),
    ]),
  );
  const years = Array.from(
    new Set([
      ...settings.years,
      ...entries.map((e) => Number(e.competence.slice(0, 4))),
      ...services
        .filter((s) => !s.archived)
        .map((s) => Number((s.date || s.competence).slice(0, 4))),
      Number(year),
    ]),
  ).sort();
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setPage(q.get("page") || "overview");
    setYear(q.get("year") || "2026");
    setMonth(
      q.get("month") ||
        (q.get("page") === "calendar" ? iso().slice(5, 7) : "all"),
    );
  }, []);
  useEffect(() => {
    if (logged)
      history.replaceState(
        null,
        "",
        "?" + new URLSearchParams({ page, year, month }),
      );
  }, [page, year, month, logged]);
  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api("/api/data", undefined, "GET");
      setRecords(r.records);
      setAudit(r.audit);
      setHasLoaded(true);
      return r.records as Rec[];
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (logged) void refresh();
  }, [logged]);
  useEffect(() => {
    if (editor || payment) {
      dialog.current?.showModal();
      const body = dialog.current?.querySelector(".form-content");
      if (body) body.scrollTop = 0;
      dialog.current
        ?.querySelector<HTMLElement>(
          "input:not([type=checkbox]),select,textarea",
        )
        ?.focus({ preventScroll: true });
      if (dialog.current) revealDialog(dialog.current);
    } else dialog.current?.close();
  }, [editor, payment]);
  useEffect(() => {
    if (confirm) {
      confirmation.current?.showModal();
      if (confirmation.current) revealDialog(confirmation.current);
    } else confirmation.current?.close();
  }, [confirm]);
  async function run(fn: () => Promise<void>, msg = "Alterações salvas.") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(msg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const closeEditor = () =>
    void dismissDialog(dialog.current, () => {
      setEditor(null);
      setPayment(null);
    });
  const go = (p: string, f = "") =>
    changeView(() => {
      setPage(p);
      setFilter(f);
      setCategory("");
      setVehicle("");
      setSearch("");
      setMenu(false);
      setAgendaFocus(undefined);
      if (p === "calendar" && page !== "calendar" && month === "all")
        setMonth(iso().slice(5, 7));
    });
  function openAiSettings() {
    go("settings");
    const settingsPanel = document.getElementById("settings-ai");
    settingsPanel?.focus({ preventScroll: true });
    settingsPanel?.scrollIntoView({ block: "start" });
  }
  async function openAiSource(source: Source) {
    if (source.type === "help") {
      go(source.page);
      return;
    }
    if (source.type === "report") {
      go("reports");
      setReportView("financial");
      setYear(source.year);
      setMonth(source.month);
      setBasis(source.basis);
      void refresh();
      return;
    }
    const match = (item: Rec) =>
      item.id === source.id && item.kind === source.kind;
    const record = records.find(match) ?? (await refresh())?.find(match);
    if (!record) {
      setError("Este registro não está mais disponível no Prumo.");
      return;
    }
    if (source.kind === "client") {
      go("services");
      setSelectedClientId(record.id);
      return;
    }
    if (source.kind === "service" && source.visit && record.date) {
      go("calendar");
      setYear(record.date.slice(0, 4));
      setMonth(record.date.slice(5, 7));
      setAgendaFocus(record.id);
      return;
    }
    if (source.kind === "payroll") {
      go("entries");
      const entryId =
        "payroll-" + record.employeeId + "-" + record.competence.slice(0, 7);
      const linked = records.find(
        (item) => item.kind === "entry" && item.id === entryId,
      );
      if (linked) open("entry", linked);
      return;
    }
    const pageForKind = {
      service: "services",
      entry: "entries",
      recurrence: "fixed",
      vehicle: "vehicles",
      employee: "settings",
      category: "settings",
    };
    go(pageForKind[source.kind]);
    open(source.kind, record);
  }
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!logged) return;
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!dialog.current?.open && !confirmation.current?.open)
          setCommandOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [logged]);
  const periodEntries = entries.filter(
    (e) => !e.cancelled && inPeriod(e.competence, year, month),
  );
  const cash = totals(entries, year, month);
  const selectedClient = clients.find(
    (client) => client.id === selectedClientId,
  );
  const listedClients = clients.filter(
    (client) => !client.archived || client.id === form.clientId,
  );
  const clientQuery = normalizeClientSearch(clientSearch.trim());
  const phoneQuery = clientQuery.replace(/[\s()+.-]/g, "");
  const searchByPhone = /^\d+$/.test(phoneQuery);
  const matchingClients = clientQuery
    ? listedClients.filter(
        (client) =>
          [client.name, client.nickname, client.phone, client.contact].some(
            (value) =>
              value && normalizeClientSearch(value).includes(clientQuery),
          ) ||
          (searchByPhone &&
            (client.phone ?? "").replace(/\D/g, "").includes(phoneQuery)),
      )
    : listedClients;
  const expenses = expenseSummary(entries, year, month);
  const recorded = useMemo(
    () => recordedMonths(entries, year, month),
    [entries, year, month],
  );
  const editingServiceEntry =
    editor?.kind === "service" ? serviceEntries.get(editor.id) : undefined;
  const agendaEditor = editor?.kind === "service" && page === "calendar";
  const agendaClient = agendaEditor
    ? clients.find((client) => client.id === form.clientId)
    : undefined;
  const agendaSingleItem = agendaEditor && form.items.length === 1;
  const agendaAction = editor?.agendaAction;
  const ServiceItemGroup = agendaEditor ? "details" : "div";
  const pending = periodEntries.filter(
    (e) => !e.review && balance(e) !== null && (balance(e) || 0) > 0,
  );
  const receivable = pending
      .filter((e) => e.type === "income")
      .reduce((s, e) => s + (balance(e) || 0), 0),
    payable = pending
      .filter((e) => e.type === "expense")
      .reduce((s, e) => s + (balance(e) || 0), 0);
  const review = periodEntries.filter((e) => e.review || e.amount === null);
  const monthly = useMemo(
    () =>
      months.map((name, i) => {
        const t = totals(
          entries,
          year,
          String(i + 1).padStart(2, "0"),
          page === "reports" ? basis : "cash",
        );
        return {
          name: name.slice(0, 3),
          Entradas: t.income / 100,
          Saídas: t.expense / 100,
          Fluxo: t.net / 100,
        };
      }),
    [entries, year, page, basis],
  );
  const filtered = entries.filter((e) => {
    const period =
      filter.startsWith("cash-") || (page === "reports" && basis === "cash")
        ? e.payments.some((p) => !p.voided && inPeriod(p.date, year, month))
        : inPeriod(e.competence, year, month);
    const match =
      !filter ||
      (["income", "cash-income"].includes(filter) &&
        e.type === "income" &&
        !e.cancelled) ||
      (["expense", "cash-expense"].includes(filter) &&
        e.type === "expense" &&
        !e.cancelled) ||
      (filter === "receivable" &&
        e.type === "income" &&
        !e.review &&
        !e.cancelled &&
        (balance(e) || 0) > 0) ||
      (filter === "payable" &&
        e.type === "expense" &&
        !e.review &&
        !e.cancelled &&
        (balance(e) || 0) > 0) ||
      (filter === "review" &&
        (e.review || e.amount === null) &&
        !e.cancelled) ||
      (filter === "cancelled" && e.cancelled);
    return (
      period &&
      match &&
      (!search ||
        (e.description + " " + e.party + " " + e.notes)
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!category || e.category === category) &&
      (!vehicle || e.vehicleId === vehicle)
    );
  });
  function open(kind: string, r?: Rec, preset: Rec = {}) {
    setError("");
    setPayment(null);
    const agendaService =
      page === "calendar" && kind === "service" ? r : undefined;
    const agendaAmount = agendaService
      ? serviceAmount(agendaService.items)
      : null;
    const agendaEntry = agendaService
      ? serviceEntries.get(agendaService.id)
      : undefined;
    setEditor({
      kind,
      id: r?.id,
      createId: !r && kind === "service" ? crypto.randomUUID() : undefined,
      serviceAction: r && kind === "service" ? preset.status : undefined,
      settleService: preset.paymentAction === "settle",
      agendaAction:
        agendaService &&
        (preset.status === "Concluído"
          ? "confirm"
          : preset.paymentAction === "settle" &&
              (agendaAmount !== null || agendaService.items.length === 1)
            ? "settle"
            : undefined),
      agendaBalance:
        agendaService && agendaAmount !== null
          ? agendaAmount -
            agendaService.discount -
            (agendaEntry && !agendaEntry.cancelled ? paid(agendaEntry) : 0)
          : null,
    });
    const d = r || {};
    const plannedMethod =
      kind === "service"
        ? (d.method ?? serviceEntries.get(d.id)?.method ?? "")
        : "";
    setForm({
      type: "expense",
      description: "",
      category: "Outros",
      amount: "",
      discount: "0,00",
      competence:
        year + "-" + (month === "all" ? iso().slice(5, 7) : month) + "-01",
      due: "",
      party: "",
      method: "Pix",
      notes: "",
      review: false,
      confirmedZero: false,
      payments: [],
      vehicleId: "",
      employeeId: "",
      serviceId: "",
      recurrenceId: "",
      source: "",
      cancelled: false,
      name: "",
      cpf: "",
      model: "",
      plate: "",
      contact: "",
      nickname: "",
      phone: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      zipCode: "",
      paymentAction: "keep",
      receiptDate: iso(),
      receiptMethod: plannedMethod || (page === "calendar" ? "" : "Pix"),
      clientId: "",
      clientChoice: "",
      address: "",
      date: iso(),
      appointmentTime: "",
      status: "Em andamento",
      items: [
        { description: "Serviço", quantity: "1", unit: "un.", amount: null },
      ],
      day: 10,
      start: iso(),
      end: "",
      active: true,
      base: "",
      extras: "0,00",
      scope: "one",
      ...d,
      ...preset,
      ...(kind === "client" && d.cpf ? { cpf: formatCpf(d.cpf) } : {}),
      ...(["entry", "recurrence"].includes(kind)
        ? {
            amount: dec(d.amount ?? preset.amount),
            discount: dec(d.discount ?? 0),
          }
        : {}),
      ...(kind === "service"
        ? {
            discount: dec(d.discount ?? 0),
            method: plannedMethod,
            ...(page === "calendar" && !r
              ? {
                  description: "",
                  items: [
                    {
                      description: "Serviço",
                      quantity: "",
                      unit: "",
                      amount: null,
                    },
                  ],
                }
              : {}),
          }
        : {}),
      ...(kind === "settings"
        ? {
            name: settings.name,
            initialBalance: dec(settings.initialBalance),
            initialDate: settings.initialDate || "",
            goal: dec(settings.goal),
            years: settings.years,
          }
        : {}),
    });
  }
  function addAgendaService() {
    const today = iso();
    const period = year + "-" + (month === "all" ? today.slice(5, 7) : month);
    open("service", undefined, {
      agenda: true,
      status: "Agendado",
      date: today.startsWith(period) ? today : period + "-01",
      clientChoice: "new",
      newClient: { name: "", creationId: crypto.randomUUID() },
    });
  }
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    await run(async () => {
      const kind = editor.kind;
      let data = { ...form };
      if (["entry", "recurrence"].includes(kind))
        data.amount = data.amount === "" ? null : parseMoney(data.amount);
      if (["entry", "service"].includes(kind))
        data.discount = parseMoney(data.discount || "0");
      if (kind === "entry") data.due = data.due || null;
      if (kind === "recurrence") {
        data.day = Number(data.day);
        data.end = data.end || null;
      }
      if (kind === "service") {
        data.competence = data.competence || data.date;
        data.date = data.date || null;
        data.appointmentTime = data.appointmentTime || null;
        if (agendaEditor) {
          data.serviceType = data.serviceType || undefined;
          data.meters =
            data.serviceType === "Manutenção"
              ? undefined
              : data.meters?.trim() || undefined;
          data.description = data.description.trim() || data.serviceType;
          if (!editor.id) {
            data.items[0] = { ...data.items[0], description: data.serviceType };
          }
        }
        data.items = data.items.map((i: any) => ({
          ...i,
          amount:
            i.amount === "" || i.amount === null
              ? null
              : typeof i.amount === "number"
                ? i.amount
                : parseMoney(i.amount),
        }));
      }
      if (kind === "payroll")
        for (const k of ["base", "extras", "discount"])
          data[k] = parseMoney(data[k] || "0");
      if (kind === "settings") {
        data.initialBalance =
          data.initialBalance === "" ? null : parseMoney(data.initialBalance);
        data.initialDate = data.initialDate || null;
        data.goal = data.goal === "" ? null : parseMoney(data.goal);
      }
      const saveRecord = async () => {
        await api("/api/data", {
          kind,
          id: editor.id ?? editor.createId,
          data,
          scope: form.scope,
          ...(kind === "service" && form.paymentAction !== "keep"
            ? {
                receipt:
                  form.paymentAction === "unpaid"
                    ? { action: "unpaid" }
                    : {
                        action: "settle",
                        date: form.receiptDate,
                        method: form.receiptMethod,
                      },
              }
            : {}),
        });
        setEditor(null);
        if (agendaEditor && data.date) {
          setYear(data.date.slice(0, 4));
          if (month !== "all" || !data.date.startsWith(year))
            setMonth(data.date.slice(5, 7));
        }
        await refresh();
      };
      if (
        kind === "service" &&
        form.paymentAction === "unpaid" &&
        editingServiceEntry &&
        paid(editingServiceEntry) > 0
      ) {
        setConfirm({
          title: "Marcar serviço como não pago?",
          body: "Todos os recebimentos deste serviço serão estornados. O histórico será preservado e os totais financeiros serão atualizados.",
          action: saveRecord,
        });
      } else await saveRecord();
    });
  }
  function requestArchive(kind: "client" | "service", id: string) {
    setConfirm({
      title: kind === "client" ? "Remover cliente?" : "Remover serviço?",
      body:
        kind === "client"
          ? "O cliente sairá da lista de cadastros. Seus serviços, recebimentos e histórico financeiro serão preservados."
          : "O serviço sairá das listas. Valores pagos e a receber continuarão no financeiro. Para desfazer um recebimento, use a opção Não pago antes de remover.",
      action: async () => {
        await api("/api/data", { action: "archive", id });
        setEditor(null);
        if (kind === "client") setSelectedClientId("");
        await refresh();
      },
    });
  }
  function editPayment(entry: Entry, receipt: Entry["payments"][number]) {
    setError("");
    setEditor(null);
    setPayment(entry);
    setForm({
      paymentId: receipt.id,
      amount: dec(receipt.amount),
      date: receipt.date ?? "",
      method: receipt.method,
    });
  }
  function table(rows: Entry[], compact = false) {
    return (
      <div className="table-scroll">
        {compact && (
          <div className="mobile-transactions">
            {rows.map((e) => (
              <details key={e.id}>
                <summary>
                  <span>
                    {e.description}
                    <small>{status(e)}</small>
                  </span>
                  <strong
                    className={e.type === "income" ? "positive" : "outgoing"}
                  >
                    {e.amount === null
                      ? "Sem preço"
                      : money(e.amount - e.discount)}
                  </strong>
                </summary>
                <p>
                  {e.category} · {br(e.competence)} · {e.party || "Sem vínculo"}
                </p>
                <button onClick={() => open("entry", e)}>Abrir registro</button>
              </details>
            ))}
          </div>
        )}
        <table className={compact ? "compact-table" : "entry-table"}>
          <thead>
            <tr>
              <th>Descrição / origem</th>
              <th>Categoria</th>
              <th>Competência</th>
              <th>Valor devido</th>
              <th>Situação</th>
              {!compact && <th>Em aberto</th>}
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <button
                    className="text-button row-title"
                    onClick={() => open("entry", e)}
                  >
                    {e.description}
                  </button>
                  <small>
                    {e.party ||
                      vehicles.find((v) => v.id === e.vehicleId)?.name ||
                      "Sem vínculo"}
                    {e.source ? " · Importado" : ""}
                  </small>
                </td>
                <td>{e.category}</td>
                <td>{br(e.competence)}</td>
                <td className={e.type === "income" ? "positive" : "outgoing"}>
                  {e.amount === null
                    ? "Não informado"
                    : money(e.amount - e.discount)}
                </td>
                <td>
                  <span
                    className={
                      "status " +
                      (status(e) === "Quitado"
                        ? "settled"
                        : e.review
                          ? "review"
                          : "")
                    }
                  >
                    {status(e)}
                  </span>
                </td>
                {!compact && (
                  <td>{balance(e) === null ? "—" : money(balance(e)!)}</td>
                )}
                <td>
                  <div className="row-actions">
                    {!e.cancelled &&
                      e.amount !== null &&
                      (balance(e) || 0) > 0 && (
                        <button
                          className="icon-button"
                          title="Registrar baixa"
                          aria-label={"Registrar baixa de " + e.description}
                          onClick={() => {
                            setEditor(null);
                            setPayment(e);
                            setForm({
                              amount: dec(balance(e)),
                              date: iso(),
                              method: e.method || "Pix",
                            });
                          }}
                        >
                          <Check size={17} />
                        </button>
                      )}
                    <button
                      className="icon-button"
                      aria-label={"Editar " + e.description}
                      onClick={() => open("entry", e)}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty">
            <Wallet size={28} />
            <h3>Nenhum lançamento neste período</h3>
            <p>Registre uma movimentação ou escolha outro período.</p>
            <button onClick={() => open("entry")}>Criar lançamento</button>
          </div>
        )}
      </div>
    );
  }
  const serviceScheduleFields = editor?.kind === "service" && (
    <div className="form-grid">
      <Field
        label={form.agenda ? "Data do serviço" : "Data do serviço (opcional)"}
      >
        <input
          type="date"
          required={!!form.agenda}
          value={form.date || ""}
          onChange={(event) => {
            const date = event.target.value;
            setForm((current) => ({
              ...current,
              date,
              appointmentTime: date ? current.appointmentTime : "",
            }));
          }}
        />
      </Field>
      <Field label="Horário (opcional)">
        <input
          type="time"
          disabled={!form.date}
          value={form.appointmentTime || ""}
          onChange={(event) => set("appointmentTime", event.target.value)}
        />
      </Field>
      {!form.agenda && (
        <Field label="Mês de referência">
          <input
            type="month"
            required
            value={form.competence?.slice(0, 7) || ""}
            onChange={(event) =>
              set(
                "competence",
                event.target.value ? event.target.value + "-01" : "",
              )
            }
          />
        </Field>
      )}
    </div>
  );
  const serviceStatusField = editor?.kind === "service" && (
    <Field label="Situação operacional">
      <select
        value={form.status}
        onChange={(event) => {
          const nextStatus = event.target.value;
          setForm((current) => ({
            ...current,
            status: nextStatus,
            paymentAction:
              nextStatus === "Cancelado" && current.paymentAction === "settle"
                ? "keep"
                : current.paymentAction,
          }));
        }}
      >
        {serviceStatuses.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </Field>
  );
  if (!logged)
    return (
      <LoginScreen
        busy={busy}
        error={error}
        needsSetup={needsSetup}
        onLogin={(email, password) =>
          void run(async () => {
            await api("/api/auth", { email, password });
            setLogged(true);
          })
        }
      />
    );
  return (
    <div className="shell">
      <aside className={menu ? "sidebar expanded" : "sidebar"}>
        <a
          href={`?page=overview&year=${year}&month=${month}`}
          className="brand"
        >
          <Brand />
        </a>
        <p className="brand-tagline">Finanças em equilíbrio.</p>
        <nav id="primary-navigation" aria-label="Navegação principal">
          <span
            className="nav-track"
            aria-hidden="true"
            style={{
              transform: `translateY(${
                Math.max(
                  0,
                  nav.findIndex((n) => n[0] === page),
                ) * 53
              }px)`,
            }}
          />
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}

              onClick={() => go(id)}
            >
              <Icon size={19} />
              {label}
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={18} />
            <div>
              Seu espaço privado
              <small>
                {cloudStorage
                  ? "Dados salvos no Supabase"
                  : "Dados salvos neste computador"}
              </small>
            </div>
          </div>
          <button
            onClick={() =>
              void run(async () => {
                await api("/api/auth", {}, "DELETE");
                window.location.replace("/");
              })
            }
          >
            <LogOut size={17} />
            Encerrar sessão
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              onClick={() => setMenu(!menu)}
              aria-label="Abrir navegação"
              aria-expanded={menu}
              aria-controls="primary-navigation"
            >
              <Menu />
            </button>
          </div>
          <div className="workspace-tools">
            <ThemeToggle />
            <button
              className="command-trigger"
              aria-label="Abrir navegação rápida"
              onClick={() => setCommandOpen(true)}
            >
              <Search size={17} />
              <span>Ir para…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className="icon-button refresh-button"
              disabled={loading}
              aria-label="Atualizar dados"
              title="Atualizar dados"
              onClick={() => void refresh()}
            >
              <RotateCw size={17} className={loading ? "spin" : ""} />
            </button>
          </div>
          <span className="private-label">
            <span />
            Sessão protegida
          </span>
        </header>
        <main
          className={`page-content${page === "settings" ? " settings-content" : page === "assistant" ? " assistant-content" : ""}`}
          data-loading={loading && !hasLoaded}
          aria-busy={loading}
        >
          {page !== "assistant" && (
            <div
              className={
                page === "calendar"
                  ? "page-heading agenda-page-heading"
                  : "page-heading"
              }
            >
              <div>
                <h1>{nav.find((n) => n[0] === page)?.[1]}</h1>
                <p>
                  {page === "overview"
                    ? "Uma visão clara do que entra, do que sai e do que vem pela frente."
                    : page === "entries"
                      ? "Compromissos, baixas e histórico em um só lugar."
                      : (
                          {
                            services:
                              "Cadastre clientes e acompanhe seus serviços e recebimentos.",
                            calendar:
                              "Acompanhe serviços, confirmações e recebimentos mês a mês.",
                            fixed:
                              "Organize as contas que se repetem todos os meses.",
                            vehicles:
                              "Acompanhe abastecimentos, manutenção e custos por veículo.",
                            reports:
                              "Compare caixa e competência e consulte os registros de origem.",
                            settings:
                              "Personalize o financeiro e cuide dos seus dados.",
                          } as Rec
                        )[page] || "Organize seu financeiro."}
                </p>
              </div>
              <div className="heading-actions">
                <div className="period">
                  <select
                    aria-label="Ano"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    {years.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                  {page !== "calendar" && (
                    <select
                      aria-label="Mês"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                    >
                      <option value="all">Ano completo</option>
                      {months.map((m, i) => (
                        <option value={String(i + 1).padStart(2, "0")} key={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  className="primary"
                  onClick={
                    page === "calendar" ? addAgendaService : () => open("entry")
                  }
                >
                  <Plus size={18} />
                  {page === "calendar" ? "Agendar serviço" : "Novo lançamento"}
                </button>
              </div>
            </div>
          )}
          {page === "overview" && !loading && entries.length === 0 && (
            <section className="first-step">
              <span className="first-step-icon">
                <Wallet size={25} />
              </span>
              <div>
                <h2>Um começo simples. Uma visão mais clara.</h2>
                <p>
                  Adicione seu primeiro lançamento ou traga o histórico da sua
                  planilha.
                </p>
              </div>
              <button onClick={() => go("settings")}>
                <FileUp size={16} />
                Importar planilha
                <ArrowRight size={16} />
              </button>
            </section>
          )}
          {error && (
            <div className="error alert" role="alert">
              {error}
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="Fechar erro"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="success alert" role="status">
              <Check size={16} />
              {notice}
              <button
                className="icon-button"
                onClick={() => setNotice("")}
                aria-label="Fechar aviso"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading && (
            <div role="status" className="loading">
              <LoaderCircle size={15} className="spin" />
              <span>Atualizando dados…</span>
            </div>
          )}
          {page === "assistant" && (
            <Assistant
              records={records.map(
                ({ id, kind, name, description, archived, city }) => ({
                  id,
                  kind,
                  name,
                  description,
                  archived,
                  city,
                }),
              )}
              onSettings={openAiSettings}
              onSource={openAiSource}
              onCommitted={() => void refresh()}
            />
          )}
          {page === "calendar" && (
            <ServiceCalendar
              key={agendaFocus ?? "agenda"}
              focusedService={agendaFocus}
              year={year}
              month={month}
              services={services}
              clients={
                new Map(
                  clients.map((client) => [
                    client.id,
                    { id: client.id, ...schemas.client.parse(client) },
                  ]),
                )
              }
              entries={serviceEntries}
              loading={loading}
              onMonth={setMonth}
              onEdit={(service, action) =>
                open(
                  "service",
                  service,
                  action === "confirm"
                    ? { status: "Concluído" }
                    : action === "settle"
                      ? { paymentAction: "settle" }
                      : {},
                )
              }
            />
          )}
          {page === "reports" && (
            <div
              className="toolbar report-view-selector"
              role="group"
              aria-label="Tipo de relatório"
            >
              <button
                aria-pressed={reportView === "financial"}
                onClick={() => setReportView("financial")}
              >
                Financeiro
              </button>
              <button
                aria-pressed={reportView === "services"}
                onClick={() => setReportView("services")}
              >
                Serviços do período
              </button>
            </div>
          )}
          {page === "reports" && reportView === "services" && (
            <ServiceReport
              key={year + "-" + month}
              services={services}
              clients={clients.map((client) => ({
                id: client.id,
                ...schemas.client.parse(client),
              }))}
              entries={serviceEntries}
              year={year}
              month={month}
              onEdit={(service) => open("service", service)}
            />
          )}
          {page === "reports" && reportView === "financial" && (
            <FinancialReports
              key={year + "-" + month}
              entries={entries}
              year={year}
              month={month}
              basis={basis === "accrual" ? "accrual" : "cash"}
              setBasis={setBasis}
              loading={loading}
              settings={settings}
              recordLabels={Object.fromEntries(
                records.map((r) => [r.id, r.name || r.description || r.id]),
              )}
              onEntry={(entry) => open("entry", entry)}
            />
          )}
          {page === "overview" && (
            <>
              <div className="section-meta">
                <span>
                  {month === "all"
                    ? "Janeiro a dezembro"
                    : months[Number(month) - 1]}{" "}
                  de {year}
                </span>
                <span>
                  {page === "overview"
                    ? "Caixa · valores efetivamente movimentados"
                    : basis === "cash"
                      ? "Caixa · pela data da baixa"
                      : "Competência · pelo mês da operação"}
                </span>
              </div>
              <div className="metrics">
                {[
                  [
                    "Recebimentos efetivos",
                    cash.income,
                    "cash-income",
                    ArrowDownLeft,
                    "positive",
                  ],
                  [
                    "Pagamentos efetivos",
                    cash.expense,
                    "cash-expense",
                    ArrowUpRight,
                    "outgoing",
                  ],
                  [
                    "Fluxo líquido do período",
                    cash.net,
                    "",
                    ArrowLeftRight,
                    "accent",
                  ],
                ].map(([label, value, f, Icon, color]: any) => (
                  <button
                    className="metric"
                    key={label}
                    onClick={() => go("entries", f)}
                  >
                    <div>
                      <span>{label}</span>
                      <Icon size={20} className={color} />
                    </div>
                    <strong>{money(value)}</strong>
                    <small>
                      {label.startsWith("Fluxo")
                        ? "Resultado gerencial do período"
                        : "Ver lançamentos"}
                      <ArrowRight size={13} />
                    </small>
                  </button>
                ))}
              </div>
              <div className="balance-note">
                <Wallet size={16} />
                {settings.initialBalance === null
                  ? "Saldo inicial não informado. Os valores representam a movimentação registrada."
                  : `Saldo inicial de ${money(settings.initialBalance)} em ${br(settings.initialDate)}. Movimentação registrada não confirma saldo bancário.`}
              </div>
              {recorded.length > 0 && (
                <section
                  className="panel"
                  aria-labelledby="recorded-months-title"
                >
                  <div className="panel-heading">
                    <div>
                      <h2 id="recorded-months-title">
                        Serviços e gastos registrados
                      </h2>
                      <p>
                        Valores informados por mês da operação, incluindo
                        lançamentos a conferir. O total de gastos já inclui os
                        veículos.
                      </p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Mês</th>
                          <th scope="col">Serviços com cliente</th>
                          <th scope="col">Valor dos serviços</th>
                          <th scope="col">Total de gastos</th>
                          <th scope="col">Gastos com veículos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recorded.map((row) => (
                          <tr key={row.month}>
                            <td>{months[Number(row.month) - 1]}</td>
                            <td>{row.services}</td>
                            <td>{money(row.serviceValue)}</td>
                            <td>{money(row.expenses)}</td>
                            <td>{money(row.vehicleExpenses)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {page === "overview" && (
                <section
                  className="panel expense-summary"
                  aria-labelledby="expense-summary-title"
                >
                  <div className="panel-heading">
                    <div>
                      <h2 id="expense-summary-title">
                        Gastos confirmados do período
                      </h2>
                      <p>
                        Pelo mês da despesa · fixas, veículos, colaboradores e
                        demais gastos.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => go("entries", "expense")}
                    >
                      Ver gastos
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  <dl className="expense-summary-values">
                    <div>
                      <dt>Gastos totais</dt>
                      <dd>{money(expenses.total)}</dd>
                    </div>
                    <div>
                      <dt>Já pagos</dt>
                      <dd>{money(expenses.paid)}</dd>
                    </div>
                    <div>
                      <dt>A pagar</dt>
                      <dd>{money(expenses.outstanding)}</dd>
                    </div>
                  </dl>
                  <dl className="expense-origins">
                    {expenses.groups.map((group) => (
                      <div key={group.name}>
                        <dt>{group.name}</dt>
                        <dd>{money(group.amount)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="expense-summary-note">
                    Pagos considera as baixas dessas despesas, mesmo quando
                    feitas em outro mês.{" "}
                    {expenses.unresolved > 0 && (
                      <span>
                        {expenses.unresolved} gasto(s) a conferir ou sem valor
                        ficam fora dos totais até a confirmação.
                      </span>
                    )}
                  </p>
                </section>
              )}
              <div className="charts">
                <section className="panel comparison">
                  <div className="panel-heading">
                    <div>
                      <h2>Entradas e saídas</h2>
                      <p>Comparação mensal · {year}</p>
                    </div>
                    <div className="legend">
                      <span>
                        <i className="green-dot" />
                        Entradas
                      </span>
                      <span>
                        <i className="orange-dot" />
                        Saídas
                      </span>
                    </div>
                  </div>
                  <div className="chart">
                    {monthly.some((d) => d.Entradas || d.Saídas) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          key={
                            year +
                            "-" +
                            basis +
                            "-" +
                            monthly
                              .map((d) => d.Entradas + "," + d.Saídas)
                              .join(";")
                          }
                          data={monthly}
                          barGap={5}
                        >
                          <CartesianGrid
                            vertical={false}
                            stroke="var(--prumo-line)"
                            strokeDasharray="3 5"
                          />
                          <XAxis
                            dataKey="name"
                            interval={0}
                            angle={compactChart ? -40 : 0}
                            textAnchor={compactChart ? "end" : "middle"}
                            height={compactChart ? 48 : 30}
                            tickMargin={compactChart ? 10 : 8}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "var(--muted)", fontSize: 12 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "var(--muted)", fontSize: 12 }}
                            tickFormatter={(n) =>
                              n >= 1000 ? `${n / 1000} mil` : String(n)
                            }
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--panel)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              color: "var(--prumo-ink)",
                            }}
                            formatter={(v) =>
                              money(Math.round(Number(v) * 100))
                            }
                          />
                          <Bar
                            isAnimationActive={false}
                            dataKey="Entradas"
                            className="cash-income"
                            fill="var(--chart-income, #34765a)"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={18}
                          />
                          <Bar
                            isAnimationActive={false}
                            dataKey="Saídas"
                            className="cash-outgoing"
                            fill="var(--chart-outgoing, #b0795d)"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={18}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="empty chart-placeholder">
                        <ChartNoAxesCombined size={32} />
                        <h3>Seu fluxo vai ganhar forma aqui.</h3>
                        <p>
                          Os recebimentos e pagamentos registrados aparecem mês
                          a mês, sem complicação.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Para onde foi o dinheiro</h2>
                      <p>Despesas por categoria · período selecionado</p>
                    </div>
                  </div>
                  {Object.values(cash.categories).some((n) => n > 0) ? (
                    <div className="category-list">
                      {Object.entries(cash.categories)
                        .filter(([, n]) => n > 0)
                        .sort((a, b) => b[1] - a[1])
                        .map(([c, n], i) => (
                          <button
                            key={c}
                            onClick={() => {
                              go(
                                "entries",
                                page === "overview" || basis === "cash"
                                  ? "cash-expense"
                                  : "expense",
                              );
                              setCategory(c);
                            }}
                          >
                            <span>
                              <i
                                style={{
                                  background: [
                                    "#2d6a51",
                                    "#b0795d",
                                    "#34765a",
                                    "#769bcf",
                                    "#d3bc7d",
                                  ][i % 5],
                                }}
                              />
                              {c}
                            </span>
                            <strong>{money(n)}</strong>
                            <div
                              className="category-bar"
                              style={{
                                width:
                                  (n / Math.max(1, cash.expense)) * 100 + "%",
                              }}
                            />
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="empty chart-empty">
                      <ChartNoAxesCombined size={30} />
                      <h3>O destino aparece aqui</h3>
                      <p>Registre pagamentos para visualizar suas despesas.</p>
                    </div>
                  )}
                </section>
              </div>
              <div className="pending-strip">
                <button onClick={() => go("entries", "receivable")}>
                  <span>A receber</span>
                  <strong>{money(receivable)}</strong>
                  <ArrowRight size={17} />
                </button>
                <button onClick={() => go("entries", "payable")}>
                  <span>A pagar</span>
                  <strong>{money(payable)}</strong>
                  <ArrowRight size={17} />
                </button>
                <button onClick={() => go("entries", "review")}>
                  <span>Precisam de conferência</span>
                  <strong>{review.length} registros</strong>
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className="lower-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Lançamentos recentes</h2>
                    <button
                      className="text-button"
                      onClick={() => go("entries")}
                    >
                      Ver todos
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {table(periodEntries.slice(-5).reverse(), true)}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Ações rápidas</h2>
                  </div>
                  <div className="quick-actions">
                    <button
                      onClick={() =>
                        open("entry", undefined, {
                          type: "income",
                          category: "Serviços",
                        })
                      }
                    >
                      <ArrowDownLeft className="positive" />
                      Registrar entrada
                      <Plus size={16} />
                    </button>
                    <button onClick={() => open("entry")}>
                      <ArrowUpRight className="outgoing" />
                      Registrar saída
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() =>
                        open("entry", undefined, {
                          category: "Combustível",
                          fuel: {
                            liters: "",
                            odometer: "",
                            station: "",
                            fuelType: "",
                          },
                        })
                      }
                    >
                      <Fuel className="accent" />
                      Abastecimento
                      <Plus size={16} />
                    </button>
                  </div>
                  <h3 className="minor-title">Próximas pendências</h3>
                  {pending
                    .sort((a, b) =>
                      (a.due || "9999").localeCompare(b.due || "9999"),
                    )
                    .slice(0, 3)
                    .map((e) => (
                      <button
                        key={e.id}
                        className="pending-item"
                        onClick={() => open("entry", e)}
                      >
                        <span>
                          {e.description}
                          <small>{e.due ? br(e.due) : "Sem vencimento"}</small>
                        </span>
                        <strong>{money(balance(e)!)}</strong>
                      </button>
                    ))}
                  {!pending.length && (
                    <p className="muted pad">
                      Sem compromissos confirmados em aberto.
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
          {page === "entries" && (
            <>
              <div className="toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Pesquisar lançamentos"
                    placeholder="Pesquisar descrição, cliente ou observação"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filtrar situação"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    ["", "Todos os lançamentos"],
                    ["income", "Entradas"],
                    ["expense", "Saídas"],
                    ["cash-income", "Recebimentos no período"],
                    ["cash-expense", "Pagamentos no período"],
                    ["receivable", "A receber"],
                    ["payable", "A pagar"],
                    ["review", "A conferir"],
                    ["cancelled", "Cancelados"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {cats.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <section className="panel">{table(filtered)}</section>
            </>
          )}
          {page === "services" && (
            <>
              <div className="toolbar">
                <button
                  className="primary"
                  onClick={() =>
                    open(
                      "service",
                      undefined,
                      selectedClient ? { clientId: selectedClient.id } : {},
                    )
                  }
                >
                  <Plus size={16} />
                  Novo serviço
                </button>
                <button onClick={() => open("client")}>
                  <Plus size={16} />
                  Novo cliente
                </button>
              </div>
              {selectedClient ? (
                <ClientProfile
                  key={selectedClient.id}
                  client={{
                    id: selectedClient.id,
                    ...schemas.client.parse(selectedClient),
                  }}
                  services={services
                    .filter(
                      (r) => !r.archived && r.clientId === selectedClient.id,
                    )
                    .map((service) => {
                      const entry = serviceEntries.get(service.id);
                      const amount = entry
                        ? entry.amount
                        : serviceAmount(service.items);
                      return {
                        id: service.id,
                        description: service.description,
                        date: service.date,
                        status: service.status,
                        financialStatus: entry
                          ? status(entry) === "Quitado"
                            ? "Pago"
                            : status(entry) === "Em aberto"
                              ? "Não pago"
                              : status(entry)
                          : service.status === "Cancelado"
                            ? "Cancelado"
                            : "Aguardando execução",
                        receiptSummary: entry?.payments
                          .filter((payment) => !payment.voided)
                          .map(
                            (payment) =>
                              `${money(payment.amount)} · ${payment.method || "Forma não informada"}`,
                          )
                          .join(" / "),
                        amount:
                          amount === null
                            ? null
                            : amount - (entry?.discount ?? service.discount),
                      };
                    })
                    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))}
                  onClose={() => setSelectedClientId("")}
                  onEdit={() => open("client", selectedClient)}
                  onRemove={() => requestArchive("client", selectedClient.id)}
                  onNewService={() =>
                    open("service", undefined, { clientId: selectedClient.id })
                  }
                  onEditService={(id) =>
                    open(
                      "service",
                      records.find((r) => r.id === id),
                    )
                  }
                />
              ) : (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Serviços do período</h2>
                      <span className="muted">
                        Operação e recebimento separados
                      </span>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Serviço / cliente</th>
                            <th>Data</th>
                            <th>Mês de referência</th>
                            <th>Operação</th>
                            <th>Financeiro</th>
                            <th>Valor</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {services
                            .filter(
                              (r) =>
                                !r.archived &&
                                inPeriod(r.competence || r.date, year, month),
                            )
                            .sort(
                              (a, b) =>
                                (b.competence || b.date || "")
                                  .slice(0, 7)
                                  .localeCompare(
                                    (a.competence || a.date || "").slice(0, 7),
                                  ) ||
                                (b.date || "").localeCompare(a.date || ""),
                            )
                            .map((s) => {
                              const reference = s.competence;
                              const e = serviceEntries.get(s.id);
                              const amount = e
                                ? e.amount
                                : serviceAmount(s.items);
                              return (
                                <tr key={s.id}>
                                  <td>
                                    <strong>{s.description}</strong>
                                    <small>
                                      {
                                        clients.find((c) => c.id === s.clientId)
                                          ?.name
                                      }
                                    </small>
                                  </td>
                                  <td>{br(s.date)}</td>
                                  <td>
                                    {months[Number(reference.slice(5, 7)) - 1]}{" "}
                                    de {reference.slice(0, 4)}
                                  </td>
                                  <td>{s.status}</td>
                                  <td>
                                    <span>
                                      {e
                                        ? status(e) === "Quitado"
                                          ? "Pago"
                                          : status(e) === "Em aberto"
                                            ? "Não pago"
                                            : status(e)
                                        : s.status === "Cancelado"
                                          ? "Cancelado"
                                          : "Aguardando execução"}
                                    </span>
                                    {e &&
                                      e.payments
                                        .filter((p) => !p.voided)
                                        .map((p) => (
                                          <small key={p.id}>
                                            {money(p.amount)} ·{" "}
                                            {p.method || "Forma não informada"}{" "}
                                            · {br(p.date)}
                                          </small>
                                        ))}
                                  </td>
                                  <td>
                                    {amount === null
                                      ? "Sem preço"
                                      : money(
                                          amount - (e?.discount ?? s.discount),
                                        )}
                                  </td>
                                  <td>
                                    <div className="service-actions">
                                      <button
                                        onClick={() =>
                                          open("service", s, {
                                            paymentAction: "settle",
                                          })
                                        }
                                        disabled={
                                          !e ||
                                          e.cancelled ||
                                          e.amount === null ||
                                          (balance(e) || 0) <= 0
                                        }
                                        aria-label={`Receber serviço: ${s.description}`}
                                      >
                                        Receber
                                      </button>
                                      <button
                                        onClick={() => open("service", s)}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        className="danger"
                                        onClick={() =>
                                          requestArchive("service", s.id)
                                        }
                                        aria-label={`Remover serviço: ${s.description}`}
                                      >
                                        Remover
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    {!records.some(
                      (r) =>
                        r.kind === "service" &&
                        !r.archived &&
                        inPeriod(r.competence || r.date, year, month),
                    ) && (
                      <div className="empty">
                        <BriefcaseBusiness size={28} />
                        <h3>Nenhum serviço neste período</h3>
                        <p>
                          {clients.some((c) => !c.archived)
                            ? "Adicione um serviço e acompanhe os recebimentos na mesma origem."
                            : "Comece cadastrando um cliente para vincular seus serviços."}
                        </p>
                        <button
                          onClick={() =>
                            open(
                              clients.some((c) => !c.archived)
                                ? "service"
                                : "client",
                            )
                          }
                        >
                          {clients.some((c) => !c.archived)
                            ? "Novo serviço"
                            : "Cadastrar cliente"}
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-heading client-list-heading">
                      <h2>Clientes</h2>
                      <label className="search">
                        <Search size={17} aria-hidden="true" />
                        <input
                          type="search"
                          aria-label="Pesquisar clientes"
                          placeholder="Nome, apelido ou contato"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                        />
                      </label>
                    </div>
                    {matchingClients.map((c) => (
                      <button
                        className="summary-row"
                        key={c.id}
                        onClick={() => setSelectedClientId(c.id)}
                        aria-label={`Ver cliente: ${c.name}`}
                      >
                        <span>
                          {c.name}
                          <small>
                            {[c.nickname, c.phone || c.contact]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                    {matchingClients.length === 0 && (
                      <div className="empty" role="status">
                        <p>
                          {listedClients.length
                            ? "Nenhum cliente encontrado."
                            : "Cadastre seu primeiro cliente para vincular um serviço."}
                        </p>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
          {page === "fixed" && (
            <>
              <div className="toolbar">
                <button className="primary" onClick={() => open("recurrence")}>
                  <Plus size={16} />
                  Nova despesa fixa
                </button>
                <button
                  disabled={busy || month === "all"}
                  onClick={() =>
                    void run(async () => {
                      await api("/api/data", {
                        action: "generate",
                        year: Number(year),
                        month: Number(month),
                      });
                      await refresh();
                    }, "Geração concluída. As contas permanecem previstas.")
                  }
                >
                  Gerar contas do mês
                </button>
                <span className="muted">
                  {month === "all"
                    ? "Escolha um mês para gerar as contas."
                    : "Gerar novamente não duplica as contas."}
                </span>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Recorrências mensais</h2>
                </div>
                {records
                  .filter((r) => r.kind === "recurrence")
                  .map((r) => (
                    <button
                      className="summary-row"
                      key={r.id}
                      onClick={() => open("recurrence", r)}
                    >
                      <span>
                        {r.description}
                        <small>
                          Dia {r.day} · {r.category} ·{" "}
                          {r.active ? "Ativa" : "Encerrada"}
                        </small>
                      </span>
                      <strong>{money(r.amount)}</strong>
                      <Pencil size={16} />
                    </button>
                  ))}
                {!records.some((r) => r.kind === "recurrence") && (
                  <div className="empty">
                    <Repeat2 size={28} />
                    <h3>Suas contas recorrentes, organizadas</h3>
                    <p>Cadastre uma despesa e gere os compromissos do mês.</p>
                  </div>
                )}
              </section>
              {table(periodEntries.filter((e) => e.recurrenceId))}
            </>
          )}
          {page === "vehicles" && (
            <>
              <div className="toolbar">
                <button className="primary" onClick={() => open("vehicle")}>
                  <Plus size={16} />
                  Cadastrar veículo
                </button>
                <button
                  onClick={() =>
                    open("entry", undefined, {
                      category: "Combustível",
                      vehicleId: vehicle,
                      fuel: {
                        liters: "",
                        odometer: "",
                        station: "",
                        fuelType: "",
                      },
                    })
                  }
                >
                  <Fuel size={17} />
                  Abastecimento
                </button>
                <button
                  onClick={() =>
                    open("entry", undefined, {
                      category: "Manutenção de veículos",
                      vehicleId: vehicle,
                    })
                  }
                >
                  Registrar manutenção
                </button>
                <select
                  aria-label="Selecionar veículo"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                >
                  <option value="">Todos os veículos / a vincular</option>
                  {vehicles.map((v) => (
                    <option value={v.id} key={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="vehicle-grid">
                {vehicles
                  .filter((v) => !vehicle || v.id === vehicle)
                  .map((v) => {
                    const es = entries.filter((e) => e.vehicleId === v.id);
                    return (
                      <section className="panel vehicle-card" key={v.id}>
                        <div>
                          <Car size={25} />
                          <button
                            className="icon-button"
                            aria-label={"Editar " + v.name}
                            onClick={() => open("vehicle", v)}
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                        <h2>{v.name}</h2>
                        <p>
                          {v.model || "Modelo não informado"} ·{" "}
                          {v.plate || "Sem placa"}
                        </p>
                        <dl>
                          {[
                            [
                              "Registrado no período",
                              totals(es, year, month, "accrual").expense,
                            ],
                            [
                              "Pago no período",
                              totals(es, year, month).expense,
                            ],
                            [
                              "Combustível no ano",
                              totals(
                                es.filter((e) => e.category === "Combustível"),
                                year,
                                "all",
                                "accrual",
                              ).expense,
                            ],
                            [
                              "Manutenção no ano",
                              totals(
                                es.filter(
                                  (e) =>
                                    e.category === "Manutenção de veículos",
                                ),
                                year,
                                "all",
                                "accrual",
                              ).expense,
                            ],
                          ].map(([l, n]) => (
                            <div key={String(l)}>
                              <dt>{l}</dt>
                              <dd>{money(Number(n))}</dd>
                            </div>
                          ))}
                        </dl>
                        <button onClick={() => setVehicle(v.id)}>
                          Ver histórico
                        </button>
                      </section>
                    );
                  })}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    Histórico de custos{" "}
                    {vehicle ? "do veículo" : "e gastos a vincular"}
                  </h2>
                </div>
                {table(
                  periodEntries.filter((e) =>
                    vehicle
                      ? e.vehicleId === vehicle
                      : !!e.vehicleId ||
                        ["Combustível", "Manutenção de veículos"].includes(
                          e.category,
                        ),
                  ),
                )}
              </section>
            </>
          )}
          {page === "settings" && (
            <div className="settings-page">
              <div className="settings-grid">
                <section className="panel settings-panel organization-panel">
                  <h2>Organização e preferências</h2>
                  <p>Nome, saldo inicial e meta anual de vendas brutas.</p>
                  <dl className="organization-details">
                    <div>
                      <dt>Organização</dt>
                      <dd>{settings.name?.trim() || "Não definida"}</dd>
                    </div>
                    <div>
                      <dt>Saldo inicial</dt>
                      <dd>
                        {settings.initialBalance == null
                          ? "Não definido"
                          : money(settings.initialBalance)}
                      </dd>
                    </div>
                    <div>
                      <dt>Meta anual de vendas brutas</dt>
                      <dd>
                        {settings.goal == null
                          ? "Não definida"
                          : money(settings.goal)}
                      </dd>
                    </div>
                  </dl>
                  <button onClick={() => open("settings", settings)}>
                    <Pencil size={15} /> Editar configurações
                  </button>
                  <div className="settings-years">
                    <label htmlFor="new-year">Anos do financeiro</label>
                    <div className="year-list" aria-label="Anos cadastrados">
                      {[...settings.years]
                        .sort((a: number, b: number) => a - b)
                        .map((y: number) => (
                          <span key={y}>{y}</span>
                        ))}
                    </div>
                    <div className="inline-form">
                      <input
                        aria-label="Adicionar ano"
                        type="number"
                        min="1900"
                        max="2200"
                        id="new-year"
                        placeholder="Novo ano"
                      />
                      <button
                        onClick={() =>
                          void run(async () => {
                            const y = Number(
                              (
                                document.getElementById(
                                  "new-year",
                                ) as HTMLInputElement
                              ).value,
                            );
                            await api("/api/data", {
                              kind: "settings",
                              id: "settings",
                              data: {
                                ...settings,
                                years: Array.from(
                                  new Set([...settings.years, y]),
                                ),
                              },
                            });
                            await refresh();
                            setYear(String(y));
                          })
                        }
                      >
                        Adicionar ano
                      </button>
                    </div>
                  </div>
                </section>
                <section className="panel settings-panel appearance-panel">
                  <div>
                    <span className="appearance-icon">
                      <Sparkles size={22} />
                    </span>
                    <h2>Uma experiência no seu ritmo</h2>
                    <p>
                      Transições entre telas, gráficos e feedbacks visuais. Você
                      pode reduzir o movimento a qualquer momento.
                    </p>
                  </div>
                  <button
                    className="motion-switch"
                    type="button"
                    role="switch"
                    aria-checked={motion.enabled}
                    aria-label="Ativar animações"
                    onClick={motion.toggle}
                  >
                    <span className="switch-track">
                      <span />
                    </span>
                    {motion.enabled
                      ? "Animações ativadas"
                      : "Movimento reduzido"}
                  </button>
                  {motion.reduced && (
                    <small>
                      A preferência de movimento reduzido do seu dispositivo
                      está sendo respeitada.
                    </small>
                  )}
                </section>
                <AiSettings />
                <section className="panel settings-panel support-panel">
                  <h2>Cadastros de apoio</h2>
                  <p>Categorias e colaboradores para classificar despesas.</p>
                  <div className="settings-shortcuts">
                    <button
                      aria-label="Nova categoria"
                      onClick={() => open("category")}
                    >
                      <span>
                        <strong>Nova categoria</strong>
                        <small>Organize a classificação dos lançamentos</small>
                      </span>
                      <Plus size={18} />
                    </button>
                    <button
                      aria-label="Novo colaborador"
                      onClick={() => open("employee")}
                    >
                      <span>
                        <strong>Novo colaborador</strong>
                        <small>Cadastre quem faz parte da equipe</small>
                      </span>
                      <Plus size={18} />
                    </button>
                    <button
                      aria-label="Registrar pagamento"
                      onClick={() => open("payroll")}
                    >
                      <span>
                        <strong>Registrar pagamento</strong>
                        <small>Lance um pagamento à equipe</small>
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                  <div className="support-groups">
                    {[
                      {
                        kind: "category",
                        title: "Categorias",
                        items: records.filter((r) => r.kind === "category"),
                        empty: "Nenhuma categoria cadastrada.",
                      },
                      {
                        kind: "employee",
                        title: "Colaboradores",
                        items: employees,
                        empty: "Nenhum colaborador cadastrado.",
                      },
                    ].map((group) => (
                      <section
                        className="support-group"
                        key={group.kind}
                        aria-labelledby={`support-${group.kind}-title`}
                      >
                        <header className="support-group-heading">
                          <h3 id={`support-${group.kind}-title`}>
                            {group.title}
                          </h3>
                          <span
                            className="support-count"
                            aria-label={`${group.items.length} cadastros`}
                          >
                            {group.items.length}
                          </span>
                        </header>
                        {group.items.length ? (
                          <ul
                            className="support-list"
                            aria-label={group.title}
                            tabIndex={0}
                          >
                            {group.items.map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  className="support-edit"
                                  aria-label={`Editar ${group.kind === "category" ? "categoria" : "colaborador"}: ${item.name}`}
                                  onClick={() => open(group.kind, item)}
                                >
                                  <span>{item.name}</span>
                                  <Pencil size={15} aria-hidden="true" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="support-empty">{group.empty}</p>
                        )}
                      </section>
                    ))}
                  </div>
                </section>
                <section className="panel settings-panel backup-panel">
                  <h2>Backup e restauração</h2>
                  <p>
                    Guarde uma cópia dos seus dados ou selecione um backup para
                    restaurar. Você poderá conferir antes de confirmar.
                  </p>
                  <a className="button" href="/api/backup">
                    <Download size={16} />
                    Baixar backup
                  </a>
                  <FilePicker
                    label="Selecionar backup"
                    disabled={busy}
                    accept=".json"
                    filename={backupFilename}
                    hint="Arquivo de backup do Prumo (.json)"
                    onSelect={(file) => {
                      setBackupFilename(file?.name || "");
                      setRestore(null);
                      if (file)
                        void run(async () => {
                          let backup;
                          try {
                            backup = JSON.parse(await file.text());
                          } catch {
                            throw Error(
                              "Este arquivo não é um backup JSON válido. Selecione um backup exportado pelo Prumo.",
                            );
                          }
                          const r = await api("/api/backup", { backup });
                          setRestore(backup);
                          setNotice(
                            `Backup validado: ${r.count} registros. Confira antes de restaurar.`,
                          );
                        });
                    }}
                  />

                  {restore && (
                    <button
                      className="danger"
                      onClick={() =>
                        setConfirm({
                          title: "Substituir os dados financeiros?",
                          body: "Todos os registros atuais serão substituídos pelo backup validado. O administrador será preservado.",
                          action: async () => {
                            await api("/api/backup", {
                              backup: restore,
                              confirm: "RESTAURAR",
                            });
                            setRestore(null);
                            await refresh();
                          },
                        })
                      }
                    >
                      Confirmar restauração
                    </button>
                  )}
                </section>
                <section className="panel settings-panel spreadsheet-panel">
                  <h2>Importar planilha</h2>
                  <p>
                    Preparação → revisão → confirmação. Nenhum lançamento entra
                    antes da sua revisão.
                  </p>
                  <a
                    className="button"
                    href="/modelo-importacao-prumo.xlsx"
                    download
                  >
                    <Download size={16} /> Baixar modelo de planilha
                  </a>
                  <p className="template-hint">
                    Baixe o modelo, preencha a aba Lançamentos e selecione o
                    arquivo abaixo. As instruções estão na própria planilha.
                  </p>
                  <FilePicker
                    label="Selecionar planilha"
                    disabled={busy}
                    accept=".xlsx"
                    filename={importFile?.name}
                    hint="Planilha Excel (.xlsx) · até 10 MB"
                    onSelect={(file) => {
                      setImportFile(file);
                      setPreview(null);
                    }}
                  />
                  <button
                    className="primary"
                    disabled={!importFile || busy}
                    onClick={() =>
                      void run(async () => {
                        const f = new FormData();
                        f.set("file", importFile!);
                        setPreview(await api("/api/import", f));
                      }, "Prévia pronta para revisão.")
                    }
                  >
                    <FileUp size={16} />
                    Preparar importação
                  </button>
                </section>
              </div>
              {preview && (
                <section className="panel import-review">
                  <div className="panel-heading">
                    <div>
                      <h2>Revisão · {preview.filename}</h2>
                      <p>
                        {preview.candidates.length} candidatos · abas:{" "}
                        {preview.sheets.join(", ")}
                      </p>
                    </div>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          title: "Confirmar os registros selecionados?",
                          body: "A origem será preservada. Itens não conciliados continuarão a conferir. O mesmo arquivo não poderá duplicar este lote.",
                          action: async () => {
                            const f = new FormData();
                            f.set("file", importFile!);
                            f.set("action", "confirm");
                            f.set("edits", JSON.stringify(preview.candidates));
                            await api("/api/import", f);
                            setPreview(null);
                            await refresh();
                          },
                        })
                      }
                    >
                      Confirmar importação
                    </button>
                  </div>
                  <ul className="import-warnings">
                    {preview.warnings.map((w: string) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Mês</th>
                          <th>Bruto identificado</th>
                          <th>Bruto da planilha</th>
                          <th>Diferença</th>
                          <th>Despesas identificadas</th>
                          <th>Despesas da planilha</th>
                          <th>Diferença</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.reconciliation?.map((r: Rec) => (
                          <tr key={r.month}>
                            <td>{r.month}</td>
                            <td>{money(r.gross)}</td>
                            <td>
                              {r.referenceGross === null
                                ? "Sem resumo"
                                : money(r.referenceGross)}
                            </td>
                            <td>
                              {r.grossDifference === null
                                ? "—"
                                : money(r.grossDifference)}
                            </td>
                            <td>{money(r.expenses)}</td>
                            <td>
                              {r.referenceExpenses === null
                                ? "Sem resumo"
                                : money(r.referenceExpenses)}
                            </td>
                            <td>
                              {r.expenseDifference === null
                                ? "—"
                                : money(r.expenseDifference)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-scroll import-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Importar</th>
                          <th>Origem</th>
                          <th>Descrição</th>
                          <th>Valor</th>
                          <th>Conferido</th>
                          <th>Dados originais</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.candidates.map((c: Rec, i: number) => {
                          const edit = (k: string, v: any) =>
                            setPreview({
                              ...preview,
                              candidates: preview.candidates.map(
                                (r: Rec, j: number) =>
                                  i === j ? { ...r, [k]: v } : r,
                              ),
                            });
                          return (
                            <tr key={c.key}>
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={"Selecionar " + c.description}
                                  checked={c.selected}
                                  onChange={(e) =>
                                    edit("selected", e.target.checked)
                                  }
                                />
                              </td>
                              <td>
                                {c.sheet} · linha {c.row}
                                <small>
                                  {
                                    (
                                      {
                                        income: "Receita",
                                        expense: "Despesa",
                                        service: "Serviço",
                                        legacy: "Controle antigo",
                                      } as Rec
                                    )[c.kind]
                                  }
                                </small>
                              </td>
                              <td>
                                <input
                                  aria-label="Descrição importada"
                                  value={c.description}
                                  onChange={(e) =>
                                    edit("description", e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  aria-label="Valor importado em reais"
                                  placeholder="Sem valor"
                                  defaultValue={dec(c.amount)}
                                  onBlur={(e) => {
                                    try {
                                      edit(
                                        "amount",
                                        e.target.value === ""
                                          ? null
                                          : parseMoney(e.target.value),
                                      );
                                    } catch (err) {
                                      setError((err as Error).message);
                                    }
                                  }}
                                />
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={
                                    "Confirmar interpretação de " +
                                    c.description
                                  }
                                  checked={!!c.resolved}
                                  onChange={(e) =>
                                    edit("resolved", e.target.checked)
                                  }
                                />
                              </td>
                              <td>
                                <details>
                                  <summary>Ver origem</summary>
                                  <pre>
                                    {JSON.stringify(c.original, null, 2)}
                                  </pre>
                                  <p>{c.notes}</p>
                                </details>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <details className="pad">
                    <summary>
                      Resumos originais para conciliação · TOTAL, Contas a pagar
                      e Como usar
                    </summary>
                    <p>
                      Os resumos não geram lançamentos. Valores sem data e itens
                      a conferir ficam fora dos totais confirmados.
                    </p>
                    <pre>{JSON.stringify(preview.reference, null, 2)}</pre>
                  </details>
                </section>
              )}
              <section className="panel settings-history">
                <div className="panel-heading">
                  <h2>Histórico de alterações</h2>
                  <span className="muted">Últimos 100 eventos</span>
                </div>
                <div className="audit-list">
                  {audit.length === 0 && (
                    <p className="audit-empty">
                      As alterações importantes aparecerão aqui quando você
                      começar a usar o financeiro.
                    </p>
                  )}
                  {audit.map((a) => (
                    <details key={a.id}>
                      <summary>
                        {new Date(a.createdAt).toLocaleString("pt-BR")} ·{" "}
                        {(
                          {
                            create: "Criação",
                            edit: "Edição",
                            payment: "Baixa",
                            "edit-payment": "Correção de baixa",
                            reverse: "Estorno",
                            cancel: "Cancelamento",
                            import: "Importação",
                            "ai-import": "Inclusão pelo Assistente IA",
                            restore: "Restauração",
                            generate: "Geração mensal",
                            archive: "Remoção da lista",
                          } as Rec
                        )[a.action] || a.action}
                      </summary>
                      <pre>
                        {JSON.stringify(
                          {
                            registro: a.entityId,
                            anterior: a.before ? JSON.parse(a.before) : null,
                            novo: a.after ? JSON.parse(a.after) : null,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          )}
          <footer>
            Prumo · Finanças em equilíbrio
            <span>
              Valores em reais ·{" "}
              {cloudStorage
                ? "Dados salvos no Supabase"
                : "Dados persistidos localmente"}
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        className="editor-dialog"
        data-kind={payment ? "payment" : editor?.kind}
        data-agenda-action={agendaAction}
        aria-labelledby="editor-title"
        aria-describedby="editor-description"
        onCancel={(e) => {
          e.preventDefault();
          closeEditor();
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2 id="editor-title">
              {payment
                ? form.paymentId
                  ? "Editar baixa"
                  : payment.type === "income"
                    ? "Registrar recebimento"
                    : "Registrar pagamento"
                : editor?.id
                  ? agendaEditor && editor.settleService
                    ? "Dar baixa"
                    : editor.serviceAction === "Concluído"
                      ? "Confirmar serviço"
                      : editor.serviceAction === "Cancelado"
                        ? "Cancelar serviço"
                        : agendaEditor
                          ? "Editar serviço"
                          : "Editar registro"
                  : (
                      {
                        entry: form.fuel
                          ? "Novo abastecimento"
                          : form.category === "Manutenção de veículos"
                            ? "Nova manutenção"
                            : "Novo lançamento",
                        service: "Novo serviço",
                        client: "Novo cliente",
                        vehicle: "Novo veículo",
                        recurrence: "Nova despesa fixa",
                        employee: "Novo colaborador",
                        category: "Nova categoria",
                        payroll: "Pagamento de colaborador",
                        settings: "Configurações",
                      } as Rec
                    )[editor?.kind]}
            </h2>
            <p id="editor-description">
              {payment
                ? payment.description
                : agendaEditor
                  ? editor?.settleService
                    ? "Informe a data e a forma do recebimento."
                    : null
                  : (
                      {
                        entry: "Organize o valor e o mês deste lançamento.",
                        service:
                          "Vincule o cliente e descreva os itens do serviço.",
                        client:
                          "Os dados essenciais para identificar seu cliente.",
                        vehicle:
                          "Identifique o veículo para acompanhar seus custos.",
                        recurrence: "Defina a conta que se repete a cada mês.",
                        settings: "Ajuste as informações do seu financeiro.",
                        payroll:
                          "Informe os valores do mês para este colaborador.",
                        employee: "Cadastre quem recebe pagamentos.",
                        category:
                          "Crie uma categoria para organizar seus lançamentos.",
                      } as Rec
                    )[editor?.kind]}
            </p>
          </div>
          <button
            className="icon-button"
            onClick={closeEditor}
            aria-label="Fechar formulário"
          >
            <X />
          </button>
        </div>
        {error && (
          <div role="alert" className="error pad">
            {error}
          </div>
        )}
        {payment ? (
          <form
            className="editor-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api("/api/data", {
                  action: form.paymentId ? "edit-payment" : "payment",
                  id: payment.id,
                  paymentId: form.paymentId,
                  amount: parseMoney(form.amount),
                  date: form.date || null,
                  method: form.method,
                });
                setPayment(null);
                await refresh();
              });
            }}
          >
            <div className="form-content">
              <p className="muted">
                Devido: {money(payment.amount! - payment.discount)} · Em aberto:{" "}
                {money(balance(payment)!)}
              </p>
              <Field label="Valor da baixa (R$)">
                <input
                  autoFocus
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  required
                  inputMode="decimal"
                />
              </Field>
              <Field label="Data efetiva">
                <input
                  type="date"
                  required={
                    !form.paymentId ||
                    !!payment.payments.find((p) => p.id === form.paymentId)
                      ?.date
                  }
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </Field>
              <Field label="Forma de pagamento">
                <input
                  required={!form.paymentId}
                  value={form.method}
                  onChange={(e) => set("method", e.target.value)}
                />
              </Field>
            </div>
            <div className="dialog-footer">
              <button type="button" onClick={closeEditor}>
                Cancelar
              </button>
              <button className="primary" type="submit" disabled={busy}>
                {busy
                  ? "Salvando…"
                  : form.paymentId
                    ? "Salvar baixa"
                    : payment.type === "income"
                      ? "Confirmar recebimento"
                      : "Confirmar pagamento"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submit} className="editor-form">
            <div className="form-content">
              {editor?.kind === "client" && (
                <ClientFields client={form} onChange={set} autoFocus />
              )}
              {editor &&
                ["vehicle", "employee", "category"].includes(editor.kind) && (
                  <>
                    <Field label="Nome / identificação">
                      <input
                        autoFocus
                        required
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                      />
                    </Field>
                    {editor.kind === "vehicle" && (
                      <div className="form-grid">
                        <Field label="Modelo (opcional)">
                          <input
                            value={form.model}
                            onChange={(e) => set("model", e.target.value)}
                          />
                        </Field>
                        <Field label="Placa (opcional)">
                          <input
                            value={form.plate}
                            onChange={(e) => set("plate", e.target.value)}
                          />
                        </Field>
                      </div>
                    )}
                  </>
                )}
              {editor &&
                !agendaEditor &&
                ["entry", "recurrence", "service"].includes(editor.kind) && (
                  <>
                    <Field label="Descrição">
                      <input
                        autoFocus
                        required
                        value={form.description}
                        disabled={editor.kind === "entry" && !!form.serviceId}
                        onChange={(e) => set("description", e.target.value)}
                      />
                    </Field>
                    {editor.kind !== "service" && (
                      <div
                        className={
                          editor.kind === "entry"
                            ? "form-grid entry-value-grid"
                            : "form-grid"
                        }
                      >
                        {" "}
                        {editor.kind === "entry" && (
                          <Field label="Tipo">
                            <select
                              value={form.type}
                              disabled={!!form.serviceId}
                              onChange={(e) => set("type", e.target.value)}
                            >
                              <option value="income">Entrada</option>
                              <option value="expense">Saída</option>
                            </select>
                          </Field>
                        )}
                        <Field label="Categoria">
                          <select
                            value={form.category}
                            onChange={(e) => set("category", e.target.value)}
                          >
                            {cats.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label={
                            editor.kind === "recurrence"
                              ? "Valor mensal (R$)"
                              : "Valor (R$)"
                          }
                        >
                          <input
                            inputMode="decimal"
                            value={form.amount}
                            disabled={
                              editor.kind === "entry" && !!form.serviceId
                            }
                            onChange={(e) => set("amount", e.target.value)}
                            required={editor.kind === "recurrence"}
                          />
                        </Field>
                      </div>
                    )}
                  </>
                )}
              {editor?.kind === "entry" && (
                <>
                  <div className="form-grid">
                    {["Combustível", "Manutenção de veículos"].includes(
                      form.category,
                    ) ? (
                      <Field label="Data do gasto">
                        <input
                          type="date"
                          required
                          value={form.competence}
                          onChange={(e) => set("competence", e.target.value)}
                        />
                      </Field>
                    ) : (
                      <Field label="Mês de referência">
                        <input
                          type="month"
                          required
                          value={form.competence?.slice(0, 7) || ""}
                          disabled={!!form.serviceId}
                          onChange={(e) =>
                            set(
                              "competence",
                              e.target.value ? e.target.value + "-01" : "",
                            )
                          }
                        />
                      </Field>
                    )}
                    <Field label="Vencimento (opcional)">
                      <input
                        type="date"
                        value={form.due || ""}
                        onChange={(e) => set("due", e.target.value)}
                      />
                    </Field>
                  </div>
                  {/^0+(?:,0{1,2})?$/.test(
                    String(form.amount).replaceAll(".", ""),
                  ) && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={form.confirmedZero}
                        onChange={(e) => set("confirmedZero", e.target.checked)}
                      />
                      Confirmo valor zero (gratuito / garantia)
                    </label>
                  )}
                  <p className="field-hint">
                    Deixe o valor em branco se ainda não estiver definido. O
                    recebimento ou pagamento pode ser registrado depois.
                  </p>
                  {["Combustível", "Manutenção de veículos"].includes(
                    form.category,
                  ) && (
                    <Field label="Veículo">
                      <select
                        value={form.vehicleId}
                        onChange={(e) => set("vehicleId", e.target.value)}
                      >
                        <option value="">A vincular</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <details className="form-details">
                    <summary>
                      Informações adicionais{form.review ? " · a conferir" : ""}
                    </summary>{" "}
                    <Field label="Cliente / fornecedor (opcional)">
                      <input
                        value={form.party}
                        onChange={(e) => set("party", e.target.value)}
                      />
                    </Field>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={form.review}
                        onChange={(e) => set("review", e.target.checked)}
                      />
                      Informações precisam de conferência
                    </label>
                    <Field label="Desconto explícito (R$)">
                      <input
                        value={form.discount}
                        disabled={!!form.serviceId}
                        onChange={(e) => set("discount", e.target.value)}
                      />
                    </Field>
                    {!["Combustível", "Manutenção de veículos"].includes(
                      form.category,
                    ) && (
                      <Field label="Veículo (opcional)">
                        <select
                          value={form.vehicleId}
                          onChange={(e) => set("vehicleId", e.target.value)}
                        >
                          <option value="">A vincular / não se aplica</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Forma prevista de pagamento">
                      <input
                        value={form.method}
                        onChange={(e) => set("method", e.target.value)}
                      />
                    </Field>
                    {form.category === "Combustível" && (
                      <div className="form-grid">
                        {[
                          ["fuelType", "Combustível"],
                          ["liters", "Litros (opcional)"],
                          ["odometer", "Quilometragem (opcional)"],
                          ["station", "Posto (opcional)"],
                        ].map(([k, l]) => (
                          <Field label={l} key={k}>
                            <input
                              value={form.fuel?.[k] || ""}
                              onChange={(e) =>
                                set("fuel", {
                                  liters: "",
                                  odometer: "",
                                  station: "",
                                  fuelType: "",
                                  ...form.fuel,
                                  [k]: e.target.value,
                                })
                              }
                            />
                          </Field>
                        ))}
                      </div>
                    )}
                    <Field label="Observações">
                      <textarea
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                      />
                    </Field>
                  </details>
                  {form.serviceId && (
                    <p className="muted">
                      Valor e descrição pertencem ao serviço.{" "}
                      <button
                        type="button"
                        onClick={() =>
                          open(
                            "service",
                            records.find((r) => r.id === form.serviceId),
                          )
                        }
                      >
                        Editar serviço de origem
                      </button>
                    </p>
                  )}
                  {form.payments?.length > 0 && (
                    <div className="payments">
                      <h3>Histórico de baixas</h3>
                      {form.payments.map((p: any) => (
                        <div key={p.id}>
                          <span>
                            {money(p.amount)} · {br(p.date)} · {p.method}
                            {p.voided ? " · Estornada" : ""}
                          </span>
                          {!p.voided && !form.cancelled && (
                            <button
                              type="button"
                              onClick={() => {
                                const entry = entries.find(
                                  (e) => e.id === editor.id,
                                );
                                if (entry) editPayment(entry, p);
                              }}
                            >
                              Editar baixa
                            </button>
                          )}
                          {!p.voided && !form.cancelled && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirm({
                                  title: "Estornar esta baixa?",
                                  body: "O valor voltará ao saldo em aberto. O histórico será preservado.",
                                  action: async () => {
                                    await api("/api/data", {
                                      action: "reverse",
                                      id: editor.id,
                                      paymentId: p.id,
                                    });
                                    setEditor(null);
                                    await refresh();
                                  },
                                })
                              }
                            >
                              Estornar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {form.source && (
                    <details>
                      <summary>Rastreabilidade da importação</summary>
                      <pre>
                        {JSON.stringify(JSON.parse(form.source), null, 2)}
                      </pre>
                    </details>
                  )}
                </>
              )}
              {editor?.kind === "service" && (
                <datalist id="receipt-methods">
                  {paymentMethods.map((method) => (
                    <option value={method} key={method} />
                  ))}
                </datalist>
              )}
              {agendaAction && editor && (
                <>
                  <div className="agenda-action-summary">
                    <strong>{form.description}</strong>
                    <span>
                      {[
                        agendaClient?.name || editingServiceEntry?.party,
                        br(form.date),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  {agendaAction === "settle" && (
                    <>
                      {editor.agendaBalance === null ? (
                        <Field label="Valor (R$)">
                          <input
                            inputMode="decimal"
                            required
                            value={form.items[0].amount ?? ""}
                            onChange={(event) =>
                              set("items", [
                                {
                                  ...form.items[0],
                                  amount: event.target.value,
                                },
                              ])
                            }
                          />
                        </Field>
                      ) : (
                        <p className="field-hint">
                          Saldo a receber · {money(editor.agendaBalance)}
                        </p>
                      )}
                      <ReceiptFields
                        date={form.receiptDate}
                        method={form.receiptMethod}
                        onChange={set}
                      />
                    </>
                  )}
                </>
              )}
              {editor?.kind === "service" && !agendaAction && (
                <>
                  {agendaEditor && serviceScheduleFields}
                  <div className={agendaEditor ? undefined : "form-grid"}>
                    <Field label="Cliente">
                      <select
                        required
                        value={form.clientChoice || form.clientId}
                        onChange={(e) => {
                          const value = e.target.value;
                          const newClient =
                            value === "new"
                              ? { name: "", creationId: crypto.randomUUID() }
                              : undefined;
                          setForm((f) => ({
                            ...f,
                            clientChoice: value === "new" ? "new" : "",
                            clientId: value === "new" ? "" : value,
                            newClient,
                            clientUpdate: undefined,
                          }));
                        }}
                      >
                        <option value="">Selecione um cliente</option>
                        <option value="new">Cadastrar novo cliente…</option>
                        {clients
                          .filter((c) => !c.archived || c.id === form.clientId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {!agendaEditor && serviceStatusField}
                  </div>
                  {agendaEditor && (form.newClient || agendaClient) && (
                    <div className="form-grid">
                      {(
                        [
                          ["name", "Nome do cliente"],
                          ["cpf", "CPF"],
                        ] as const
                      ).map(([key, label]) => (
                        <Field label={label} key={key}>
                          <input
                            required={key === "name"}
                            readOnly={!!agendaClient?.archived}
                            inputMode={key === "cpf" ? "numeric" : undefined}
                            maxLength={key === "cpf" ? 14 : undefined}
                            value={
                              form.newClient?.[key] ??
                              form.clientUpdate?.[key] ??
                              (key === "cpf"
                                ? formatCpf(agendaClient?.cpf)
                                : agendaClient?.name) ??
                              ""
                            }
                            onChange={(event) => {
                              const value = event.target.value;
                              setForm((f) =>
                                f.newClient
                                  ? {
                                      ...f,
                                      newClient: {
                                        ...f.newClient,
                                        [key]: value,
                                      },
                                    }
                                  : {
                                      ...f,
                                      clientUpdate: {
                                        ...f.clientUpdate,
                                        [key]: value,
                                      },
                                    },
                              );
                            }}
                          />
                        </Field>
                      ))}
                    </div>
                  )}
                  {form.clientChoice === "new" && !agendaEditor && (
                    <ClientFields
                      client={form.newClient}
                      nameLabel="Nome do novo cliente"
                      onChange={(key, value) =>
                        setForm((f) => ({
                          ...f,
                          newClient: { ...f.newClient, [key]: value },
                        }))
                      }
                    />
                  )}
                  {agendaEditor ? (
                    <Field label="Endereço do serviço">
                      <input
                        value={form.address}
                        onChange={(event) => set("address", event.target.value)}
                        placeholder={
                          clientAddress(agendaClient as Client | undefined) ||
                          "Rua, número e bairro"
                        }
                      />
                    </Field>
                  ) : (
                    serviceScheduleFields
                  )}
                  {agendaEditor && (
                    <>
                      <div className="form-grid">
                        <Field label="Tipo de serviço">
                          <select
                            required={!editor.id}
                            value={form.serviceType ?? ""}
                            onChange={(event) => {
                              const serviceType = event.target.value;
                              setForm((f) => ({
                                ...f,
                                description:
                                  f.description === f.serviceType
                                    ? serviceType
                                    : f.description,
                                serviceType,
                                items:
                                  serviceType &&
                                  f.items.length === 1 &&
                                  f.items[0].description === f.serviceType
                                    ? [
                                        {
                                          ...f.items[0],
                                          description: serviceType,
                                        },
                                      ]
                                    : f.items,
                                meters:
                                  serviceType === "Manutenção" ? "" : f.meters,
                              }));
                            }}
                          >
                            <option value="">
                              {editor.id
                                ? "Outro / não informado"
                                : "Selecione"}
                            </option>
                            {serviceTypes.map((type) => (
                              <option key={type}>{type}</option>
                            ))}
                          </select>
                        </Field>
                        {form.serviceType &&
                          form.serviceType !== "Manutenção" && (
                            <Field label="Metragem (m)">
                              <input
                                inputMode="decimal"
                                required
                                maxLength={50}
                                value={form.meters ?? ""}
                                onChange={(event) =>
                                  set("meters", event.target.value)
                                }
                              />
                            </Field>
                          )}
                      </div>
                      <div className="form-grid">
                        {agendaSingleItem && (
                          <Field label="Valor (R$)">
                            <input
                              inputMode="decimal"
                              required={form.paymentAction === "settle"}
                              placeholder="A definir"
                              value={
                                typeof form.items[0].amount === "number"
                                  ? dec(form.items[0].amount)
                                  : (form.items[0].amount ?? "")
                              }
                              onChange={(event) =>
                                set("items", [
                                  {
                                    ...form.items[0],
                                    amount: event.target.value,
                                  },
                                ])
                              }
                            />
                          </Field>
                        )}
                        {serviceStatusField}
                      </div>
                    </>
                  )}
                  {!agendaEditor && (
                    <div className="form-grid">
                      <Field label="Endereço do serviço (opcional)">
                        <input
                          value={form.address}
                          onChange={(e) => set("address", e.target.value)}
                          placeholder="Usa o endereço do cliente se vazio"
                        />
                      </Field>
                      <Field label="Forma prevista de pagamento">
                        <input
                          list="receipt-methods"
                          value={form.method}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              method: e.target.value,
                              receiptMethod: e.target.value || "Pix",
                            }))
                          }
                        />
                      </Field>
                    </div>
                  )}
                  {(form.status !== "Cancelado" ||
                    (editingServiceEntry && paid(editingServiceEntry) > 0)) && (
                    <fieldset className="service-receipt">
                      <legend>Pagamento do serviço</legend>
                      {editingServiceEntry && (
                        <p className="field-hint">
                          Situação atual:{" "}
                          {status(editingServiceEntry) === "Quitado"
                            ? "Pago"
                            : status(editingServiceEntry) === "Em aberto"
                              ? "Não pago"
                              : status(editingServiceEntry)}
                          . Recebido: {money(paid(editingServiceEntry))}.
                        </p>
                      )}
                      <Field label="Situação do pagamento">
                        <select
                          value={form.paymentAction}
                          onChange={(e) => set("paymentAction", e.target.value)}
                        >
                          <option value="keep">
                            {editingServiceEntry
                              ? "Manter recebimentos atuais"
                              : "Não pago"}
                          </option>
                          {form.status !== "Cancelado" && (
                            <option value="settle">
                              Pago — dar baixa ao salvar
                            </option>
                          )}
                          {editingServiceEntry &&
                            paid(editingServiceEntry) > 0 && (
                              <option value="unpaid">
                                Não pago — estornar recebimentos
                              </option>
                            )}
                        </select>
                      </Field>
                      {form.paymentAction === "settle" && (
                        <ReceiptFields
                          date={form.receiptDate}
                          method={form.receiptMethod}
                          onChange={set}
                        />
                      )}
                      {editingServiceEntry &&
                        editingServiceEntry.payments.length > 0 && (
                          <details className="service-receipt-history">
                            <summary>Histórico de recebimentos</summary>
                            <ul>
                              {editingServiceEntry.payments.map((p) => (
                                <li key={p.id}>
                                  {money(p.amount)} ·{" "}
                                  {p.method || "Forma não informada"} ·{" "}
                                  {br(p.date)}
                                  {p.voided ? " · Estornado" : ""}
                                  {!p.voided &&
                                    !editingServiceEntry.cancelled && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          editPayment(editingServiceEntry, p)
                                        }
                                      >
                                        Editar baixa
                                      </button>
                                    )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                    </fieldset>
                  )}
                  {agendaEditor && (
                    <Field label="Observação">
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={form.notes}
                        onChange={(event) => set("notes", event.target.value)}
                      />
                    </Field>
                  )}
                  {(!agendaEditor || editor.id) && (
                    <ServiceItemGroup
                      className={agendaEditor ? "form-details" : undefined}
                      open={
                        agendaEditor && !agendaSingleItem ? true : undefined
                      }
                    >
                      {agendaEditor ? (
                        <summary>Itens do serviço</summary>
                      ) : (
                        <h3>Itens do serviço</h3>
                      )}
                      <p className="muted">
                        Informe o total de cada item. Se o preço ainda não
                        estiver definido, deixe o valor em branco.
                      </p>
                      {form.items.map((item: any, i: number) => (
                        <div className="service-item" key={i}>
                          {[
                            ["description", "Descrição"],
                            ["quantity", "Quantidade"],
                            ["unit", "Unidade"],
                            ["amount", "Total do item (R$)"],
                          ]
                            .filter(
                              ([key]) => !agendaSingleItem || key !== "amount",
                            )
                            .map(([k, l]) => (
                              <Field key={k} label={l}>
                                <input
                                  required={
                                    k === "description" ||
                                    (k === "amount" &&
                                      form.paymentAction === "settle")
                                  }
                                  value={
                                    k === "amount" &&
                                    typeof item[k] === "number"
                                      ? dec(item[k])
                                      : (item[k] ?? "")
                                  }
                                  placeholder={
                                    k === "amount" ? "Sem preço" : ""
                                  }
                                  onChange={(e) =>
                                    set(
                                      "items",
                                      form.items.map((r: any, j: number) =>
                                        i === j
                                          ? { ...r, [k]: e.target.value }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                            ))}
                          <button
                            type="button"
                            disabled={form.items.length === 1}
                            onClick={() =>
                              set(
                                "items",
                                form.items.filter(
                                  (_: any, j: number) => i !== j,
                                ),
                              )
                            }
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          set("items", [
                            ...form.items,
                            {
                              description: "",
                              quantity: "",
                              unit: "",
                              amount: null,
                            },
                          ])
                        }
                      >
                        <Plus size={15} />
                        Adicionar item
                      </button>
                    </ServiceItemGroup>
                  )}
                  {agendaEditor && (
                    <details className="form-details">
                      <summary>Mais detalhes do serviço</summary>
                      <Field label="Descrição">
                        <input
                          value={form.description}
                          placeholder={
                            form.serviceType || "Descrição do serviço"
                          }
                          onChange={(event) =>
                            set("description", event.target.value)
                          }
                        />
                      </Field>
                    </details>
                  )}
                  <details className="form-details">
                    <summary>
                      {agendaEditor
                        ? "Pagamento previsto e desconto"
                        : "Desconto e observações"}
                    </summary>
                    {agendaEditor && (
                      <Field label="Forma prevista de pagamento">
                        <input
                          list="receipt-methods"
                          value={form.method}
                          onChange={(event) => {
                            const method = event.target.value;
                            setForm((current) => ({
                              ...current,
                              method,
                              receiptMethod:
                                current.receiptMethod === current.method
                                  ? method
                                  : current.receiptMethod,
                            }));
                          }}
                        />
                      </Field>
                    )}
                    <Field label="Desconto explícito (R$)">
                      <input
                        value={form.discount}
                        onChange={(e) => set("discount", e.target.value)}
                      />
                    </Field>
                    {!agendaEditor && (
                      <Field label="Observações">
                        <textarea
                          value={form.notes}
                          onChange={(e) => set("notes", e.target.value)}
                        />
                      </Field>
                    )}
                  </details>
                  {agendaEditor && form.clientChoice === "new" && (
                    <details className="form-details">
                      <summary>Mais dados do cliente</summary>
                      <ClientFields
                        client={form.newClient}
                        extraOnly
                        onChange={(key, value) =>
                          setForm((f) => ({
                            ...f,
                            newClient: { ...f.newClient, [key]: value },
                          }))
                        }
                      />
                    </details>
                  )}
                </>
              )}
              {editor?.kind === "recurrence" && (
                <>
                  <div className="form-grid">
                    <Field label="Dia de vencimento">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        required
                        value={form.day}
                        onChange={(e) => set("day", e.target.value)}
                      />
                    </Field>
                    <Field label="Início">
                      <input
                        type="date"
                        required
                        value={form.start}
                        onChange={(e) => set("start", e.target.value)}
                      />
                    </Field>
                    <Field label="Término (opcional)">
                      <input
                        type="date"
                        value={form.end || ""}
                        onChange={(e) => set("end", e.target.value)}
                      />
                    </Field>
                  </div>
                  <p className="muted">
                    Se o dia não existir, o vencimento será o último dia do mês.
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => set("active", e.target.checked)}
                    />
                    Recorrência ativa
                  </label>
                  {editor.id && (
                    <Field label="Aplicar alterações">
                      <select
                        value={form.scope}
                        onChange={(e) => set("scope", e.target.value)}
                      >
                        <option value="one">
                          Modelo para próximas gerações
                        </option>
                        <option value="future">
                          Modelo e contas não liquidadas desde o início
                          informado
                        </option>
                      </select>
                    </Field>
                  )}
                  <p className="muted">
                    Para alterar só uma ocorrência, edite a conta em
                    Lançamentos.
                  </p>
                </>
              )}
              {editor?.kind === "payroll" && (
                <>
                  <Field label="Colaborador">
                    <select
                      required
                      value={form.employeeId}
                      onChange={(e) => set("employeeId", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Mês de referência">
                    <input
                      type="month"
                      required
                      value={form.competence?.slice(0, 7) || ""}
                      onChange={(e) =>
                        set(
                          "competence",
                          e.target.value ? e.target.value + "-01" : "",
                        )
                      }
                    />
                  </Field>
                  {[
                    ["base", "Valor-base (R$)"],
                    ["extras", "Extras (R$)"],
                    ["discount", "Descontos (R$)"],
                  ].map(([k, l]) => (
                    <Field key={k} label={l}>
                      <input
                        required
                        value={form[k]}
                        onChange={(e) => set(k, e.target.value)}
                      />
                    </Field>
                  ))}
                  <p className="muted">
                    Será criado um compromisso. Registre a baixa quando o
                    pagamento acontecer.
                  </p>
                </>
              )}
              {editor?.kind === "settings" && (
                <>
                  <Field label="Nome da organização · opcional">
                    <input
                      placeholder="Digite o nome da organização"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </Field>
                  <Field label="Saldo inicial (R$) · opcional">
                    <input
                      value={form.initialBalance}
                      onChange={(e) => set("initialBalance", e.target.value)}
                    />
                  </Field>
                  <Field label="Data do saldo inicial">
                    <input
                      type="date"
                      required={form.initialBalance !== ""}
                      value={form.initialDate}
                      onChange={(e) => set("initialDate", e.target.value)}
                    />
                  </Field>
                  <Field label="Meta anual de vendas brutas (R$)">
                    <input
                      value={form.goal}
                      onChange={(e) => set("goal", e.target.value)}
                    />
                  </Field>
                </>
              )}
            </div>
            <div className="dialog-footer">
              {editor?.id &&
                !agendaAction &&
                ["client", "service"].includes(editor.kind) && (
                  <button
                    className="danger"
                    type="button"
                    onClick={() => requestArchive(editor.kind, editor.id)}
                  >
                    Remover {editor.kind === "client" ? "cliente" : "serviço"}
                  </button>
                )}
              {editor?.id &&
                ["vehicle", "employee", "category", "recurrence"].includes(
                  editor.kind,
                ) && (
                  <button
                    className="danger"
                    type="button"
                    onClick={() =>
                      setConfirm({
                        title: "Excluir cadastro sem vínculos?",
                        body: "A exclusão será registrada no histórico. Cadastros vinculados a movimentações serão preservados.",
                        action: async () => {
                          await api("/api/data", {
                            action: "delete",
                            id: editor.id,
                          });
                          setEditor(null);
                          await refresh();
                        },
                      })
                    }
                  >
                    Excluir cadastro
                  </button>
                )}
              {editor?.kind === "entry" &&
                editor.id &&
                !form.cancelled &&
                (!form.serviceId ||
                  services.find((s) => s.id === form.serviceId)?.archived) && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      setConfirm({
                        title: "Cancelar lançamento?",
                        body: "A origem e o histórico serão mantidos. O lançamento e suas baixas deixarão de compor os totais.",
                        action: async () => {
                          await api("/api/data", {
                            action: "cancel",
                            id: editor.id,
                          });
                          setEditor(null);
                          await refresh();
                        },
                      })
                    }
                  >
                    Cancelar lançamento
                  </button>
                )}
              <button type="button" onClick={closeEditor}>
                Cancelar
              </button>
              <button className="primary" type="submit" disabled={busy}>
                {busy
                  ? "Salvando…"
                  : agendaEditor && form.paymentAction === "settle"
                    ? "Confirmar baixa"
                    : editor?.id
                      ? editor.serviceAction === "Concluído" &&
                        form.status === "Concluído"
                        ? "Confirmar execução"
                        : editor.serviceAction === "Cancelado" &&
                            form.status === "Cancelado"
                          ? "Salvar cancelamento"
                          : "Salvar alterações"
                      : (
                          {
                            entry: "Salvar lançamento",
                            client: "Salvar cliente",
                            service: "Salvar serviço",
                            vehicle: "Salvar veículo",
                            recurrence: "Salvar despesa fixa",
                            employee: "Salvar colaborador",
                            category: "Salvar categoria",
                            payroll: "Salvar compromisso",
                            settings: "Salvar configurações",
                          } as Rec
                        )[editor?.kind] || "Salvar"}
              </button>
            </div>
          </form>
        )}
      </dialog>
      <dialog
        className="confirmation-dialog"
        ref={confirmation}
        aria-labelledby="confirmation-title"
        onCancel={() => setConfirm(null)}
      >
        <div className="dialog-heading">
          <h2 id="confirmation-title">{confirm?.title}</h2>
        </div>
        <p className="pad">{confirm?.body}</p>
        {error && (
          <p role="alert" className="error pad">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <button onClick={() => setConfirm(null)}>Voltar</button>
          <button
            className="danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await confirm?.action();
                setConfirm(null);
              })
            }
          >
            {busy ? "Confirmando…" : "Confirmar"}
          </button>
        </div>
      </dialog>
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        commands={[
          ...nav.map(([id, label, Icon]) => ({
            id,
            label,
            description: "Abrir " + label.toLocaleLowerCase("pt-BR"),
            Icon,
            action: () => go(id),
          })),
          {
            id: "new-entry",
            label: "Novo lançamento",
            description: "Registrar uma entrada ou saída",
            Icon: Plus,
            action: () => open("entry"),
          },
          {
            id: "new-fuel",
            label: "Registrar abastecimento",
            description: "Adicionar um gasto de combustível",
            Icon: Fuel,
            action: () =>
              open("entry", undefined, {
                category: "Combustível",
                fuel: { liters: "", odometer: "", station: "", fuelType: "" },
              }),
          },
        ]}
      />
    </div>
  );
}
