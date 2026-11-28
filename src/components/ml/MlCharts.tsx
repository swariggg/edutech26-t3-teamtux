"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "@/components/providers/preferences";
import { ChartCard } from "@/components/charts/ChartCard";
import { CLASSES, MODEL_IDS, MODEL_META } from "@/ml/inference";
import { classMeta, featureLabel, pct } from "@/ml/labels";
import type { MlDashboard } from "@/ml/dashboard";

const axis = { stroke: "var(--fg-muted)", fontSize: 12, tickLine: false } as const;
const grid = { stroke: "var(--border-subtle)", strokeDasharray: "3 3" } as const;
const tooltipStyle = { background: "var(--surface-solid)", border: "1px solid var(--border-subtle)", borderRadius: 12, color: "var(--fg)" };
const gap = { stroke: "var(--surface-solid)", strokeWidth: 2 } as const;
const legendText = (v: string) => <span style={{ color: "var(--fg)" }}>{v}</span>;
const pctTick = (v: number) => `${Math.round(v * 100)}%`;

export function MlCharts({ data }: { data: MlDashboard }) {
  const animate = !useReducedMotion();
  const M = data.metrics;

  const perf = [
    { label: "Exactitud", get: (id: keyof typeof M) => M[id].accuracy },
    { label: "F1 macro", get: (id: keyof typeof M) => M[id].macroF1 },
    { label: "Recall incumplimiento", get: (id: keyof typeof M) => M[id].perClass.incumplimiento.recall },
    { label: "Recall tardío", get: (id: keyof typeof M) => M[id].perClass.tardio.recall },
  ].map((r) => ({ label: r.label, base: r.get("base"), ...Object.fromEntries(MODEL_IDS.map((id) => [id, r.get(id)])) }));

  const dist = MODEL_IDS.map((id) => ({ label: MODEL_META[id].label, ...data.predictedDistribution[id] }));
  const imp = data.importances.map((r) => ({ label: featureLabel[r.feature], ...r.values }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        title="Desempeño en meses no vistos"
        description={`Evaluado en ${data.evalSize} familias-mes reales. En gris, la referencia ingenua «todos pagan puntual».`}
        table={{ headers: ["Métrica", ...MODEL_IDS.map((id) => MODEL_META[id].label), "Referencia"], rows: perf.map((r) => [r.label, ...MODEL_IDS.map((id) => pct((r as unknown as Record<string, number>)[id] ?? 0, 1)), pct(r.base, 1)]) }}
      >
        <ResponsiveContainer>
          <BarChart data={perf} margin={{ left: 0, right: 8 }} barGap={2}>
            <CartesianGrid {...grid} vertical={false} />
            <XAxis dataKey="label" {...axis} interval={0} />
            <YAxis {...axis} domain={[0, 1]} tickFormatter={pctTick} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border-subtle)" }} formatter={(v) => pct(Number(v), 1)} />
            <Legend formatter={legendText} />
            {MODEL_IDS.map((id) => <Bar key={id} dataKey={id} name={MODEL_META[id].label} fill={MODEL_META[id].color} radius={[4, 4, 0, 0]} {...gap} isAnimationActive={animate} />)}
            <Bar dataKey="base" name="Referencia" fill="var(--fg-muted)" fillOpacity={0.45} radius={[4, 4, 0, 0]} {...gap} isAnimationActive={animate} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={`Pronóstico por modelo · ${data.predictMonth}`}
        description={`Cuántas de las ${data.predictions.length} familias clasifica cada modelo en cada comportamiento.`}
        table={{ headers: ["Modelo", ...CLASSES.map((c) => classMeta[c].label)], rows: dist.map((r) => [r.label, ...CLASSES.map((c) => r[c])]) }}
      >
        <ResponsiveContainer>
          <BarChart data={dist} layout="vertical" margin={{ left: 24, right: 16 }}>
            <CartesianGrid {...grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} domain={[0, data.predictions.length]} {...axis} />
            <YAxis type="category" dataKey="label" width={130} {...axis} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border-subtle)" }} />
            <Legend formatter={legendText} />
            {CLASSES.map((c, i) => <Bar key={c} dataKey={c} name={classMeta[c].label} stackId="d" fill={classMeta[c].color} radius={i === CLASSES.length - 1 ? [0, 4, 4, 0] : 0} {...gap} isAnimationActive={animate} />)}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="xl:col-span-2">
        <ChartCard
          title="¿En qué se fija cada modelo?"
          description="Importancia relativa de cada variable (árboles: reducción de impureza; regresión: |coeficiente| medio sobre variables estandarizadas). Suma 100% por modelo."
          table={{ headers: ["Variable", ...MODEL_IDS.map((id) => MODEL_META[id].label)], rows: imp.map((r) => [r.label, ...MODEL_IDS.map((id) => ((r as Record<string, unknown>)[id] === undefined ? "no usa" : pct(Number((r as Record<string, unknown>)[id]), 1)))]) }}
        >
          <ResponsiveContainer>
            <BarChart data={imp} margin={{ left: 0, right: 8 }} barGap={2}>
              <CartesianGrid {...grid} vertical={false} />
              <XAxis dataKey="label" {...axis} interval={0} angle={-20} textAnchor="end" height={56} />
              <YAxis {...axis} tickFormatter={pctTick} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border-subtle)" }} formatter={(v) => pct(Number(v), 1)} />
              <Legend verticalAlign="top" formatter={legendText} />
              {MODEL_IDS.map((id) => <Bar key={id} dataKey={id} name={MODEL_META[id].label} fill={MODEL_META[id].color} radius={[4, 4, 0, 0]} {...gap} isAnimationActive={animate} />)}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
