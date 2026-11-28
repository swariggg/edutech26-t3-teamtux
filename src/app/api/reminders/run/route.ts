import { NextResponse } from "next/server";
import { getRepository } from "@/data";
import { buildReminder, sendReminder } from "@/lib/reminders";
import { notificationsEnabled, publicBaseUrl } from "@/lib/notifications";
import { isAdminRequest } from "@/lib/session";
import { timingSafeEqual } from "@/lib/auth";
import { env } from "@/lib/env";
import { nowISO } from "@/lib/clock";
import { clientIp, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Máximo de correos por corrida (protege la cuota de Gmail). */
const MAX_PER_RUN = 50;
/** Recordatorios automáticos: no repetir a la misma matrícula antes de este tiempo. */
const MIN_GAP_MS = 20 * 60 * 60_000;
/** Automático: solo cuotas que vencen en esta ventana o ya vencidas (la matrícula siempre). */
const DUE_WINDOW_DAYS = 5;

/**
 * Envía recordatorios de pago a todas las familias con correo registrado y cuotas pendientes.
 * - Botón del panel (sesión de administrador): envía a todas, sin esperar ventana (para la demo).
 * - n8n programado (cabecera x-webhook-secret): solo lo que vence pronto o ya venció, y no repite en 20 h.
 * Las familias del dataset no tienen correo: nunca se les escribe.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`reminders-run:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) return jsonError("Demasiadas solicitudes", 429, { retryAfter: rl.retryAfter });
  const admin = await isAdminRequest();
  const secret = req.headers.get("x-webhook-secret") ?? "";
  const scheduled = !admin && Boolean(env.n8nWebhookSecret) && timingSafeEqual(secret, env.n8nWebhookSecret ?? "");
  if (!admin && !scheduled) return jsonError("No autorizado", 401);
  if (!notificationsEnabled()) return jsonError("n8n no está configurado (N8N_OUTBOUND_WEBHOOK_URL).", 503);

  const repo = getRepository();
  const baseUrl = publicBaseUrl(req);
  // Familias que postularon en línea (el código REP-### es del dataset, sin correo).
  const candidates = (await repo.listEnrollments({ limit: 100_000 }))
    .filter((e) => e.status !== "anulada" && e.status !== "retirada" && !e.guardianKey?.startsWith("REP-"));
  const recent = scheduled
    ? new Set((await repo.listAuditLogs({ search: "notification.payment_reminder_sent", limit: 1000 }))
        .filter((l) => Date.parse(nowISO()) - Date.parse(l.at) < MIN_GAP_MS).map((l) => l.entityId))
    : new Set<string | undefined>();

  const sent: { code: string; kind: string; installment: string }[] = [];
  let failed = 0;
  for (const e of candidates) {
    if (sent.length >= MAX_PER_RUN) break;
    if (recent.has(e.id)) continue;
    const detail = await repo.getEnrollmentDetail(e.id);
    if (!detail) continue;
    const reminder = buildReminder(detail, baseUrl);
    if (!reminder) continue;
    if (scheduled && reminder.kind !== "matricula" && reminder.installment.days > DUE_WINDOW_DAYS) continue;
    const r = await sendReminder(repo, detail, reminder, scheduled ? "n8n (programado)" : "colecturia");
    if (r.delivered) sent.push({ code: reminder.enrollmentCode, kind: reminder.kind, installment: reminder.installment.description });
    else failed++;
  }
  return NextResponse.json({ ok: true, sent: sent.length, failed, details: sent });
}
