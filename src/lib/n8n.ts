import "server-only";
import { env } from "./env";

export type OutboundEvent = "application.created" | "application.status_changed" | "payment.received";

/** Envía un evento a n8n si N8N_OUTBOUND_WEBHOOK_URL está definido; si no, no hace nada. */
export async function emitEvent(event: OutboundEvent, data: Record<string, unknown>): Promise<void> {
  if (!env.n8nOutboundUrl) return;
  try {
    await fetch(env.n8nOutboundUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...(env.n8nWebhookSecret ? { "x-webhook-secret": env.n8nWebhookSecret } : {}) },
      body: JSON.stringify({ event, occurredAt: new Date().toISOString(), data }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("[n8n] no se pudo emitir", event, error instanceof Error ? error.message : error);
  }
}
