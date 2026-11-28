import type { Metadata } from "next";
import { PaymentsLookup } from "@/components/payments/PaymentsLookup";
import { Alert } from "@/components/ui/Alert";
import { getRepository } from "@/data";
import { institution } from "@/content/institution";

export const metadata: Metadata = { title: "Mis pagos" };
export const dynamic = "force-dynamic";

export default function PagosPage() {
  const demo = getRepository().kind === "mock";
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold">Mis pagos</h1>
        <p className="text-muted">Las pensiones vencen el día {institution.fees.dueDay} de cada mes.</p>
      </header>
      {demo && <Alert tone="info" title="Modo demostración">Prueba con el estudiante <strong>EST-001</strong> y el representante <strong>REP-001</strong> (datos del dataset ficticio).</Alert>}
      <PaymentsLookup />
    </div>
  );
}
