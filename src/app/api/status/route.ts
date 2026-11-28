import { NextResponse } from "next/server";
import { StatusLookupInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { gradeLabel } from "@/content/institution";
import type { ApplicationStatus } from "@/domain/types";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { lookupBlocked, rateLimit, recordLookupFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const NEXT_STEPS: Record<ApplicationStatus, string> = {
  borrador: "Completa y envía tu solicitud.",
  enviada: "Secretaría revisará tu solicitud en los próximos días hábiles.",
  en_revision: "Estamos revisando tus documentos. Te contactaremos si falta algo.",
  documentos_pendientes: "Entrega los documentos pendientes en secretaría o por correo para continuar.",
  entrevista_agendada: "Asiste a la entrevista con el estudiante en la fecha indicada.",
  aprobada: "¡Felicidades! Acércate a colecturía o paga la matrícula para completar la inscripción.",
  rechazada: "Lamentamos no poder ofrecer un cupo. Puedes escribir a secretaría para más información.",
  lista_espera: "Estás en lista de espera. Te avisaremos si se libera un cupo.",
};

export async function POST(req: Request) {
  const rl = rateLimit(`status:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return jsonError("Demasiados intentos. Espera un momento.", 429, { retryAfter: rl.retryAfter });
  const parsed = await parseBody(req, StatusLookupInput, 2_000);
  if ("response" in parsed) return parsed.response;
  const { trackingCode, guardianDocument } = parsed.data;
  if (lookupBlocked("status", trackingCode)) return jsonError("Demasiados intentos fallidos para este código. Intenta más tarde o escribe a secretaría.", 429);
  const app = await getRepository().findApplicationByTracking(trackingCode, guardianDocument);
  if (!app) {
    recordLookupFailure("status", trackingCode);
    return jsonError("No encontramos una solicitud con esos datos. Revisa el código y la cédula.", 404);
  }
  // Respuesta mínima: sin datos de contacto, cédulas ni notas internas.
  return NextResponse.json({
    trackingCode: app.trackingCode,
    studentFirstName: app.student.fullName.split(" ")[0],
    grade: gradeLabel(app.gradeApplied),
    status: app.status,
    submittedAt: app.submittedAt,
    interviewAt: app.status === "entrevista_agendada" ? app.interviewAt : undefined,
    // Sin notas: el historial puede tener notas internas del personal o de n8n.
    history: app.history.map((h) => ({ status: h.status, at: h.at })),
    missingDocuments: app.documents.filter((d) => !d.received).map((d) => d.kind),
    nextSteps: NEXT_STEPS[app.status],
  }, { headers: { "Cache-Control": "no-store" } });
}
