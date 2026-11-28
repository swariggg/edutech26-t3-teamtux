"use client";
import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
export interface Prefs {
  theme: ThemePref;
  textScale: number;
  contrast: "normal" | "high";
  motion: "auto" | "reduce";
  transparency: "auto" | "reduce";
  font: "default" | "dyslexic";
}
export const DEFAULT_PREFS: Prefs = { theme: "system", textScale: 1, contrast: "normal", motion: "auto", transparency: "auto", font: "default" };
export const TEXT_SCALES = [0.9, 1, 1.125, 1.25, 1.5] as const;
const KEY = "ea-prefs";

/** Script inline (antes del primer pintado) que aplica las preferencias guardadas sin parpadeo. */
export const PREFS_INIT_SCRIPT = `(function(){var d=document.documentElement;function pick(v,a,f){return a.indexOf(v)>=0?v:f}var p={};try{p=JSON.parse(localStorage.getItem("${KEY}")||"{}");if(!p||typeof p!=="object")p={}}catch(e){p={}}var t=pick(p.theme,["light","dark","system"],"system");var r=t==="system"?(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;d.dataset.theme=r;d.dataset.themePref=t;d.dataset.contrast=pick(p.contrast,["normal","high"],"normal");d.dataset.motion=pick(p.motion,["auto","reduce"],"auto");d.dataset.transparency=pick(p.transparency,["auto","reduce"],"auto");d.dataset.font=pick(p.font,["default","dyslexic"],"default");d.style.setProperty("--text-scale",String(pick(p.textScale,[0.9,1,1.125,1.25,1.5],1)));})();`;

let current: Prefs | null = null;
const listeners = new Set<() => void>();

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Normaliza lo guardado: cualquier valor desconocido o corrupto vuelve al predeterminado. */
function sanitize(raw: unknown): Prefs {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    theme: pick(p.theme, ["light", "dark", "system"] as const, DEFAULT_PREFS.theme),
    textScale: pick(p.textScale, TEXT_SCALES, DEFAULT_PREFS.textScale as (typeof TEXT_SCALES)[number]),
    contrast: pick(p.contrast, ["normal", "high"] as const, DEFAULT_PREFS.contrast),
    motion: pick(p.motion, ["auto", "reduce"] as const, DEFAULT_PREFS.motion),
    transparency: pick(p.transparency, ["auto", "reduce"] as const, DEFAULT_PREFS.transparency),
    font: pick(p.font, ["default", "dyslexic"] as const, DEFAULT_PREFS.font),
  };
}

function read(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    return sanitize(raw ? JSON.parse(raw) : {});
  } catch {
    return DEFAULT_PREFS;
  }
}

function resolveTheme(t: ThemePref): "light" | "dark" {
  if (t !== "system") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(p: Prefs) {
  const d = document.documentElement;
  d.dataset.theme = resolveTheme(p.theme);
  d.dataset.themePref = p.theme;
  d.dataset.contrast = p.contrast;
  d.dataset.motion = p.motion;
  d.dataset.transparency = p.transparency;
  d.dataset.font = p.font;
  d.style.setProperty("--text-scale", String(p.textScale));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => { const p = getSnapshot(); if (p.theme === "system") apply(p); };
  mq.addEventListener("change", onScheme);
  // Sincroniza cambios hechos en otra pestaña.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== null) return;
    current = read();
    apply(current);
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); mq.removeEventListener("change", onScheme); window.removeEventListener("storage", onStorage); };
}

function getSnapshot(): Prefs {
  if (!current) current = read();
  return current;
}

export function setPrefs(patch: Partial<Prefs>) {
  current = sanitize({ ...getSnapshot(), ...patch });
  try { window.localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* almacenamiento no disponible */ }
  apply(current);
  listeners.forEach((l) => l());
}

export function resetPrefs() { setPrefs(DEFAULT_PREFS); }

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PREFS);
}

/** true si el usuario o el sistema piden menos movimiento. */
export function useReducedMotion(): boolean {
  const prefs = usePrefs();
  const system = useSyncExternalStore(
    (cb) => { const mq = window.matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  return prefs.motion === "reduce" || system;
}
