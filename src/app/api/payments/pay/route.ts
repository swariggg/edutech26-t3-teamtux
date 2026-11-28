import { NextResponse } from "next/server";
import { PayOnlineInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { isConflictError, isNotFoundError } from "@/data/repository";
import { emitEvent } from "@/lib/n8n";
import { now } from "@/lib/clock";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { lookupBlocked, rateLimit, recordLookupFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

/**
 * Fecha del pago de demostración. Puntual: hoy si aún no vence; si ya venció, 3 días antes del vencimiento.
 * Atrasado: hoy si ya venció; si aún no vence, 7 días después del vencimiento.
 */
function demoPaidAt(dueDate: string, mode: "puntual" | "atrasado", now: Date): string {
  const due = Date.parse(`${dueDate.slice(0, 10)}T15:00:00Z`);
  const overdue = now.toISOString().slice(0, 10) > dueDate.slice(0, 10);
  if (mode === "puntual") return overdue ? new Date(due - 3 * DAY).toISOString() : now.toISOString();
  return overdue ? now.toISOString() : new Date(due + 7 * DAY).toISOString();
}

/**
 * Pago en línea de DEMOSTRACIÓN: no hay pasarela ni se cobra dinero. Registra el pago completo de la cuota
 * como «tarjeta» y referencia «DEMO-…», con la misma operación atómica que usa colecturía (bitácora + idempotencia).
 * Para mostrar el récord de puntualidad, la familia elige si el pago cuenta como puntual o atrasado (fecha simulada).
 * La familia debe volver a identificarse (estudiante/matrícula + representante) y solo puede pagar cuotas
 * de esa matrícula.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`pay-online:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) return jsonError("Demasiados intentos. Espera un momento.", 429, { retryAfter: rl.retryAfter });
  const parsed = await parseBody(req, PayOnlineInput, 2_000);
  if ("response" in parsed) return parsed.response;
  const { studentQuery, guardianDocument, installmentId, idempotencyKey, mode } = parsed.data;
  if (lookupBlocked("pay", studentQuery)) return jsonError("Demasiados intentos fallidos para este estudiante. Intenta más tarde o escribe a colecturía.", 429);
  const repo = getRepository();
  const found = await repo.findPaymentsForFamily(studentQuery, guardianDocument);
  if (!found) {
    recordLookupFailure("pay", studentQuery);
    return jsonError("No encontramos pagos con esos datos.", 404);
  }
  const ins = found.installments.find((i) => i.id === installmentId);
  if (!ins) return jsonError("Esa cuota no pertenece a esta matrícula.", 404);
  const owed = Math.round((ins.amount - ins.amountPaid) * 100) / 100;
  if (ins.status === "pagada" || ins.status === "anulada" || owed <= 0) return jsonError("Esta cuota ya está pagada.", 409);
  if (mode === "atrasado" && ins.concept !== "pension") return jsonError("Solo las pensiones se pueden registrar como atrasadas.", 400);
  try {
    const { installment, applied } = await repo.registerPayment(ins.id, {
      amount: owed,
      method: "tarjeta",
      reference: `DEMO-${idempotencyKey.replace(/-/g, "").slice(0, 16).toUpperCase()}`,
      by: "familia (pago en línea demo)",
      paidAt: demoPaidAt(ins.dueDate, mode, now()),
    });
    if (applied) void emitEvent("payment.received", { installmentId: ins.id, amount: owed, method: "tarjeta", status: installment.status, channel: "web" });
    return NextResponse.json({ ok: true, applied, status: installment.status, amount: owed, reference: installment.reference, paidAt: installment.paidAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isNotFoundError(error)) return jsonError(error.message, 404);
    if (isConflictError(error)) return jsonError(error.message, 409);
    console.error("[payments/pay]", error);
    return jsonError("No se pudo registrar el pago. Intenta de nuevo.", 500);
  }
}
