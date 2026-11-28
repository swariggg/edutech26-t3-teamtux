import { GlassCard } from "@/components/ui/GlassCard";

/** Tarjeta de gráfico con tabla de datos accesible ("Ver datos"). */
export function ChartCard({ title, description, table, children }: { title: string; description?: string; table: { headers: string[]; rows: (string | number)[][] }; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <GlassCard as="section" aria-labelledby={id} className="flex flex-col gap-3 p-5">
      <div>
        <h2 id={id} className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <div aria-hidden className="h-64 w-full">{children}</div>
      <details>
        <summary className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">Ver datos</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead><tr>{table.headers.map((h) => <th key={h} scope="col" className="border-b border-line py-1 text-left font-semibold text-muted">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-line/50 py-1 tabular-nums">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </GlassCard>
  );
}
