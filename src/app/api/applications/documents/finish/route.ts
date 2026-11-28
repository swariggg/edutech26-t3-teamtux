import { NextResponse, after } from "next/server";
import { UploadFinishInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { verifyUploadToken } from "@/data/storage";
import { reviewApplicationDocuments } from "@/ai/document-review";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// La revisión con IA corre después de responder; con varios PDF puede tardar más de un minuto.
export const maxDuration = 300;

/** Paso 3: la familia terminó de subir. La revisión con IA corre en segundo plano (no hace esperar a la familia). */
export async function POST(req: Request) {
  const rl = rateLimit(`doc-finish:${clientIp(req)}`, 10, 10 * 60_000);
  if (!rl.ok) return jsonError("Demasiadas solicitudes. Intenta más tarde.", 429, { retryAfter: rl.retryAfter });
  const parsed = await parseBody(req, UploadFinishInput, 1_000);
  if ("response" in parsed) return parsed.response;
  const applicationId = verifyUploadToken(parsed.data.token);
  if (!applicationId) return jsonError("El permiso de subida venció.", 401);
  // Una revisión por solicitud cada 10 minutos (cada revisión consume tokens del modelo).
  if (rateLimit(`doc-review:${applicationId}`, 1, 10 * 60_000).ok) {
    const repo = getRepository();
    after(async () => {
      try {
        await reviewApplicationDocuments(repo, applicationId);
      } catch (error) {
        console.error("[documents/finish] revisión fallida", error);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
