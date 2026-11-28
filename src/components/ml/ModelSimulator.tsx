"use client";
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import bundleJson from "@/ml/modelos.json";
import { argmax, CLASSES, MODEL_IDS, MODEL_META, predictProba, type FeatureVector, type ModelBundle } from "@/ml/inference";
import { classMeta, pct } from "@/ml/labels";

const bundle = bundleJson as unknown as ModelBundle;
const BASE_FEE = 185;
const BECAS = [0, 10, 25, 50];

function NumberField({ id, label, value, min, max, onChange, hint }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} className="min-h-11 w-full rounded-md border border-line bg-surface px-3 tabular-nums" aria-describedby={hint ? `${id}-h` : undefined} />
      {hint && <p id={`${id}-h`} className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Simulador «¿qué pasaría si?»: los 3 modelos se ejecutan en el navegador con la misma lógica que el servidor. */
export function ModelSimulator() {
  const [hijos, setHijos] = useState(1);
  const [beca, setBeca] = useState(0);
  const [meses, setMeses] = useState(2);
  const [puntuales, setPuntuales] = useState(1);
  const [tardes, setTardes] = useState(1);
  const [impagos, setImpagos] = useState(0);

  const hist = meses * hijos;
  const p = Math.min(puntuales, hist);
  const t = Math.min(tardes, hist - p);
  const i = Math.min(impagos, hist - p - t);
  const resto = hist - p - t - i; // se asume puntual para que las tasas sumen 1
  const features: FeatureVector = {
    obligaciones_mes: hijos,
    valor_mes: hijos * BASE_FEE * (1 - beca / 100),
    meses_historial: meses,
    obligaciones_historial: hist,
    tasa_puntualidad: hist ? (p + resto) / hist : 0,
    tasa_tardanza: hist ? t / hist : 0,
    tasa_incumplimiento: hist ? i / hist : 0,
  };
  const results = MODEL_IDS.map((id) => ({ id, proba: predictProba(bundle[id], features) }));

  return (
    <GlassCard as="section" aria-labelledby="simulador" className="flex flex-col gap-4 p-5">
      <div>
        <h2 id="simulador" className="text-lg font-semibold">Simulador: ¿qué predice cada modelo?</h2>
        <p className="text-sm text-muted">Describe una familia y compara la respuesta de los 3 modelos. Pensión base {`$${BASE_FEE}`} por hijo, con beca aplicada.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Datos de la familia</legend>
          <NumberField id="sim-hijos" label="Hijos matriculados" value={hijos} min={1} max={4} onChange={setHijos} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sim-beca" className="text-sm font-medium">Beca</label>
            <select id="sim-beca" value={beca} onChange={(e) => setBeca(Number(e.target.value))} className="min-h-11 rounded-md border border-line bg-surface px-3">
              {BECAS.map((b) => <option key={b} value={b}>{b}%</option>)}
            </select>
          </div>
          <NumberField id="sim-meses" label="Meses de historial" value={meses} min={0} max={2} onChange={setMeses} hint="Los modelos se entrenaron con 1–2 meses." />
          <div className="flex flex-col justify-end pb-1 text-sm text-muted">Pensiones en historial: <strong className="text-foreground tabular-nums">{hist}</strong></div>
          <NumberField id="sim-p" label="Pagadas a tiempo" value={p} min={0} max={hist} onChange={setPuntuales} />
          <NumberField id="sim-t" label="Pagadas tarde (día > 10)" value={t} min={0} max={hist} onChange={setTardes} />
          <NumberField id="sim-i" label="No pagadas" value={i} min={0} max={hist} onChange={setImpagos} hint={resto > 0 ? `${resto} sin especificar se cuentan como a tiempo.` : undefined} />
        </fieldset>

        <div className="flex flex-col gap-4" aria-live="polite">
          {results.map(({ id, proba }) => {
            const pred = argmax(proba);
            return (
              <div key={id} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span aria-hidden className="size-3 rounded-full" style={{ background: MODEL_META[id].color }} />
                    {MODEL_META[id].label}
                  </span>
                  <Badge tone={classMeta[pred].tone}>{classMeta[pred].label} · {pct(proba[pred])}</Badge>
                </div>
                <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
                  {CLASSES.map((c) => <div key={c} style={{ width: `${proba[c] * 100}%`, background: classMeta[c].color }} />)}
                </div>
                <p className="text-xs tabular-nums text-muted">
                  {CLASSES.map((c) => `${classMeta[c].label} ${pct(proba[c])}`).join(" · ")}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
