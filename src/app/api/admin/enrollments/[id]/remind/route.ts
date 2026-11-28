import { NextResponse } from "next/server";
import { getRepository } from "@/data";
import { buildReminder, sendReminder } from "@/lib/reminders";
import { isDeliverableEmail, notificationsEnabled, publicBaseUrl } from "@/lib/notifications";
import { isAdminRequest } from "@/lib/session";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Colecturía envía el recordatorio de la próxima cuota sin pagar de esta matrícula (vía n8n). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/enrollments/[id]/remind">) {
  if (!(await isAdminRequest())) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const rl = rateLimit(`remind:${id}`, 6, 60_000);
  if (!rl.ok) return jsonError("Espera un momento antes de volver a enviar el recordatorio.", 429, { retryAfter: rl.retryAfter });
  const repo = getRepository();
  const detail = await repo.getEnrollmentDetail(id);
  if (!detail) return jsonError("Matrícula no encontrada", 404);
  if (!isDeliverableEmail(detail.guardian.email)) return jsonError("El representante no tiene un correo real registrado (los datos de demostración no reciben correos).", 409);
  const reminder = buildReminder(detail, publicBaseUrl(req));
  if (!reminder) return jsonError("No hay cuotas pendientes: nada que recordar.", 409);
  if (!notificationsEnabled()) return jsonError("n8n no está configurado (N8N_OUTBOUND_WEBHOOK_URL): el correo no se puede enviar.", 503);
  const result = await sendReminder(repo, detail, reminder, "colecturia");
  if (!result.delivered) return jsonError(`n8n no aceptó el recordatorio (${result.detail}).`, 502);
  return NextResponse.json({ ok: true, kind: reminder.kind, installment: reminder.installment.description });
}
