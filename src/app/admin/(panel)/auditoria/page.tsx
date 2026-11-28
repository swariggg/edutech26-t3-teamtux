import type { Metadata } from "next";
import { getRepository } from "@/data";
import { AuditorPanel } from "@/components/admin/AuditorPanel";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { hasLLM } from "@/lib/env";

export const metadata: Metadata = { title: "Auditoría" };
export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const logs = await getRepository().listAuditLogs({ limit: 200 });
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Auditoría</h1>
        <p className="text-muted">Revisión automática de procesos y bitácora de acciones.</p>
      </div>
      <AuditorPanel llmEnabled={hasLLM} />
      <GlassCard as="section" aria-labelledby="bitacora" className="overflow-hidden">
        <h2 id="bitacora" className="px-5 pt-5 text-lg font-semibold">Bitácora</h2>
        <AuditLogTable logs={logs} />
      </GlassCard>
    </>
  );
}
