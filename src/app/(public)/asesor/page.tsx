import type { Metadata } from "next";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { institution } from "@/content/institution";
import { hasLLM } from "@/lib/env";

export const metadata: Metadata = { title: "Asesor virtual" };
export const dynamic = "force-dynamic";

export default function AsesorPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold">Asesor virtual</h1>
        <p className="text-muted">Pregunta sobre admisiones, matrículas, costos, fechas o pagos. Te respondemos al instante.</p>
      </header>
      <ChatPanel
        greeting={`¡Hola! Soy el asesor virtual de ${institution.name}. ¿En qué te ayudo hoy?`}
        sourceLabel={hasLLM ? "Respuestas generadas con IA (Claude)" : "Modo demostración: respuestas simuladas"}
      />
    </div>
  );
}
