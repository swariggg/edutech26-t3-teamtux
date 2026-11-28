import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

export default function NotFound() {
  return (
    <main id="contenido" tabIndex={-1} className="flex min-h-dvh items-center justify-center p-4 outline-none">
      <GlassCard className="flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <p className="font-heading text-5xl font-semibold text-primary">404</p>
        <h1 className="text-2xl font-semibold">No encontramos esta página</h1>
        <p className="text-muted">Puede que el enlace haya cambiado.</p>
        <Link href="/" className="font-medium text-primary underline">Volver al inicio</Link>
      </GlassCard>
    </main>
  );
}
