"use client";
import { institution } from "@/content/institution";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUp, AudioLines, RotateCcw, Square } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { VoiceControls } from "./VoiceControls";
import { useVoiceConversation } from "./useVoiceConversation";
import { LiveRegion } from "@/components/a11y/LiveRegion";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Msg = { role: "user" | "assistant"; content: string };

/** Turnos enviados al servidor (el servidor vuelve a recortar). */
const MAX_TURNS = 20;
const MAX_ASSISTANT_CHARS = 4000;

const SUGGESTIONS = ["¿Qué requisitos necesito?", "¿Cuánto cuesta la pensión?", "¿Cómo consulto mi estado?", "¿Qué métodos de pago aceptan?"];

export function ChatPanel({
  greeting,
  sourceLabel,
  variant = "page",
  onAssistantReply,
}: {
  greeting: string;
  sourceLabel: string;
  /** page: tarjeta de página completa (/asesor). embedded: ocupa el contenedor (burbuja flotante). */
  variant?: "page" | "embedded";
  /** Se llama cuando termina una respuesta (p. ej. para marcar «no leído» si el chat está minimizado). */
  onAssistantReply?: () => void;
}) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const helpId = `${uid}-help`;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Aborta el stream si se abandona la página (evita setState tras desmontar y gasto de tokens).
  useEffect(() => () => abortRef.current?.abort(), []);

  const scrollToEnd = () => requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }));

  /**
   * Envía una pregunta y transmite la respuesta. Devuelve el texto completo, o null si falló o se detuvo.
   * voice: pide respuesta oral (frases cortas) y reporta cada fragmento para leerlo en voz alta.
   */
  async function send(text: string, opts?: { voice?: boolean; onDelta?: (acc: string) => void }): Promise<string | null> {
    const content = text.trim();
    // En modo voz no se espera al estado de React: interrumpir aborta el stream anterior justo abajo.
    if (!content || (streaming && !opts?.voice)) return null;
    sessionRef.current ??= crypto.randomUUID();
    abortRef.current?.abort();
    const history: Msg[] = [...messages.filter((m) => m.content.trim() !== ""), { role: "user", content }];
    setMessages(history);
    setAnnouncement(`${institution.assistant.name} está escribiendo…`);
    // Solo turnos no vacíos y recientes; las respuestas largas se recortan para no invalidar el pedido.
    const payload = history.slice(-MAX_TURNS).map((m) => (m.role === "assistant" ? { ...m, content: m.content.slice(0, MAX_ASSISTANT_CHARS) } : m));
    setInput("");
    setError(null);
    setStreaming(true);
    setWaiting(true);
    scrollToEnd();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: payload, sessionId: sessionRef.current, mode: opts?.voice ? "voice" : "text" }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `No pudimos conectar con ${institution.assistant.name}.`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setWaiting(false);
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
        opts?.onDelta?.(acc);
        scrollToEnd();
      }
      setAnnouncement(acc.trim() ? `${institution.assistant.name} respondió: ${acc.trim()}` : "");
      if (acc.trim()) onAssistantReply?.();
      return acc;
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        const msg = e instanceof Error ? e.message : "Error inesperado";
        setError(msg);
        setAnnouncement("");
      } else {
        setAnnouncement("Respuesta detenida.");
      }
      return null;
    } finally {
      // Quita una respuesta vacía (detenida antes del primer fragmento o con error temprano).
      setMessages((m) => (m.at(-1)?.role === "assistant" && m.at(-1)?.content === "" ? m.slice(0, -1) : m));
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStreaming(false);
        setWaiting(false);
        if (!opts?.voice) inputRef.current?.focus();
      }
    }
  }

  // La voz llama siempre a la versión más reciente de send (con el historial actualizado).
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });
  const voice = useVoiceConversation(
    (text, onDelta) => sendRef.current(text, { voice: true, onDelta }),
    () => abortRef.current?.abort(),
  );
  const voiceOn = voice.state !== "off";

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className={cn("flex flex-col overflow-hidden", variant === "page" ? "glass h-[min(78dvh,52rem)] min-h-[28rem] rounded-xl" : "min-h-0 flex-1")}>
      <div className={cn("flex items-center justify-between gap-3 border-b border-line", variant === "page" ? "px-4 py-3" : "min-h-12 px-4 py-1")}>
        <p className={cn("text-muted", variant === "page" ? "text-sm" : "text-xs")}>{sourceLabel}</p>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { voice.stop(); abortRef.current?.abort(); abortRef.current = null; setStreaming(false); setWaiting(false); setMessages([]); setError(null); setAnnouncement(""); sessionRef.current = null; }}>
            <RotateCcw aria-hidden className="size-4" /> {variant === "page" ? "Nueva conversación" : <span className="whitespace-nowrap">Nueva<span className="sr-only"> conversación</span></span>}
          </Button>
        )}
      </div>

      <LiveRegion message={announcement} />
      {/* El log no se anuncia mientras llega cada fragmento; la respuesta completa se anuncia por LiveRegion. */}
      <div ref={logRef} role="log" aria-live="off" aria-busy={streaming} aria-label={`Conversación con ${institution.assistant.name}`} className={cn("flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4", variant === "page" && "sm:p-6")}>
        <ChatMessage role="assistant" content={greeting} />
        {messages.length === 0 && (
          <div className={cn("flex flex-wrap gap-2", variant === "page" ? "pl-12" : "pl-0")} role="group" aria-label="Preguntas sugeridas">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => void send(s)} className="glass-inset min-h-11 rounded-full px-4 text-sm font-medium hover:border-primary hover:text-primary">{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (m.content ? <ChatMessage key={i} role={m.role} content={m.content} /> : null))}
        {waiting && <TypingIndicator />}
        {error && <p role="alert" className="rounded-lg border border-danger/40 p-3 text-sm text-danger">{error}</p>}
        {voice.error && <p role="alert" className="rounded-lg border border-warning/40 p-3 text-sm">{voice.error}</p>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className={cn("border-t border-line p-3", variant === "page" && "sm:p-4")}>
        {voiceOn ? (
          <div className="glass-inset rounded-xl px-3">
            <VoiceControls
              state={voice.state as Exclude<typeof voice.state, "off">}
              interim={voice.interim}
              compact={variant === "embedded"}
              onInterrupt={voice.interrupt}
              onFinishSpeaking={voice.finishSpeaking}
              onStop={() => { voice.stop(); requestAnimationFrame(() => inputRef.current?.focus()); }}
            />
          </div>
        ) : (
        <>
        <label htmlFor={inputId} className="sr-only">Escribe tu pregunta</label>
        <div className="glass-inset flex items-end gap-2 rounded-xl p-2">
          <textarea
            id={inputId}
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={4000}
            placeholder={variant === "page" ? "Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)" : "Escribe tu pregunta…"}
            aria-describedby={helpId}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 placeholder:text-muted/80 focus-visible:outline-none"
          />
          {streaming ? (
            <Button variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Detener respuesta" className="size-11 px-0"><Square aria-hidden className="size-4" /></Button>
          ) : input.trim() ? (
            <Button type="submit" aria-label="Enviar" className="size-11 px-0"><ArrowUp aria-hidden className="size-5" /></Button>
          ) : (
            <Button onClick={() => { voice.clearError(); voice.start(); }} aria-label={`Conversar por voz con ${institution.assistant.name}`} title="Conversar por voz" className="size-11 px-0">
              <AudioLines aria-hidden className="size-5" />
            </Button>
          )}
        </div>
        </>
        )}
        <p id={helpId} className="mt-2 text-xs text-muted">{voiceOn
            ? "Conversación por voz: tu navegador reconoce lo que dices y lee las respuestas. No dictes cédulas ni datos personales."
            : `${institution.assistant.name} puede equivocarse. No compartas contraseñas ni datos de tarjetas.`}</p>
      </form>
    </div>
  );
}
