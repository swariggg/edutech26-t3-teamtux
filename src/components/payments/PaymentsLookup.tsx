"use client";
import { useRef, useState } from "react";
import { CreditCard, Search } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { conceptLabel, installmentStatusMeta } from "@/domain/labels";
import { formatDate, formatMoney } from "@/domain/format";
import type { InstallmentConcept, InstallmentStatus } from "@/domain/types";

export interface PublicPayments {
  studentFirstName: string;
  enrollmentCode: string;
  grade: string;
  summary: { total: number; paid: number; pending: number; overdue: number };
  installments: { id: string; concept: InstallmentConcept; description: string; amount: number; amountPaid: number; dueDate: string; status: InstallmentStatus }[];
}

export function PaymentsLookup() {
  const [q, setQ] = useState("");
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicPayments | null>(null);
  const ref = useRef<HTMLHeadingElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setData(null);
    try {
      const res = await fetch("/api/payments/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentQuery: q, guardianDocument: doc }) });
      const json = (await res.json()) as PublicPayments & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "No encontramos pagos con esos datos.");
      setData(json);
      requestAnimationFrame(() => ref.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally { setLoading(false); }
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

      <div aria-live="polite">
        {error && <Alert tone="warning" title="Sin resultados">{error}</Alert>}
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
            {data.summary.overdue > 0 && <Alert tone="danger" title="Tienes valores vencidos">Si necesitas un plan de pagos, escribe a colecturía. El asesor virtual también puede orientarte.</Alert>}
            <GlassCard className="overflow-hidden">
              <DataTable
                caption="Cuotas del año lectivo"
                rows={data.installments}
                rowKey={(r) => r.id}
                columns={[
                  { key: "d", header: "Concepto", cell: (r) => <span><span className="font-medium">{conceptLabel[r.concept]}</span> <span className="text-muted">{r.description}</span></span> },
                  { key: "due", header: "Vence", cell: (r) => formatDate(r.dueDate) },
                  { key: "amt", header: "Monto", align: "right", cell: (r) => formatMoney(r.amount) },
                  { key: "paid", header: "Pagado", align: "right", cell: (r) => formatMoney(r.amountPaid) },
                  { key: "st", header: "Estado", cell: (r) => <Badge tone={installmentStatusMeta[r.status].tone}>{installmentStatusMeta[r.status].label}</Badge> },
                ]}
              />
            </GlassCard>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled aria-describedby="pay-soon"><CreditCard aria-hidden className="size-4" /> Pagar en línea</Button>
              <p id="pay-soon" className="text-sm text-muted">Pasarela de pago próximamente. Mientras tanto usa transferencia o paga en colecturía.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
