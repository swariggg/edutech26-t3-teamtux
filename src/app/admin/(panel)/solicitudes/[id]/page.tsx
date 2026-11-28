import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getRepository } from "@/data";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { StatusChangeForm } from "@/components/admin/StatusChangeForm";
import { applicationStatusMeta, documentLabel, relationshipLabel } from "@/domain/labels";
import { formatDate, formatDateTime } from "@/domain/format";
import { gradeLabel } from "@/content/institution";

export const metadata: Metadata = { title: "Detalle de solicitud" };
export const dynamic = "force-dynamic";

export default async function SolicitudDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await getRepository().getApplication(id);
  if (!app) notFound();
  const meta = applicationStatusMeta[app.status];
  return (
    <>
      <Link href="/admin/solicitudes" className="text-sm font-medium text-primary hover:underline">← Volver a solicitudes</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{app.trackingCode}</h1>
          <p className="text-muted">{app.student.fullName} · {gradeLabel(app.gradeApplied)} · {app.academicYear}</p>
        </div>
        <Badge tone={meta.tone} className="text-base">{meta.label}</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard as="section" aria-labelledby="est" className="p-5">
          <h2 id="est" className="mb-3 text-lg font-semibold">Estudiante</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-muted">Nombre</dt><dd className="font-medium">{app.student.fullName}</dd></div>
            <div><dt className="text-muted">Cédula</dt><dd className="font-medium tabular-nums">{app.student.documentId ?? app.student.code ?? "—"}</dd></div>
            <div><dt className="text-muted">Nacimiento</dt><dd className="font-medium">{formatDate(app.student.birthDate)}</dd></div>
            {app.student.previousSchool && <div><dt className="text-muted">Institución anterior</dt><dd className="font-medium">{app.student.previousSchool}</dd></div>}
            {app.student.specialNeeds && <div><dt className="text-muted">Necesidades</dt><dd className="font-medium">{app.student.specialNeeds}</dd></div>}
          </dl>
        </GlassCard>
        <GlassCard as="section" aria-labelledby="rep" className="p-5">
          <h2 id="rep" className="mb-3 text-lg font-semibold">Representante</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-muted">Nombre</dt><dd className="font-medium">{app.guardian.fullName} ({relationshipLabel[app.guardian.relationship]})</dd></div>
            <div><dt className="text-muted">Cédula</dt><dd className="font-medium tabular-nums">{app.guardian.documentId ?? app.guardian.code ?? "—"}</dd></div>
            <div><dt className="text-muted">Correo</dt><dd className="break-all font-medium">{app.guardian.email}</dd></div>
            <div><dt className="text-muted">Teléfono</dt><dd className="font-medium">{app.guardian.phone}</dd></div>
          </dl>
        </GlassCard>
        <GlassCard as="section" aria-labelledby="cambio" className="p-5">
          <h2 id="cambio" className="mb-3 text-lg font-semibold">Cambiar estado</h2>
          <StatusChangeForm id={app.id} current={app.status} />
        </GlassCard>
        <GlassCard as="section" aria-labelledby="docs" className="p-5">
          <h2 id="docs" className="mb-3 text-lg font-semibold">Documentos</h2>
          <ul className="flex flex-col gap-2">
            {app.documents.map((d) => (
              <li key={d.kind} className="flex items-center gap-2 text-sm">
                {d.received ? <CheckCircle2 aria-hidden className="size-4 text-success" /> : <XCircle aria-hidden className="size-4 text-danger" />}
                <span>{documentLabel[d.kind]}</span>
                {d.received && <span className="sr-only">recibido</span>}
                {!d.received && <span className="text-muted">(pendiente)</span>}
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard as="section" aria-labelledby="hist" className="p-5 lg:col-span-2">
          <h2 id="hist" className="mb-3 text-lg font-semibold">Historial</h2>
          <ol className="flex flex-col gap-3 border-l-2 border-line pl-5">
            {app.history.map((h, i) => (
              <li key={i}>
                <p className="font-medium">{applicationStatusMeta[h.status].label}</p>
                <p className="text-sm text-muted">{formatDateTime(h.at)} · {h.by}</p>
                {h.note && <p className="text-sm">{h.note}</p>}
              </li>
            ))}
          </ol>
          {app.interviewAt && <p className="mt-3 text-sm">Entrevista: <strong>{formatDateTime(app.interviewAt)}</strong></p>}
        </GlassCard>
      </div>
    </>
  );
}
