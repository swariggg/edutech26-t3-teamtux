import type { Metadata } from "next";
import { OpenAdvisorButton } from "@/components/chat/OpenAdvisorButton";
import { CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ButtonLink } from "@/components/ui/Button";
import { institution } from "@/content/institution";
import { StatusLookupInput } from "@/domain/schemas";
import { CopyButton } from "@/components/ui/CopyButton";
import { Alert } from "@/components/ui/Alert";
import { notificationsEnabled } from "@/lib/notifications";

export const metadata: Metadata = { title: "Solicitud enviada" };

export default async function ConfirmacionPage({ searchParams }: { searchParams: Promise<{ codigo?: string; docs?: string; fallidos?: string }> }) {
  const { codigo, docs, fallidos } = await searchParams;
  const count = (v?: string) => Math.min(20, Math.max(0, Number.parseInt(v ?? "", 10) || 0));
  const uploaded = count(docs);
  const failed = count(fallidos);
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
      {uploaded > 0 && (
        <p className="text-sm">Recibimos <strong>{uploaded} {uploaded === 1 ? "documento" : "documentos"}</strong>. Los revisaremos y te avisaremos si alguno necesita corrección.</p>
      )}
      {failed > 0 && (
        <Alert tone="warning" title={`${failed} ${failed === 1 ? "documento no se pudo subir" : "documentos no se pudieron subir"}`}>
          Tu solicitud quedó registrada. Entrega {failed === 1 ? "ese documento" : "esos documentos"} en secretaría o envíalos a {institution.contact.secretaria.email} indicando tu código de seguimiento.
        </Alert>
      )}
      <p className="text-sm text-muted">Secretaría revisará tus documentos en los próximos días hábiles. Dudas: {institution.contact.secretaria.email}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href={code ? `/estado?codigo=${encodeURIComponent(code)}` : "/estado"}>Consultar estado</ButtonLink>
        <OpenAdvisorButton variant="secondary">Hablar con Clipo</OpenAdvisorButton>
      </div>
    </GlassCard>
  );
}
