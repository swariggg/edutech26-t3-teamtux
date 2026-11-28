import "server-only";
import type { Repository } from "@/data/repository";
import type { ApplicationView, Enrollment } from "@/domain/types";
import { formatDate, formatMoney } from "@/domain/format";
import { ENROLLMENT_FEE_DAYS } from "@/data/enrollment-plan";
import { gradeLabel, institution } from "@/content/institution";
import { applicationStatusMeta } from "@/domain/labels";
import { logAudit } from "./audit";
import { env } from "./env";
import { emitEvent } from "./n8n";

/** true si hay un flujo de n8n configurado que entregue los avisos (correo / WhatsApp). */
export const notificationsEnabled = () => Boolean(env.n8nOutboundUrl);

/**
 * ¿Se le puede escribir a este correo? Los datos de demostración usan el dominio reservado «.invalid»
 * (RFC 2606, no existe en internet): esas familias se ven en el panel pero nunca reciben correos.
 */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  const e = email?.trim().toLowerCase() ?? "";
  return e.includes("@") && !e.endsWith(".invalid");
}

/** r***@gmail.com — para la bitácora: deja rastro del envío sin guardar el correo completo. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return domain ? `${user.slice(0, 1)}***@${domain}` : "***";
}

/** URL pública de la app: APP_URL o, si falta, el origen de la petición. */
export function publicBaseUrl(req: Request): string {
  return env.appUrl ?? new URL(req.url).origin;
}

/**
 * Pide a n8n que envíe el/los código(s) de seguimiento al representante (correo y, si hay teléfono, WhatsApp).
 * - reason "created": justo después de enviar la solicitud.
 * - reason "resend": la familia lo pidió desde «¿Olvidaste tu código?».
 * Todas las solicitudes deben ser del mismo representante. Nunca lanza: un fallo de envío no rompe el flujo.
 */
export async function notifyTrackingCodes(repo: Repository, apps: ApplicationView[], reason: "created" | "resend", baseUrl: string): Promise<void> {
  const guardian = apps[0]?.guardian;
  if (!isDeliverableEmail(guardian?.email)) return;
  const applications = apps.map((a) => ({
    trackingCode: a.trackingCode,
    studentFirstName: a.student.fullName.split(" ")[0],
    grade: gradeLabel(a.gradeApplied),
    status: applicationStatusMeta[a.status].label,
    academicYear: a.academicYear,
  }));
  const result = await emitEvent("tracking_code.notify", {
    reason,
    guardian: { name: guardian.fullName, email: guardian.email, phone: guardian.phone || null },
    applications,
    institution: { name: institution.name, email: institution.contact.secretaria.email, phone: institution.contact.secretaria.phone },
    // Enlace completo (n8n Cloud no permite leer variables de entorno en los nodos). Con un solo código, va precargado.
    statusUrl: `${baseUrl}/estado${applications.length === 1 ? `?codigo=${encodeURIComponent(applications[0]!.trackingCode)}` : ""}`,
  });
  await logAudit(repo, {
    actor: "sistema",
    action: reason === "created" ? "notification.tracking_code_sent" : "notification.tracking_code_resent",
    entity: "application",
    entityId: apps[0]!.id,
    details: {
      to: maskEmail(guardian.email),
      codes: applications.length,
      delivery: result.delivered ? "n8n ok" : `no enviado (${result.detail})`,
    },
  });
}

/**
 * Avisa a la familia que su solicitud fue aprobada y ya tiene matrícula: código MAT, valor y plazo de la matrícula,
 * pensiones y enlace directo a /pagos. Nunca lanza.
 */
export async function notifyEnrollment(repo: Repository, app: ApplicationView, enrollment: Enrollment, baseUrl: string): Promise<void> {
  const guardian = app.guardian;
  if (!isDeliverableEmail(guardian?.email)) return;
  const { enrollment: fee, monthly, months, dueDay } = institution.fees;
  const feeDue = new Date(Date.parse(enrollment.enrolledAt) + ENROLLMENT_FEE_DAYS * 86_400_000).toISOString();
  const result = await emitEvent("enrollment.created", {
    guardian: { name: guardian.fullName, email: guardian.email, phone: guardian.phone || null },
    student: { firstName: app.student.fullName.split(" ")[0], grade: gradeLabel(app.gradeApplied) },
    trackingCode: app.trackingCode,
    enrollmentCode: enrollment.code,
    academicYear: enrollment.academicYear,
    fees: {
      enrollment: formatMoney(fee),
      enrollmentDue: formatDate(feeDue),
      monthly: formatMoney(monthly),
      months,
      dueDay,
    },
    institution: { name: institution.name, email: institution.contact.secretaria.email, phone: institution.contact.secretaria.phone },
    // Con el código de matrícula y la cédula del representante la familia ve sus pagos y su récord de puntualidad.
    paymentsUrl: `${baseUrl}/pagos?estudiante=${encodeURIComponent(enrollment.code)}`,
    statusUrl: `${baseUrl}/estado?codigo=${encodeURIComponent(app.trackingCode)}`,
  });
  await logAudit(repo, {
    actor: "sistema",
    action: "notification.enrollment_sent",
    entity: "enrollment",
    entityId: enrollment.id,
    details: { to: maskEmail(guardian.email), code: enrollment.code, delivery: result.delivered ? "n8n ok" : `no enviado (${result.detail})` },
  });
}
