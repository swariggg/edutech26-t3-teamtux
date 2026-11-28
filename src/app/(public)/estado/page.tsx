import type { Metadata } from "next";
import { StatusLookup } from "@/components/status/StatusLookup";
import { Alert } from "@/components/ui/Alert";
import { getRepository } from "@/data";

export const metadata: Metadata = { title: "Estado de mi solicitud" };
export const dynamic = "force-dynamic";

export default function EstadoPage() {
  const demo = getRepository().kind === "mock";
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold">Estado de mi solicitud</h1>
        <p className="text-muted">Ingresa el código que recibiste al enviar la solicitud y la cédula del representante.</p>
      </header>
      {demo && <Alert tone="info" title="Modo demostración">Prueba con el código <strong>ADM-2026-0001</strong> y la cédula <strong>0912345678</strong>.</Alert>}
      <StatusLookup />
    </div>
  );
}
