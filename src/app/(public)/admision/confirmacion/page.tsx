import type { Metadata } from "next";
import { OpenAdvisorButton } from "@/components/chat/OpenAdvisorButton";
import { CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ButtonLink } from "@/components/ui/Button";
import { institution } from "@/content/institution";
import { StatusLookupInput } from "@/domain/schemas";
import { CopyButton } from "@/components/ui/CopyButton";
import { notificationsEnabled } from "@/lib/notifications";

export const metadata: Metadata = { title: "Solicitud enviada" };

export default async function ConfirmacionPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  // Mismo formato que valida la consulta (ADM-2026-K7P2QX).
  const parsed = StatusLookupInput.shape.trackingCode.safeParse(codigo ?? "");
  const code = parsed.success ? parsed.data : null;
  return (
    <GlassCard className="mx-auto flex max-w-2xl flex-col items-center gap-5 p-8 text-center">
      <CheckCircle2 aria-hidden className="size-14 text-success" />
      <h1 className="text-3xl font-semibold">¡Solicitud enviada!</h1>
      {code ? (
        <>
          <p className="text-muted">Este es tu <strong className="text-foreground">código de seguimiento</strong>. Guárdalo: lo necesitarás junto con la <strong className="text-foreground">cédula del representante</strong> para consultar el estado.</p>
          <div className="flex flex-col items-center gap-3">
            <p className="glass-inset rounded-lg px-6 py-4 font-heading text-3xl font-semibold tracking-wider tabular-nums">
              {/* Un <p> no admite aria-label: el lector de pantalla recibe el código deletreado aquí. */}
              <span className="sr-only">Código de seguimiento: {code.split("").join(" ")}</span>
              <span aria-hidden className="select-all">{code}</span>
            </p>
            <CopyButton text={code} label="Copiar código" />
          </div>
          <p className="text-sm text-muted">
            {notificationsEnabled()
              ? "También te enviamos una copia al correo del representante."
              : "Modo demostración: con n8n configurado, este código también llega al correo del representante."}
          </p>
        </>
      ) : (
        <p className="text-muted">Recibimos tu solicitud. Revisa tu correo para ver el código de seguimiento.</p>
      )}
      <p className="text-sm text-muted">Secretaría revisará tus documentos en los próximos días hábiles. Dudas: {institution.contact.secretaria.email}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href={code ? `/estado?codigo=${encodeURIComponent(code)}` : "/estado"}>Consultar estado</ButtonLink>
        <OpenAdvisorButton variant="secondary">Hablar con el asesor</OpenAdvisorButton>
      </div>
    </GlassCard>
  );
}
