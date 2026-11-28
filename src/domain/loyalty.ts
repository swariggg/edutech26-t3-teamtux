import type { Tone } from "./labels";

/**
 * Récord de puntualidad (fidelización):
 * cada uno de los 10 meses de pensión suma a la barra 10 % si se pagó a tiempo, 5 % si se pagó atrasado y 0 % si no se pagó.
 * Con 80 % o más y ningún mes impago, la familia gana una beca del 20 % en la pensión del año siguiente.
 * El riesgo se calcula solo sobre los meses ya vencidos (así a mitad de año no parece que todos estén en riesgo).
 * Es apoyo a la decisión: colecturía confirma la beca.
 */
export type MonthOutcome = "puntual" | "atrasado" | "impago" | "pendiente";
export type RiskLevel = "critico" | "alto" | "medio" | "bajo" | "sin_historial";

export const PUNCTUALITY_RULES = {
  months: 10,
  onTimePct: 10,
  latePct: 5,
  scholarshipMinPct: 80,
  scholarshipDiscountPct: 20,
} as const;

const POINTS: Record<MonthOutcome, number> = { puntual: PUNCTUALITY_RULES.onTimePct, atrasado: PUNCTUALITY_RULES.latePct, impago: 0, pendiente: 0 };

export const outcomeMeta: Record<MonthOutcome, { label: string; tone: Tone; points: number }> = {
  puntual: { label: "Puntual", tone: "success", points: POINTS.puntual },
  atrasado: { label: "Atrasado", tone: "warning", points: POINTS.atrasado },
  impago: { label: "Sin pagar", tone: "danger", points: 0 },
  pendiente: { label: "Por vencer", tone: "neutral", points: 0 },
};

export const RISK_LEVELS: Exclude<RiskLevel, "sin_historial">[] = ["critico", "alto", "medio", "bajo"];
export const riskMeta: Record<RiskLevel, { label: string; range: string; tone: Tone; action: string }> = {
  critico: { label: "Crítico", range: "0–25 %", tone: "danger", action: "Tomar medidas: llamar a la familia y acordar un plan de pago." },
  alto: { label: "Alto", range: "26–50 %", tone: "danger", action: "Seguimiento cercano de colecturía." },
  medio: { label: "Medio", range: "51–75 %", tone: "warning", action: "Enviar recordatorios antes del vencimiento." },
  bajo: { label: "Bajo", range: "76–100 %", tone: "success", action: "Familia puntual; candidata a beca desde 80 %." },
  sin_historial: { label: "Sin historial", range: "—", tone: "neutral", action: "Aún no vence ninguna pensión." },
};

export function riskLevel(punctualityPct: number | null): RiskLevel {
  if (punctualityPct === null) return "sin_historial";
  if (punctualityPct <= 25) return "critico";
  if (punctualityPct <= 50) return "alto";
  if (punctualityPct <= 75) return "medio";
  return "bajo";
}

/** Clasifica una pensión. `today` es AAAA-MM-DD (fecha de la app). */
export function classifyMonth(i: { status: string; dueDate: string; paidAt?: string | null }, today: string): MonthOutcome {
  const due = i.dueDate.slice(0, 10);
  if (i.status === "pagada") return !i.paidAt || i.paidAt.slice(0, 10) <= due ? "puntual" : "atrasado";
  if (i.status === "vencida" || due < today) return "impago";
  return "pendiente";
}

export interface PunctualityRecord {
  /** Barra acumulada sobre el 100 % del año. */
  recordPct: number;
  /** Puntos ganados sobre los meses ya vencidos (0–100), o null si aún no vence ninguno. */
  punctualityPct: number | null;
  onTime: number; late: number; unpaid: number; pending: number; due: number;
  risk: RiskLevel;
  /** Lo máximo que puede alcanzar: lo que queda pagado a tiempo y lo impago puesto al día (atrasado, 5 %). */
  maxReachablePct: number;
  /** Ya ganó la beca (año cerrado, ≥80 % y sin impagos). */
  scholarshipEarned: boolean;
  /** Todavía puede ganar la beca (sin impagos y el máximo alcanzable llega al 80 %). */
  scholarshipOnTrack: boolean;
  /** Puntos que le faltan para el 80 %. */
  missingPct: number;
}

export function punctualityRecord(outcomes: MonthOutcome[]): PunctualityRecord {
  const count = (o: MonthOutcome) => outcomes.filter((x) => x === o).length;
  const onTime = count("puntual"), late = count("atrasado"), unpaid = count("impago"), pending = count("pendiente");
  const due = onTime + late + unpaid;
  const recordPct = outcomes.reduce((s, o) => s + POINTS[o], 0);
  const punctualityPct = due === 0 ? null : Math.round((recordPct / (due * PUNCTUALITY_RULES.onTimePct)) * 100);
  const maxReachablePct = recordPct + pending * PUNCTUALITY_RULES.onTimePct + unpaid * PUNCTUALITY_RULES.latePct;
  const min = PUNCTUALITY_RULES.scholarshipMinPct;
  return {
    recordPct, punctualityPct, onTime, late, unpaid, pending, due,
    risk: riskLevel(punctualityPct),
    maxReachablePct,
    scholarshipEarned: pending === 0 && unpaid === 0 && recordPct >= min,
    scholarshipOnTrack: unpaid === 0 && maxReachablePct >= min,
    missingPct: Math.max(0, min - recordPct),
  };
}
