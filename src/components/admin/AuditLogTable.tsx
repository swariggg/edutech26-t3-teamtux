import type { AuditLog } from "@/domain/types";
import { formatDateTime } from "@/domain/format";
import { DataTable } from "@/components/ui/DataTable";

const ACTION_LABEL: Record<string, string> = {
  "application.created": "Solicitud creada",
  "application.status_changed": "Cambio de estado",
  "payment.received": "Pago registrado",
  "reminder.sent": "Recordatorio enviado",
  "system.audit_run": "Auditoría ejecutada",
};

function summary(l: AuditLog): string {
  const d = l.details ?? {};
  const parts = [
    d.trackingCode,
    d.to ?? d.status,
    d.amount !== undefined ? `$${String(d.amount)}` : undefined,
    d.method,
    d.channel,
    d.findings !== undefined ? `${String(d.findings)} hallazgos` : undefined,
  ];
  return parts.filter((p) => p !== undefined && p !== null && p !== "").map(String).join(" · ");
}

export function AuditLogTable({ logs, compact = false }: { logs: AuditLog[]; compact?: boolean }) {
  if (compact) {
    return (
      <ul className="flex flex-col divide-y divide-line">
        {logs.map((l) => {
          const s = summary(l);
          return (
            <li key={l.id} className="flex flex-col py-2">
              <span className="font-medium">{ACTION_LABEL[l.action] ?? l.action}</span>
              <span className="text-sm text-muted">
                {l.actor} · {formatDateTime(l.at)}
                {s && ` · ${s}`}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <DataTable
      caption="Bitácora de auditoría"
      rows={logs}
      rowKey={(l) => l.id}
      empty="Sin registros"
      columns={[
        { key: "at", header: "Fecha", cell: (l) => formatDateTime(l.at) },
        { key: "actor", header: "Usuario", cell: (l) => l.actor },
        { key: "action", header: "Acción", cell: (l) => ACTION_LABEL[l.action] ?? l.action },
        { key: "entity", header: "Entidad", cell: (l) => <span className="text-muted">{l.entity}</span> },
        { key: "detail", header: "Detalle", cell: (l) => summary(l) || "—" },
      ]}
    />
  );
}
