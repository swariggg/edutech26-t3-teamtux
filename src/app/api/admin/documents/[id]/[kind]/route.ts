import { NextResponse } from "next/server";
import { getRepository } from "@/data";
import { getDocStorage } from "@/data/storage";
import { isAdminRequest } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Ver un documento (solo personal). Supabase: redirige a un enlace de 60 s. Demo: sirve el archivo. Queda en la bitácora. */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/documents/[id]/[kind]">) {
  if (!(await isAdminRequest())) return jsonError("No autorizado", 401);
  const { id, kind } = await ctx.params;
  const repo = getRepository();
  const app = await repo.getApplication(id);
  const file = app?.documents.find((d) => d.kind === kind)?.file;
  if (!app || !file) return jsonError("Documento no encontrado", 404);
  await logAudit(repo, { actor: "admin", action: "document.viewed", entity: "application", entityId: id, details: { kind } });
  const storage = getDocStorage();
  const signed = await storage.signedDownloadUrl(file.path, 60);
  if (signed) return NextResponse.redirect(signed, { headers: { "Cache-Control": "no-store" } });
  const data = await storage.download(file.path);
  if (!data) return jsonError("Archivo no disponible", 404);
  return new NextResponse(Buffer.from(data.bytes), {
    headers: {
      "Content-Type": data.mimeType,
      "Content-Disposition": `inline; filename="${kind}.${file.mimeType === "application/pdf" ? "pdf" : "img"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
    },
  });
}
