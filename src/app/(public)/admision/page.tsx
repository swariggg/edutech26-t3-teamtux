import type { Metadata } from "next";
import { AdmissionWizard } from "@/components/forms/AdmissionWizard";

export const metadata: Metadata = { title: "Solicitud de admisión" };

export default function AdmisionPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold">Solicitud de admisión</h1>
        <p className="text-muted">Te tomará unos 5 minutos. Los campos con <span className="text-danger">*</span> son obligatorios.</p>
      </header>
      <AdmissionWizard />
    </div>
  );
}
