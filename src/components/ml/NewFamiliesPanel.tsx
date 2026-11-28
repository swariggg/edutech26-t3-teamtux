import Link from "next/link";
import { Sprout } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { PunctualityBar } from "@/components/payments/PunctualityBar";
import { enrollmentStatusMeta, type Tone } from "@/domain/labels";
import { PUNCTUALITY_RULES } from "@/domain/loyalty";
import { gradeLabel } from "@/content/institution";
import type { NewFamilyRow } from "@/ml/new-families";

const riskTone: Record<NewFamilyRow["risk"]["level"], Tone> = { bajo: "success", medio: "warning", alto: "danger" };

/** Familias del año siguiente: aún sin historial para los modelos de cobranza → modelo «cliente nuevo» + récord real. */
export function NewFamiliesPanel({ rows, academicYear }: { rows: NewFamilyRow[]; academicYear: string }) {
  return (
    <GlassCard as="section" aria-labelledby="nuevas" className="flex flex-col gap-3 overflow-hidden p-0">
      <div className="flex flex-col gap-1 px-5 pt-5">
        <h2 id="nuevas" className="flex items-center gap-2 text-lg font-semibold"><Sprout aria-hidden className="size-5 text-primary" /> Familias nuevas ({academicYear})</h2>
        <p className="text-sm text-muted">
          Matriculadas al aprobar su solicitud. Todavía no tienen meses pasados, así que los modelos de cobranza no pueden pronosticarlas:
          se evalúan con el modelo <strong>cliente nuevo</strong> (perfil de la familia: hijos, cursos, beca y NEE) y se muestra su récord real con los pagos que ya registraron.
        </p>
      </div>
      <DataTable
        caption={`Familias nuevas del año ${academicYear}`}
        rows={rows}
        rowKey={(r) => r.key}
        empty="Aún no hay familias nuevas: aprueba una solicitud en Solicitudes para crear su matrícula."
        columns={[
          { key: "fam", header: "Familia", cell: (r) => (
            <span className="flex flex-col">
              <span className="font-medium">{r.guardianName}</span>
              {r.students.map((s) => (
                <span key={s.enrollmentId} className="text-sm text-muted">
                  {s.name} · {gradeLabel(s.grade)}{s.nee ? " · NEE" : ""} · <Link href={`/admin/matriculas/${s.enrollmentId}`} className="font-mono text-primary underline-offset-4 hover:underline">{s.enrollmentCode}</Link>
                </span>
              ))}
            </span>
          ) },
          { key: "status", header: "Matrícula", cell: (r) => (
            <span className="flex flex-col gap-1">{[...new Set(r.students.map((s) => s.status))].map((st) => <Badge key={st} tone={enrollmentStatusMeta[st].tone}>{enrollmentStatusMeta[st].label}</Badge>)}</span>
          ) },
          { key: "risk", header: "Riesgo (cliente nuevo)", cell: (r) => (
            <span className="flex flex-col gap-1">
              <Badge tone={riskTone[r.risk.level]}>Riesgo {r.risk.level} · {Math.round(r.risk.probability * 100)} %</Badge>
              <span className="text-xs text-muted">{r.risk.votes} de 3 modelos predicen impago{r.beca ? ` · beca ${r.beca} %` : ""}{r.outOfRange ? " · curso fuera del entrenamiento" : ""}</span>
            </span>
          ) },
          { key: "record", header: "Récord de pago real", cell: (r) => (
            <span className="flex min-w-44 flex-col gap-1">
              <span className="flex justify-between text-sm"><span className="font-semibold tabular-nums">{r.record.recordPct} %</span><span className="text-muted">{r.paidCount} pago(s)</span></span>
              <PunctualityBar size="sm" outcomes={r.outcomes} recordPct={r.record.recordPct} label={`Récord de ${r.guardianName}`} />
              <span className="text-xs text-muted">{r.record.onTime} puntual · {r.record.late} atrasado · {r.record.unpaid} sin pagar · meta {PUNCTUALITY_RULES.scholarshipMinPct} %</span>
            </span>
          ) },
        ]}
      />
    </GlassCard>
  );
}
