import type { Metadata } from "next";
import { getRepository } from "@/data";
import { FilterBar } from "@/components/admin/FilterBar";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ENROLLMENT_STATUSES, enrollmentStatusMeta } from "@/domain/labels";
import { formatDate } from "@/domain/format";
import { gradeLabel, institution } from "@/content/institution";
import type { EnrollmentStatus, Grade } from "@/domain/types";

export const metadata: Metadata = { title: "Matrículas" };
export const dynamic = "force-dynamic";

export default async function MatriculasPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; grado?: string }> }) {
  const sp = await searchParams;
  const status = ENROLLMENT_STATUSES.includes(sp.estado as EnrollmentStatus) ? (sp.estado as EnrollmentStatus) : undefined;
  const grade = institution.grades.some((g) => g.id === sp.grado) ? (sp.grado as Grade) : undefined;
  const rows = await getRepository().listEnrollments({ search: sp.q, status, grade });
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Matrículas</h1>
        <p className="text-muted">{rows.length} resultado(s) · Año {institution.academicYear}</p>
      </div>
      <FilterBar
        action="/admin/matriculas"
        search={sp.q}
        selects={[
          { name: "estado", label: "Estado", value: status, options: ENROLLMENT_STATUSES.map((s) => ({ value: s, label: enrollmentStatusMeta[s].label })) },
          { name: "grado", label: "Grado", value: grade, options: institution.grades.map((g) => ({ value: g.id, label: g.label })) },
        ]}
      />
      <GlassCard className="overflow-hidden">
        <DataTable
          caption="Matrículas"
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "code", header: "Código", cell: (r) => <span className="font-semibold">{r.code}</span> },
            { key: "student", header: "Estudiante", cell: (r) => r.studentName },
            { key: "grade", header: "Grado", cell: (r) => `${gradeLabel(r.grade)}${r.section ? ` "${r.section}"` : ""}` },
            { key: "status", header: "Estado", cell: (r) => <Badge tone={enrollmentStatusMeta[r.status].tone}>{enrollmentStatusMeta[r.status].label}</Badge> },
            { key: "date", header: "Fecha", cell: (r) => formatDate(r.enrolledAt) },
          ]}
        />
      </GlassCard>
    </>
  );
}
