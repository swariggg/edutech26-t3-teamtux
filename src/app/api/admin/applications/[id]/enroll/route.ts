import { NextResponse, after } from "next/server";
import { getRepository } from "@/data";
import { isConflictError, isNotFoundError } from "@/data/repository";
import { notifyEnrollment, publicBaseUrl } from "@/lib/notifications";
import { isAdminRequest } from "@/lib/session";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Crea la matrícula de una solicitud aprobada (reintento manual; aprobar ya la crea). Idempotente. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/applications/[id]/enroll">) {
  if (!(await isAdminRequest())) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const repo = getRepository();
  try {
    const { enrollment, created } = await repo.enrollApplication(id, "secretaria");
    if (created) {
      const app = await repo.getApplication(id);
      const baseUrl = publicBaseUrl(req);
      if (app) after(() => notifyEnrollment(repo, app, enrollment, baseUrl));
    }
    return NextResponse.json({ ok: true, enrollmentCode: enrollment.code, created });
  } catch (error) {
    if (isNotFoundError(error)) return jsonError(error.message, 404);
    if (isConflictError(error)) return jsonError(error.message, 409);
    console.error("[admin/enroll]", error);
    return jsonError("No se pudo crear la matrícula", 500);
  }
}
