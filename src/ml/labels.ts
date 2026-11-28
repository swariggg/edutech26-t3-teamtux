import type { Tone } from "@/domain/labels";
import type { FeatureName, PaymentClass } from "./inference";

export const classMeta: Record<PaymentClass, { label: string; tone: Tone; color: string }> = {
  puntual: { label: "Puntual", tone: "success", color: "var(--success)" },
  tardio: { label: "Tardío", tone: "warning", color: "var(--warning)" },
  incumplimiento: { label: "Incumplimiento", tone: "danger", color: "var(--danger)" },
};

export const featureLabel: Record<FeatureName, string> = {
  obligaciones_mes: "Pensiones del mes",
  valor_mes: "Valor del mes (USD)",
  meses_historial: "Meses de historial",
  obligaciones_historial: "Pensiones en historial",
  tasa_puntualidad: "Tasa de puntualidad",
  tasa_tardanza: "Tasa de tardanza",
  tasa_incumplimiento: "Tasa de incumplimiento",
};

export const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;
