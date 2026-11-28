import { cn } from "@/lib/cn";
import { EmptyState } from "./EmptyState";

export interface Column<T> { key: string; header: string; cell: (row: T) => React.ReactNode; className?: string; align?: "left" | "right" }

/** Tabla semántica con caption; en móvil se desplaza dentro de su contenedor (no la página). */
export function DataTable<T>({ caption, columns, rows, rowKey, empty = "Sin resultados" }: { caption: string; columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty?: string }) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-3 font-semibold text-muted", c.align === "right" && "text-right", c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line/60 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 align-middle", c.align === "right" && "text-right tabular-nums", c.className)}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
