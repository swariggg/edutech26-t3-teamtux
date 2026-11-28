import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

export const jsonError = (error: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });

/** Lee y valida el cuerpo JSON. Devuelve los datos o una respuesta de error lista para retornar. */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>, maxBytes = 64_000): Promise<{ data: T } | { response: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { response: jsonError("Solicitud demasiado grande", 413) };
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return { response: jsonError("Solicitud demasiado grande", 413) };
    raw = JSON.parse(text);
  } catch {
    return { response: jsonError("JSON inválido", 400) };
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    return { response: jsonError("Datos inválidos", 400, { issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }) };
  }
  return { data: r.data };
}

/**
 * IP del cliente para limitar abusos. OJO: confiar en x-forwarded-for solo es seguro si el despliegue
 * (Vercel, proxy inverso) la sobrescribe; si no, el cliente puede falsificarla. Por eso las búsquedas públicas
 * también limitan intentos fallidos por identificador (ver lookupBlocked en lib/rate-limit.ts).
 */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
