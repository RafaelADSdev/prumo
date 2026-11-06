"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LineChart,
} from "recharts";
import {
  balance,
  inPeriod,
  money,
  paid,
  status,
  type Entry,
} from "@/lib/finance";
import {
  groupRows,
  periodLabel,
  previousPeriod,
  reportQuality,
  reportRows,
  reportTimeline,
  summarizeRows,
  type ReportBasis,
  type ReportGroup,
  type ReportRow,
} from "@/lib/reports";

const percent = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value) +
  "%";
const dateLabel = (value: string) => value.split("-").reverse().join("/");
const axisMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value / 100);
const tooltipStyle = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--prumo-ink)",
};
const palette = {
  income: "var(--chart-income, #34765a)",
  expense: "var(--chart-outgoing, #b0795d)",
  net: "var(--prumo-ink)",
};

function Comparison({
  value,
  previous,
  label,
}: {
  value: number;
  previous: number;
  label: string;
}) {
  const diff = value - previous;
  return (
    <small className="report-comparison">
      {diff === 0
        ? "Sem variação"
        : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
      {previous > 0 && diff !== 0
        ? ` (${diff > 0 ? "+" : "−"}${percent((Math.abs(diff) / previous) * 100)})`
        : ""}
      <span>
        Em {label}: {money(previous)}
      </span>
    </small>
  );
}

function Breakdown({
  title,
  subtitle,
  groups,
  total,
  type,
  onSelect,
}: {
  title: string;
  subtitle: string;
  groups: ReportGroup[];
  total: number;
  type: "income" | "expense";
  onSelect?: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className={`panel report-breakdown report-${type}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <strong>{money(total)}</strong>
      </div>
      {groups.length ? (
        <>
          <ol className="report-ranking">
            {(expanded ? groups : groups.slice(0, 6)).map((group) => (
              <li key={group.name}>
                {onSelect ? (
                  <button
                    className="report-ranking-row"
                    onClick={() => onSelect(group.name)}
                  >
                    <span>{group.name}</span>
                    <strong>{money(group.amount)}</strong>
                    <small>
                      {total ? percent((group.amount / total) * 100) : "0%"}
                    </small>
                  </button>
                ) : (
                  <div className="report-ranking-row">
                    <span>{group.name}</span>
                    <strong>{money(group.amount)}</strong>
                    <small>
                      {total ? percent((group.amount / total) * 100) : "0%"}
                    </small>
                  </div>
                )}
                <div className="report-track" aria-hidden="true">
                  <i
                    style={{
                      width: `${total ? (group.amount / total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
          {groups.length > 6 && (
            <button
              className="text-button report-expand"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Mostrar principais" : `Ver todos (${groups.length})`}
            </button>
          )}
        </>
      ) : (
        <p className="report-empty">Nenhum valor confirmado neste período.</p>
      )}
    </section>
  );
}

function exportCsv(
  rows: ReportRow[],
  year: string,
  month: string,
  basis: ReportBasis,
) {
  const headers = [
    "Data de referência",
    "Descrição",
    "Tipo",
    "Categoria",
    "Cliente / favorecido",
    "Origem",
    "Forma",
    "Competência",
    "Valor em reais",
    "Situação do lançamento",
  ];
  const cell = (value: string) =>
    `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const content = [
    headers,
    ...rows.map((r) => [
      dateLabel(r.date),
      r.entry.description,
      r.entry.type === "income" ? "Entrada" : "Saída",
      r.entry.category,
      r.entry.party,
      r.origin,
      r.method,
      dateLabel(r.entry.competence),
      (r.amount / 100).toFixed(2).replace(".", ","),
      status(r.entry),
    ]),
  ]
    .map((r) => r.map(cell).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-${basis}-${year}-${month}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function FinancialReports({
  entries,
  year,
  month,
  basis,
  setBasis,
  onEntry,
  loading,
  settings,
  recordLabels,
}: {
  entries: Entry[];
  year: string;
  month: string;
  basis: ReportBasis;
  setBasis: (basis: ReportBasis) => void;
  onEntry: (entry: Entry) => void;
  loading: boolean;
  settings: { initialBalance: number | null; initialDate: string | null };
  recordLabels: Record<string, string>;
}) {
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pendingType, setPendingType] = useState("income");
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const allRows = useMemo(
    () => reportRows(entries, year, month, basis),
    [entries, year, month, basis],
  );
  const rows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          (!category || r.entry.category === category) &&
          (!type || r.entry.type === type),
      ),
    [allRows, category, type],
  );
  const summary = useMemo(() => summarizeRows(rows), [rows]);
  const previous = previousPeriod(year, month);
  const prev = summarizeRows(
    reportRows(entries, previous.year, previous.month, basis).filter(
      (r) =>
        (!category || r.entry.category === category) &&
        (!type || r.entry.type === type),
    ),
  );
  const timeline = reportTimeline(rows, year, month);
  const quality = reportQuality(entries, year, month);
  const categories = [...new Set(allRows.map((r) => r.entry.category))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  const cohort = entries.filter(
    (e) =>
      !e.cancelled &&
      !e.review &&
      e.amount !== null &&
      inPeriod(e.competence, year, month) &&
      (!category || e.category === category) &&
      (!type || e.type === type),
  );
  const pending = cohort.filter((e) => (balance(e) || 0) > 0);
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
  const receivable = pending
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + balance(e)!, 0);
  const payable = pending
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + balance(e)!, 0);
  const overdue = (entryType: string) =>
    pending
      .filter((e) => e.type === entryType && e.due && e.due < today)
      .reduce((s, e) => s + balance(e)!, 0);
  const pendingRows = pending
    .filter((e) => e.type === pendingType)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const detail = rows.filter((r) =>
    `${r.entry.description} ${r.entry.party} ${r.method} ${r.origin}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const pageCount = Math.max(1, Math.ceil(detail.length / 15));
  const currentPage = Math.min(page, pageCount);
  const selectCategory = (name: string, entryType: string) => {
    setCategory(name);
    setType(entryType);
    setPage(1);
  };
  const activeFilters = !!category || !!type;
  const margin = summary.income ? (summary.net / summary.income) * 100 : null;
  const firstDay = `${year}-${month === "all" ? "01" : month}-01`;
  const lastDay =
    month === "all"
      ? `${year}-12-31`
      : `${year}-${month}-${String(timeline.length).padStart(2, "0")}`;
  // Only offer a book balance when the unfiltered period starts after a dated opening balance.
  const hasOpening =
    settings.initialBalance !== null &&
    !!settings.initialDate &&
    settings.initialDate <= firstDay &&
    !activeFilters;
  const historical = hasOpening
    ? entries
        .filter((e) => !e.cancelled)
        .reduce(
          (sum, e) =>
            sum +
            e.payments
              .filter(
                (p) =>
                  !p.voided &&
                  p.date &&
                  p.date >= settings.initialDate! &&
                  p.date < firstDay,
              )
              .reduce(
                (s, p) => s + (e.type === "income" ? p.amount : -p.amount),
                0,
              ),
          0,
        )
    : 0;
  const opening = hasOpening ? settings.initialBalance! + historical : null;
  const cashMovement = summarizeRows(
    reportRows(entries, year, month, "cash"),
  ).net;
  const resultHeading =
    basis === "cash" ? "Resultado de caixa" : "Resultado por competência";

  return (
    <div className="financial-reports" aria-busy={loading}>
      <div className="report-header">
        <div>
          <h2>Seu dinheiro, de ponta a ponta</h2>
          <p>
            {periodLabel(year, month)} ·{" "}
            {basis === "cash"
              ? "Recebimentos e pagamentos pela data da baixa"
              : "Receitas e despesas pelo mês da operação"}
          </p>
        </div>
        <div className="report-actions">
          <button
            disabled={loading}
            onClick={() => exportCsv(rows, year, month, basis)}
          >
            <Download size={16} />
            Exportar CSV
          </button>
          <button disabled={loading} onClick={() => window.print()}>
            <Printer size={16} />
            Imprimir
          </button>
        </div>
      </div>
      <div className="report-controls">
        <div
          className="segmented"
          role="group"
          aria-label="Regime do relatório"
        >
          <button
            aria-pressed={basis === "cash"}
            className={basis === "cash" ? "selected" : ""}
            onClick={() => setBasis("cash")}
          >
            Caixa
          </button>
          <button
            aria-pressed={basis === "accrual"}
            className={basis === "accrual" ? "selected" : ""}
            onClick={() => setBasis("accrual")}
          >
            Competência
          </button>
        </div>
        <label>
          Movimentação
          <select
            aria-label="Movimentação do relatório"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Entradas e saídas</option>
            <option value="income">Somente entradas</option>
            <option value="expense">Somente saídas</option>
          </select>
        </label>
        <label>
          Categoria
          <select
            aria-label="Categoria do relatório"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as categorias</option>
            {[...new Set([...categories, ...(category ? [category] : [])])].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </label>
        {activeFilters && (
          <button
            className="text-button"
            onClick={() => {
              setCategory("");
              setType("");
              setPage(1);
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>
      <p className="report-explanation">
        {basis === "cash"
          ? "Caixa mostra o dinheiro que efetivamente entrou e saiu, inclusive baixas parciais de operações de outros meses."
          : "Competência mostra os valores líquidos de desconto das operações do período, mesmo que ainda não tenham sido pagos. Não representa saldo disponível."}{" "}
        Os filtros acima se aplicam a todos os totais, gráficos e à exportação.
      </p>

      <div className="report-metrics">
        {[
          {
            label:
              basis === "cash" ? "Dinheiro que entrou" : "Receitas registradas",
            value: summary.income,
            prev: prev.income,
            count: summary.incomeCount,
            Icon: ArrowDownLeft,
            tone: "income",
          },
          {
            label:
              basis === "cash" ? "Dinheiro que saiu" : "Despesas registradas",
            value: summary.expense,
            prev: prev.expense,
            count: summary.expenseCount,
            Icon: ArrowUpRight,
            tone: "expense",
          },
          {
            label: resultHeading,
            value: summary.net,
            prev: prev.net,
            count: null,
            Icon: ArrowLeftRight,
            tone: "net",
          },
        ].map((item) => (
          <section
            className={`panel report-metric report-${item.tone}`}
            key={item.tone}
          >
            <div>
              <h3>{item.label}</h3>
              <item.Icon size={20} />
            </div>
            <strong>{loading ? "—" : money(item.value)}</strong>
            <p>
              {item.count !== null
                ? `${item.count} ${basis === "cash" ? "baixa(s)" : "lançamento(s)"}`
                : margin !== null
                  ? `${percent(margin)} das entradas restantes após as saídas`
                  : "Sem entradas para calcular a proporção"}
            </p>
            <Comparison
              value={item.value}
              previous={item.prev}
              label={periodLabel(previous.year, previous.month)}
            />
          </section>
        ))}
      </div>
      {!rows.length && !loading && (
        <div className="report-notice" role="status">
          Nenhuma movimentação confirmada para este período e estes filtros.
          Experimente outro mês, regime ou categoria. Valores pendentes aparecem
          na seção de compromissos.
        </div>
      )}

      <section className="panel report-flow">
        <div className="panel-heading">
          <div>
            <h2>Entradas, saídas e o que ficou</h2>
            <p>
              {month === "all"
                ? "Comparação mês a mês"
                : "Comparação dia a dia"}{" "}
              · valores em R$ · {periodLabel(year, month)}
            </p>
          </div>
          <div className="report-legend">
            <span>
              <i style={{ background: palette.income }} />
              Entradas
            </span>
            <span>
              <i style={{ background: palette.expense }} />
              Saídas
            </span>
            <span>
              <i style={{ background: palette.net }} />
              Resultado
            </span>
          </div>
        </div>
        {rows.length ? (
          <div
            className="report-chart"
            role="img"
            aria-label={`Entradas de ${money(summary.income)}, saídas de ${money(summary.expense)}, resultado de ${money(summary.net)}. Valores por ${month === "all" ? "mês" : "dia"} na tabela de evolução abaixo.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={timeline}
                margin={{ top: 15, right: 14, bottom: 8, left: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--prumo-line)"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={12}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                />
                <YAxis
                  width={62}
                  tickFormatter={axisMoney}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => money(Number(v))}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.date
                      ? `Referência: ${payload[0].payload.date}`
                      : ""
                  }
                />
                <ReferenceLine y={0} stroke="var(--muted)" />
                <Bar
                  name="Entradas"
                  dataKey="income"
                  fill={palette.income}
                  maxBarSize={28}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  name="Saídas"
                  dataKey="expense"
                  fill={palette.expense}
                  maxBarSize={28}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  name="Resultado"
                  dataKey="result"
                  type="linear"
                  stroke={palette.net}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="report-empty">
            O gráfico aparece quando houver valores confirmados.
          </p>
        )}
      </section>

      <div className="report-grid">
        <Breakdown
          title="De onde veio o dinheiro"
          subtitle={
            basis === "cash"
              ? "Recebimentos por categoria · clique para detalhar"
              : "Receitas por categoria · clique para detalhar"
          }
          groups={summary.incomeCategories}
          total={summary.income}
          type="income"
          onSelect={(name) => selectCategory(name, "income")}
        />
        <Breakdown
          title="Para onde foi o dinheiro"
          subtitle={
            basis === "cash"
              ? "Pagamentos por categoria · clique para detalhar"
              : "Despesas por categoria · clique para detalhar"
          }
          groups={summary.expenseCategories}
          total={summary.expense}
          type="expense"
          onSelect={(name) => selectCategory(name, "expense")}
        />
      </div>

      <section className="panel report-reading">
        <div className="panel-heading">
          <h2>Leitura do período</h2>
        </div>
        <ul>
          <li>
            {summary.income || summary.expense ? (
              <>
                As{" "}
                {basis === "cash"
                  ? "saídas consumiram"
                  : "despesas representam"}{" "}
                <strong>
                  {summary.income
                    ? percent((summary.expense / summary.income) * 100) +
                      " das entradas"
                    : money(summary.expense) + ", sem entradas registradas"}
                </strong>
                . O período{" "}
                {summary.net >= 0 ? "gerou" : "teve uma diferença negativa de"}{" "}
                <strong>{money(Math.abs(summary.net))}</strong>.
              </>
            ) : (
              "Ainda não há valores confirmados para analisar."
            )}
          </li>
          {summary.expense > 0 && summary.expenseCategories[0] && (
            <li>
              A maior saída foi{" "}
              <strong>{summary.expenseCategories[0].name}</strong>:{" "}
              {money(summary.expenseCategories[0].amount)}, ou{" "}
              {percent(
                (summary.expenseCategories[0].amount / summary.expense) * 100,
              )}{" "}
              do total de saídas.
            </li>
          )}
          {summary.income > 0 && summary.incomeCategories[0] && (
            <li>
              A principal fonte de entrada foi{" "}
              <strong>{summary.incomeCategories[0].name}</strong>:{" "}
              {money(summary.incomeCategories[0].amount)}.
            </li>
          )}
          <li>
            A comparação considera o período anterior inteiro (
            {periodLabel(previous.year, previous.month)}).{" "}
            {lastDay >= today && firstDay <= today
              ? "O período atual ainda está em andamento; a comparação não é proporcional aos dias transcorridos."
              : "Ausência de registros no período anterior não comprova ausência de movimentação."}
          </li>
        </ul>
      </section>

      <div className="report-grid">
        <Breakdown
          title="Clientes e fontes de receita"
          subtitle="Agrupados pelo cliente / favorecido do lançamento"
          groups={summary.incomeParties}
          total={summary.income}
          type="income"
        />
        <Breakdown
          title="Quem recebeu os pagamentos"
          subtitle="Agrupados pelo cliente / favorecido do lançamento"
          groups={summary.expenseParties}
          total={summary.expense}
          type="expense"
        />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Movimentação por origem e forma</h2>
            <p>
              {basis === "cash"
                ? "Forma registrada em cada baixa"
                : "Forma prevista no lançamento; não confirma pagamento"}
            </p>
          </div>
        </div>
        <div className="report-grid report-cross-section">
          {["origin", "method"].map((key) => {
            const grouped = new Map<
              string,
              { income: number; expense: number }
            >();
            rows.forEach((r) => {
              const name = r[key as "origin" | "method"];
              const value = grouped.get(name) || { income: 0, expense: 0 };
              value[r.entry.type] += r.amount;
              grouped.set(name, value);
            });
            return (
              <div className="report-table-wrap" key={key}>
                <table>
                  <caption>
                    {key === "origin"
                      ? "Origem do registro"
                      : "Forma de pagamento"}
                  </caption>
                  <thead>
                    <tr>
                      <th>{key === "origin" ? "Origem" : "Forma"}</th>
                      <th>Entradas</th>
                      <th>Saídas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...grouped]
                      .sort(
                        (a, b) =>
                          b[1].income +
                          b[1].expense -
                          a[1].income -
                          a[1].expense,
                      )
                      .map(([name, value]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td className="positive">{money(value.income)}</td>
                          <td className="outgoing">{money(value.expense)}</td>
                        </tr>
                      ))}
                    {!grouped.size && (
                      <tr>
                        <td colSpan={3}>Sem movimentações neste período.</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <td>{money(summary.income)}</td>
                      <td>{money(summary.expense)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      </section>

      <div className="report-grid">
        {(
          [
            { key: "vehicleId", title: "Custos por veículo" },
            { key: "employeeId", title: "Pagamentos por colaborador" },
            { key: "recurrenceId", title: "Despesas fixas por compromisso" },
          ] as const
        ).map(({ key, title }) => {
          const linked = rows.filter(
            (r) => r.entry.type === "expense" && r.entry[key],
          );
          if (!linked.length) return null;
          return (
            <Breakdown
              key={key}
              title={title}
              subtitle="Somente despesas vinculadas a este cadastro"
              type="expense"
              groups={groupRows(
                linked,
                (r) => recordLabels[r.entry[key]] || "Cadastro indisponível",
              )}
              total={linked.reduce((s, r) => s + r.amount, 0)}
            />
          );
        })}
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {basis === "cash"
                ? "Evolução do resultado de caixa"
                : "Evolução do resultado por competência"}
            </h2>
            <p>
              Acumulado desde o início do período · começa em zero · não é saldo
              bancário
            </p>
          </div>
          <strong>{money(summary.net)}</strong>
        </div>
        {rows.length > 0 && (
          <div
            className="report-chart report-chart-small"
            role="img"
            aria-label={`Resultado acumulado final: ${money(summary.net)}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={timeline}
                margin={{ top: 12, right: 14, left: 0, bottom: 4 }}
                accessibilityLayer
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--prumo-line)"
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="name"
                  minTickGap={12}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                />
                <YAxis
                  width={62}
                  tickFormatter={axisMoney}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="var(--muted)" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => money(Number(v))}
                />
                <Line
                  name="Resultado acumulado"
                  dataKey="net"
                  stroke={palette.net}
                  strokeWidth={2}
                  type="linear"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <details className="report-details">
          <summary>
            Ver evolução em números ({timeline.length}{" "}
            {month === "all" ? "meses" : "dias"})
          </summary>
          <div className="report-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{month === "all" ? "Mês" : "Dia"}</th>
                  <th>Entradas</th>
                  <th>Saídas</th>
                  <th>Resultado</th>
                  <th>Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((t) => (
                  <tr key={t.date}>
                    <td>{t.name}</td>
                    <td>{money(t.income)}</td>
                    <td>{money(t.expense)}</td>
                    <td>{money(t.result)}</td>
                    <td>{money(t.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <td>{money(summary.income)}</td>
                  <td>{money(summary.expense)}</td>
                  <td>{money(summary.net)}</td>
                  <td>{money(summary.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
        <p className="report-footnote">
          {opening !== null
            ? `Saldo inicial registrado para o período: ${money(opening)}. Saldo contábil ao final: ${money(opening + cashMovement)}. Calculado a partir do saldo informado em ${dateLabel(settings.initialDate!)} e das baixas datadas desde então; confira com suas contas bancárias.`
            : "Para acompanhar saldo contábil, informe saldo inicial e data nas configurações. O saldo só pode ser calculado para um período sem filtros e iniciado a partir dessa data."}
        </p>
      </section>

      <section className="panel report-obligations">
        <div className="panel-heading">
          <div>
            <h2>Compromissos do período</h2>
            <p>
              Operações por competência, independentemente do regime acima ·
              posição atual, com baixas de qualquer data
            </p>
          </div>
        </div>
        <div className="report-obligation-values">
          <div>
            <span>A receber</span>
            <strong className="positive">{money(receivable)}</strong>
            <small>{money(overdue("income"))} vencidos</small>
          </div>
          <div>
            <span>A pagar</span>
            <strong className="outgoing">{money(payable)}</strong>
            <small>{money(overdue("expense"))} vencidos</small>
          </div>
          <div>
            <span>Diferença entre pendências</span>
            <strong>{money(receivable - payable)}</strong>
            <small>Não é previsão de saldo</small>
          </div>
        </div>
        <div className="report-pending-toolbar">
          <div
            className="segmented"
            role="group"
            aria-label="Tipo de compromisso"
          >
            <button
              className={pendingType === "income" ? "selected" : ""}
              aria-pressed={pendingType === "income"}
              onClick={() => {
                setPendingType("income");
                setPendingExpanded(false);
              }}
            >
              A receber
            </button>
            <button
              className={pendingType === "expense" ? "selected" : ""}
              aria-pressed={pendingType === "expense"}
              onClick={() => {
                setPendingType("expense");
                setPendingExpanded(false);
              }}
            >
              A pagar
            </button>
          </div>
          <span>
            {pendingRows.length} compromisso(s) · vencimentos mais próximos
            primeiro
          </span>
        </div>
        <div className="report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Vencimento</th>
                <th>Valor líquido</th>
                <th>Já baixado</th>
                <th>Saldo pendente</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {(pendingExpanded ? pendingRows : pendingRows.slice(0, 8)).map(
                (e) => (
                  <tr key={e.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => onEntry(e)}
                      >
                        {e.description}
                      </button>
                      <small className="report-cell-sub">
                        {e.party || "Cliente / favorecido não informado"}
                      </small>
                    </td>
                    <td>{e.due ? dateLabel(e.due) : "Sem vencimento"}</td>
                    <td>{money(e.amount! - e.discount)}</td>
                    <td>{money(paid(e))}</td>
                    <td>{money(balance(e)!)}</td>
                    <td>{status(e, today)}</td>
                  </tr>
                ),
              )}
              {!pendingRows.length && (
                <tr>
                  <td colSpan={6}>
                    Nenhum compromisso pendente neste recorte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pendingRows.length > 8 && (
          <button
            className="text-button report-expand"
            onClick={() => setPendingExpanded(!pendingExpanded)}
          >
            {pendingExpanded
              ? "Mostrar menos"
              : `Ver todos (${pendingRows.length})`}
          </button>
        )}
      </section>

      <section className="panel report-ledger">
        <div className="panel-heading">
          <div>
            <h2>Detalhamento das movimentações</h2>
            <p>
              {basis === "cash"
                ? "Uma linha por baixa efetiva; parciais aparecem separadamente"
                : "Uma linha por operação; valor líquido de desconto"}{" "}
              · clique na descrição para abrir
            </p>
          </div>
          <strong>{rows.length} registro(s)</strong>
        </div>
        <label className="report-search">
          <Search size={17} />
          <input
            aria-label="Buscar no detalhamento"
            placeholder="Buscar descrição, cliente, origem ou forma…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {query && (
          <p className="report-footnote" role="status">
            {detail.length} resultado(s). Esta busca filtra apenas a tabela;
            totais, gráficos e CSV mantêm os filtros do relatório.
          </p>
        )}
        <div className="report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{basis === "cash" ? "Data da baixa" : "Competência"}</th>
                <th>Descrição / cliente</th>
                <th>Tipo</th>
                <th>Categoria / origem</th>
                <th>Forma</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {detail
                .slice((currentPage - 1) * 15, currentPage * 15)
                .map((r) => (
                  <tr key={r.id}>
                    <td>{dateLabel(r.date)}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => onEntry(r.entry)}
                      >
                        {r.entry.description}
                      </button>
                      <small className="report-cell-sub">
                        {r.entry.party || "Cliente / favorecido não informado"}
                      </small>
                    </td>
                    <td>{r.entry.type === "income" ? "Entrada" : "Saída"}</td>
                    <td>
                      {r.entry.category}
                      <small className="report-cell-sub">{r.origin}</small>
                    </td>
                    <td>{r.method}</td>
                    <td
                      className={
                        r.entry.type === "income" ? "positive" : "outgoing"
                      }
                    >
                      {r.entry.type === "income" ? "+" : "−"}
                      {money(r.amount)}
                    </td>
                  </tr>
                ))}
              {!detail.length && (
                <tr>
                  <td colSpan={6}>Nenhuma movimentação encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="report-pagination">
          <span>
            Página {currentPage} de {pageCount} · {detail.length} registro(s)
          </span>
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <button
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </button>
        </div>
      </section>

      <details
        className="panel report-methodology"
        open={quality.unresolved > 0 || quality.undatedCount > 0}
      >
        <summary>
          Critérios e qualidade dos dados
          {quality.unresolved || quality.undatedCount
            ? ` · ${quality.unresolved + quality.undatedCount} ponto(s) de atenção`
            : ""}
        </summary>
        <ul>
          <li>
            Valores em reais, calculados em centavos. Operações canceladas e
            baixas estornadas ficam fora dos relatórios.
          </li>
          <li>
            Competência exclui operações sem valor ou a conferir. Caixa inclui
            somente baixas válidas com data no período, mesmo que a operação
            esteja em conferência.
          </li>
          <li>
            {quality.unresolved} operação(ões) sem valor ou a conferir na
            competência selecionada. Os totais por competência podem estar
            incompletos.
          </li>
          <li>
            {quality.undatedCount} baixa(s) sem data em todo o cadastro:{" "}
            {money(quality.undatedIncome)} em entradas e{" "}
            {money(quality.undatedExpense)} em saídas. Ficam fora do caixa, pois
            não é possível atribuí-las a um período.
          </li>
          <li>
            Compromissos mostram o saldo atual das operações da competência
            selecionada, e não uma fotografia histórica do fechamento. Não
            incluem operações de outras competências.
          </li>
          <li>
            Cliente, favorecido e forma não informados são agrupados
            explicitamente. Percentuais usam os totais do recorte selecionado. A
            exportação contém todas as linhas deste recorte.
          </li>
        </ul>
      </details>
    </div>
  );
}
