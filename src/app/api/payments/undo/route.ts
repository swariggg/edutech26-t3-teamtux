import { NextResponse } from "next/server";
import { UndoDemoPaymentInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { isConflictError, isNotFoundError } from "@/data/repository";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { lookupBlocked, rateLimit, recordLookupFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Demo del récord de puntualidad: deshace un pago de DEMOSTRACIÓN de una pensión (vuelve a «sin pagar»).
 * Solo pagos con referencia «DEMO-…»; los pagos reales no se pueden deshacer. La familia debe identificarse.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`pay-undo:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) return jsonError("Demasiados intentos. Espera un momento.", 429, { retryAfter: rl.retryAfter });
  const parsed = await parseBody(req, UndoDemoPaymentInput, 2_000);
  if ("response" in parsed) return parsed.response;
  const { studentQuery, guardianDocument, installmentId } = parsed.data;
  if (lookupBlocked("pay", studentQuery)) return jsonError("Demasiados intentos fallidos para este estudiante. Intenta más tarde.", 429);
  const repo = getRepository();
  const found = await repo.findPaymentsForFamily(studentQuery, guardianDocument);
  if (!found) {
    recordLookupFailure("pay", studentQuery);
    return jsonError("No encontramos pagos con esos datos.", 404);
  }
  if (!found.installments.some((i) => i.id === installmentId)) return jsonError("Esa cuota no pertenece a esta matrícula.", 404);
  try {
    const ins = await repo.undoDemoPayment(installmentId, "familia (pago en línea demo)");
    return NextResponse.json({ ok: true, status: ins.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isNotFoundError(error)) return jsonError(error.message, 404);
    if (isConflictError(error)) return jsonError(error.message, 409);
    console.error("[payments/undo]", error);
    return jsonError("No se pudo deshacer el pago.", 500);
  }
}
