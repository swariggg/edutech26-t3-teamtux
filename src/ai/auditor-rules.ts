import { PUNCTUALITY_RULES, classifyMonth, punctualityRecord } from "@/domain/loyalty";
import type { AuditFinding } from "@/domain/types";
import type { AuditSnapshot } from "@/data/repository";
import { applicationStatusMeta } from "@/domain/labels";
import { daysBetween, formatMoney, formatDate } from "@/domain/format";

/** Reglas deterministas: funcionan sin IA y alimentan al auditor IA. */
export function runRules(s: AuditSnapshot, scope: "todo" | "solicitudes" | "pagos" = "todo"): AuditFinding[] {
  const out: AuditFinding[] = [];
  const now = new Date(s.now);
  const add = (f: Omit<AuditFinding, "id">) => out.push({ ...f, id: `${f.category}:${f.entityId ?? out.length}` });

  if (scope !== "pagos") {
    const limits: Partial<Record<string, number>> = { enviada: 10, en_revision: 15, documentos_pendientes: 15 };
    for (const a of s.applications) {
      const idle = daysBetween(a.updatedAt, now);
      const limit = limits[a.status];
      if (limit !== undefined && idle > limit) {
        add({
          severity: idle > 2 * limit ? "alta" : "media", category: "estancada", entity: "application", entityId: a.id,
          title: `${a.trackingCode} lleva ${idle} días en «${applicationStatusMeta[a.status].label}»`,
          detail: `La solicitud de ${a.student.fullName} no registra movimiento desde ${formatDate(a.updatedAt)}.`,
          recommendation: "Revisar la solicitud y avanzar al siguiente estado o contactar a la familia.",
        });
      }
      if (a.status === "entrevista_agendada" && a.interviewAt && new Date(a.interviewAt) < now) {
        add({
          severity: "media", category: "inconsistencia", entity: "application", entityId: a.id,
          title: `${a.trackingCode}: entrevista ya pasó y el estado no cambió`,
          detail: `La entrevista era el ${formatDate(a.interviewAt)} y la solicitud sigue como «Entrevista agendada».`,
          recommendation: "Registrar el resultado de la entrevista (aprobada, rechazada o lista de espera).",
        });
      }
      if (a.status === "aprobada" && !s.enrollments.some((e) => e.applicationId === a.id) && daysBetween(a.updatedAt, now) > 7) {
        add({
          severity: "media", category: "inconsistencia", entity: "application", entityId: a.id,
          title: `${a.trackingCode}: aprobada sin matrícula`,
          detail: `Aprobada hace ${daysBetween(a.updatedAt, now)} días y aún no tiene matrícula registrada.`,
          recommendation: "Contactar a la familia para completar la matrícula o liberar el cupo.",
        });
      }
      const missing = a.documents.filter((d) => !d.received && d.kind !== "certificado_medico");
      if (missing.length > 0 && ["en_revision", "entrevista_agendada", "aprobada"].includes(a.status)) {
        add({
          severity: a.status === "aprobada" ? "alta" : "baja", category: "documentos", entity: "application", entityId: a.id,
          title: `${a.trackingCode}: ${missing.length} documento(s) faltante(s)`,
          detail: `La solicitud avanza («${applicationStatusMeta[a.status].label}») sin todos los documentos obligatorios.`,
          recommendation: "Solicitar los documentos faltantes antes de avanzar.",
        });
      }
    }
    // Revisión de documentos con IA: inconsistencias graves, riesgo de pago y posibles becas.
    for (const a of s.applications) {
      const r = a.aiReview;
      if (!r) continue;
      const serious = r.inconsistencies.filter((x) => x.severity === "alta");
      if (serious.length > 0) {
        add({
          severity: "alta", category: "inconsistencia", entity: "application", entityId: a.id,
          title: `${a.trackingCode}: ${serious.length} inconsistencia(s) grave(s) en los documentos`,
          detail: serious.map((x) => x.title).join(" · "),
          recommendation: "Revisar los documentos en el detalle de la solicitud y pedir a la familia que los corrija antes de avanzar.",
        });
      }
      if (r.financial.capacity === "baja") {
        add({
          severity: "media", category: "riesgo_pago", entity: "application", entityId: a.id,
          title: `${a.trackingCode}: capacidad de pago baja según el estado de cuenta`,
          detail: `La pensión equivale al ${r.financial.pensionToIncomePct ?? "?"}% del ingreso mensual promedio (regularidad: ${r.financial.incomeRegularity}).`,
          recommendation: r.financial.recommendation || "Acordar un plan de pago antes de matricular.",
        });
      }
      if (r.financial.scholarshipCandidate) {
        add({
          severity: "baja", category: "oportunidad", entity: "application", entityId: a.id,
          title: `${a.trackingCode}: posible candidata a beca`,
          detail: r.financial.scholarshipReason ?? "Ingresos ajustados con buen manejo de su cuenta.",
          recommendation: "Presentar el caso al comité de becas.",
        });
      }
    }
    const byDoc = new Map<string, string[]>();
    for (const a of s.applications) {
      const doc = a.student.documentId;
      if (doc) byDoc.set(doc, [...(byDoc.get(doc) ?? []), a.student.fullName]);
    }
    let dupN = 0;
    for (const [doc, names] of byDoc) {
      if (new Set(names).size > 1) {
        dupN += 1;
        add({
          // entityId sin la cédula: este id se envía al modelo; el título (solo UI admin) sí la muestra.
          severity: "alta", category: "datos", entity: "system", entityId: `cedula-duplicada-${dupN}`,
          title: `Cédula ${doc} repetida en ${names.length} estudiantes`,
          detail: `Aparece para: ${[...new Set(names)].join(", ")}.`,
          recommendation: "Verificar la cédula con la familia y corregir el registro duplicado.",
        });
      }
    }
  }

  if (scope !== "solicitudes") {
    for (const e of s.enrollments) {
      const mat = s.installments.find((i) => i.enrollmentId === e.id && i.concept === "matricula");
      if (e.status === "activa" && mat && mat.status !== "pagada") {
        add({
          severity: "alta", category: "inconsistencia", entity: "enrollment", entityId: e.id,
          title: `${e.code}: matrícula activa sin pago de matrícula`,
          detail: `${e.studentName} figura como matriculado/a pero la cuota de matrícula está «${mat.status}».`,
          recommendation: "Confirmar el pago con colecturía o cambiar el estado a «Pendiente de pago».",
        });
      }
    }
    const overdueByStudent = new Map<string, { name: string; total: number; oldest: string; count: number }>();
    for (const i of s.installments) {
      if (i.status !== "vencida") continue;
      const cur = overdueByStudent.get(i.studentId) ?? { name: i.studentName, total: 0, oldest: i.dueDate, count: 0 };
      cur.total += i.amount - i.amountPaid;
      cur.count += 1;
      if (i.dueDate < cur.oldest) cur.oldest = i.dueDate;
      overdueByStudent.set(i.studentId, cur);
    }
    for (const [studentId, v] of overdueByStudent) {
      const days = daysBetween(v.oldest, now);
      if (days <= 30) continue;
      add({
        severity: days > 60 ? "alta" : "media", category: "mora", entity: "installment", entityId: studentId,
        title: `${v.name}: ${v.count} cuota(s) vencida(s), ${formatMoney(v.total)}`,
        detail: `La cuota más antigua venció hace ${days} días (${formatDate(v.oldest)}).`,
        recommendation: days > 60 ? "Contactar a la familia y proponer un plan de pagos." : "Enviar recordatorio de pago.",
      });
    }
    // Fidelización (récord de puntualidad, src/domain/loyalty.ts): pueden llegar al 80 % sin meses impagos → beca del 20 %.
    // Riesgo crítico (≤25 % de puntualidad en lo vencido) → tomar medidas.
    const today = now.toISOString().slice(0, 10);
    const pensions = new Map<string, { name: string; list: typeof s.installments }>();
    for (const i of s.installments) {
      if (i.concept !== "pension" || i.status === "anulada") continue;
      const cur = pensions.get(i.enrollmentId) ?? { name: i.studentName, list: [] };
      cur.list.push(i);
      pensions.set(i.enrollmentId, cur);
    }
    const records = [...pensions.values()].map((v) => ({
      name: v.name,
      r: punctualityRecord([...v.list].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((i) => classifyMonth(i, today))),
    }));
    const names = (l: typeof records) => `${l.slice(0, 8).map((v) => v.name).join(", ")}${l.length > 8 ? ` y ${l.length - 8} más` : ""}`;
    const loyal = records.filter((v) => v.r.due >= 3 && (v.r.scholarshipOnTrack || v.r.scholarshipEarned)).sort((a, b) => (b.r.punctualityPct ?? 0) - (a.r.punctualityPct ?? 0));
    if (loyal.length > 0) {
      add({
        severity: "baja", category: "oportunidad", entity: "system", entityId: "fidelizacion-puntualidad",
        title: `${loyal.length} estudiante(s) en camino a la beca del ${PUNCTUALITY_RULES.scholarshipDiscountPct} % por puntualidad`,
        detail: `Pueden llegar al ${PUNCTUALITY_RULES.scholarshipMinPct} % de récord sin meses impagos: ${names(loyal)}.`,
        recommendation: "Avisar a estas familias de que van en camino a la beca para reforzar la puntualidad (ver Pagos → Récord de puntualidad).",
      });
    }
    const critical = records.filter((v) => v.r.risk === "critico");
    if (critical.length > 0) {
      add({
        severity: "alta", category: "riesgo_pago", entity: "system", entityId: "riesgo-critico-puntualidad",
        title: `${critical.length} estudiante(s) con riesgo de pago crítico (puntualidad ≤ 25 %)`,
        detail: `Familias con la mayoría de sus pensiones vencidas sin pagar: ${names(critical)}.`,
        recommendation: "Tomar medidas: llamar a la familia y acordar un plan de pago antes de que la deuda crezca.",
      });
    }
    for (const i of s.installments) {
      if (i.amountPaid > i.amount || (i.status === "pagada" && !i.paidAt)) {
        add({
          severity: "baja", category: "datos", entity: "installment", entityId: i.id,
          title: `Cuota con datos inconsistentes (${i.description})`,
          detail: i.amountPaid > i.amount ? "El monto pagado supera el monto de la cuota." : "Está marcada como pagada pero no tiene fecha de pago.",
          recommendation: "Revisar el registro en colecturía y corregirlo.",
        });
      }
    }
  }

  const order = { alta: 0, media: 1, baja: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function rulesSummary(findings: AuditFinding[]): string {
  if (findings.length === 0) return "No se encontraron problemas en los procesos revisados.";
  const c = (s: string) => findings.filter((f) => f.severity === s).length;
  return `Se detectaron ${findings.length} hallazgos: ${c("alta")} de severidad alta, ${c("media")} media y ${c("baja")} baja. Prioriza las moras de más de 60 días, las matrículas activas sin pago y las solicitudes estancadas.`;
}
