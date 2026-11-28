import { PUNCTUALITY_RULES, type MonthOutcome } from "@/domain/loyalty";
import { cn } from "@/lib/cn";

const FILL: Record<MonthOutcome, string> = {
  puntual: "bg-success",
  atrasado: "bg-warning",
  impago: "bg-danger/35",
  pendiente: "",
};

/**
 * Barra del récord de puntualidad: 10 tramos (uno por mes). Puntual llena el tramo (10 %), atrasado la mitad (5 %).
 * La marca vertical señala el 80 % que da acceso a la beca. El significado no depende solo del color:
 * el porcentaje y el texto acompañan siempre a la barra.
 */
export function PunctualityBar({ outcomes, recordPct, size = "md", label }: { outcomes: MonthOutcome[]; recordPct: number; size?: "sm" | "md"; label: string }) {
  const months = Math.max(outcomes.length, PUNCTUALITY_RULES.months);
  const cells = Array.from({ length: months }, (_, i) => outcomes[i] ?? "pendiente");
  const min = PUNCTUALITY_RULES.scholarshipMinPct;
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={recordPct}
      aria-valuetext={`${recordPct} %`}
      aria-label={label}
      className="relative w-full"
    >
      <div className={cn("flex w-full gap-0.5 overflow-hidden rounded-full border border-line bg-[color-mix(in_srgb,var(--fg-muted)_10%,transparent)]", size === "sm" ? "h-2.5" : "h-5")}>
        {cells.map((o, i) => (
          <div key={i} className="relative flex-1 overflow-hidden">
            {o !== "pendiente" && <div className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", FILL[o], o === "atrasado" ? "w-1/2" : "w-full")} />}
          </div>
        ))}
      </div>
      {/* Marca del 80 % (beca). */}
      <div aria-hidden className={cn("absolute -top-[3px] w-0.5 rounded bg-primary", size === "sm" ? "h-4" : "h-[26px]")} style={{ left: `calc(${min}% - 1px)` }} />
    </div>
  );
}
