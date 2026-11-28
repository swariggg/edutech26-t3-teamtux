"use client";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenido" tabIndex={-1} className="flex min-h-dvh items-center justify-center p-4 outline-none">
      <GlassCard className="flex max-w-md flex-col items-center gap-4 p-8 text-center" role="alert">
        <h1 className="text-2xl font-semibold">Algo salió mal</h1>
        <p className="text-muted">Ocurrió un error inesperado. Intenta de nuevo; si persiste, contacta a secretaría.</p>
        <Button onClick={reset}>Reintentar</Button>
      </GlassCard>
    </main>
  );
}
