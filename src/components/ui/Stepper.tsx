import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Progreso del formulario">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} aria-current={active ? "step" : undefined} className="flex items-center gap-2">
            <span className={cn("inline-flex size-8 items-center justify-center rounded-full border text-sm font-semibold", done && "border-success bg-success text-white dark:text-black", active && "border-primary bg-primary text-on-primary", !done && !active && "border-line text-muted")}>
              {done ? <Check aria-hidden className="size-4" /> : i + 1}
              <span className="sr-only">{done ? " (completado)" : active ? " (actual)" : ""}</span>
            </span>
            <span className={cn("text-sm", active ? "font-semibold" : "text-muted", "hidden sm:inline")}>{s}</span>
            {i < steps.length - 1 && <span aria-hidden className="hidden h-px w-6 bg-line sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}
