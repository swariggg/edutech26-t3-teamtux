"use client";
import { useId, useState } from "react";
import { Mail } from "lucide-react";
import { Field, Input, describedBy } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/** «¿Olvidaste tu código?»: pide el reenvío al correo registrado. Nunca muestra el código en pantalla. */
export function RecoverCode({ demoNote }: { demoNote?: string }) {
  const uid = useId();
  const fieldId = `${uid}-doc`;
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      const res = await fetch("/api/applications/recover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guardianDocument: doc }) });
      const data = (await res.json()) as { message?: string; error?: string; issues?: { message: string }[] };
      if (!res.ok) throw new Error(data.issues?.[0]?.message ?? data.error ?? "No pudimos procesar la solicitud.");
      setMessage(data.message ?? "Listo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally { setLoading(false); }
  }

  return (
    <details className="glass rounded-xl p-5 sm:p-6 [&[open]>summary]:mb-4">
      <summary className="cursor-pointer font-medium text-primary marker:text-primary">¿Olvidaste tu código de seguimiento?</summary>
      <p className="mb-4 text-sm text-muted">
        Ingresa la cédula del representante y te enviaremos los códigos de tus solicitudes al correo que registraste al postular.
      </p>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field id={fieldId} label="Cédula del representante" required hint="10 dígitos">
          <Input id={fieldId} value={doc} onChange={(e) => setDoc(e.target.value)} required inputMode="numeric" autoComplete="off" aria-describedby={describedBy(fieldId, "x")} />
        </Field>
        <Button type="submit" variant="secondary" disabled={loading} aria-busy={loading} className="sm:mb-7">
          <Mail aria-hidden className="size-4" /> {loading ? "Enviando…" : "Enviar a mi correo"}
        </Button>
      </form>
      <div aria-live="polite" className="flex flex-col gap-3">
        {message && <Alert tone="success" title="Solicitud recibida">{message}</Alert>}
        {message && demoNote && <Alert tone="info" title="Modo demostración">{demoNote}</Alert>}
        {error && <Alert tone="warning" title="Revisa el dato">{error}</Alert>}
      </div>
    </details>
  );
}
