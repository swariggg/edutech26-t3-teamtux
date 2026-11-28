import { NextResponse } from "next/server";
import { AuditorInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { runAudit } from "@/ai/auditor";
import { logAudit } from "@/lib/audit";
import { isAdminRequest } from "@/lib/session";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!(await isAdminRequest())) return jsonError("No autorizado", 401);
  const raw = await req.json().catch(() => ({}));
  const input = AuditorInput.safeParse(raw ?? {});
  if (!input.success) return jsonError("Datos inválidos", 400);
  const repo = getRepository();
  const report = await runAudit(repo, input.data.scope);
  await logAudit(repo, { actor: "secretaria", action: "system.audit_run", entity: "system", details: { scope: input.data.scope, source: report.source, findings: report.findings.length } });
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
