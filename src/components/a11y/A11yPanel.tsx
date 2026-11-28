"use client";
import { useId, useRef } from "react";
import { PersonStanding, RotateCcw, X } from "lucide-react";
import { resetPrefs, setPrefs, TEXT_SCALES, usePrefs } from "@/components/providers/preferences";
import { ThemeToggle } from "./ThemeToggle";
import { useRovingRadio } from "./useRovingRadio";
import { cn } from "@/lib/cn";

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="font-medium">{label}</label>
        {hint && <p id={`${id}-h`} className="text-sm text-muted">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-h` : undefined}
        onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full border transition-colors", checked ? "border-primary bg-primary" : "border-line bg-surface")}
      >
        <span aria-hidden className={cn("absolute top-0.5 left-0 size-5.5 rounded-full shadow transition-transform", checked ? "translate-x-5.5 bg-on-primary" : "translate-x-0.5 bg-muted")} />
      </button>
    </div>
  );
}

export function A11yPanel() {
  const ref = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const prefs = usePrefs();
  const titleId = useId();
  const sizes = useRovingRadio(TEXT_SCALES, prefs.textScale as (typeof TEXT_SCALES)[number], (s) => setPrefs({ textScale: s }));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => ref.current?.showModal()}
        className="glass-inset inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium hover:text-primary"
        aria-haspopup="dialog"
      >
        <PersonStanding aria-hidden className="size-5" />
        <span className="sr-only sm:not-sr-only">Accesibilidad</span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="glass glass-strong fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl p-0 text-foreground backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        <div className="p-6">
          <div className="mb-2 flex items-center justify-between gap-4">
            <h2 id={titleId} className="text-xl font-semibold">Preferencias de accesibilidad</h2>
            <button type="button" onClick={() => ref.current?.close()} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Cerrar">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <p className="mb-4 text-sm text-muted">Se guardan en este dispositivo.</p>

          <fieldset className="border-b border-line pb-4">
            <legend className="mb-2 font-medium">Tema</legend>
            <ThemeToggle showLabels />
          </fieldset>

          <fieldset className="border-b border-line py-4">
            <legend className="mb-2 font-medium">Tamaño del texto</legend>
            <div role="radiogroup" aria-label="Tamaño del texto" className="flex flex-wrap gap-2" {...sizes.groupProps}>
              {TEXT_SCALES.map((s, i) => (
                <button
                  key={s}
                  {...sizes.itemProps(i)}
                  type="button"
                  role="radio"
                  aria-checked={prefs.textScale === s}
                  onClick={() => setPrefs({ textScale: s })}
                  className={cn("min-h-11 min-w-14 rounded-md border px-3 font-medium", prefs.textScale === s ? "border-primary bg-primary text-on-primary" : "border-line hover:border-primary")}
                >
                  {Math.round(s * 100)}%
                </button>
              ))}
            </div>
          </fieldset>

          <div className="divide-y divide-line">
            <Switch label="Alto contraste" hint="Texto más marcado y superficies sólidas." checked={prefs.contrast === "high"} onChange={(v) => setPrefs({ contrast: v ? "high" : "normal" })} />
            <Switch label="Reducir movimiento" hint="Desactiva animaciones y transiciones." checked={prefs.motion === "reduce"} onChange={(v) => setPrefs({ motion: v ? "reduce" : "auto" })} />
            <Switch label="Reducir transparencia" hint="Reemplaza el efecto vidrio por superficies sólidas." checked={prefs.transparency === "reduce"} onChange={(v) => setPrefs({ transparency: v ? "reduce" : "auto" })} />
            <Switch label="Fuente de lectura fácil" hint="Atkinson Hyperlegible, con más espacio entre letras." checked={prefs.font === "dyslexic"} onChange={(v) => setPrefs({ font: v ? "dyslexic" : "default" })} />
          </div>

          <button type="button" onClick={resetPrefs} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-medium text-primary hover:underline">
            <RotateCcw aria-hidden className="size-4" /> Restablecer
          </button>
        </div>
      </dialog>
    </>
  );
}
