import { NextResponse } from "next/server";
import { N8nEvent } from "@/domain/schemas";
import { getRepository } from "@/data";
import type { ApplicationStatus, PaymentMethod } from "@/domain/types";
import { ConflictError, NotFoundError } from "@/data/repository";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { timingSafeEqual } from "@/lib/auth";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = rateLimit(`n8n:${clientIp(req)}`, 120, 60_000);
  if (!rl.ok) return jsonError("Demasiadas solicitudes", 429, { retryAfter: rl.retryAfter });
  // Sin N8N_WEBHOOK_SECRET el webhook está deshabilitado en TODOS los entornos (también en desarrollo).
  // TODO: firma HMAC del cuerpo + marca de tiempo para evitar repeticiones.
  if (!env.n8nWebhookSecret) return jsonError("Webhook deshabilitado: configura N8N_WEBHOOK_SECRET", 401);
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!timingSafeEqual(provided, env.n8nWebhookSecret)) return jsonError("No autorizado", 401);

  const parsed = await parseBody(req, N8nEvent, 16_000);
  if ("response" in parsed) return parsed.response;
  const ev = parsed.data;
  const repo = getRepository();
  try {
    switch (ev.type) {
      case "application.status_update": {
        let id = ev.applicationId;
        if (!id && ev.trackingCode) id = (await repo.findApplicationByCode(ev.trackingCode))?.id;
        if (!id) return jsonError("Solicitud no encontrada", 404);
        const app = await repo.updateApplicationStatus(id, ev.status as ApplicationStatus, "n8n", ev.note);
        await logAudit(repo, { actor: "n8n", action: "application.status_changed", entity: "application", entityId: id, details: { trackingCode: app.trackingCode, to: ev.status } });
        break;
      }
      case "payment.registered": {
        // Idempotente por referencia; la bitácora la escribe el repositorio.
        const { applied } = await repo.registerPayment(ev.installmentId, { amount: ev.amount, method: ev.method as PaymentMethod, reference: ev.reference, by: "n8n" });
        return NextResponse.json({ ok: true, applied });
      }
      case "reminder.sent": {
        await logAudit(repo, { actor: "n8n", action: "reminder.sent", entity: "installment", entityId: ev.installmentId, details: { channel: ev.channel, reportedSentAt: ev.sentAt } });
        break;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError(error.message, 404);
    if (error instanceof ConflictError) return jsonError(error.message, 409);
    console.error("[webhook n8n]", error);
    return jsonError("Error procesando el evento", 500);
  }
}
