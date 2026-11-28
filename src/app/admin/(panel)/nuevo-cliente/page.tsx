import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { GlassCard } from "@/components/ui/GlassCard";
import { NewClientEvaluator } from "@/components/ml/NewClientEvaluator";
import { NewClientImportance } from "@/components/ml/NewClientImportance";
import { MODEL_IDS, MODEL_META } from "@/ml/inference";
import { ncBundle } from "@/ml/nuevo-cliente";
import { pct } from "@/ml/labels";

export const metadata: Metadata = { title: "Evaluar cliente nuevo" };

export default function NuevoClientePage() {
  const { meta, modelos } = ncBundle;
  const rows = [
    { label: "AUC (0,5 = azar · 1 = perfecto)", get: (id: (typeof MODEL_IDS)[number]) => modelos[id].metrics.auc.toFixed(2) },
    { label: "Detecta impagos (recall)", get: (id: (typeof MODEL_IDS)[number]) => pct(modelos[id].metrics.recall) },
    { label: "Acierta cuando alerta (precisión)", get: (id: (typeof MODEL_IDS)[number]) => pct(modelos[id].metrics.precision) },
    { label: "Exactitud", get: (id: (typeof MODEL_IDS)[number]) => pct(modelos[id].metrics.accuracy) },
  ];
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">¿Es propensa a no pagar una familia nueva?</h1>
        <p className="text-muted">
          Tres modelos estiman el riesgo de que una familia que recién se matricula deje alguna pensión sin pagar, comparándola con las {meta.familias} familias del colegio.
          Para familias que ya tienen historial, usa <Link href="/admin/modelos" className="font-medium text-primary hover:underline">Modelos IA</Link>.
        </p>
      </div>

      <NewClientEvaluator />

      <Alert tone="warning" title="Qué tan confiable es">
        Con los datos actuales la señal es débil: AUC de {MODEL_IDS.map((id) => `${MODEL_META[id].short} ${modelos[id].metrics.auc.toFixed(2)}`).join(", ")}, apenas por encima del azar (0,50).
        Lo que más distingue el riesgo es el número de hijos (más pensiones al mes). Úsalo para decidir a quién acompañar más de cerca (recordatorios, acuerdo de pago), nunca para negar una matrícula.
      </Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard as="section" aria-labelledby="calidad" className="flex flex-col gap-3 p-5">
          <div>
            <h2 id="calidad" className="text-lg font-semibold">Calidad de los modelos</h2>
            <p className="text-sm text-muted">
              Validación cruzada de 5 partes sobre {meta.familias} familias. El {pct(meta.tasa_impago)} tuvo al menos una pensión impaga entre sep-2025 y ene-2026;
              decir siempre «paga» acertaría el {pct(meta.referencia_accuracy)} pero no detectaría ningún impago.
            </p>
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Métricas de los modelos de cliente nuevo">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Métricas de validación cruzada por modelo</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-semibold text-muted">Métrica</th>
                  {MODEL_IDS.map((id) => (
                    <th key={id} scope="col" className="px-3 py-2 text-right font-semibold text-muted">
                      <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full" style={{ background: MODEL_META[id].color }} />{MODEL_META[id].label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-line/60 last:border-0">
                    <th scope="row" className="py-2 pr-3 font-medium">{r.label}</th>
                    {MODEL_IDS.map((id) => <td key={id} className="px-3 py-2 text-right tabular-nums">{r.get(id)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            Datos usados: hijos a matricular, beca, valor mensual, curso del menor y del mayor, y si alguno tiene necesidad educativa especial. Script: <code>Modelos/entrenar_nuevo_cliente.py</code>. Datos sintéticos.
          </p>
        </GlassCard>
        <NewClientImportance />
      </div>
    </>
  );
}
