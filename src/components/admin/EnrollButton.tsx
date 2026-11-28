"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Crea la matrícula de una solicitud aprobada que aún no la tiene (por ejemplo, si falló al aprobar). */
export function EnrollButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/applications/${id}/enroll`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear la matrícula");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <Button onClick={run} disabled={loading} aria-busy={loading}>
        <GraduationCap aria-hidden className="size-4" /> {loading ? "Creando matrícula…" : "Crear matrícula"}
      </Button>
      <p aria-live="polite" className="text-sm text-danger">{msg}</p>
    </div>
  );
}
