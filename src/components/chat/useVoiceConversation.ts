"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Conversación por voz manos libres con el asesor:
 * escucha → envía lo dicho → lee la respuesta en voz alta mientras llega (frase a frase) → vuelve a escuchar.
 *
 * Usa solo APIs del navegador (Web Speech): reconocimiento de voz (Chrome, Edge, Safari) y síntesis de voz.
 * En Chrome el audio del micrófono lo procesa el servicio de voz de Google; no se guarda audio en nuestro servidor.
 */

export type VoiceState = "off" | "listening" | "thinking" | "speaking" | "paused";

/** Envía el texto al asesor. onDelta recibe el texto acumulado; resuelve con la respuesta completa o null si falló. */
export type AskFn = (text: string, onDelta: (acc: string) => void) => Promise<string | null>;

// Tipos mínimos de Web Speech (no están en lib.dom de TypeScript).
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Voz en español más natural disponible: prioriza voces «Natural»/«Google» (de red, mejor calidad) y Latinoamérica. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  if (voices.length === 0) return null;
  const score = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase();
    let s = 0;
    if (/natural|neural|online/i.test(v.name)) s += 4;
    if (/google/i.test(v.name)) s += 3;
    if (/es[-_](ec|419|us|mx|co|pe)/.test(lang)) s += 2;
    if (!v.localService) s += 1;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0]!;
}

const SECTION_NAMES: Record<string, string> = { admision: "Admisión", estado: "Estado", pagos: "Pagos", asesor: "Asesor" };

/** Quita el formato Markdown y convierte rutas de la web en algo que se pueda decir. */
export function toSpeech(text: string): string {
  return text
    .replace(/\*\*|__|`|#+\s?/g, "")
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/https?:\/\/\S+/g, "el enlace en pantalla")
    .replace(/(^|\s)\/(admision|estado|pagos|asesor)\b/gi, (_, sp: string, path: string) => `${sp}la sección ${SECTION_NAMES[path.toLowerCase()]}`)
    .replace(/\s+/g, " ")
    .trim();
}

/** Índice hasta donde hay frases completas para leer (fin de oración, salto de línea o, si es muy largo, una coma). */
function speakableEnd(text: string): number {
  let end = 0;
  const re = /[.!?…:;](?=\s)|\n/g;
  for (let m = re.exec(text); m; m = re.exec(text)) end = m.index + 1;
  if (end === 0 && text.length > 160) {
    const comma = text.lastIndexOf(", ");
    if (comma > 40) end = comma + 1;
  }
  return end;
}

const MAX_SILENT_TRIES = 2;

export function useVoiceConversation(ask: AskFn, abortAsk: () => void) {
  const [state, setState] = useState<VoiceState>("off");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const askRef = useRef(ask);
  const abortRef = useRef(abortAsk);
  useEffect(() => { askRef.current = ask; abortRef.current = abortAsk; });

  const activeRef = useRef(false);
  const recRef = useRef<Recognition | null>(null);
  const turnRef = useRef(0); // invalida callbacks de turnos anteriores (cancelar dispara onend de lo pendiente)
  const pendingRef = useRef(0); // frases en cola de la síntesis
  const replyDoneRef = useRef(false);
  const silentRef = useRef(0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const utterancesRef = useRef(new Set<SpeechSynthesisUtterance>()); // evita que Chrome las recolecte a mitad de frase
  const listenRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => { voiceRef.current = pickVoice(); };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const stopRecognition = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { rec.onresult = rec.onerror = rec.onend = null; rec.abort(); }
  }, []);

  const speak = useCallback((chunk: string, turn: number) => {
    const text = toSpeech(chunk);
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceRef.current?.lang ?? "es-ES";
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = 1.05;
    pendingRef.current += 1;
    utterancesRef.current.add(u);
    u.onstart = () => { if (turn === turnRef.current) setState("speaking"); };
    u.onend = u.onerror = () => {
      utterancesRef.current.delete(u);
      if (turn !== turnRef.current) return;
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      if (pendingRef.current === 0 && replyDoneRef.current) listenRef.current();
    };
    window.speechSynthesis.speak(u);
  }, []);

  const respond = useCallback(async (text: string) => {
    const turn = ++turnRef.current;
    pendingRef.current = 0;
    replyDoneRef.current = false;
    setState("thinking");
    setInterim(text);
    let spoken = 0;
    const reply = await askRef.current(text, (acc) => {
      if (turn !== turnRef.current) return;
      const end = speakableEnd(acc.slice(spoken));
      if (end > 0) { speak(acc.slice(spoken, spoken + end), turn); spoken += end; }
    });
    if (turn !== turnRef.current || !activeRef.current) return;
    if (reply === null) { setState("paused"); return; } // el error ya se muestra en el chat
    speak(reply.slice(spoken), turn);
    replyDoneRef.current = true;
    if (pendingRef.current === 0) listenRef.current();
  }, [speak]);

  const listen = useCallback(() => {
    if (!activeRef.current) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    stopRecognition();
    const turn = ++turnRef.current;
    const rec = new Ctor();
    rec.lang = "es-EC";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    let fatal = false;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += r[0].transcript;
        else live += r[0].transcript;
      }
      setInterim((finalText + live).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      fatal = true;
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "No tenemos permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones y vuelve a intentar."
          : e.error === "network"
            ? "No pudimos conectar con el servicio de reconocimiento de voz. Revisa tu conexión; algunos navegadores (como Brave) lo bloquean: prueba con Chrome o Edge."
            : e.error === "audio-capture"
              ? "No encontramos un micrófono disponible."
              : "No pudimos escucharte. Intenta de nuevo.",
      );
    };
    rec.onend = () => {
      if (turn !== turnRef.current || !activeRef.current) return;
      recRef.current = null;
      const text = finalText.trim();
      if (fatal) { activeRef.current = false; setState("off"); return; }
      if (text) { silentRef.current = 0; void respond(text); return; }
      // Silencio: reintenta un par de veces y luego espera a que la persona toque para hablar.
      if (++silentRef.current <= MAX_SILENT_TRIES) listenRef.current();
      else { setState("paused"); setInterim(""); }
    };
    recRef.current = rec;
    setInterim("");
    setError(null);
    setState("listening");
    try { rec.start(); } catch { setState("paused"); }
  }, [respond, stopRecognition]);

  useEffect(() => { listenRef.current = listen; }, [listen]);

  const start = useCallback(() => {
    if (!getRecognitionCtor() || !("speechSynthesis" in window)) {
      setError("Tu navegador no permite conversar por voz. Usa Chrome, Edge o Safari, o escribe tu pregunta.");
      return;
    }
    activeRef.current = true;
    silentRef.current = 0;
    // «Desbloquea» la síntesis dentro del gesto del usuario (Chrome y Safari la bloquean si no).
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    listen();
  }, [listen]);

  /** Corta lo que dice el asesor (o la pausa) y escucha de nuevo. */
  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    turnRef.current += 1;
    abortRef.current();
    window.speechSynthesis.cancel();
    pendingRef.current = 0;
    silentRef.current = 0;
    listen();
  }, [listen]);

  /** Envía ya lo que se lleva dicho, sin esperar la pausa natural. */
  const finishSpeaking = useCallback(() => recRef.current?.stop(), []);

  const stop = useCallback(() => {
    activeRef.current = false;
    turnRef.current += 1;
    stopRecognition();
    abortRef.current();
    window.speechSynthesis?.cancel();
    pendingRef.current = 0;
    setState("off");
    setInterim("");
  }, [stopRecognition]);

  // Al desmontar: suelta el micrófono y calla la voz.
  useEffect(() => () => {
    activeRef.current = false;
    stopRecognition();
    window.speechSynthesis?.cancel();
  }, [stopRecognition]);

  const clearError = useCallback(() => setError(null), []);
  return { state, interim, error, start, stop, interrupt, finishSpeaking, clearError };
}
