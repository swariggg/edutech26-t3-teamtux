import { NextResponse } from "next/server";
import { PaymentsLookupInput } from "@/domain/schemas";
import { getRepository } from "@/data";
import { gradeLabel } from "@/content/institution";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { nowISO } from "@/lib/clock";
import { lookupBlocked, rateLimit, recordLookupFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = rateLimit(`pay:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return jsonError("Demasiados intentos. Espera un momento.", 429, { retryAfter: rl.retryAfter });
  const parsed = await parseBody(req, PaymentsLookupInput, 2_000);
  if ("response" in parsed) return parsed.response;
  const { studentQuery, guardianDocument } = parsed.data;
  if (lookupBlocked("pay", studentQuery)) return jsonError("Demasiados intentos fallidos para este estudiante. Intenta más tarde o escribe a colecturía.", 429);
  const found = await getRepository().findPaymentsForFamily(studentQuery, guardianDocument);
  if (!found) {
    recordLookupFailure("pay", studentQuery);
    return jsonError("No encontramos pagos con esos datos. Revisa la información ingresada.", 404);
  }
  const items = found.installments.filter((i) => i.status !== "anulada");
  const sum = (f: (i: (typeof items)[number]) => number) => Math.round(items.reduce((s, i) => s + f(i), 0) * 100) / 100;
  return NextResponse.json({
    studentFirstName: found.student.fullName.split(" ")[0],
    enrollmentCode: found.enrollment.code,
    grade: gradeLabel(found.enrollment.grade),
    /** Fecha de la app (AAAA-MM-DD) para clasificar puntual / atrasado / sin pagar igual que en administración. */
    today: nowISO().slice(0, 10),
    summary: {
      total: sum((i) => i.amount),
      paid: sum((i) => i.amountPaid),
      pending: sum((i) => (i.status === "pendiente" || i.status === "parcial" ? i.amount - i.amountPaid : 0)),
      overdue: sum((i) => (i.status === "vencida" ? i.amount - i.amountPaid : 0)),
    },
    installments: items.map((i) => ({ id: i.id, concept: i.concept, description: i.description, amount: i.amount, amountPaid: i.amountPaid, dueDate: i.dueDate, status: i.status, paidAt: i.paidAt?.slice(0, 10) ?? null, demo: Boolean(i.reference?.startsWith("DEMO-")) })),
  }, { headers: { "Cache-Control": "no-store" } });
}
