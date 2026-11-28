import { NextResponse } from "next/server";
import { DOC_MAX_BYTES, DOC_MIME_TYPES, UploadCompleteInput } from "@/domain/schemas";
import type { DocumentKind } from "@/domain/types";
import { getRepository } from "@/data";
import { getDocStorage, verifyUploadToken } from "@/data/storage";
import { nowISO } from "@/lib/clock";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Paso 2: confirma que el archivo llegó al almacenamiento (tamaño y tipo reales) y lo adjunta a la solicitud. */
export async function POST(req: Request) {
  const rl = rateLimit(`doc-done:${clientIp(req)}`, 40, 10 * 60_000);
  if (!rl.ok) return jsonError("Demasiadas subidas. Intenta más tarde.", 429, { retryAfter: rl.retryAfter });
  const parsed = await parseBody(req, UploadCompleteInput, 2_000);
  if ("response" in parsed) return parsed.response;
  const { token, kind, path, fileName } = parsed.data;
  const applicationId = verifyUploadToken(token);
  if (!applicationId) return jsonError("El permiso de subida venció.", 401);
  // La ruta debe ser de ESTA solicitud y de ESTE tipo de documento (no se aceptan rutas ajenas).
  if (!path.startsWith(`${applicationId}/${kind}-`) || path.includes("..")) return jsonError("Ruta de archivo inválida", 400);
  const info = await getDocStorage().stat(path);
  if (!info) return jsonError("No encontramos el archivo subido. Intenta de nuevo.", 404);
  const mimeType = info.mimeType.split(";")[0]!.trim();
  if (!(DOC_MIME_TYPES as readonly string[]).includes(mimeType) || info.size <= 0 || info.size > DOC_MAX_BYTES) {
    return jsonError("Archivo no permitido", 400);
  }
  try {
    await getRepository().attachDocument(applicationId, kind as DocumentKind, { path, name: fileName, mimeType, size: info.size, uploadedAt: nowISO() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[documents/complete]", error);
    return jsonError("No pudimos registrar el documento.", 500);
  }
}
