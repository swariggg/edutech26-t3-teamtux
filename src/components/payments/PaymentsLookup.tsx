"use client";
import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alert } from "@/components/ui/Alert";
import { formatDate, formatMoney } from "@/domain/format";
import { PaymentBoard, type BoardInstallment, type PayMode } from "./PaymentBoard";

export interface PublicPayments {
  studentFirstName: string;
  enrollmentCode: string;
  grade: string;
  today: string;
  summary: { total: number; paid: number; pending: number; overdue: number };
  installments: BoardInstallment[];
}

export function PaymentsLookup({ initialStudent = "" }: { initialStudent?: string }) {
  const [q, setQ] = useState(initialStudent);
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicPayments | null>(null);
  const ref = useRef<HTMLHeadingElement>(null);
  // Datos con los que se hizo la consulta: el pago vuelve a enviarlos (aunque luego se editen los campos).
  const creds = useRef<{ studentQuery: string; guardianDocument: string } | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function fetchPayments(c: { studentQuery: string; guardianDocument: string }): Promise<PublicPayments> {
    const res = await fetch("/api/payments/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
    const json = (await res.json()) as PublicPayments & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "No encontramos pagos con esos datos.");
    return json;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setData(null); setPayMsg(null);
    // Código de solicitud de admisión: aún no hay matrícula ni pensiones; se consulta en Estado.
    if (/^\s*ADM-/i.test(q)) {
      setError("ADM");
      return;
    }
    setLoading(true);
    try {
      const c = { studentQuery: q, guardianDocument: doc };
      setData(await fetchPayments(c));
      creds.current = c;
      requestAnimationFrame(() => ref.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally { setLoading(false); }
  }

  /** Pago de demostración (puntual o atrasado): se registra de verdad y se vuelve a cargar el tablero. */
  async function pay(row: BoardInstallment, mode: PayMode) {
    if (!creds.current) return;
    setPaying(row.id); setPayMsg(null);
    try {
      const res = await fetch("/api/payments/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...creds.current, installmentId: row.id, idempotencyKey: crypto.randomUUID(), mode }),
      });
      const json = (await res.json()) as { error?: string; amount?: number; reference?: string; paidAt?: string };
      if (!res.ok) throw new Error(json.error ?? "No se pudo registrar el pago.");
      setData(await fetchPayments(creds.current));
      setPayMsg({ ok: true, text: `${row.description}: pago de ${formatMoney(json.amount ?? 0)} registrado ${mode === "atrasado" ? "como ATRASADO" : "a tiempo"} (${formatDate(json.paidAt)}). Comprobante ${json.reference ?? ""}.` });
    } catch (err) {
      setPayMsg({ ok: false, text: err instanceof Error ? err.message : "Error inesperado" });
    } finally { setPaying(null); }
  }

  /** Deshace un pago de demostración: la pensión vuelve a «sin pagar». */
  async function undo(row: BoardInstallment) {
    if (!creds.current) return;
    setPaying(row.id); setPayMsg(null);
    try {
      const res = await fetch("/api/payments/undo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...creds.current, installmentId: row.id }) });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "No se pudo deshacer el pago.");
      setData(await fetchPayments(creds.current));
      setPayMsg({ ok: true, text: `${row.description}: pago deshecho, vuelve a estar sin pagar.` });
    } catch (err) {
      setPayMsg({ ok: false, text: err instanceof Error ? err.message : "Error inesperado" });
    } finally { setPaying(null); }
  }

  return (
    <div className="flex flex-col gap-6">
      <GlassCard as="section" className="p-5 sm:p-6" aria-label="Buscar pagos">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field id="studentQuery" label="Código del estudiante o de matrícula" required hint="Ejemplo: EST-001 o MAT-2025-0001 (también acepta la cédula)">
            <Input id="studentQuery" value={q} onChange={(e) => setQ(e.target.value)} required autoComplete="off" aria-describedby="studentQuery-hint" />
          </Field>
          <Field id="guardianDocumentPay" label="Código o cédula del representante" required hint="Ejemplo: REP-001">
            <Input id="guardianDocumentPay" value={doc} onChange={(e) => setDoc(e.target.value)} required autoComplete="off" aria-describedby="guardianDocumentPay-hint" />
          </Field>
          <Button type="submit" disabled={loading} aria-busy={loading} className="sm:mb-7"><Search aria-hidden className="size-4" /> {loading ? "Buscando…" : "Consultar"}</Button>
        </form>
      </GlassCard>

      <div>
        {/* Solo el error se anuncia solo; así el lector de pantalla no lee de golpe toda la tabla de pagos. */}
        <div aria-live="polite">
          {error === "ADM" ? (
            <Alert tone="info" title="Ese es un código de solicitud de admisión">
              Las pensiones aparecen aquí cuando la solicitud es aprobada y se completa la matrícula; entonces recibes tu código de matrícula (MAT-…).
              Mientras tanto, revisa cómo va tu solicitud en <a href="/estado" className="font-semibold text-primary underline underline-offset-4">Estado de solicitud</a>.
            </Alert>
          ) : error && <Alert tone="warning" title="Sin resultados">{error}</Alert>}
        </div>
        {data && (
          <section className="flex flex-col gap-4" aria-labelledby="pay-title">
            <h2 id="pay-title" ref={ref} tabIndex={-1} className="text-2xl font-semibold outline-none">Pagos de {data.studentFirstName} · {data.grade} <span className="text-base font-normal text-muted">({data.enrollmentCode})</span></h2>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Total del año", data.summary.total, "text-foreground"], ["Pagado", data.summary.paid, "text-success"], ["Por vencer", data.summary.pending, "text-info"], ["Vencido", data.summary.overdue, "text-danger"]].map(([l, v, c]) => (
                <GlassCard key={l as string} className="p-4">
                  <dt className="text-sm text-muted">{l}</dt>
                  <dd className={`font-heading text-2xl font-semibold tabular-nums ${c}`}>{formatMoney(v as number)}</dd>
                </GlassCard>
              ))}
            </dl>
            {data.summary.overdue > 0 && <Alert tone="danger" title="Tienes valores vencidos">Si necesitas un plan de pagos, escribe a colecturía. Clipo, el asistente virtual, también puede orientarte.</Alert>}
            <div aria-live="polite">{payMsg && <Alert tone={payMsg.ok ? "success" : "danger"} title={payMsg.ok ? "Listo" : "No se pudo completar"}>{payMsg.text}</Alert>}</div>
            <PaymentBoard installments={data.installments} today={data.today} busyId={paying} onPay={pay} onUndo={undo} />
          </section>
        )}
      </div>
    </div>
  );
}
