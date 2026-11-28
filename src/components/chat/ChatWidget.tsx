"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize2, Minus, X } from "lucide-react";
import { ClipoIcon } from "@/components/brand/Brand";
import { institution } from "@/content/institution";
import { ChatPanel } from "./ChatPanel";
import { cn } from "@/lib/cn";

/** Evento global para abrir la burbuja desde cualquier botón (ver OpenAdvisorButton). */
export const OPEN_ADVISOR_EVENT = "ea:open-advisor";

/**
 * Asesor IA flotante, presente en todas las páginas públicas.
 * Vive en el layout público: la conversación se conserva al navegar y al minimizar
 * (el panel solo se oculta). En /asesor se oculta porque esa página ya muestra el chat completo.
 */
export function ChatWidget({ greeting, sourceLabel }: { greeting: string; sourceLabel: string }) {
  const pathname = usePathname();
  const onAdvisorPage = pathname === "/asesor";
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const openRef = useRef(open);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => { openRef.current = open; }, [open]);

  const show = useCallback(() => {
    setOpen(true);
    setUnread(false);
    // Tras mostrar el panel, el foco va al campo de texto.
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus());
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => bubbleRef.current?.focus());
  }, []);

  useEffect(() => {
    const onOpen = () => show();
    window.addEventListener(OPEN_ADVISOR_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ADVISOR_EVENT, onOpen);
  }, [show]);

  // Esc minimiza el chat aunque el foco esté en la página (p. ej. tras navegar), salvo que haya un diálogo modal abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
      const inPanel = panelRef.current?.contains(document.activeElement);
      setOpen(false);
      if (inPanel || document.activeElement === document.body) requestAnimationFrame(() => bubbleRef.current?.focus());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const onReply = useCallback(() => {
    if (!openRef.current) setUnread(true);
  }, []);

  return (
    <div hidden={onAdvisorPage} className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6 print:hidden">
      <section
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        hidden={!open}
        className="glass glass-strong advisor-pop pointer-events-auto flex h-[min(40rem,calc(100dvh-7rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
            <ClipoIcon className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate font-semibold">{institution.assistant.name}</h2>
            <p className="truncate text-xs text-muted">Asistente virtual de {institution.shortName} · admisiones, matrículas y pagos</p>
          </div>
          <Link
            href="/asesor"
            onClick={() => setOpen(false)}
            className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            aria-label={`Abrir a ${institution.assistant.name} en pantalla completa`}
            title="Pantalla completa"
          >
            <Maximize2 aria-hidden className="size-4" />
          </Link>
          <button
            type="button"
            onClick={hide}
            className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            aria-label={`Minimizar a ${institution.assistant.name}`}
            title="Minimizar (Esc)"
          >
            <Minus aria-hidden className="size-5" />
          </button>
        </header>
        {/* Siempre montado: minimizar no borra la conversación ni corta una respuesta en curso. */}
        <ChatPanel variant="embedded" greeting={greeting} sourceLabel={sourceLabel} onAssistantReply={onReply} />
      </section>

      <button
        ref={bubbleRef}
        type="button"
        onClick={() => (open ? hide() : show())}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? `Cerrar a ${institution.assistant.name}` : unread ? `Abrir a ${institution.assistant.name}, tu asistente virtual (respuesta nueva)` : `Abrir a ${institution.assistant.name}, tu asistente virtual`}
        className={cn(
          "pointer-events-auto relative inline-flex size-14 items-center justify-center rounded-full bg-primary text-on-primary",
          "shadow-[0_10px_30px_-6px_color-mix(in_srgb,var(--primary)_55%,transparent)] transition-transform duration-200 hover:scale-105 active:scale-95",
        )}
      >
        {open ? <X aria-hidden className="size-6" /> : <ClipoIcon className="size-9" />}
        {unread && !open && (
          <span aria-hidden className="absolute top-0.5 right-0.5 size-3.5 rounded-full border-2 border-[var(--bg)] bg-accent" />
        )}
      </button>
    </div>
  );
}
