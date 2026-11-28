import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { institution } from "@/content/institution";
import { hasLLM } from "@/lib/env";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pt-8 outline-none sm:px-6 sm:pt-12">
        {children}
      </main>
      <PublicFooter />
      {/* Asesor IA flotante en todas las páginas públicas (la conversación persiste al navegar). */}
      <ChatWidget
        greeting={`¡Hola! Soy el asesor virtual de ${institution.name}. ¿En qué te ayudo hoy?`}
        sourceLabel={hasLLM ? "Respuestas generadas con IA (Claude)" : "Modo demostración: respuestas simuladas"}
      />
    </>
  );
}
