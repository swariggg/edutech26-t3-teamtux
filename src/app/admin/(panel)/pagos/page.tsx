import type { Metadata } from "next";
import { getRepository } from "@/data";
import { FilterBar } from "@/components/admin/FilterBar";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { MarkPaidButton } from "@/components/admin/MarkPaidButton";
import { INSTALLMENT_STATUSES, installmentStatusMeta, methodLabel } from "@/domain/labels";
import { formatDate, formatMoney, formatMonth } from "@/domain/format";
import { gradeLabel } from "@/content/institution";
import type { InstallmentStatus } from "@/domain/types";

export const metadata: Metadata = { title: "Pagos" };
export const dynamic = "force-dynamic";

const PAGE = 100;

export default async function PagosAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; periodo?: string }> }) {
  const sp = await searchParams;
  const status = INSTALLMENT_STATUSES.includes(sp.estado as InstallmentStatus) ? (sp.estado as InstallmentStatus) : undefined;
  const repo = getRepository();
  const all = await repo.listInstallments({ limit: 10_000 });
  const periods = [...new Set(all.map((i) => i.period))].sort();
  const period = periods.includes(sp.periodo ?? "") ? sp.periodo : undefined;
  const filtered = await repo.listInstallments({ search: sp.q, status, period, limit: 10_000 });
  const rows = filtered.slice(0, PAGE);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Pagos y pensiones</h1>
        <p className="text-muted">{filtered.length} cuota(s){filtered.length > PAGE ? `, se muestran las primeras ${PAGE}. Usa los filtros para acotar.` : ""}</p>
      </div>
      <FilterBar
        action="/admin/pagos"
        search={sp.q}
        selects={[
          { name: "estado", label: "Estado", value: status, options: INSTALLMENT_STATUSES.map((s) => ({ value: s, label: installmentStatusMeta[s].label })) },
          { name: "periodo", label: "Periodo", value: period, options: periods.map((p) => ({ value: p, label: formatMonth(p) })) },
        ]}
      />
      <GlassCard className="overflow-hidden">
        <DataTable
          caption="Cuotas"
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "student", header: "Estudiante", cell: (r) => <span><span className="font-medium">{r.studentName}</span> <span className="text-muted">· {gradeLabel(r.grade)}</span></span> },
            { key: "desc", header: "Concepto", cell: (r) => r.description },
            { key: "due", header: "Vence", cell: (r) => formatDate(r.dueDate) },
            { key: "amount", header: "Monto", align: "right", cell: (r) => formatMoney(r.amount) },
            { key: "paid", header: "Pagado", align: "right", cell: (r) => formatMoney(r.amountPaid) },
            { key: "status", header: "Estado", cell: (r) => <Badge tone={installmentStatusMeta[r.status].tone}>{installmentStatusMeta[r.status].label}</Badge> },
            { key: "method", header: "Método", cell: (r) => (r.method ? methodLabel[r.method] : "—") },
            { key: "act", header: "Acción", cell: (r) => (r.status === "pagada" || r.status === "anulada" ? <span className="text-muted">—</span> : <MarkPaidButton id={r.id} owed={Math.round((r.amount - r.amountPaid) * 100) / 100} label={`${r.description} de ${r.studentName}`} />) },
          ]}
        />
      </GlassCard>
    </>
  );
}
