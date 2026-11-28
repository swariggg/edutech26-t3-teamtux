import { NextResponse } from "next/server";
import { getRepository } from "@/data";
import { reviewApplicationDocuments } from "@/ai/document-review";
import { isAdminRequest } from "@/lib/session";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** El personal vuelve a ejecutar la revisión de documentos con IA (por ejemplo, tras subir un archivo corregido). */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/applications/[id]/review">) {
  if (!(await isAdminRequest())) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const rl = rateLimit(`admin-review:${id}`, 3, 10 * 60_000);
  if (!rl.ok) return jsonError("Espera unos minutos antes de volver a analizar esta solicitud.", 429, { retryAfter: rl.retryAfter });
  try {
    const review = await reviewApplicationDocuments(getRepository(), id);
    if (!review) return jsonError("Solicitud no encontrada", 404);
    return NextResponse.json({ ok: true, source: review.source });
  } catch (error) {
    console.error("[admin/review]", error);
    return jsonError("No se pudo completar la revisión", 500);
  }
}
