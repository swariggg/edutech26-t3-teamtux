import { NextResponse } from "next/server";
import { UploadUrlInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { documentPath, getDocStorage, verifyUploadToken } from "@/data/storage";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Paso 1 de la subida: valida el permiso (token de la solicitud), el tipo y el tamaño, y devuelve un enlace
 * firmado de un solo uso. El navegador sube el archivo directo al almacenamiento (no pasa por esta función).
 */
export async function POST(req: Request) {
  const rl = rateLimit(`doc-url:${clientIp(req)}`, 40, 10 * 60_000);
  if (!rl.ok) return jsonError("Demasiadas subidas. Intenta más tarde.", 429, { retryAfter: rl.retryAfter });
  const parsed = await parseBody(req, UploadUrlInput, 2_000);
  if ("response" in parsed) return parsed.response;
  const { token, kind, mimeType } = parsed.data;
  const applicationId = verifyUploadToken(token);
  if (!applicationId) return jsonError("El permiso de subida venció. Entrega los documentos en secretaría o vuelve a intentarlo.", 401);
  if (!(await getRepository().getApplication(applicationId))) return jsonError("Solicitud no encontrada", 404);
  try {
    const path = documentPath(applicationId, kind, mimeType);
    const { url, headers } = await getDocStorage().createUploadUrl(path, mimeType);
    return NextResponse.json({ url, headers, path }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[documents/upload-url]", error);
    return jsonError("No pudimos preparar la subida. Intenta de nuevo.", 500);
  }
}
