import { NextResponse, after } from "next/server";
import { ApplicationInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { isConflictError } from "@/data/repository";
import { logAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/n8n";
import { notifyTrackingCodes, publicBaseUrl } from "@/lib/notifications";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = rateLimit(`apply:${clientIp(req)}`, 5, 10 * 60_000);
  if (!rl.ok) return jsonError("Demasiadas solicitudes. Intenta más tarde.", 429, { retryAfter: rl.retryAfter });
  const parsed = await parseBody(req, ApplicationInput);
  if ("response" in parsed) return parsed.response;
  const repo = getRepository();
  try {
    const app = await repo.createApplication(parsed.data);
    await logAudit(repo, { actor: "familia", action: "application.created", entity: "application", entityId: app.id, details: { trackingCode: app.trackingCode, grade: app.gradeApplied } });
    void emitEvent("application.created", { applicationId: app.id, trackingCode: app.trackingCode, grade: app.gradeApplied });
    // Copia del código al correo / WhatsApp del representante (vía n8n), después de responder: no demora el envío del formulario.
    const baseUrl = publicBaseUrl(req);
    after(() => notifyTrackingCodes(repo, [app], "created", baseUrl));
    return NextResponse.json({ trackingCode: app.trackingCode }, { status: 201 });
  } catch (error) {
    // Mensaje genérico en conflictos: no revela si la cédula del estudiante ya existe.
    if (isConflictError(error)) return jsonError(error.message, 409);
    console.error("[applications] error", error);
    return jsonError("No pudimos registrar la solicitud. Intenta de nuevo.", 500);
  }
}
