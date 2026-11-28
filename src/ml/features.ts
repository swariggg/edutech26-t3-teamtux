import "server-only";
import type { FeatureVector, PaymentClass } from "./inference";
import { getRepository } from "@/data";
import { gradeLabel, institution } from "@/content/institution";
import { nowISO } from "@/lib/clock";

/**
 * Ingeniería de variables a partir de la BASE DE DATOS de la app (Supabase o el modo demo, ambos sembrados
 * desde dataset-ficticio-colegio): así los modelos ven los pagos reales registrados después de la carga
 * (colecturía, n8n, pagos en línea). Reproduce el entrenamiento: una fila = un representante (familia) en un
 * mes objetivo; el historial son los meses previos. Con los datos originales, las medias/desviaciones del
 * StandardScaler coinciden exactamente con objetivos oct-2025 (historial sep) y nov-2025 (historial sep–oct).
 * Solo usa el año lectivo en curso: las matrículas del año siguiente no tienen historial.
 */

/** El entrenamiento tuvo 1–2 meses de historial; usar más extrapola fuera de lo visto por los modelos. */
export const HISTORY_WINDOW = 2;

export interface Student { codigo: string; nombre: string; curso: string; paralelo: string; beca: number; representante: string }
interface Pension { estudiante: string; mes: string; valor: number; estado: "pagado" | "vencido" | "por_vencer"; dueDate: string; fechaPago: string }

export interface FamilyMonth {
  representante: string;
  mes: string;
  features: FeatureVector;
  /** Resultado real del mes (peor caso entre los hijos), si ya ocurrió. */
  real?: PaymentClass;
}

/** Puntual si se pagó hasta el vencimiento (día 10), tardío si después, incumplimiento si venció sin pagar. */
function outcome(p: Pension): PaymentClass | undefined {
  if (p.estado === "vencido") return "incumplimiento";
  if (p.estado === "pagado") return p.fechaPago > p.dueDate ? "tardio" : "puntual";
  return undefined;
}

const SEVERITY: Record<PaymentClass, number> = { puntual: 0, tardio: 1, incumplimiento: 2 };

export interface Dataset {
  students: Student[]; months: string[]; closedMonths: string[]; openMonth?: string;
  byFamily: Map<string, { students: Student[]; pensions: Pension[] }>;
  /** Fecha de corte (fecha de la app) y año lectivo usados. */
  asOf: string; academicYear: string;
}

/** Lee matrículas y pensiones del año en curso desde el repositorio (sin caché: refleja cada pago nuevo). */
export async function loadDataset(): Promise<Dataset> {
  const repo = getRepository();
  const academicYear = institution.currentYear;
  const today = nowISO().slice(0, 10);
  const [enrollments, installments] = await Promise.all([
    repo.listEnrollments({ academicYear, limit: 100_000 }),
    repo.listInstallments({ limit: 100_000 }),
  ]);
  const active = enrollments.filter((e) => e.status !== "anulada" && e.status !== "retirada");
  const students: Student[] = active.map((e) => ({
    codigo: e.studentCode ?? e.code,
    nombre: e.studentName,
    curso: gradeLabel(e.grade),
    paralelo: e.section ?? "",
    beca: e.scholarshipPct ?? 0,
    representante: e.guardianKey ?? e.studentId,
  }));
  const studentOf = new Map(active.map((e, i) => [e.id, students[i]!]));
  const byFamily = new Map<string, { students: Student[]; pensions: Pension[] }>();
  for (const s of students) {
    const f = byFamily.get(s.representante) ?? { students: [], pensions: [] };
    f.students.push(s);
    byFamily.set(s.representante, f);
  }
  const months = new Set<string>();
  for (const i of installments) {
    const st = studentOf.get(i.enrollmentId);
    if (!st || i.concept !== "pension" || i.status === "anulada") continue;
    months.add(i.period);
    byFamily.get(st.representante)!.pensions.push({
      estudiante: st.codigo,
      mes: i.period,
      valor: i.amount,
      // El estado ya viene «efectivo»: una cuota pendiente cuyo vencimiento pasó llega como «vencida».
      estado: i.status === "pagada" ? "pagado" : i.status === "vencida" ? "vencido" : "por_vencer",
      dueDate: i.dueDate.slice(0, 10),
      fechaPago: i.paidAt?.slice(0, 10) ?? "",
    });
  }
  const sorted = [...months].sort();
  // Un mes está cerrado cuando ya pasó su vencimiento (aunque alguien haya pagado por adelantado uno futuro).
  const dueOf = (m: string) => `${m}-${String(institution.fees.dueDay).padStart(2, "0")}`;
  const closedMonths = sorted.filter((m) => dueOf(m) < today);
  const openMonth = sorted.find((m) => !closedMonths.includes(m));
  return { students, months: sorted, closedMonths, openMonth, byFamily, asOf: today, academicYear };
}

/** Variables de cada familia para un mes objetivo, con historial = los `window` meses previos. */
export function buildFamilyMonths(ds: Dataset, target: string, window = HISTORY_WINDOW): FamilyMonth[] {
  const idx = ds.months.indexOf(target);
  const hist = ds.months.slice(Math.max(0, idx - window), idx);
  const rows: FamilyMonth[] = [];
  for (const [rep, fam] of ds.byFamily) {
    const t = fam.pensions.filter((p) => p.mes === target);
    const h = fam.pensions.filter((p) => hist.includes(p.mes));
    if (t.length === 0) continue;
    const outs = h.map(outcome);
    const rate = (c: PaymentClass) => (h.length ? outs.filter((o) => o === c).length / h.length : 0);
    const tOuts = t.map(outcome);
    const real = tOuts.every(Boolean) ? (tOuts as PaymentClass[]).reduce((w, o) => (SEVERITY[o] > SEVERITY[w] ? o : w), "puntual") : undefined;
    rows.push({
      representante: rep,
      mes: target,
      real,
      features: {
        obligaciones_mes: t.length,
        valor_mes: t.reduce((s, p) => s + p.valor, 0),
        meses_historial: hist.length,
        obligaciones_historial: h.length,
        tasa_puntualidad: rate("puntual"),
        tasa_tardanza: rate("tardio"),
        tasa_incumplimiento: rate("incumplimiento"),
      },
    });
  }
  return rows.sort((a, b) => a.representante.localeCompare(b.representante));
}
