"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "@/components/providers/preferences";
import { ChartCard } from "@/components/charts/ChartCard";
import { MODEL_IDS, MODEL_META } from "@/ml/inference";
import { ncFeatureLabel, ncImportances } from "@/ml/nuevo-cliente";
import { pct } from "@/ml/labels";

const axis = { stroke: "var(--fg-muted)", fontSize: 12, tickLine: false } as const;
const tooltipStyle = { background: "var(--surface-solid)", border: "1px solid var(--border-subtle)", borderRadius: 12, color: "var(--fg)" };
const legendText = (v: string) => <span style={{ color: "var(--fg)" }}>{v}</span>;

export function NewClientImportance() {
  const animate = !useReducedMotion();
  const data = ncImportances().map((r) => ({ label: ncFeatureLabel[r.feature], ...r.values }));
  return (
    <ChartCard
      title="¿Qué pesa más en la predicción?"
      description="Importancia relativa de cada dato de la familia en cada modelo (suma 100% por modelo)."
      table={{ headers: ["Dato", ...MODEL_IDS.map((id) => MODEL_META[id].label)], rows: data.map((r) => [r.label, ...MODEL_IDS.map((id) => pct(Number((r as Record<string, unknown>)[id] ?? 0), 1))]) }}
    >
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }} barGap={2}>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" {...axis} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
          <YAxis type="category" dataKey="label" width={170} {...axis} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border-subtle)" }} formatter={(v) => pct(Number(v), 1)} />
          <Legend formatter={legendText} />
          {MODEL_IDS.map((id) => <Bar key={id} dataKey={id} name={MODEL_META[id].label} fill={MODEL_META[id].color} radius={[0, 4, 4, 0]} stroke="var(--surface-solid)" strokeWidth={2} isAnimationActive={animate} />)}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
