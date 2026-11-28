import type { Metadata } from "next";
import { AlertOctagon, BrainCircuit, Handshake, Target, Users } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Alert } from "@/components/ui/Alert";
import { MlCharts } from "@/components/ml/MlCharts";
import { ConfusionMatrices } from "@/components/ml/ConfusionMatrices";
import { FamilyPredictions } from "@/components/ml/FamilyPredictions";
import { ModelSimulator } from "@/components/ml/ModelSimulator";
import { getMlDashboard, TRAIN_MONTHS } from "@/ml/dashboard";
import { MODEL_IDS, MODEL_META } from "@/ml/inference";
import { pct } from "@/ml/labels";
import { formatMonth } from "@/domain/format";

export const metadata: Metadata = { title: "Modelos predictivos" };
export const dynamic = "force-dynamic";

export default async function ModelosPage() {
  const data = await getMlDashboard();
  const month = formatMonth(data.predictMonth);
  const view = { ...data, predictMonth: month };
  const best = MODEL_IDS.reduce((b, id) => (data.metrics[id].macroF1 > data.metrics[b].macroF1 ? id : b));
  const atRisk = data.predictions.filter((p) => p.consenso !== "puntual").length;
  const unanimousRisk = data.predictions.filter((p) => p.acuerdo === 3 && p.consenso !== "puntual").length;
  const beatsBaseline = MODEL_IDS.filter((id) => data.metrics[id].macroF1 > data.metrics.base.macroF1);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Modelos predictivos de cobranza</h1>
        <p className="text-muted">
          Tres clasificadores predicen si cada familia pagará la pensión <strong>puntual</strong>, <strong>tarde</strong> (después del día 10) o <strong>no pagará</strong> el mes siguiente,
          a partir de sus {data.window} meses previos. Entrenados con {TRAIN_MONTHS.map(formatMonth).join(" y ")}; evaluados con {data.evalMonths.map(formatMonth).join(" y ")}; pronóstico para {month}.
        </p>
      </div>

      <section aria-label="Indicadores de modelos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Familias pronosticadas" value={String(data.predictions.length)} hint={`Mes ${month}`} Icon={Users} />
        <StatCard label="En riesgo según consenso" value={String(atRisk)} hint={`${unanimousRisk} con los 3 modelos de acuerdo`} Icon={AlertOctagon} tone="danger" />
        <StatCard label="Acuerdo unánime" value={pct(data.unanimous / (data.predictions.length || 1))} hint={`${data.unanimous} familias con la misma predicción en los 3`} Icon={Handshake} tone="accent" />
        <StatCard label="Mejor F1 macro (evaluación)" value={pct(data.metrics[best].macroF1, 1)} hint={`${MODEL_META[best].label} · referencia ${pct(data.metrics.base.macroF1, 1)}`} Icon={Target} tone="success" />
      </section>

      <Alert tone="warning" title="Lee estos resultados con cautela">
        Datos sintéticos y solo 2 meses de entrenamiento (408 filas, ~86% puntuales). En meses no vistos, la exactitud de los modelos ({MODEL_IDS.map((id) => `${MODEL_META[id].short} ${pct(data.metrics[id].accuracy)}`).join(", ")})
        queda por debajo de la referencia ingenua «todos pagan puntual» ({pct(data.metrics.base.accuracy)}), porque se entrenaron con <em>class_weight=balanced</em> para no ignorar tardíos e impagos.
        {beatsBaseline.length > 0 ? ` En F1 macro superan a la referencia: ${beatsBaseline.map((id) => MODEL_META[id].label).join(", ")}.` : ""} Úsalos como alerta temprana para priorizar contacto, no para decidir sanciones.
      </Alert>

      <MlCharts data={view} />
      <ConfusionMatrices data={data} />
      <FamilyPredictions rows={data.predictions} month={month} />
      <ModelSimulator />

      <section aria-labelledby="ficha" className="glass glass-strong flex flex-col gap-2 rounded-xl p-5 text-sm">
        <h2 id="ficha" className="flex items-center gap-2 text-lg font-semibold"><BrainCircuit aria-hidden className="size-5 text-primary" /> Ficha técnica</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Origen: <code>Modelos/*.joblib</code> (scikit-learn 1.6.1), exportados a <code>src/ml/modelos.json</code> con <code>Modelos/exportar_modelos.py</code> e inferidos en TypeScript (verificado contra <code>predict_proba</code> de sklearn: error máximo &lt; 1e-6).</li>
          <li>Unidad: una familia (representante) en un mes. Variables: pensiones y valor del mes; pensiones del historial; tasas de puntualidad, tardanza e incumplimiento en el historial. La regresión logística usa además <code>meses_historial</code>.</li>
          <li>Etiqueta real: el peor resultado entre los hijos de la familia en ese mes (incumplimiento &gt; tardío &gt; puntual).</li>
          {MODEL_IDS.map((id) => (
            <li key={id}>{MODEL_META[id].label}: {Object.entries(data.params[id]).map(([k, v]) => `${k}=${String(v)}`).join(", ")}.</li>
          ))}
          <li>Datos: <code>dataset-ficticio-colegio/</code> — todos sintéticos, no corresponden a personas reales.</li>
        </ul>
      </section>
    </>
  );
}
