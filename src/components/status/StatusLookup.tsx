"use client";
import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { Field, Input, describedBy } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { applicationStatusMeta, documentLabel } from "@/domain/labels";
import { formatDate, formatDateTime } from "@/domain/format";
import type { ApplicationStatus, DocumentKind } from "@/domain/types";

export interface PublicStatus {
  trackingCode: string;
  studentFirstName: string;
  grade: string;
  status: ApplicationStatus;
  submittedAt: string;
  interviewAt?: string;
  history: { status: ApplicationStatus; at: string; note?: string }[];
  missingDocuments: DocumentKind[];
  nextSteps: string;
}

export function StatusLookup() {
  const [code, setCode] = useState("");
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicStatus | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trackingCode: code, guardianDocument: doc }) });
      const data = (await res.json()) as PublicStatus & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No encontramos una solicitud con esos datos.");
      setResult(data);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <GlassCard as="section" className="p-5 sm:p-6" aria-label="Buscar solicitud">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field id="trackingCode" label="Código de seguimiento" required hint="Ejemplo: ADM-2026-0001">
            <Input id="trackingCode" name="trackingCode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required autoComplete="off" aria-describedby={describedBy("trackingCode", "x")} />
          </Field>
          <Field id="guardianDocument" label="Cédula del representante" required hint="10 dígitos">
            <Input id="guardianDocument" name="guardianDocument" value={doc} onChange={(e) => setDoc(e.target.value)} required inputMode="numeric" autoComplete="off" aria-describedby={describedBy("guardianDocument", "x")} />
          </Field>
          <Button type="submit" disabled={loading} aria-busy={loading} className="sm:mb-7"><Search aria-hidden className="size-4" /> {loading ? "Buscando…" : "Consultar"}</Button>
        </form>
      </GlassCard>

      <div aria-live="polite">
        {error && <Alert tone="warning" title="Sin resultados">{error}</Alert>}
        {result && (
          <GlassCard as="section" className="flex flex-col gap-6 p-5 sm:p-6" aria-labelledby="res-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="res-title" ref={resultRef} tabIndex={-1} className="text-2xl font-semibold outline-none">Solicitud {result.trackingCode}</h2>
                <p className="text-muted">{result.studentFirstName} · {result.grade} · enviada el {formatDate(result.submittedAt)}</p>
              </div>
              <Badge tone={applicationStatusMeta[result.status].tone}>{applicationStatusMeta[result.status].label}</Badge>
            </div>
            <Alert tone="info" title="Próximo paso">{result.nextSteps}{result.interviewAt && ` Entrevista: ${formatDateTime(result.interviewAt)}.`}</Alert>
            <div className="grid gap-6 md:grid-cols-2">
              <section aria-labelledby="hist-title">
                <h3 id="hist-title" className="mb-3 font-semibold">Historial</h3>
                <ol className="relative flex flex-col gap-4 border-l-2 border-line pl-5">
                  {result.history.map((h, i) => (
                    <li key={i} className="relative">
                      <span aria-hidden className="absolute -left-[1.72rem] top-1.5 size-3 rounded-full border-2 border-primary bg-surface" />
                      <p className="font-medium">{applicationStatusMeta[h.status].label}</p>
                      <p className="text-sm text-muted">{formatDateTime(h.at)}</p>
                      {h.note && <p className="text-sm">{h.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
              <section aria-labelledby="docs-title">
                <h3 id="docs-title" className="mb-3 font-semibold">Documentos pendientes</h3>
                {result.missingDocuments.length === 0 ? (
                  <p className="text-muted">No hay documentos pendientes.</p>
                ) : (
                  <ul className="flex flex-col gap-2">{result.missingDocuments.map((d) => (<li key={d}><Badge tone="warning">{documentLabel[d]}</Badge></li>))}</ul>
                )}
              </section>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
