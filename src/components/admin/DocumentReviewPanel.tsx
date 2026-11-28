import { AlertTriangle, BadgeCheck, GraduationCap, Landmark, ShieldAlert } from "lucide-react";
import type { DocReviewStatus, DocumentReview, PaymentCapacity } from "@/domain/types";
import type { Tone } from "@/domain/labels";
import { documentLabel, severityMeta } from "@/domain/labels";
import { formatDateTime, formatMoney } from "@/domain/format";
import { Badge } from "@/components/ui/Badge";

const docStatus: Record<DocReviewStatus, { label: string; tone: Tone }> = {
  ok: { label: "Correcto", tone: "success" },
  observado: { label: "Observado", tone: "warning" },
  ilegible: { label: "Ilegible", tone: "danger" },
  no_corresponde: { label: "No corresponde", tone: "danger" },
};
const capacityMeta: Record<PaymentCapacity, { label: string; tone: Tone }> = {
  alta: { label: "Capacidad de pago alta", tone: "success" },
  media: { label: "Capacidad de pago media", tone: "warning" },
  baja: { label: "Capacidad de pago baja", tone: "danger" },
  desconocida: { label: "Capacidad de pago sin determinar", tone: "neutral" },
};
const riskTone = { bajo: "success", medio: "warning", alto: "danger" } as const;
const regularity = { estable: "Estable", variable: "Variable", irregular: "Irregular", desconocida: "Sin determinar" } as const;

/** Resultado de la revisión de documentos con IA (apoyo a la decisión del personal). */
export function DocumentReviewPanel({ review }: { review: DocumentReview }) {
  const f = review.financial;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        {review.source === "ia" ? "Revisado con IA" : "Sin revisión con IA"} · {formatDateTime(review.reviewedAt)}
      </p>
      <p>{review.summary}</p>

      {review.inconsistencies.length > 0 && (
        <section aria-labelledby="rev-inc" className="flex flex-col gap-2">
          <h3 id="rev-inc" className="flex items-center gap-2 font-semibold"><ShieldAlert aria-hidden className="size-4 text-danger" /> Inconsistencias ({review.inconsistencies.length})</h3>
          <ul className="flex flex-col gap-2">
            {review.inconsistencies.map((x, i) => (
              <li key={i} className="glass-inset rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={severityMeta[x.severity].tone}>{severityMeta[x.severity].label}</Badge>
                  <span className="font-medium">{x.title}</span>
                </div>
                <p className="mt-1 text-sm">{x.detail}</p>
                {x.documents.length > 0 && <p className="mt-1 text-xs text-muted">{x.documents.map((k) => documentLabel[k]).join(" · ")}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.documents.length > 0 && (
        <section aria-labelledby="rev-docs" className="flex flex-col gap-2">
          <h3 id="rev-docs" className="flex items-center gap-2 font-semibold"><BadgeCheck aria-hidden className="size-4 text-primary" /> Documento por documento</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {review.documents.map((d) => (
              <li key={d.kind} className="glass-inset rounded-lg p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{documentLabel[d.kind]}</span>
                  <Badge tone={docStatus[d.status].tone}>{docStatus[d.status].label}</Badge>
                </div>
                {d.issues.length > 0 && <ul className="mt-1 list-disc pl-5 text-muted">{d.issues.map((t, i) => <li key={i}>{t}</li>)}</ul>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="rev-fin" className="flex flex-col gap-3">
        <h3 id="rev-fin" className="flex items-center gap-2 font-semibold"><Landmark aria-hidden className="size-4 text-primary" /> Estado de cuenta y plan de pago</h3>
        <div className="flex flex-wrap gap-2">
          <Badge tone={capacityMeta[f.capacity].tone}>{capacityMeta[f.capacity].label}</Badge>
          {review.mlRisk && (
            <Badge tone={riskTone[review.mlRisk.level]}>Modelo ML: riesgo {review.mlRisk.level} ({Math.round(review.mlRisk.probability * 100)}%)</Badge>
          )}
          {f.scholarshipCandidate && <Badge tone="info"><GraduationCap aria-hidden className="size-3.5" /> Candidata a beca</Badge>}
        </div>
        {f.analyzed ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-muted">Ingreso mensual promedio</dt><dd className="font-medium tabular-nums">{f.avgMonthlyIncome != null ? formatMoney(f.avgMonthlyIncome) : "—"}</dd></div>
            <div><dt className="text-muted">Pensión sobre el ingreso</dt><dd className="font-medium tabular-nums">{f.pensionToIncomePct != null ? `${f.pensionToIncomePct}%` : "—"}</dd></div>
            <div><dt className="text-muted">Regularidad del ingreso</dt><dd className="font-medium">{regularity[f.incomeRegularity]}</dd></div>
            <div><dt className="text-muted">Saldo promedio</dt><dd className="font-medium tabular-nums">{f.avgMonthlyBalance != null ? formatMoney(f.avgMonthlyBalance) : "—"}</dd></div>
            <div><dt className="text-muted">Periodo analizado</dt><dd className="font-medium">{f.periodMonths ? `${f.periodMonths} meses` : "—"}</dd></div>
            <div><dt className="text-muted">Titular = representante</dt><dd className="font-medium">{f.holderMatchesGuardian == null ? "Sin determinar" : f.holderMatchesGuardian ? "Sí" : "No"}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-muted">No hay un estado de cuenta legible para analizar.</p>
        )}
        {f.negativeEvents.length > 0 && (
          <div className="text-sm">
            <p className="flex items-center gap-1.5 font-medium text-warning"><AlertTriangle aria-hidden className="size-4" /> Eventos negativos</p>
            <ul className="list-disc pl-5">{f.negativeEvents.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        )}
        {f.signals.length > 0 && <ul className="list-disc pl-5 text-sm text-muted">{f.signals.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        <p className="text-sm"><strong>Sugerencia para colecturía:</strong> {f.recommendation}</p>
        {f.scholarshipCandidate && f.scholarshipReason && <p className="text-sm"><strong>Beca:</strong> {f.scholarshipReason}</p>}
      </section>

      <p className="border-t border-line pt-3 text-xs text-muted">
        Apoyo a la decisión: la IA y el modelo pueden equivocarse. La admisión, el plan de pago y las becas los decide el personal.
        La capacidad de pago se calcula con reglas fijas (pensión / ingreso, regularidad y eventos negativos), no la decide el modelo.
      </p>
    </div>
  );
}
