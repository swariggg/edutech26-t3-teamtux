"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { methodLabel, PAYMENT_METHODS } from "@/domain/labels";
import { formatMoney } from "@/domain/format";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

export function MarkPaidButton({ id, owed, label }: { id: string; owed: number; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [amount, setAmount] = useState(String(owed));
  const [method, setMethod] = useState("transferencia");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function open() {
    // Reinicia el formulario con el saldo vigente (cambia tras pagos parciales).
    setAmount(String(owed)); setMethod("transferencia"); setReference(""); setError(null);
    ref.current?.showModal();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: Number(amount), method, reference: reference || undefined }) });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(res.status === 401 ? "Tu sesión expiró. Vuelve a ingresar." : body.error ?? "No se pudo registrar el pago. Revisa el monto.");
        return;
      }
      ref.current?.close();
      router.refresh();
    } catch {
      setError("Sin conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button ref={trigger} size="sm" variant="secondary" onClick={open}>Registrar pago<span className="sr-only"> de {label}</span></Button>
      <dialog ref={ref} aria-labelledby={`pay-${id}`} onClose={() => trigger.current?.focus()} className="glass glass-strong fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-xl p-6 text-foreground backdrop:bg-black/40">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <h2 id={`pay-${id}`} className="text-lg font-semibold">Registrar pago</h2>
          <p className="text-sm text-muted">{label} · saldo {formatMoney(owed)}</p>
          <Field id={`amt-${id}`} label="Monto" required>
            <Input id={`amt-${id}`} type="number" min="0.01" step="0.01" max={owed} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field id={`met-${id}`} label="Método" required>
            <Select id={`met-${id}`} value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
            </Select>
          </Field>
          <Field id={`ref-${id}`} label="Referencia o comprobante">
            <Input id={`ref-${id}`} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} />
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => ref.current?.close()}>Cancelar</Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>Guardar</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
