"use client";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { MODEL_IDS, MODEL_META } from "@/ml/inference";
import { BASE_FEE, BECAS, evaluateFamily, GRADOS, type NewFamily, type RiskLevel } from "@/ml/nuevo-cliente";
import { pct } from "@/ml/labels";
import { formatMoney } from "@/domain/format";
import type { Tone } from "@/domain/labels";

const levelMeta: Record<RiskLevel, { label: string; tone: Tone; text: string }> = {
  bajo: { label: "Riesgo bajo", tone: "success", text: "El perfil se parece más a familias que pagaron todas sus pensiones." },
  medio: { label: "Riesgo medio", tone: "warning", text: "La probabilidad está cerca del 50%: perfil intermedio. Conviene darle seguimiento en los primeros meses." },
  alto: { label: "Riesgo alto", tone: "danger", text: "El perfil se parece más a familias que dejaron alguna pensión sin pagar. Sugerencia: acordar fecha y medio de pago al matricular, recordatorio antes del día 5." },
};

const MAX_HIJOS = 3;

export function NewClientEvaluator() {
  const [family, setFamily] = useState<NewFamily>({ hijos: [{ grado: 8, nee: false }], beca: 0 });
  const r = evaluateFamily(family);
  const meta = levelMeta[r.nivel];

  const setHijo = (i: number, patch: Partial<NewFamily["hijos"][number]>) =>
    setFamily((f) => ({ ...f, hijos: f.hijos.map((h, j) => (j === i ? { ...h, ...patch } : h)) }));

  return (
    <GlassCard as="section" aria-labelledby="nuevo-cliente" className="flex flex-col gap-5 p-5">
      <div>
        <h2 id="nuevo-cliente" className="text-lg font-semibold">Datos de la familia</h2>
        <p className="text-sm text-muted">Solo lo que se conoce al matricular. Pensión base {formatMoney(BASE_FEE)} por hijo, con la beca aplicada.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} aria-label="Datos de la familia nueva">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">Hijos a matricular ({family.hijos.length})</legend>
            {family.hijos.map((h, i) => (
              <div key={i} className="glass-inset flex flex-wrap items-end gap-3 rounded-lg p-3">
                <div className="flex min-w-36 flex-1 flex-col gap-1.5">
                  <label htmlFor={`nc-grado-${i}`} className="text-sm font-medium">Curso · hijo {i + 1}</label>
                  <select id={`nc-grado-${i}`} value={h.grado} onChange={(e) => setHijo(i, { grado: Number(e.target.value) })} className="min-h-11 rounded-md border border-line bg-surface px-3">
                    {GRADOS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={h.nee} onChange={(e) => setHijo(i, { nee: e.target.checked })} className="size-5 accent-[var(--primary)]" />
                  <span>Necesidad educativa especial<span className="sr-only"> del hijo {i + 1}</span></span>
                </label>
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" className={buttonClass("secondary", "md")} disabled={family.hijos.length >= MAX_HIJOS} onClick={() => setFamily((f) => ({ ...f, hijos: [...f.hijos, { grado: 8, nee: false }] }))}>
                <Plus aria-hidden className="size-4" /> Agregar hijo
              </button>
              <button type="button" className={buttonClass("ghost", "md")} disabled={family.hijos.length <= 1} onClick={() => setFamily((f) => ({ ...f, hijos: f.hijos.slice(0, -1) }))}>
                <Minus aria-hidden className="size-4" /> Quitar
              </button>
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nc-beca" className="text-sm font-medium">Beca</label>
            <select id="nc-beca" value={family.beca} onChange={(e) => setFamily((f) => ({ ...f, beca: Number(e.target.value) }))} className="min-h-11 max-w-48 rounded-md border border-line bg-surface px-3">
              {BECAS.map((b) => <option key={b} value={b}>{b}%</option>)}
            </select>
          </div>
          <p className="text-sm text-muted">Valor mensual: <strong className="text-foreground tabular-nums">{formatMoney(r.features.valor_mensual)}</strong></p>
        </form>

        <div className="flex flex-col gap-4" aria-live="polite">
          <div className="glass-inset flex flex-col gap-2 rounded-lg p-4">
            <p className="text-sm font-medium text-muted">Resultado</p>
            <div className="flex flex-wrap items-baseline gap-3">
              <Badge tone={meta.tone} className="text-base">{meta.label}</Badge>
              <span className="font-heading text-3xl font-semibold tabular-nums">{pct(r.promedio)}</span>
              <span className="text-sm text-muted">probabilidad media de impago · {r.votosImpago} de 3 modelos dicen «propenso a no pagar»</span>
            </div>
            <p className="text-sm text-muted">{meta.text}</p>
          </div>

          {MODEL_IDS.map((id) => {
            const p = r.perModel[id];
            const impago = p >= 0.5;
            return (
              <div key={id} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span aria-hidden className="size-3 rounded-full" style={{ background: MODEL_META[id].color }} />
                    {MODEL_META[id].label}
                  </span>
                  <Badge tone={impago ? "danger" : "success"}>{impago ? "Propenso a no pagar" : "Paga"} · {pct(p)}</Badge>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg-muted)_18%,transparent)]" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: impago ? "var(--danger)" : "var(--success)" }} />
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-foreground/60" title="Umbral 50%" />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted">La línea central marca el umbral del 50%: a partir de ahí el modelo clasifica a la familia como propensa a no pagar.</p>
        </div>
      </div>
    </GlassCard>
  );
}
