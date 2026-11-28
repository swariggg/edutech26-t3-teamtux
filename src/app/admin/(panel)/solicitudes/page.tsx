import type { Metadata } from "next";
import Link from "next/link";
import { getRepository } from "@/data";
import { FilterBar } from "@/components/admin/FilterBar";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { APPLICATION_STATUSES, applicationStatusMeta } from "@/domain/labels";
import { formatDate, relativeDays } from "@/domain/format";
import { gradeLabel, institution } from "@/content/institution";
import type { ApplicationStatus, Grade } from "@/domain/types";

export const metadata: Metadata = { title: "Solicitudes" };
export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; estado?: string; grado?: string }>;

export default async function SolicitudesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const status = APPLICATION_STATUSES.includes(sp.estado as ApplicationStatus) ? (sp.estado as ApplicationStatus) : undefined;
  const grade = institution.grades.some((g) => g.id === sp.grado) ? (sp.grado as Grade) : undefined;
  const rows = await getRepository().listApplications({ search: sp.q, status, grade });
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Solicitudes de admisión</h1>
        <p className="text-muted">{rows.length} resultado(s)</p>
      </div>
      <FilterBar
        action="/admin/solicitudes"
        search={sp.q}
        selects={[
          { name: "estado", label: "Estado", value: status, options: APPLICATION_STATUSES.map((s) => ({ value: s, label: applicationStatusMeta[s].label })) },
          { name: "grado", label: "Grado", value: grade, options: institution.grades.map((g) => ({ value: g.id, label: g.label })) },
        ]}
      />
      <GlassCard className="overflow-hidden">
        <DataTable
          caption="Solicitudes de admisión"
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "code", header: "Código", cell: (r) => <Link href={`/admin/solicitudes/${r.id}`} className="font-semibold text-primary hover:underline">{r.trackingCode}</Link> },
            { key: "student", header: "Estudiante", cell: (r) => r.student.fullName },
            { key: "grade", header: "Grado", cell: (r) => gradeLabel(r.gradeApplied) },
            { key: "status", header: "Estado", cell: (r) => <Badge tone={applicationStatusMeta[r.status].tone}>{applicationStatusMeta[r.status].label}</Badge> },
            { key: "sub", header: "Enviada", cell: (r) => formatDate(r.submittedAt) },
            { key: "upd", header: "Último movimiento", cell: (r) => <span className="text-muted">{relativeDays(r.updatedAt)}</span> },
          ]}
        />
      </GlassCard>
    </>
  );
}
