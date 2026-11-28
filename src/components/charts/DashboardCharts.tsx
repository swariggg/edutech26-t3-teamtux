"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardStats } from "@/domain/types";
import { useReducedMotion } from "@/components/providers/preferences";
import { formatMoney } from "@/domain/format";
import { ChartCard } from "./ChartCard";

const axis = { stroke: "var(--fg-muted)", fontSize: 12, tickLine: false } as const;
const grid = { stroke: "var(--border-subtle)", strokeDasharray: "3 3" } as const;
const tooltipStyle = { background: "var(--surface-solid)", border: "1px solid var(--border-subtle)", borderRadius: 12, color: "var(--fg)" };
const COLLECTION_COLORS = ["var(--success)", "var(--primary)", "var(--danger)"];

export function DashboardCharts({ stats }: { stats: DashboardStats }) {
  const animate = !useReducedMotion();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Solicitudes por estado" description="Todas las solicitudes del año lectivo." table={{ headers: ["Estado", "Cantidad"], rows: stats.applicationsByStatus.map((s) => [s.label, s.count]) }}>
        <ResponsiveContainer>
          <BarChart data={stats.applicationsByStatus} layout="vertical" margin={{ left: 24, right: 16 }}>
            <CartesianGrid {...grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} {...axis} />
            <YAxis type="category" dataKey="label" width={150} {...axis} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border-subtle)" }} />
            <Bar dataKey="count" name="Solicitudes" fill="var(--primary)" radius={[0, 6, 6, 0]} isAnimationActive={animate} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Recaudación por mes" description="Facturado frente a cobrado (cuotas vencidas a la fecha)." table={{ headers: ["Mes", "Facturado", "Cobrado"], rows: stats.monthlyRevenue.map((m) => [m.label, formatMoney(m.billed), formatMoney(m.collected)]) }}>
        <ResponsiveContainer>
          <AreaChart data={stats.monthlyRevenue} margin={{ left: 8, right: 16 }}>
            <defs>
              <linearGradient id="gBilled" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient>
              <linearGradient id="gColl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid {...grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
            <Legend />
            <Area type="monotone" dataKey="billed" name="Facturado" stroke="var(--primary)" fill="url(#gBilled)" strokeWidth={2} isAnimationActive={animate} />
            <Area type="monotone" dataKey="collected" name="Cobrado" stroke="var(--accent)" fill="url(#gColl)" strokeWidth={2} strokeDasharray="5 3" isAnimationActive={animate} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Estado de la cartera" description="Cobrado, pendiente por vencer y vencido." table={{ headers: ["Concepto", "Monto"], rows: stats.collections.map((c) => [c.name, formatMoney(c.value)]) }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={stats.collections} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} isAnimationActive={animate} stroke="var(--surface-solid)">
              {stats.collections.map((c, i) => <Cell key={c.name} fill={COLLECTION_COLORS[i]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Matrículas activas por grado" table={{ headers: ["Grado", "Estudiantes"], rows: stats.enrollmentsByGrade.map((g) => [g.label, g.count]) }}>
        <ResponsiveContainer>
          <BarChart data={stats.enrollmentsByGrade} margin={{ left: 0, right: 8 }}>
            <CartesianGrid {...grid} vertical={false} />
            <XAxis dataKey="label" {...axis} interval={0} angle={-35} textAnchor="end" height={56} />
            <YAxis allowDecimals={false} {...axis} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border-subtle)" }} />
            <Bar dataKey="count" name="Estudiantes" fill="var(--accent)" radius={[6, 6, 0, 0]} isAnimationActive={animate} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
