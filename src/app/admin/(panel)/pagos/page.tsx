import type { Metadata } from "next";
import Link from "next/link";
import { Award, ShieldAlert } from "lucide-react";
import { getRepository } from "@/data";
import { FilterBar } from "@/components/admin/FilterBar";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { MarkPaidButton } from "@/components/admin/MarkPaidButton";
import { RunRemindersButton } from "@/components/admin/ReminderButtons";
import { PunctualityBar } from "@/components/payments/PunctualityBar";
import { INSTALLMENT_STATUSES, installmentStatusMeta, methodLabel, type Tone } from "@/domain/labels";
import { formatDate, formatMoney, formatMonth } from "@/domain/format";
import { PUNCTUALITY_RULES, RISK_LEVELS, classifyMonth, punctualityRecord, riskMeta, type MonthOutcome, type PunctualityRecord, type RiskLevel } from "@/domain/loyalty";
import { matchesSearch } from "@/data/repository";
import { gradeLabel, institution } from "@/content/institution";
import { nowISO } from "@/lib/clock";
import { cn } from "@/lib/cn";
import type { Grade, InstallmentStatus, InstallmentView } from "@/domain/types";

export const metadata: Metadata = { title: "Pagos" };
export const dynamic = "force-dynamic";

const PAGE = 100;

type SP = { vista?: string; q?: string; estado?: string; periodo?: string; grado?: string; riesgo?: string; beca?: string; orden?: string };

type Scholarship = "ganada" | "en_camino" | "recuperable" | "no_alcanza";
const scholarshipMeta: Record<Scholarship, { label: string; tone: Tone }> = {
  ganada: { label: "Beca ganada", tone: "success" },
  en_camino: { label: "En camino a beca", tone: "success" },
  recuperable: { label: "Recuperable si se pone al día", tone: "warning" },
  no_alcanza: { label: "No alcanza este año", tone: "neutral" },
};
function scholarshipOf(r: PunctualityRecord): Scholarship {
  if (r.scholarshipEarned) return "ganada";
  if (r.scholarshipOnTrack) return "en_camino";
  if (r.maxReachablePct >= PUNCTUALITY_RULES.scholarshipMinPct) return "recuperable";
  return "no_alcanza";
}

interface StudentRow {
  id: string; name: string; code?: string; documentId?: string; grade: Grade;
  outcomes: MonthOutcome[]; record: PunctualityRecord; scholarship: Scholarship; overdueAmount: number;
}

/** Una fila por matrícula con sus pensiones del año, ordenadas por vencimiento. */
function buildRows(installments: InstallmentView[], today: string): StudentRow[] {
  const byEnrollment = new Map<string, InstallmentView[]>();
  for (const i of installments) {
    if (i.concept !== "pension" || i.status === "anulada") continue;
    const list = byEnrollment.get(i.enrollmentId) ?? [];
    list.push(i);
    byEnrollment.set(i.enrollmentId, list);
  }
  return [...byEnrollment.values()].map((list) => {
    list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const f = list[0]!;
    const outcomes = list.map((i) => classifyMonth(i, today));
    const record = punctualityRecord(outcomes);
    const overdueAmount = Math.round(list.reduce((s, i, n) => s + (outcomes[n] === "impago" ? i.amount - i.amountPaid : 0), 0) * 100) / 100;
    return { id: f.enrollmentId, name: f.studentName, code: f.studentCode, documentId: f.studentDocumentId, grade: f.grade, outcomes, record, scholarship: scholarshipOf(record), overdueAmount };
  });
}

const RISK_ORDER: Record<RiskLevel, number> = { critico: 0, alto: 1, medio: 2, bajo: 3, sin_historial: 4 };

export default async function PagosAdminPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const vista = sp.vista === "cuotas" ? "cuotas" : "record";
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Pagos y pensiones</h1>
        <p className="text-muted">Puntualidad de las familias, riesgo de cartera y candidatos a la beca del {PUNCTUALITY_RULES.scholarshipDiscountPct} %.</p>
      </div>
      <nav aria-label="Vistas de pagos" className="flex flex-wrap gap-2">
        {([["record", "Récord de puntualidad"], ["cuotas", "Cuotas"]] as const).map(([v, label]) => (
          <Link key={v} href={v === "record" ? "/admin/pagos" : "/admin/pagos?vista=cuotas"} aria-current={vista === v ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center rounded-full px-4 font-medium", vista === v ? "bg-primary text-on-primary" : "glass-inset hover:text-primary")}>
            {label}
          </Link>
        ))}
      </nav>
      <RunRemindersButton />
      {vista === "record" ? <RecordView sp={sp} /> : <InstallmentsView sp={sp} />}
    </>
  );
}

async function RecordView({ sp }: { sp: SP }) {
  const today = nowISO().slice(0, 10);
  const all = buildRows(await getRepository().listInstallments({ limit: 10_000 }), today);
  const grade = institution.grades.some((g) => g.id === sp.grado) ? (sp.grado as Grade) : undefined;
  const risk = (RISK_LEVELS as string[]).includes(sp.riesgo ?? "") ? (sp.riesgo as RiskLevel) : undefined;
  const beca = sp.beca && sp.beca in scholarshipMeta ? (sp.beca as Scholarship) : undefined;
  const best = sp.orden === "mejor";

  // Curso y búsqueda acotan el grupo; el resumen por riesgo refleja ese grupo.
  const scoped = all.filter((r) => (!grade || r.grade === grade) && matchesSearch([r.name, r.code, r.documentId], sp.q));
  const rows = scoped
    .filter((r) => (!risk || r.record.risk === risk) && (!beca || r.scholarship === beca || (beca === "en_camino" && r.scholarship === "ganada")))
    .sort((a, b) => {
      const pa = a.record.punctualityPct ?? 101, pb = b.record.punctualityPct ?? 101;
      return best
        ? pb - pa || b.record.recordPct - a.record.recordPct
        : RISK_ORDER[a.record.risk] - RISK_ORDER[b.record.risk] || pa - pb || b.overdueAmount - a.overdueAmount;
    });
  const gradesPresent = institution.grades.filter((g) => all.some((r) => r.grade === g.id));
  const count = (l: RiskLevel) => scoped.filter((r) => r.record.risk === l).length;
  const candidates = scoped.filter((r) => r.scholarship === "en_camino" || r.scholarship === "ganada").length;
  const link = (patch: Partial<SP>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, grado: grade, riesgo: risk, beca, orden: sp.orden, ...patch })) if (v) q.set(k, v);
    return `/admin/pagos${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <section aria-label="Resumen por nivel de riesgo" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {RISK_LEVELS.map((l) => (
          <Link key={l} href={link({ riesgo: risk === l ? undefined : l })} aria-current={risk === l ? "true" : undefined}
            className={cn("glass flex flex-col gap-1 rounded-xl p-4 transition-shadow hover:ring-2 hover:ring-primary/40", risk === l && "ring-2 ring-primary")}>
            <Badge tone={riskMeta[l].tone} className="self-start">Riesgo {riskMeta[l].label.toLowerCase()}</Badge>
            <span className="font-heading text-3xl font-semibold tabular-nums">{count(l)}</span>
            <span className="text-xs text-muted">Puntualidad {riskMeta[l].range}</span>
          </Link>
        ))}
        <Link href={link({ beca: beca === "en_camino" ? undefined : "en_camino" })} aria-current={beca === "en_camino" ? "true" : undefined}
          className={cn("glass col-span-2 flex flex-col gap-1 rounded-xl p-4 transition-shadow hover:ring-2 hover:ring-primary/40 lg:col-span-1", beca === "en_camino" && "ring-2 ring-primary")}>
          <span className="flex items-center gap-1.5 text-sm font-medium text-success"><Award aria-hidden className="size-4" /> Candidatos a beca</span>
          <span className="font-heading text-3xl font-semibold tabular-nums">{candidates}</span>
          <span className="text-xs text-muted">Pueden llegar a {PUNCTUALITY_RULES.scholarshipMinPct} % sin meses impagos</span>
        </Link>
      </section>

      <FilterBar
        action="/admin/pagos"
        search={sp.q}
        placeholder="Nombre, código o cédula del estudiante"
        selects={[
          { name: "grado", label: "Curso", value: grade, options: gradesPresent.map((g) => ({ value: g.id, label: g.label })) },
          { name: "riesgo", label: "Riesgo", value: risk, options: RISK_LEVELS.map((l) => ({ value: l, label: `${riskMeta[l].label} (${riskMeta[l].range})` })) },
          { name: "beca", label: "Beca", value: beca, options: (Object.keys(scholarshipMeta) as Scholarship[]).map((s) => ({ value: s, label: scholarshipMeta[s].label })) },
          { name: "orden", label: "Orden", value: sp.orden, emptyLabel: "Mayor riesgo primero", options: [{ value: "mejor", label: "Mejor récord primero" }] },
        ]}
      />

      <p className="text-sm text-muted">
        {rows.length} estudiante(s){risk ? ` · Riesgo ${riskMeta[risk].label.toLowerCase()}: ${riskMeta[risk].action}` : ""}
      </p>

      <GlassCard className="overflow-hidden">
        <DataTable
          caption="Récord de puntualidad por estudiante"
          rows={rows}
          rowKey={(r) => r.id}
          empty="Ningún estudiante coincide con los filtros."
          columns={[
            { key: "student", header: "Estudiante", cell: (r) => (
              <span className="flex flex-col">
                <Link href={`/admin/matriculas/${r.id}`} className="font-medium text-primary underline-offset-4 hover:underline">{r.name}</Link>
                <span className="text-sm text-muted">{[r.code, r.documentId, gradeLabel(r.grade)].filter(Boolean).join(" · ")}</span>
              </span>
            ) },
            { key: "bar", header: "Récord del año", cell: (r) => (
              <span className="flex min-w-44 flex-col gap-1">
                <span className="flex justify-between text-sm"><span className="font-semibold tabular-nums">{r.record.recordPct} %</span><span className="text-muted">de 100 %</span></span>
                <PunctualityBar size="sm" outcomes={r.outcomes} recordPct={r.record.recordPct} label={`Récord de ${r.name}`} />
              </span>
            ) },
            { key: "pct", header: "Puntualidad (vencido)", align: "right", cell: (r) => (r.record.punctualityPct === null ? "—" : `${r.record.punctualityPct} %`) },
            { key: "detail", header: "Puntual / Atrasado / Sin pagar", cell: (r) => (
              <span className="tabular-nums">
                <span className="text-success">{r.record.onTime}</span> / <span className="text-warning">{r.record.late}</span> / <span className={r.record.unpaid ? "font-semibold text-danger" : ""}>{r.record.unpaid}</span>
                {r.overdueAmount > 0 && <span className="block text-sm text-danger">{formatMoney(r.overdueAmount)} vencido</span>}
              </span>
            ) },
            { key: "risk", header: "Riesgo", cell: (r) => <Badge tone={riskMeta[r.record.risk].tone}>{riskMeta[r.record.risk].label}</Badge> },
            { key: "beca", header: `Beca ${PUNCTUALITY_RULES.scholarshipDiscountPct} %`, cell: (r) => <Badge tone={scholarshipMeta[r.scholarship].tone}>{scholarshipMeta[r.scholarship].label}</Badge> },
            { key: "act", header: "Cuotas", cell: (r) => <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/admin/pagos?vista=cuotas&q=${encodeURIComponent(r.code ?? r.name)}`}>Ver<span className="sr-only"> cuotas de {r.name}</span></Link> },
          ]}
        />
      </GlassCard>
      <p className="flex items-start gap-2 text-sm text-muted">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Cada mes suma {PUNCTUALITY_RULES.onTimePct} % si se pagó a tiempo, {PUNCTUALITY_RULES.latePct} % si se pagó atrasado y 0 % si no se pagó. El riesgo usa solo los meses ya vencidos (al {formatDate(today)}).
          La beca requiere {PUNCTUALITY_RULES.scholarshipMinPct} % y ningún mes impago; es una sugerencia y la confirma colecturía.
        </span>
      </p>
    </>
  );
}

async function InstallmentsView({ sp }: { sp: SP }) {
  const status = INSTALLMENT_STATUSES.includes(sp.estado as InstallmentStatus) ? (sp.estado as InstallmentStatus) : undefined;
  const repo = getRepository();
  const all = await repo.listInstallments({ limit: 10_000 });
  const periods = [...new Set(all.map((i) => i.period))].sort();
  const period = periods.includes(sp.periodo ?? "") ? sp.periodo : undefined;
  const grade = institution.grades.some((g) => g.id === sp.grado) ? (sp.grado as Grade) : undefined;
  const filtered = all.filter((i) => (!status || i.status === status) && (!period || i.period === period) && (!grade || i.grade === grade)
    && matchesSearch([i.studentName, i.studentCode, i.studentDocumentId, i.description, i.reference], sp.q));
  const rows = filtered.slice(0, PAGE);
  return (
    <>
      <FilterBar
        action="/admin/pagos"
        hidden={{ vista: "cuotas" }}
        search={sp.q}
        placeholder="Nombre, código o cédula del estudiante"
        selects={[
          { name: "estado", label: "Estado", value: status, options: INSTALLMENT_STATUSES.map((s) => ({ value: s, label: installmentStatusMeta[s].label })) },
          { name: "periodo", label: "Periodo", value: period, options: periods.map((p) => ({ value: p, label: formatMonth(p) })) },
          { name: "grado", label: "Curso", value: grade, options: institution.grades.filter((g) => all.some((i) => i.grade === g.id)).map((g) => ({ value: g.id, label: g.label })) },
        ]}
      />
      <p className="text-sm text-muted">{filtered.length} cuota(s){filtered.length > PAGE ? `, se muestran las primeras ${PAGE}. Usa los filtros para acotar.` : ""}</p>
      <GlassCard className="overflow-hidden">
        <DataTable
          caption="Cuotas"
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "student", header: "Estudiante", cell: (r) => <span><span className="font-medium">{r.studentName}</span> <span className="text-muted">· {r.studentCode ? `${r.studentCode} · ` : ""}{gradeLabel(r.grade)}</span></span> },
            { key: "desc", header: "Concepto", cell: (r) => r.description },
            { key: "due", header: "Vence", cell: (r) => formatDate(r.dueDate) },
            { key: "amount", header: "Monto", align: "right", cell: (r) => formatMoney(r.amount) },
            { key: "paid", header: "Pagado", align: "right", cell: (r) => formatMoney(r.amountPaid) },
            { key: "status", header: "Estado", cell: (r) => <Badge tone={installmentStatusMeta[r.status].tone}>{installmentStatusMeta[r.status].label}</Badge> },
            { key: "method", header: "Método", cell: (r) => (r.method ? methodLabel[r.method] : "—") },
            { key: "act", header: "Acción", cell: (r) => (r.status === "pagada" || r.status === "anulada" ? <span className="text-muted">—</span> : <MarkPaidButton id={r.id} owed={Math.round((r.amount - r.amountPaid) * 100) / 100} label={`${r.description} de ${r.studentName}`} />) },
          ]}
        />
      </GlassCard>
    </>
  );
}
