import { Search } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

export interface FilterSelect { name: string; label: string; value?: string; options: { value: string; label: string }[] }

/** Filtros por GET: funcionan sin JavaScript. */
export function FilterBar({ search, selects, action }: { search?: string; selects: FilterSelect[]; action: string }) {
  return (
    <form method="get" action={action} role="search" className="glass glass-strong flex flex-wrap items-end gap-3 rounded-xl p-4">
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <label htmlFor="q" className="text-sm font-medium">Buscar</label>
        <input id="q" name="q" defaultValue={search} placeholder="Nombre, código o cédula" className="min-h-11 rounded-md border border-line bg-surface px-3" />
      </div>
      {selects.map((s) => (
        <div key={s.name} className="flex flex-col gap-1.5">
          <label htmlFor={`f-${s.name}`} className="text-sm font-medium">{s.label}</label>
          <select id={`f-${s.name}`} name={s.name} defaultValue={s.value ?? ""} className="min-h-11 rounded-md border border-line bg-surface px-3">
            <option value="">Todos</option>
            {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      ))}
      <button type="submit" className={buttonClass("primary", "md")}><Search aria-hidden className="size-4" /> Filtrar</button>
    </form>
  );
}
