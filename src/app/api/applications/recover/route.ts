import { NextResponse, after } from "next/server";
import { RecoverCodeInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { notifyTrackingCodes, publicBaseUrl } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Respuesta idéntica exista o no la cédula: no revela si una familia tiene solicitudes. */
const GENERIC = {
  ok: true,
  message: "Si la cédula corresponde a una solicitud, enviaremos los códigos de seguimiento al correo registrado en unos minutos. Revisa también la carpeta de spam.",
};

/**
 * «¿Olvidaste tu código?»: reenvía los códigos al correo registrado del representante (vía n8n).
 * El código nunca se muestra en pantalla: solo lo recibe quien controla ese correo.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`recover:${clientIp(req)}`, 5, 10 * 60_000);
  if (!rl.ok) return jsonError("Demasiadas solicitudes. Intenta más tarde.", 429, { retryAfter: rl.retryAfter });
  const parsed = await parseBody(req, RecoverCodeInput, 1_000);
  if ("response" in parsed) return parsed.response;
  const { guardianDocument } = parsed.data;

  // Límite por cédula (independiente de la IP): evita usar el formulario para llenar de correos a una familia.
  // Si se excede, se responde igual que siempre, sin enviar nada.
  if (!rateLimit(`recover-doc:${guardianDocument}`, 3, 60 * 60_000).ok) return NextResponse.json(GENERIC);

  try {
    const repo = getRepository();
    const apps = await repo.listApplicationsByGuardianDocument(guardianDocument);
    // Después de responder: el tiempo de respuesta no revela si la cédula tiene solicitudes.
    const baseUrl = publicBaseUrl(req);
    if (apps.length > 0) after(() => notifyTrackingCodes(repo, apps, "resend", baseUrl));
  } catch (error) {
    console.error("[recover] error", error);
  }
  return NextResponse.json(GENERIC);
}
