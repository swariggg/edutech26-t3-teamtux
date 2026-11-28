import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepository } from "@/data";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { MarkPaidButton } from "@/components/admin/MarkPaidButton";
import { SendReminderButton } from "@/components/admin/ReminderButtons";
import { PunctualityBar } from "@/components/payments/PunctualityBar";
import { applicationStatusMeta, conceptLabel, enrollmentStatusMeta, installmentStatusMeta, methodLabel, relationshipLabel } from "@/domain/labels";
import { formatDate, formatDateTime, formatMoney } from "@/domain/format";
import { PUNCTUALITY_RULES, classifyMonth, punctualityRecord, riskMeta } from "@/domain/loyalty";
import { gradeLabel } from "@/content/institution";
import { nowISO } from "@/lib/clock";
import { isDeliverableEmail } from "@/lib/notifications";

export const metadata: Metadata = { title: "Ficha de matrícula" };
export const dynamic = "force-dynamic";

/** Ficha de matrícula: estudiante, representante, cuotas y récord de puntualidad en una sola pantalla. */
export default async function MatriculaDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();
  const detail = await repo.getEnrollmentDetail(id);
  if (!detail) notFound();
  const lastReminder = (await repo.listAuditLogs({ search: id, limit: 500 })).find((l) => l.action === "notification.payment_reminder_sent" && l.entityId === id);
  const pendingCount = detail.installments.filter((i) => i.status !== "pagada" && i.status !== "anulada").length;
  const { enrollment: e, student: s, guardian: g, installments, application } = detail;
  const today = nowISO().slice(0, 10);
  const pensions = installments.filter((i) => i.concept === "pension" && i.status !== "anulada");
  const outcomes = pensions.map((i) => classifyMonth(i, today));
  const record = punctualityRecord(outcomes);
  const live = installments.filter((i) => i.status !== "anulada");
  const sum = (f: (i: (typeof live)[number]) => number) => Math.round(live.reduce((t, i) => t + f(i), 0) * 100) / 100;
  const totals = {
    total: sum((i) => i.amount),
    paid: sum((i) => i.amountPaid),
    overdue: sum((i) => (i.status === "vencida" ? i.amount - i.amountPaid : 0)),
  };
  const meta = enrollmentStatusMeta[e.status];
  const scholarship = record.scholarshipEarned ? "Beca ganada" : record.scholarshipOnTrack ? "En camino a beca" : record.maxReachablePct >= PUNCTUALITY_RULES.scholarshipMinPct ? "Recuperable si se pone al día" : "No alcanza este año";

  return (
    <>
      <Link href="/admin/matriculas" className="text-sm font-medium text-primary hover:underline">← Volver a matrículas</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-3xl font-semibold">{e.code}</h1>
          <p className="text-muted">{s.fullName} · {gradeLabel(e.grade)}{e.section ? ` "${e.section}"` : ""} · {e.academicYear}</p>
        </div>
        <Badge tone={meta.tone} className="text-base">{meta.label}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard as="section" aria-labelledby="est" className="p-5">
          <h2 id="est" className="mb-3 text-lg font-semibold">Estudiante</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-muted">Nombre</dt><dd className="font-medium">{s.fullName}</dd></div>
            <div><dt className="text-muted">{s.documentId ? "Cédula" : "Código"}</dt><dd className="font-medium tabular-nums">{s.documentId ?? s.code ?? "—"}</dd></div>
            <div><dt className="text-muted">Nacimiento</dt><dd className="font-medium">{s.birthDate ? formatDate(s.birthDate) : s.birthYear ?? "—"}</dd></div>
            {s.specialNeeds && <div><dt className="text-muted">Necesidades educativas</dt><dd className="font-medium">{s.specialNeeds}</dd></div>}
            {s.scholarshipPct ? <div><dt className="text-muted">Beca vigente</dt><dd className="font-medium">{s.scholarshipPct} %</dd></div> : null}
          </dl>
        </GlassCard>
        <GlassCard as="section" aria-labelledby="rep" className="p-5">
          <h2 id="rep" className="mb-3 text-lg font-semibold">Representante</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-muted">Nombre</dt><dd className="font-medium">{g.fullName} ({relationshipLabel[g.relationship]})</dd></div>
            <div><dt className="text-muted">{g.documentId ? "Cédula" : "Código"}</dt><dd className="font-medium tabular-nums">{g.documentId ?? g.code ?? "—"}</dd></div>
            {g.email && <div><dt className="text-muted">Correo</dt><dd className="break-all font-medium">{g.email}</dd></div>}
            {g.phone && <div><dt className="text-muted">Teléfono</dt><dd className="font-medium">{g.phone}</dd></div>}
          </dl>
        </GlassCard>
        <GlassCard as="section" aria-labelledby="mat" className="p-5">
          <h2 id="mat" className="mb-3 text-lg font-semibold">Matrícula</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-muted">Estado</dt><dd><Badge tone={meta.tone}>{meta.label}</Badge></dd></div>
            <div><dt className="text-muted">Fecha</dt><dd className="font-medium">{formatDate(e.enrolledAt)}</dd></div>
            <div><dt className="text-muted">Pagado / total</dt><dd className="font-medium tabular-nums">{formatMoney(totals.paid)} de {formatMoney(totals.total)}{totals.overdue > 0 && <span className="text-danger"> · {formatMoney(totals.overdue)} vencido</span>}</dd></div>
            {application && (
              <div><dt className="text-muted">Solicitud de admisión</dt><dd><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/admin/solicitudes/${application.id}`}>{application.trackingCode}</Link> <span className="text-muted">· {applicationStatusMeta[application.status].label}</span></dd></div>
            )}
          </dl>
          {e.status === "pendiente_pago" && <p className="mt-3 text-sm text-muted">Pasa a «Activa» automáticamente cuando se paga la cuota de matrícula.</p>}
          <div className="mt-4 flex flex-col gap-1 border-t border-line pt-3">
            <SendReminderButton id={e.id} disabledReason={!isDeliverableEmail(g.email) ? "Familia de demostración: su correo es ficticio y no recibe correos." : pendingCount === 0 ? "No hay cuotas pendientes." : undefined} />
            {lastReminder && (
              <p className="text-xs text-muted">
                Último recordatorio: {formatDateTime(lastReminder.at)} · {String(lastReminder.details?.installment ?? "")} · {String(lastReminder.details?.delivery ?? "")}
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      {pensions.length > 0 && (
        <GlassCard as="section" aria-labelledby="record" className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="record" className="text-lg font-semibold">Récord de puntualidad</h2>
            <div className="flex flex-wrap gap-2">
              <Badge tone={riskMeta[record.risk].tone}>Riesgo {riskMeta[record.risk].label.toLowerCase()}</Badge>
              <Badge tone={record.scholarshipEarned || record.scholarshipOnTrack ? "success" : "neutral"}>{scholarship}</Badge>
            </div>
          </div>
          <p className="font-heading text-3xl font-semibold tabular-nums">{record.recordPct} % <span className="text-base font-normal text-muted">de 100 % · meta de beca {PUNCTUALITY_RULES.scholarshipMinPct} %</span></p>
          <PunctualityBar outcomes={outcomes} recordPct={record.recordPct} label={`Récord de puntualidad de ${s.fullName}`} />
          <p className="text-sm text-muted">
            {record.onTime} puntual(es) · {record.late} atrasado(s) · {record.unpaid} sin pagar · {record.pending} por vencer
            {record.punctualityPct !== null && ` · puntualidad en lo vencido: ${record.punctualityPct} %`}. {riskMeta[record.risk].action}
          </p>
        </GlassCard>
      )}

      <GlassCard as="section" aria-labelledby="cuotas" className="overflow-hidden">
        <h2 id="cuotas" className="px-5 pt-5 text-lg font-semibold">Cuotas</h2>
        <DataTable
          caption={`Cuotas de ${e.code}`}
          rows={installments}
          rowKey={(r) => r.id}
          columns={[
            { key: "c", header: "Concepto", cell: (r) => <span><span className="font-medium">{conceptLabel[r.concept]}</span> <span className="text-muted">{r.description}</span></span> },
            { key: "due", header: "Vence", cell: (r) => formatDate(r.dueDate) },
            { key: "amt", header: "Monto", align: "right", cell: (r) => formatMoney(r.amount) },
            { key: "paid", header: "Pagado", align: "right", cell: (r) => formatMoney(r.amountPaid) },
            { key: "st", header: "Estado", cell: (r) => <Badge tone={installmentStatusMeta[r.status].tone}>{installmentStatusMeta[r.status].label}</Badge> },
            { key: "on", header: "Pagado el", cell: (r) => (r.paidAt ? `${formatDate(r.paidAt)}${r.method ? ` · ${methodLabel[r.method]}` : ""}` : "—") },
            { key: "act", header: "Acción", cell: (r) => (r.status === "pagada" || r.status === "anulada" ? <span className="text-muted">—</span> : <MarkPaidButton id={r.id} owed={Math.round((r.amount - r.amountPaid) * 100) / 100} label={`${r.description} de ${s.fullName}`} />) },
          ]}
        />
      </GlassCard>
    </>
  );
}
