"use client";
import { Award, CheckCircle2, CreditCard, Sparkles, Undo2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PunctualityBar } from "./PunctualityBar";
import { PUNCTUALITY_RULES, classifyMonth, outcomeMeta, punctualityRecord } from "@/domain/loyalty";
import { installmentStatusMeta } from "@/domain/labels";
import { formatDate, formatMoney, formatMonth } from "@/domain/format";
import { institution } from "@/content/institution";
import type { InstallmentConcept, InstallmentStatus } from "@/domain/types";
import { cn } from "@/lib/cn";

export interface BoardInstallment {
  id: string; concept: InstallmentConcept; description: string; amount: number; amountPaid: number;
  dueDate: string; status: InstallmentStatus; paidAt: string | null; demo: boolean;
}
export type PayMode = "puntual" | "atrasado";

const SAVINGS = Math.round(institution.fees.monthly * institution.fees.months * PUNCTUALITY_RULES.scholarshipDiscountPct) / 100;
const owedOf = (r: BoardInstallment) => Math.round((r.amount - r.amountPaid) * 100) / 100;

/**
 * Tablero único de pagos: récord de puntualidad + una tarjeta por cuota con acciones REALES.
 * Puntual suma 10 %, atrasado 5 %, sin pagar 0 %. Con 80 % y ningún mes sin pagar → beca del 20 % el año siguiente.
 * En esta demostración la familia elige si el pago cuenta como puntual o atrasado, y puede deshacer sus pagos de demo.
 */
export function PaymentBoard({ installments, today, busyId, onPay, onUndo }: {
  installments: BoardInstallment[];
  today: string;
  busyId: string | null;
  onPay: (row: BoardInstallment, mode: PayMode) => void;
  onUndo: (row: BoardInstallment) => void;
}) {
  const pensions = installments.filter((i) => i.concept === "pension" && i.status !== "anulada");
  const others = installments.filter((i) => i.concept !== "pension" && i.status !== "anulada");
  const outcomes = pensions.map((m) => classifyMonth(m, today));
  const r = punctualityRecord(outcomes);
  const min = PUNCTUALITY_RULES.scholarshipMinPct;
  const busy = busyId !== null;

  let message: { tone: "success" | "warning" | "danger" | "info"; title: string; body: string };
  if (r.scholarshipEarned) {
    message = { tone: "success", title: "¡Alcanzaste la beca por puntualidad!", body: `${PUNCTUALITY_RULES.scholarshipDiscountPct} % de descuento en la pensión del próximo año: un ahorro aproximado de ${formatMoney(SAVINGS)}. Colecturía confirma la beca al cerrar el año.` };
  } else if (r.unpaid > 0) {
    message = { tone: "danger", title: `${r.unpaid} mes(es) sin pagar`, body: `Con meses sin pagar no se puede aplicar a la beca. Si los pones al día cuentan como atrasados (${PUNCTUALITY_RULES.latePct} %)${r.maxReachablePct >= min ? " y todavía puedes llegar al 80 %." : "."}` };
  } else if (r.scholarshipOnTrack && r.pending > 0) {
    message = { tone: "info", title: `Vas en camino: te falta ${r.missingPct} % para la beca`, body: `Si pagas a tiempo los ${r.pending} mes(es) que quedan, llegas a ${r.maxReachablePct} %.` };
  } else {
    message = { tone: "warning", title: "Este año no alcanza el 80 %", body: "Cada pago puntual mejora tu récord para el próximo año. Si necesitas un plan de pagos, escribe a colecturía." };
  }
  const msgCls = { success: "border-success/40 bg-success/10", warning: "border-warning/40 bg-warning/10", danger: "border-danger/40 bg-danger/10", info: "border-primary/40 bg-primary/10" }[message.tone];

  return (
    <GlassCard as="section" className="flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="board-title">
      <div className="flex max-w-3xl flex-col gap-1">
        <h3 id="board-title" className="flex items-center gap-2 text-xl font-semibold"><Award aria-hidden className="size-5 text-primary" /> Mis cuotas y récord de puntualidad</h3>
        <p className="text-sm text-muted">
          Cada pensión pagada a tiempo suma {PUNCTUALITY_RULES.onTimePct} %, atrasada {PUNCTUALITY_RULES.latePct} % y sin pagar 0 %.
          Con {min} % o más y ningún mes sin pagar ganas una <strong className="text-foreground">beca del {PUNCTUALITY_RULES.scholarshipDiscountPct} %</strong> en la pensión del próximo año.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <p className="font-heading text-4xl font-semibold tabular-nums">{r.recordPct} %<span className="sr-only"> de récord de puntualidad</span></p>
          <p className="text-sm text-muted">Meta para la beca: <strong className="text-primary">{min} %</strong></p>
        </div>
        <PunctualityBar outcomes={outcomes} recordPct={r.recordPct} label="Récord de puntualidad" />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="Resumen del récord">
          <li><span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-sm bg-success" />{r.onTime} puntual(es)</li>
          <li><span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-sm bg-warning" />{r.late} atrasado(s)</li>
          <li><span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-sm bg-danger/35" />{r.unpaid} sin pagar</li>
          <li><span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-sm border border-line" />{r.pending} por vencer</li>
        </ul>
      </div>

      <div role="status" className={cn("flex gap-3 rounded-lg border p-4", msgCls)}>
        <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold">{message.title}</p>
          <p className="text-sm">{message.body}</p>
        </div>
      </div>

      {others.length > 0 && (
        <ul className="grid gap-2" aria-label="Otras cuotas">
          {others.map((o) => (
            <li key={o.id} className="glass-inset flex flex-wrap items-center justify-between gap-3 rounded-lg p-3">
              <div className="min-w-0">
                <p className="font-medium">{o.description} · {formatMoney(o.amount)}</p>
                <p className="text-xs text-muted">Vence {formatDate(o.dueDate)}{o.paidAt ? ` · pagado ${formatDate(o.paidAt)}` : ""}</p>
              </div>
              {o.status === "pagada" ? (
                <Badge tone="success">Pagada</Badge>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={installmentStatusMeta[o.status].tone}>{installmentStatusMeta[o.status].label}</Badge>
                  <Button size="sm" onClick={() => onPay(o, "puntual")} disabled={busy} aria-busy={busyId === o.id}>
                    <CreditCard aria-hidden className="size-4" /> {busyId === o.id ? "Pagando…" : `Pagar ${formatMoney(owedOf(o))}`}<span className="sr-only"> {o.description}</span>
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ol className="grid gap-2 sm:grid-cols-2" aria-label="Pensiones del año">
        {pensions.map((m, i) => {
          const o = outcomes[i]!;
          const monthName = formatMonth(m.dueDate.slice(0, 7));
          const paid = m.status === "pagada";
          return (
            <li key={m.id} className="glass-inset flex flex-col gap-2 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">Mes {i + 1} · <span className="capitalize">{monthName}</span> · {formatMoney(m.amount)}</p>
                  <p className="text-xs text-muted">Vence {formatDate(m.dueDate)}{m.paidAt ? ` · pagado ${formatDate(m.paidAt)}${m.demo ? " · demo" : ""}` : ""}</p>
                </div>
                <Badge tone={outcomeMeta[o].tone}>{outcomeMeta[o].label} · +{outcomeMeta[o].points} %</Badge>
              </div>
              {paid ? (
                m.demo && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm text-success"><CheckCircle2 aria-hidden className="size-4" /> Pago registrado</span>
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onUndo(m)} disabled={busy} aria-busy={busyId === m.id}>
                      <Undo2 aria-hidden className="size-4" /> {busyId === m.id ? "Deshaciendo…" : "Deshacer"}<span className="sr-only"> el pago de {monthName}</span>
                    </Button>
                  </div>
                )
              ) : (
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Registrar el pago de ${monthName}`}>
                  <Button size="sm" onClick={() => onPay(m, "puntual")} disabled={busy} aria-busy={busyId === m.id}>
                    <CreditCard aria-hidden className="size-4" /> Pagar puntual
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => onPay(m, "atrasado")} disabled={busy}>
                    Pagar atrasado
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-muted">
        <strong className="text-foreground">Demostración:</strong> no se cobra dinero. Los pagos sí quedan registrados (como pago con tarjeta) y los ve colecturía.
        «Pagar atrasado» registra el pago 7 días después del vencimiento para que veas cómo afecta tu récord, y «Deshacer» lo devuelve a sin pagar.
      </p>
    </GlassCard>
  );
}
