import { institution } from "@/content/institution";
import type { InstallmentConcept } from "@/domain/types";

export interface PlannedInstallment { concept: InstallmentConcept; period: string; description: string; amount: number; due_date: string }

/** Días que tiene la familia para pagar la matrícula desde la aprobación. */
export const ENROLLMENT_FEE_DAYS = 15;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Cuotas de una matrícula nueva: la matrícula (vence a los 15 días de aprobar) y las 10 pensiones del año lectivo
 * (septiembre a junio, vencen el día 10). Ej.: año 2026-2027 → pensiones 2026-09 … 2027-06.
 */
export function enrollmentPlan(academicYear: string, approvedAt: Date): PlannedInstallment[] {
  const { enrollment, monthly, months, dueDay } = institution.fees;
  const startYear = Number(academicYear.slice(0, 4));
  const feeDue = new Date(approvedAt.getTime() + ENROLLMENT_FEE_DAYS * 86_400_000);
  const plan: PlannedInstallment[] = [{
    concept: "matricula",
    period: `${approvedAt.getUTCFullYear()}-${pad(approvedAt.getUTCMonth() + 1)}`,
    description: `Matrícula ${academicYear}`,
    amount: enrollment,
    due_date: feeDue.toISOString().slice(0, 10),
  }];
  for (let i = 0; i < months; i++) {
    const m = 8 + i; // septiembre = índice 8
    const period = `${startYear + Math.floor(m / 12)}-${pad((m % 12) + 1)}`;
    plan.push({ concept: "pension", period, description: `Pensión ${period}`, amount: monthly, due_date: `${period}-${pad(dueDay)}` });
  }
  return plan;
}
