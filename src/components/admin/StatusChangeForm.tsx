"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationStatus } from "@/domain/types";
import { APPLICATION_STATUSES, applicationStatusMeta } from "@/domain/labels";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function StatusChangeForm({ id, current }: { id: string; current: ApplicationStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(current);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/applications/${id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, note: note || undefined }) });
      if (res.ok) { setMsg({ ok: true, text: "Estado actualizado y registrado en la bitácora." }); setNote(""); router.refresh(); }
      else setMsg({ ok: false, text: res.status === 401 ? "Tu sesión expiró. Vuelve a ingresar." : "No se pudo actualizar el estado." });
    } catch {
      setMsg({ ok: false, text: "Sin conexión con el servidor. Inténtalo de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field id="new-status" label="Nuevo estado" required>
        <Select id="new-status" value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)}>
          {APPLICATION_STATUSES.filter((s) => s !== "borrador").map((s) => <option key={s} value={s}>{applicationStatusMeta[s].label}</option>)}
        </Select>
      </Field>
      <Field id="status-note" label="Nota para el historial">
        <Textarea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <Button type="submit" disabled={busy || status === current} aria-busy={busy}>Guardar cambio</Button>
      <p role="status" className={msg?.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg?.text}</p>
    </form>
  );
}
