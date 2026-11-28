import "server-only";
import { getRepository } from "@/data";
import { institution } from "@/content/institution";
import { classifyMonth, punctualityRecord, type MonthOutcome, type PunctualityRecord } from "@/domain/loyalty";
import type { EnrollmentStatus, Grade } from "@/domain/types";
import { nowISO } from "@/lib/clock";
import { evaluateFamily, type RiskLevel } from "./nuevo-cliente";

/** Curso como número, igual que en el entrenamiento (8vo EGB = 8 … 3ro BGU = 13). */
const GRADE_NUM: Partial<Record<Grade, number>> = {
  primero_egb: 1, segundo_egb: 2, tercero_egb: 3, cuarto_egb: 4, quinto_egb: 5, sexto_egb: 6, septimo_egb: 7,
  octavo_egb: 8, noveno_egb: 9, decimo_egb: 10, primero_bgu: 11, segundo_bgu: 12, tercero_bgu: 13,
};

export interface NewFamilyRow {
  key: string;
  guardianName: string;
  academicYear: string;
  students: { name: string; grade: Grade; enrollmentId: string; enrollmentCode: string; status: EnrollmentStatus; nee: boolean }[];
  beca: number;
  /** Modelo «cliente nuevo» del equipo: probabilidad promedio de impago y nivel. */
  risk: { level: RiskLevel; probability: number; votes: number };
  /** Algún curso fuera de 8vo EGB–3ro BGU (lo que vio el modelo al entrenar): la predicción extrapola. */
  outOfRange: boolean;
  /** Récord de puntualidad real con sus pagos registrados (peor resultado del mes entre los hijos). */
  outcomes: MonthOutcome[];
  record: PunctualityRecord;
  paidCount: number;
}

/**
 * Familias matriculadas para el año siguiente (sin historial de pagos del año en curso): se evalúan con el modelo
 * «cliente nuevo» (perfil de la familia) y se muestra su récord con los pagos que ya registraron.
 */
export async function getNewFamilies(): Promise<NewFamilyRow[]> {
  const repo = getRepository();
  const today = nowISO().slice(0, 10);
  const enrollments = (await repo.listEnrollments({ limit: 100_000 }))
    .filter((e) => e.academicYear !== institution.currentYear && e.status !== "anulada" && e.status !== "retirada");
  const details = (await Promise.all(enrollments.map((e) => repo.getEnrollmentDetail(e.id)))).filter((d) => d !== null);

  const families = new Map<string, typeof details>();
  for (const d of details) {
    const key = d.guardian.code ?? d.guardian.id;
    families.set(key, [...(families.get(key) ?? []), d]);
  }

  const worst: MonthOutcome[] = ["impago", "atrasado", "pendiente", "puntual"];
  return [...families.entries()].map(([key, list]) => {
    const first = list[0]!;
    const beca = Math.max(...list.map((d) => d.student.scholarshipPct ?? 0));
    const hijos = list.map((d) => ({ grado: GRADE_NUM[d.enrollment.grade] ?? 8, nee: Boolean(d.student.specialNeeds?.trim()) }));
    const r = evaluateFamily({ hijos, beca });
    const byMonth = new Map<string, MonthOutcome[]>();
    for (const d of list) {
      for (const p of d.installments) {
        if (p.concept !== "pension" || p.status === "anulada") continue;
        byMonth.set(p.period, [...(byMonth.get(p.period) ?? []), classifyMonth(p, today)]);
      }
    }
    const outcomes = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, os]) => worst.find((o) => os.includes(o))!);
    return {
      key,
      guardianName: first.guardian.fullName,
      academicYear: first.enrollment.academicYear,
      students: list.map((d) => ({
        name: d.student.fullName, grade: d.enrollment.grade, enrollmentId: d.enrollment.id, enrollmentCode: d.enrollment.code,
        status: d.enrollment.status, nee: Boolean(d.student.specialNeeds?.trim()),
      })),
      beca,
      risk: { level: r.nivel, probability: r.promedio, votes: r.votosImpago },
      outOfRange: list.some((d) => (GRADE_NUM[d.enrollment.grade] ?? 0) < 8),
      outcomes,
      record: punctualityRecord(outcomes),
      paidCount: list.reduce((s, d) => s + d.installments.filter((i) => i.status === "pagada").length, 0),
    };
  }).sort((a, b) => b.risk.probability - a.risk.probability);
}
