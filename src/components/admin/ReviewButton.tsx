"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Vuelve a ejecutar la revisión de documentos con IA (tarda de 20 a 60 s con varios PDF). */
export function ReviewButton({ id, hasReview }: { id: string; hasReview: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/applications/${id}/review`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo completar la revisión");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={run} disabled={loading} aria-busy={loading}>
        <Sparkles aria-hidden className="size-4" /> {loading ? "Analizando documentos…" : hasReview ? "Analizar de nuevo" : "Analizar con IA"}
      </Button>
      <p aria-live="polite" className="text-xs text-danger">{msg}</p>
    </div>
  );
}
