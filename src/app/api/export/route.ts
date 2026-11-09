import { guard, failure } from "@/lib/auth";
import { allRecords } from "@/lib/store";
import { Entry, inPeriod, status, balance } from "@/lib/finance";
export async function GET(req: Request) {
  try {
    const db = await guard();
    const p = new URL(req.url).searchParams;
    const year = p.get("year") || "2026",
      month = p.get("month") || "all",
      basis = p.get("basis") || "cash";
    const records = (await allRecords(db)).filter(
      (r) => r.kind === "entry",
    ) as Entry[];
    const rows = [
      [
        "Descrição",
        "Tipo",
        "Categoria",
        "Competência",
        "Data efetiva",
        "Valor em reais",
        "Situação",
        "Saldo em reais",
        "Origem",
      ],
    ];
    for (const e of records) {
      if (e.cancelled) continue;
      if (p.get("category") && e.category !== p.get("category")) continue;
      if (p.get("vehicle") && e.vehicleId !== p.get("vehicle")) continue;
      if (
        p.get("search") &&
        !(e.description + " " + e.party + " " + e.notes)
          .toLowerCase()
          .includes(p.get("search")!.toLowerCase())
      )
        continue;
      if (basis === "cash") {
        for (const b of e.payments)
          if (!b.voided && inPeriod(b.date, year, month))
            rows.push([
              e.description,
              e.type,
              e.category,
              e.competence,
              b.date || "",
              (b.amount / 100).toFixed(2),
              status(e),
              String((balance(e) || 0) / 100),
              e.source,
            ]);
      } else if (inPeriod(e.competence, year, month))
        rows.push([
          e.description,
          e.type,
          e.category,
          e.competence,
          "",
          e.amount === null ? "" : ((e.amount - e.discount) / 100).toFixed(2),
          status(e),
          balance(e) === null ? "" : String(balance(e)! / 100),
          e.source,
        ]);
    }
    const cell = (s: string) =>
      '"' + (/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
    return new Response(
      "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="financeiro.csv"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
