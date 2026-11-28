import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FeatureVector, PaymentClass } from "./inference";

/**
 * Ingeniería de variables a partir de data/dataset-ficticio-colegio (datos sintéticos).
 * Reproduce el entrenamiento: una fila = un representante (familia) en un mes objetivo;
 * el historial son los meses previos. Verificado: las medias/desviaciones del StandardScaler
 * coinciden exactamente con objetivos oct-2025 (historial sep) y nov-2025 (historial sep–oct).
 */

const DATA_DIR = path.join(process.cwd(), "data", "dataset-ficticio-colegio");
/** El entrenamiento tuvo 1–2 meses de historial; usar más extrapola fuera de lo visto por los modelos. */
export const HISTORY_WINDOW = 2;
const LATE_DAY = 10;

export interface Student { codigo: string; nombre: string; curso: string; paralelo: string; beca: number; representante: string }
interface Pension { estudiante: string; mes: string; valor: number; estado: "pagado" | "vencido" | "por_vencer"; fechaPago: string }

export interface FamilyMonth {
  representante: string;
  mes: string;
  features: FeatureVector;
  /** Resultado real del mes (peor caso entre los hijos), si ya ocurrió. */
  real?: PaymentClass;
}

/** CSV simple (el dataset no tiene comas dentro de campos). Cada fila es un lector `col => valor` ("" si falta). */
function parseCsv(text: string): ((col: string) => string)[] {
  const [head = "", ...lines] = text.replace(/^﻿/, "").trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((l) => {
    const v = l.split(",");
    return (col: string) => v[cols.indexOf(col)] ?? "";
  });
}

function outcome(p: Pension): PaymentClass | undefined {
  if (p.estado === "vencido") return "incumplimiento";
  if (p.estado === "pagado") return Number(p.fechaPago.slice(8, 10)) > LATE_DAY ? "tardio" : "puntual";
  return undefined;
}

const SEVERITY: Record<PaymentClass, number> = { puntual: 0, tardio: 1, incumplimiento: 2 };

export interface Dataset { students: Student[]; months: string[]; closedMonths: string[]; openMonth?: string; byFamily: Map<string, { students: Student[]; pensions: Pension[] }> }

let cache: Promise<Dataset> | undefined;

export function loadDataset(): Promise<Dataset> {
  cache ??= (async () => {
    const [est, pen] = await Promise.all([readFile(path.join(DATA_DIR, "estudiantes.csv"), "utf8"), readFile(path.join(DATA_DIR, "pensiones.csv"), "utf8")]);
    const students: Student[] = parseCsv(est).map((r) => ({ codigo: r("codigo"), nombre: r("nombre_ficticio"), curso: r("curso"), paralelo: r("paralelo"), beca: Number(r("beca_porcentaje")), representante: r("representante_codigo") }));
    const repOf = new Map(students.map((s) => [s.codigo, s.representante]));
    const pensions: Pension[] = parseCsv(pen).map((r) => ({ estudiante: r("codigo_estudiante"), mes: r("mes"), valor: Number(r("valor")), estado: r("estado") as Pension["estado"], fechaPago: r("fecha_pago") }));
    const byFamily = new Map<string, { students: Student[]; pensions: Pension[] }>();
    for (const s of students) {
      const f = byFamily.get(s.representante) ?? { students: [], pensions: [] };
      f.students.push(s);
      byFamily.set(s.representante, f);
    }
    for (const p of pensions) byFamily.get(repOf.get(p.estudiante) ?? "")?.pensions.push(p);
    const months = [...new Set(pensions.map((p) => p.mes))].sort();
    const closedMonths = months.filter((m) => pensions.some((p) => p.mes === m && p.estado !== "por_vencer"));
    const openMonth = months.find((m) => !closedMonths.includes(m));
    return { students, months, closedMonths, openMonth, byFamily };
  })();
  return cache;
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
