import "server-only";
import { env } from "./env";

export type OutboundEvent = "application.created" | "application.status_changed" | "payment.received" | "tracking_code.notify" | "enrollment.created" | "payment.reminder";

/** Resultado de un envío a n8n: "sin_n8n" si no está configurado, "ok", o el error (HTTP o de red). */
export type EmitResult = { delivered: true; detail: "ok" } | { delivered: false; detail: string };

/** Envía un evento a n8n si N8N_OUTBOUND_WEBHOOK_URL está definido. Nunca lanza; devuelve qué pasó. */
export async function emitEvent(event: OutboundEvent, data: Record<string, unknown>): Promise<EmitResult> {
  if (!env.n8nOutboundUrl) return { delivered: false, detail: "sin_n8n" };
  const body = JSON.stringify({ event, occurredAt: new Date().toISOString(), data });
  // Un reintento ante fallos de red (DNS / conexión), no ante respuestas HTTP: n8n podría duplicar el envío.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(env.n8nOutboundUrl, {
        method: "POST",
        headers: { "content-type": "application/json", ...(env.n8nWebhookSecret ? { "x-webhook-secret": env.n8nWebhookSecret } : {}) },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return { delivered: true, detail: "ok" };
      // p. ej. 404 = el flujo no está publicado en n8n; 403 = secreto distinto al de la credencial Header Auth.
      const text = (await res.text().catch(() => "")).slice(0, 200);
      console.error(`[n8n] ${event} rechazado: HTTP ${res.status} ${text}`);
      return { delivered: false, detail: `http_${res.status}` };
    } catch (error) {
      const cause = error instanceof Error && error.cause instanceof Error ? ` (${(error.cause as NodeJS.ErrnoException).code ?? ""} ${error.cause.message})` : "";
      console.error(`[n8n] intento ${attempt} fallido para ${event}: ${error instanceof Error ? error.message : String(error)}${cause}`);
      if (attempt === 2) return { delivered: false, detail: "sin_conexion" };
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { delivered: false, detail: "sin_conexion" };
}
