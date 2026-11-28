import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ButtonLink } from "@/components/ui/Button";
import { institution } from "@/content/institution";

export const metadata: Metadata = { title: "Solicitud enviada" };

export default async function ConfirmacionPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  const code = codigo && /^ADM-\d{4}-\d{4}$/.test(codigo) ? codigo : null;
  return (
    <GlassCard className="mx-auto flex max-w-2xl flex-col items-center gap-5 p-8 text-center">
      <CheckCircle2 aria-hidden className="size-14 text-success" />
      <h1 className="text-3xl font-semibold">¡Solicitud enviada!</h1>
      {code ? (
        <>
          <p className="text-muted">Guarda tu código de seguimiento. Lo necesitarás junto con la cédula del representante.</p>
          <p className="glass-inset rounded-lg px-6 py-4 font-heading text-3xl font-semibold tracking-wider" aria-label={`Código de seguimiento ${code}`}>{code}</p>
        </>
      ) : (
        <p className="text-muted">Recibimos tu solicitud. Revisa tu correo para ver el código de seguimiento.</p>
      )}
      <p className="text-sm text-muted">Secretaría revisará tus documentos en los próximos días hábiles. Dudas: {institution.contact.secretaria.email}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/estado">Consultar estado</ButtonLink>
        <ButtonLink href="/asesor" variant="secondary">Hablar con el asesor</ButtonLink>
      </div>
    </GlassCard>
  );
}
