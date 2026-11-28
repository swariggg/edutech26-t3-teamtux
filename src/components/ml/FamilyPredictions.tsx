"use client";
import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { MODEL_IDS, MODEL_META } from "@/ml/inference";
import { classMeta, pct } from "@/ml/labels";
import type { FamilyPrediction } from "@/ml/dashboard";
import { formatMoney } from "@/domain/format";

type Filter = "riesgo" | "discrepancia" | "unanime" | "todas";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "riesgo", label: "En riesgo (algún modelo ≠ puntual)" },
  { value: "discrepancia", label: "Modelos en desacuerdo" },
  { value: "unanime", label: "Riesgo unánime (3 de 3)" },
  { value: "todas", label: "Todas las familias" },
];
const PAGE = 25;

export function FamilyPredictions({ rows, month }: { rows: FamilyPrediction[]; month: string }) {
  const [filter, setFilter] = useState<Filter>("riesgo");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const preds = MODEL_IDS.map((id) => r.pred[id]);
      const ok =
        filter === "todas" ||
        (filter === "riesgo" && preds.some((p) => p !== "puntual")) ||
        (filter === "discrepancia" && r.acuerdo < 3) ||
        (filter === "unanime" && r.acuerdo === 3 && r.consenso !== "puntual");
      if (!ok) return false;
      return !term || r.representante.toLowerCase().includes(term) || r.estudiantes.some((s) => s.nombre.toLowerCase().includes(term));
    });
  }, [rows, filter, q]);

  const columns: Column<FamilyPrediction>[] = [
    { key: "rep", header: "Familia", cell: (r) => <span className="font-mono text-xs">{r.representante}</span> },
    {
      key: "est",
      header: "Estudiantes",
      className: "min-w-56",
      cell: (r) => (
        <ul className="flex flex-col">
          {r.estudiantes.map((s) => <li key={s.nombre}>{s.nombre} <span className="text-xs text-muted">· {s.curso} {s.paralelo}</span></li>)}
        </ul>
      ),
    },
    { key: "valor", header: "Valor del mes", align: "right", cell: (r) => formatMoney(r.features.valor_mes) },
    {
      key: "hist",
      header: `Últimos ${r0(rows)} meses`,
      className: "min-w-28",
      cell: (r) => (
        <span className="flex flex-col whitespace-nowrap text-xs tabular-nums text-muted">
          <span>{pct(r.features.tasa_puntualidad)} a tiempo</span>
          <span>{pct(r.features.tasa_tardanza)} tarde</span>
          <span>{pct(r.features.tasa_incumplimiento)} sin pagar</span>
        </span>
      ),
    },
    ...MODEL_IDS.map<Column<FamilyPrediction>>((id) => ({
      key: id,
      header: MODEL_META[id].short,
      cell: (r) => (
        <span className="flex flex-col items-start gap-0.5" title={`${MODEL_META[id].label}: puntual ${pct(r.proba[id].puntual)}, tardío ${pct(r.proba[id].tardio)}, incumplimiento ${pct(r.proba[id].incumplimiento)}`}>
          <Badge tone={classMeta[r.pred[id]].tone} className="text-xs">{classMeta[r.pred[id]].label}</Badge>
          <span className="text-xs tabular-nums text-muted">{pct(r.proba[id][r.pred[id]])}</span>
        </span>
      ),
    })),
    {
      key: "consenso",
      header: "Consenso",
      cell: (r) => (
        <span className="flex flex-col items-start gap-0.5">
          <Badge tone={classMeta[r.consenso].tone}>{classMeta[r.consenso].label}</Badge>
          <span className="text-xs text-muted">{r.acuerdo} de 3 modelos</span>
        </span>
      ),
    },
    { key: "riesgo", header: "P(impago) media", align: "right", cell: (r) => pct(r.riesgo, 1) },
  ];

  return (
    <GlassCard as="section" aria-labelledby="familias" className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="familias" className="text-lg font-semibold">Pronóstico por familia · {month}</h2>
        <p className="text-sm text-muted">
          RL = {MODEL_META.regresion_logistica.label}, AD = {MODEL_META.arbol_decision.label}, RF = {MODEL_META.random_forest.label}. Ordenado por probabilidad media de incumplimiento. El consenso es el voto mayoritario (empate a 3 bandas: mayor probabilidad media).
        </p>
      </div>
      <div role="search" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="ml-q" className="text-sm font-medium">Buscar</label>
          <input id="ml-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Estudiante o código REP-###" className="min-h-11 rounded-md border border-line bg-surface px-3" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ml-f" className="text-sm font-medium">Mostrar</label>
          <select id="ml-f" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="min-h-11 rounded-md border border-line bg-surface px-3">
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <p className="pb-3 text-sm text-muted" aria-live="polite">{filtered.length} familia(s){filtered.length > PAGE ? `, se muestran ${PAGE}` : ""}</p>
      </div>
      <DataTable caption={`Pronóstico de pago por familia para ${month}`} columns={columns} rows={filtered.slice(0, PAGE)} rowKey={(r) => r.representante} empty="Ninguna familia coincide con el filtro" />
    </GlassCard>
  );
}

const r0 = (rows: FamilyPrediction[]) => rows[0]?.features.meses_historial ?? 0;
