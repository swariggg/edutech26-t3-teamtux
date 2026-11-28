import { NextResponse } from "next/server";
import { StatusChangeInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { isNotFoundError } from "@/data/repository";
import type { ApplicationStatus } from "@/domain/types";
import { logAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/n8n";
import { isAdminRequest } from "@/lib/session";
import { jsonError, parseBody } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/applications/[id]/status">) {
  if (!(await isAdminRequest())) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const parsed = await parseBody(req, StatusChangeInput, 4_000);
  if ("response" in parsed) return parsed.response;
  const repo = getRepository();
  try {
    const before = await repo.getApplication(id);
    if (!before) return jsonError("Solicitud no encontrada", 404);
    const status = parsed.data.status as ApplicationStatus;
    const app = await repo.updateApplicationStatus(id, status, "secretaria", parsed.data.note);
    await logAudit(repo, { actor: "secretaria", action: "application.status_changed", entity: "application", entityId: id, details: { trackingCode: app.trackingCode, from: before.status, to: status, note: parsed.data.note } });
    void emitEvent("application.status_changed", { applicationId: id, trackingCode: app.trackingCode, from: before.status, to: status });
    return NextResponse.json({ ok: true, status: app.status });
  } catch (error) {
    if (isNotFoundError(error)) return jsonError(error.message, 404);
    console.error("[admin/status]", error);
    return jsonError("No se pudo actualizar", 500);
  }
}
