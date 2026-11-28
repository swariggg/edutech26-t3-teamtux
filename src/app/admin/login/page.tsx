import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/admin/LoginForm";
import { GlassCard } from "@/components/ui/GlassCard";
import { DEMO_PASSCODE, getAdminConfig } from "@/lib/auth";

export const metadata: Metadata = { title: "Ingreso administrativo", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const cfg = getAdminConfig();
  return (
    <main id="contenido" tabIndex={-1} className="flex min-h-dvh items-center justify-center p-4 outline-none">
      <GlassCard className="flex w-full max-w-sm flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Panel administrativo</h1>
          <p className="text-sm text-muted">Secretaría y colecturía.</p>
        </div>
        <LoginForm next={next ?? "/admin"} />
        {cfg.problem && (
          <p role="alert" className="text-sm text-danger">El acceso administrativo está deshabilitado: falta configurar el servidor. Contacta al responsable técnico.</p>
        )}
        {cfg.demo && <p className="text-sm text-muted">Demo (solo desarrollo): la clave es <strong>{DEMO_PASSCODE}</strong>.</p>}
        <Link href="/" className="text-sm font-medium text-primary hover:underline">← Volver al sitio</Link>
      </GlassCard>
    </main>
  );
}
