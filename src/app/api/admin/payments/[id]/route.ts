import { NextResponse } from "next/server";
import { MarkPaidInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { ConflictError, NotFoundError } from "@/data/repository";
import type { PaymentMethod } from "@/domain/types";
import { emitEvent } from "@/lib/n8n";
import { isAdminRequest } from "@/lib/session";
import { jsonError, parseBody } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/payments/[id]">) {
  if (!(await isAdminRequest())) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const parsed = await parseBody(req, MarkPaidInput, 4_000);
  if ("response" in parsed) return parsed.response;
  const repo = getRepository();
  try {
    const method = parsed.data.method as PaymentMethod;
    // La bitácora la escribe el repositorio en la misma operación del pago.
    const { installment: ins, applied } = await repo.registerPayment(id, { ...parsed.data, method, by: "colecturia" });
    if (applied) void emitEvent("payment.received", { installmentId: id, amount: parsed.data.amount, method, status: ins.status });
    return NextResponse.json({ ok: true, applied, status: ins.status, amountPaid: ins.amountPaid });
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError(error.message, 404);
    if (error instanceof ConflictError) return jsonError(error.message, 409);
    console.error("[admin/payments]", error);
    return jsonError("No se pudo registrar el pago", 500);
  }
}
