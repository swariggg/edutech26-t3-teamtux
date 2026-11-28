import type { Metadata } from "next";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ClipoIcon } from "@/components/brand/Brand";
import { institution } from "@/content/institution";
import { hasLLM } from "@/lib/env";

export const metadata: Metadata = { title: `${institution.assistant.name}, asistente virtual` };
export const dynamic = "force-dynamic";

export default function AsesorPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-3 text-4xl font-semibold">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><ClipoIcon className="size-10" /></span>
          {institution.assistant.name}
        </h1>
        <p className="text-muted">El asistente virtual de {institution.shortName}. Pregúntale sobre admisiones, matrículas, costos, fechas o pagos, por escrito o por voz.</p>
      </header>
      <ChatPanel
        greeting={institution.assistant.greeting}
        sourceLabel={hasLLM ? "Respuestas generadas con IA (Claude)" : "Modo demostración: respuestas simuladas"}
      />
    </div>
  );
}
