"use client";
import { Mic, PhoneOff, SendHorizontal, Hand } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { VoiceState } from "./useVoiceConversation";

const LABEL: Record<Exclude<VoiceState, "off">, string> = {
  listening: "Te escucho…",
  thinking: "Pensando…",
  speaking: "El asesor está hablando",
  paused: "En pausa. Toca el micrófono para hablar",
};

/** Controles del modo voz: reemplazan la caja de texto mientras dura la conversación. */
export function VoiceControls({
  state,
  interim,
  compact,
  onInterrupt,
  onFinishSpeaking,
  onStop,
}: {
  state: Exclude<VoiceState, "off">;
  interim: string;
  compact?: boolean;
  onInterrupt: () => void;
  onFinishSpeaking: () => void;
  onStop: () => void;
}) {
  const orbAction = state === "listening" ? onFinishSpeaking : onInterrupt;
  const orbLabel =
    state === "listening" ? "Ya terminé de hablar" : state === "paused" ? "Hablar" : "Interrumpir al asesor y hablar";

  return (
    <div className={cn("flex items-center gap-3", compact ? "py-1" : "py-2")}>
      <button
        type="button"
        onClick={orbAction}
        aria-label={orbLabel}
        data-state={state}
        className={cn("voice-orb relative grid shrink-0 place-items-center rounded-full", compact ? "size-14" : "size-16")}
      >
        <span aria-hidden className="voice-orb-ring" />
        <span aria-hidden className="voice-orb-ring voice-orb-ring--late" />
        {state === "speaking" || state === "thinking" ? <Hand aria-hidden className="relative size-6" /> : <Mic aria-hidden className="relative size-6" />}
      </button>

      <div className="min-w-0 flex-1">
        {/* Solo el estado se anuncia; el texto en vivo cambia demasiado rápido para un lector de pantalla. */}
        <p role="status" className="text-sm font-medium">{LABEL[state]}</p>
        <p className="line-clamp-2 text-sm text-muted" aria-hidden>
          {interim || (state === "listening" ? "Habla con naturalidad; envío al hacer una pausa." : state === "speaking" ? "Toca la mano para interrumpir." : " ")}
        </p>
      </div>

      {state === "listening" && interim && (
        <Button variant="ghost" onClick={onFinishSpeaking} aria-label="Enviar ahora" className="size-11 px-0">
          <SendHorizontal aria-hidden className="size-5" />
        </Button>
      )}
      <Button variant="secondary" onClick={onStop} aria-label="Terminar conversación por voz" className="size-11 shrink-0 px-0">
        <PhoneOff aria-hidden className="size-5" />
      </Button>
    </div>
  );
}
