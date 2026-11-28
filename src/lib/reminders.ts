import "server-only";
import type { Repository } from "@/data/repository";
import type { EnrollmentDetail } from "@/domain/types";
import { formatDate, formatMoney, formatMonth } from "@/domain/format";
import { PUNCTUALITY_RULES, classifyMonth, punctualityRecord } from "@/domain/loyalty";
import { gradeLabel, institution } from "@/content/institution";
import { logAudit } from "./audit";
import { nowISO } from "./clock";
import { emitEvent } from "./n8n";
import { isDeliverableEmail, maskEmail } from "./notifications";

/**
 * Recordatorios de pago: siempre sobre LA PRÓXIMA cuota sin pagar de la matrícula, así el mensaje se adapta a lo
 * que la familia ya pagó (matrícula → pensión del mes siguiente…) y a su récord de puntualidad / beca.
 * La app arma los datos y n8n redacta y envía el correo (evento «payment.reminder»).
 */
export type ReminderKind = "matricula" | "por_vencer" | "vencida" | "mora";

export interface PaymentReminder {
  kind: ReminderKind;
  guardian: { name: string; email: string; phone: string | null };
  student: { firstName: string; grade: string };
  enrollmentCode: string;
  installment: { description: string; month: string | null; amount: string; dueDate: string; days: number };
  record: { pct: number; missing: number; onTrack: boolean; earned: boolean; unpaid: number };
  scholarship: { minPct: number; discountPct: number };
  institution: { name: string; email: string; phone: string };
  paymentsUrl: string;
}

const DAY = 86_400_000;
/** Días de mora a partir de los cuales se propone un plan de pagos (política de la institución). */
const MORA_DAYS = 30;

/** Datos del recordatorio de la próxima cuota sin pagar, o null si no hay nada pendiente o la familia no tiene correo. */
export function buildReminder(d: EnrollmentDetail, baseUrl: string): PaymentReminder | null {
  if (!isDeliverableEmail(d.guardian.email)) return null;
  const today = nowISO().slice(0, 10);
  const next = d.installments
    .filter((i) => i.status !== "pagada" && i.status !== "anulada")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (!next) return null;
  const pensions = d.installments.filter((i) => i.concept === "pension" && i.status !== "anulada").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const r = punctualityRecord(pensions.map((i) => classifyMonth(i, today)));
  const days = Math.round((Date.parse(next.dueDate.slice(0, 10)) - Date.parse(today)) / DAY);
  const kind: ReminderKind = next.concept === "matricula" ? "matricula" : days >= 0 ? "por_vencer" : -days > MORA_DAYS ? "mora" : "vencida";
  return {
    kind,
    guardian: { name: d.guardian.fullName, email: d.guardian.email, phone: d.guardian.phone || null },
    student: { firstName: d.student.fullName.split(" ")[0] ?? d.student.fullName, grade: gradeLabel(d.enrollment.grade) },
    enrollmentCode: d.enrollment.code,
    installment: {
      description: next.description,
      month: next.concept === "pension" ? formatMonth(next.period) : null,
      amount: formatMoney(Math.round((next.amount - next.amountPaid) * 100) / 100),
      dueDate: formatDate(next.dueDate),
      days,
    },
    record: { pct: r.recordPct, missing: r.missingPct, onTrack: r.scholarshipOnTrack, earned: r.scholarshipEarned, unpaid: r.unpaid },
    scholarship: { minPct: PUNCTUALITY_RULES.scholarshipMinPct, discountPct: PUNCTUALITY_RULES.scholarshipDiscountPct },
    institution: { name: institution.name, email: institution.contact.secretaria.email, phone: institution.contact.secretaria.phone },
    paymentsUrl: `${baseUrl}/pagos?estudiante=${encodeURIComponent(d.enrollment.code)}`,
  };
}

/** Envía el recordatorio a n8n y deja rastro en la bitácora (correo enmascarado). Nunca lanza. */
export async function sendReminder(repo: Repository, d: EnrollmentDetail, reminder: PaymentReminder, actor: string): Promise<{ delivered: boolean; detail: string }> {
  const result = await emitEvent("payment.reminder", reminder as unknown as Record<string, unknown>);
  await logAudit(repo, {
    actor,
    action: "notification.payment_reminder_sent",
    entity: "enrollment",
    entityId: d.enrollment.id,
    details: {
      to: maskEmail(reminder.guardian.email),
      code: reminder.enrollmentCode,
      kind: reminder.kind,
      installment: reminder.installment.description,
      delivery: result.delivered ? "n8n ok" : `no enviado (${result.detail})`,
    },
  });
  return result;
}
