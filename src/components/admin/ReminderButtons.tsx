"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";

const KIND_LABEL: Record<string, string> = { matricula: "pago de la matrícula", por_vencer: "pensión por vencer", vencida: "pensión vencida", mora: "plan de pagos (mora)" };

async function post(url: string): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

/** Ficha de matrícula: envía por n8n el recordatorio de la próxima cuota sin pagar. */
export function SendReminderButton({ id, disabledReason }: { id: string; disabledReason?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run() {
    setBusy(true); setMsg(null);
    try {
      const { ok, data } = await post(`/api/admin/enrollments/${id}/remind`);
      if (!ok) throw new Error(String(data.error ?? "No se pudo enviar el recordatorio"));
      setMsg({ ok: true, text: `Recordatorio enviado: ${String(data.installment)} (${KIND_LABEL[String(data.kind)] ?? data.kind}). Llega al correo en unos segundos.` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Error inesperado" });
    } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" size="sm" onClick={run} disabled={busy || Boolean(disabledReason)} aria-busy={busy} title={disabledReason}>
        <BellRing aria-hidden className="size-4" /> {busy ? "Enviando…" : "Enviar recordatorio de pago"}
      </Button>
      {disabledReason && <p className="text-xs text-muted">{disabledReason}</p>}
      <p aria-live="polite" className={msg?.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg?.text}</p>
    </div>
  );
}

/** Pagos: envía ahora los recordatorios a todas las familias con correo y cuotas pendientes. */
export function RunRemindersButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run() {
    setBusy(true); setMsg(null);
    try {
      const { ok, data } = await post("/api/reminders/run");
      if (!ok) throw new Error(String(data.error ?? "No se pudieron enviar los recordatorios"));
      const sent = Number(data.sent ?? 0), failed = Number(data.failed ?? 0);
      setMsg({ ok: failed === 0, text: sent === 0 && failed === 0 ? "No hay familias con correo y cuotas pendientes." : `${sent} recordatorio(s) enviado(s)${failed ? `, ${failed} con error` : ""}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Error inesperado" });
    } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={run} disabled={busy} aria-busy={busy}>
        <Send aria-hidden className="size-4" /> {busy ? "Enviando recordatorios…" : "Enviar recordatorios de pago ahora"}
      </Button>
      <p aria-live="polite" className={msg ? (msg.ok ? "text-sm text-success" : "text-sm text-danger") : "text-sm text-muted"}>
        {msg?.text ?? "Por n8n, solo a familias con correo registrado. También se ejecuta cada día de forma automática."}
      </p>
    </div>
  );
}
