"use client";
import { useState } from "react";
import Link from "next/link";
import { Bot, ListChecks, ShieldAlert } from "lucide-react";
import type { AuditReport } from "@/domain/types";
import { categoryLabel, severityMeta } from "@/domain/labels";
import { formatDateTime } from "@/domain/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alert } from "@/components/ui/Alert";

export function AuditorPanel({ compact = false, llmEnabled }: { compact?: boolean; llmEnabled: boolean }) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"todo" | "solicitudes" | "pagos">("todo");

  async function run() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/auditor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope }) });
      if (!res.ok) throw new Error(res.status === 401 ? "Tu sesión expiró. Vuelve a ingresar." : "No se pudo ejecutar la auditoría");
      setReport((await res.json()) as AuditReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally { setLoading(false); }
  }

  const shown = report ? (compact ? report.findings.slice(0, 5) : report.findings) : [];

  return (
    <GlassCard as="section" aria-labelledby="auditor-title" className="flex flex-col gap-4 self-start p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent"><ShieldAlert aria-hidden className="size-5" /></span>
          <div>
            <h2 id="auditor-title" className="text-lg font-semibold">Auditor de procesos</h2>
            <p className="text-sm text-muted">{llmEnabled ? "Reglas + análisis con IA (Claude)." : "Reglas automáticas (configura ANTHROPIC_API_KEY para sumar IA)."}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="audit-scope" className="sr-only">Alcance</label>
          <select id="audit-scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm">
            <option value="todo">Todo</option>
            <option value="solicitudes">Solicitudes</option>
            <option value="pagos">Pagos</option>
          </select>
          <Button onClick={run} disabled={loading} aria-busy={loading}><Bot aria-hidden className="size-4" /> {loading ? "Analizando…" : "Ejecutar auditoría"}</Button>
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {error && <Alert tone="danger" role="alert" title="Error">{error}</Alert>}
        {!report && !error && (
          <div className="glass-inset rounded-lg p-4 text-sm">
            <p className="font-medium">{loading ? "Analizando los registros…" : "Aún no se ha ejecutado una auditoría en esta sesión."}</p>
            <p className="mt-1 text-muted">Revisa solicitudes estancadas, entrevistas vencidas, aprobadas sin matrícula, matrículas activas sin pago, mora por familia y datos inconsistentes.</p>
          </div>
        )}
        {report && (
          <>
            <div className="glass-inset flex flex-col gap-2 rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={report.source === "ia" ? "success" : "info"}>{report.source === "ia" ? "IA" : "Reglas"}</Badge>
                <span className="text-sm text-muted">{report.findings.length} hallazgos · {formatDateTime(report.generatedAt)}</span>
              </div>
              <p>{report.summary}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {shown.map((f) => (
                <li key={f.id} className="glass-inset rounded-lg p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={severityMeta[f.severity].tone}>Severidad {severityMeta[f.severity].label.toLowerCase()}</Badge>
                    <span className="text-sm text-muted">{categoryLabel[f.category]}</span>
                  </div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-muted">{f.detail}</p>
                  <p className="mt-1 flex items-start gap-2 text-sm"><ListChecks aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" /> {f.recommendation}</p>
                </li>
              ))}
            </ul>
            {compact && report.findings.length > shown.length && <Link href="/admin/auditoria" className="text-sm font-medium text-primary hover:underline">Ver los {report.findings.length} hallazgos</Link>}
          </>
        )}
      </div>
    </GlassCard>
  );
}
