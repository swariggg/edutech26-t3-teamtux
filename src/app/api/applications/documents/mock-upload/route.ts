import { NextResponse } from "next/server";
import { DOC_MAX_BYTES, DOC_MIME_TYPES } from "@/domain/schemas";
import { hasSupabase } from "@/lib/env";
import { hmac, memoryFiles, safeEqual } from "@/data/storage";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Solo modo demo (sin Supabase): recibe el archivo con un enlace firmado y lo guarda en memoria. */
export async function PUT(req: Request) {
  if (hasSupabase) return jsonError("No disponible", 404);
  const u = new URL(req.url);
  const path = u.searchParams.get("path") ?? "";
  const type = u.searchParams.get("type") ?? "";
  const exp = Number(u.searchParams.get("exp") ?? 0);
  const sig = u.searchParams.get("sig") ?? "";
  if (!path || exp < Date.now() || !safeEqual(sig, hmac(`upload:${path}:${type}:${exp}`))) return jsonError("Enlace inválido o vencido", 403);
  if (memoryFiles.has(path)) return jsonError("El archivo ya existe", 409);
  if (!(DOC_MIME_TYPES as readonly string[]).includes(type)) return jsonError("Formato no permitido", 415);
  if (Number(req.headers.get("content-length") ?? 0) > DOC_MAX_BYTES) return jsonError("El archivo supera 5 MB", 413);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > DOC_MAX_BYTES) return jsonError("Tamaño no permitido", 413);
  memoryFiles.set(path, { bytes, mimeType: type });
  return NextResponse.json({ ok: true });
}
