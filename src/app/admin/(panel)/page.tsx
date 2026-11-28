import type { Metadata } from "next";
import Link from "next/link";
import { AlertOctagon, CircleDollarSign, ClipboardList, Clock, GraduationCap, Percent } from "lucide-react";
import { getRepository } from "@/data";
import { StatCard } from "@/components/ui/StatCard";
import { DashboardCharts } from "@/components/charts/DashboardCharts";
import { AuditorPanel } from "@/components/admin/AuditorPanel";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatDate, formatMoney, formatPercent } from "@/domain/format";
import { hasLLM } from "@/lib/env";
import { institution } from "@/content/institution";
import { isSimulatedClock, now } from "@/lib/clock";

export const metadata: Metadata = { title: "Panel" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const repo = getRepository();
  const [stats, logs] = await Promise.all([repo.getDashboardStats(), repo.listAuditLogs({ limit: 8 })]);
  const t = stats.totals;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Panel general</h1>
        <p className="text-muted">
          Año lectivo {institution.currentYear} · Admisiones {institution.academicYear}
          {isSimulatedClock() && <> · Datos del dataset ficticio al {formatDate(now().toISOString())}</>}
        </p>
      </div>
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Solicitudes" value={String(t.applications)} hint={`${t.pendingReview} por revisar`} Icon={ClipboardList} />
        <StatCard label="Por revisar" value={String(t.pendingReview)} hint="Enviadas, en revisión o con documentos pendientes" Icon={Clock} tone="warning" />
        <StatCard label="Matrículas activas" value={String(t.enrollmentsActive)} Icon={GraduationCap} tone="accent" />
        <StatCard label="Recaudado" value={formatMoney(t.collected)} Icon={CircleDollarSign} tone="success" />
        <StatCard label="Vencido" value={formatMoney(t.overdue)} hint={`Pendiente por vencer: ${formatMoney(t.pending)}`} Icon={AlertOctagon} tone="danger" />
        <StatCard label="Tasa de cobro" value={formatPercent(t.collectionRate)} hint="Cobrado sobre lo vencido a la fecha" Icon={Percent} />
      </section>
      <DashboardCharts stats={stats} />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <AuditorPanel compact llmEnabled={hasLLM} />
        <GlassCard as="section" aria-labelledby="actividad" className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 id="actividad" className="text-lg font-semibold">Actividad reciente</h2>
            <Link href="/admin/auditoria" className="text-sm font-medium text-primary hover:underline">Ver bitácora</Link>
          </div>
          <AuditLogTable logs={logs} compact />
        </GlassCard>
      </div>
    </>
  );
}
