import type { ApplicationView, DashboardStats, EnrollmentView, InstallmentView } from "@/domain/types";
import { APPLICATION_STATUSES, applicationStatusMeta } from "@/domain/labels";
import { institution } from "@/content/institution";
import { formatMonth } from "@/domain/format";
import { now as clockNow } from "@/lib/clock";

const round = (n: number) => Math.round(n * 100) / 100;

export function computeDashboardStats(
  applications: ApplicationView[],
  enrollments: EnrollmentView[],
  installments: InstallmentView[],
  now = clockNow(),
): DashboardStats {
  const active = installments.filter((i) => i.status !== "anulada");
  const collected = active.reduce((s, i) => s + i.amountPaid, 0);
  const overdue = active.filter((i) => i.status === "vencida").reduce((s, i) => s + (i.amount - i.amountPaid), 0);
  const pending = active.filter((i) => i.status === "pendiente" || i.status === "parcial").reduce((s, i) => s + (i.amount - i.amountPaid), 0);
  const dueSoFar = active.filter((i) => new Date(i.dueDate) <= now).reduce((s, i) => s + i.amount, 0);
  const collectedDue = active.filter((i) => new Date(i.dueDate) <= now).reduce((s, i) => s + i.amountPaid, 0);

  const byStatus = APPLICATION_STATUSES.filter((s) => s !== "borrador").map((status) => ({
    status,
    label: applicationStatusMeta[status].label,
    count: applications.filter((a) => a.status === status).length,
  }));

  const byGrade = institution.grades
    .map((g) => ({ grade: g.id, label: g.label, count: enrollments.filter((e) => e.grade === g.id && e.status === "activa").length }))
    .filter((g) => g.count > 0);

  const months = new Map<string, { billed: number; collected: number }>();
  for (const i of active) {
    const m = i.dueDate.slice(0, 7);
    if (new Date(i.dueDate) > now) continue;
    const cur = months.get(m) ?? { billed: 0, collected: 0 };
    cur.billed += i.amount;
    cur.collected += i.amountPaid;
    months.set(m, cur);
  }
  const monthlyRevenue = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, v]) => ({ month, label: formatMonth(month), billed: round(v.billed), collected: round(v.collected) }));

  return {
    totals: {
      applications: applications.length,
      pendingReview: applications.filter((a) => ["enviada", "en_revision", "documentos_pendientes"].includes(a.status)).length,
      enrollmentsActive: enrollments.filter((e) => e.status === "activa").length,
      collected: round(collected),
      pending: round(pending),
      overdue: round(overdue),
      collectionRate: dueSoFar > 0 ? collectedDue / dueSoFar : 1,
    },
    applicationsByStatus: byStatus,
    enrollmentsByGrade: byGrade,
    collections: [
      { name: "Cobrado", value: round(collected) },
      { name: "Pendiente", value: round(pending) },
      { name: "Vencido", value: round(overdue) },
    ],
    monthlyRevenue,
  };
}
