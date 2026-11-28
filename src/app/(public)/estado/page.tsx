import type { Metadata } from "next";
import Link from "next/link";
import { StatusLookup } from "@/components/status/StatusLookup";
import { Alert } from "@/components/ui/Alert";
import { getRepository } from "@/data";
import { StatusLookupInput } from "@/domain/schemas";
import { RecoverCode } from "@/components/status/RecoverCode";
import { notificationsEnabled } from "@/lib/notifications";

export const metadata: Metadata = { title: "Estado de mi solicitud" };
export const dynamic = "force-dynamic";

export default async function EstadoPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  const parsed = StatusLookupInput.shape.trackingCode.safeParse(codigo ?? "");
  const initialCode = parsed.success ? parsed.data : "";
  const demo = getRepository().kind === "mock";
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold">Estado de mi solicitud</h1>
        <p className="text-muted">Ingresa el código que recibiste al enviar la solicitud y la cédula del representante.</p>
      </header>
      {demo && <Alert tone="info" title="Modo demostración">El dataset no incluye solicitudes: envía una en <Link href="/admision" className="font-medium underline">Admisión</Link> y consulta aquí con el código que recibas.</Alert>}
      <StatusLookup initialCode={initialCode} />
      <RecoverCode demoNote={notificationsEnabled() ? undefined : "n8n no está configurado en este entorno: el correo no se envía, pero el pedido queda registrado en la bitácora del panel de administración."} />
    </div>
  );
}
