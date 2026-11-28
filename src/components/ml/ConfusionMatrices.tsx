import { GlassCard } from "@/components/ui/GlassCard";
import { CLASSES, MODEL_IDS, MODEL_META } from "@/ml/inference";
import { classMeta, pct } from "@/ml/labels";
import type { MlDashboard } from "@/ml/dashboard";

/** Matrices de confusión: filas = real, columnas = predicho. Intensidad = % de la fila (secuencial, un solo tono). */
export function ConfusionMatrices({ data }: { data: MlDashboard }) {
  return (
    <GlassCard as="section" aria-labelledby="confusion" className="flex flex-col gap-4 p-5">
      <div>
        <h2 id="confusion" className="text-lg font-semibold">Matrices de confusión</h2>
        <p className="text-sm text-muted">Filas: lo que realmente pasó. Columnas: lo que predijo el modelo. La diagonal son los aciertos; el % es sobre la fila.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {MODEL_IDS.map((id) => {
          const cm = data.metrics[id].confusion;
          return (
            <div key={id} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <span aria-hidden className="size-3 rounded-full" style={{ background: MODEL_META[id].color }} />
                {MODEL_META[id].label}
              </h3>
              <table className="w-full table-fixed border-separate border-spacing-0.5 text-sm">
                <caption className="sr-only">Matriz de confusión de {MODEL_META[id].label}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-[34%] text-left text-xs font-medium text-muted">Real ↓ / Pred →</th>
                    {CLASSES.map((c) => <th key={c} scope="col" className="truncate px-1 text-xs font-medium text-muted">{classMeta[c].label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CLASSES.map((r) => {
                    const total = CLASSES.reduce((s, c) => s + cm[r][c], 0) || 1;
                    return (
                      <tr key={r}>
                        <th scope="row" className="truncate pr-1 text-left text-xs font-medium">{classMeta[r].label}</th>
                        {CLASSES.map((c) => {
                          const share = cm[r][c] / total;
                          return (
                            <td
                              key={c}
                              className={`rounded-md px-1 py-2 text-center tabular-nums ${r === c ? "font-semibold ring-1 ring-inset ring-primary/60" : ""}`}
                              style={{ background: `color-mix(in srgb, var(--primary) ${Math.round(share * 70)}%, transparent)`, color: share > 0.55 ? "var(--on-primary)" : undefined }}
                              title={`Real ${classMeta[r].label}, predicho ${classMeta[c].label}: ${cm[r][c]} (${pct(share)})`}
                            >
                              {cm[r][c]}
                              <span className="block text-[0.7rem] opacity-80">{pct(share)}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
