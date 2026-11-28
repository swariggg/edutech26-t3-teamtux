import "server-only";
import type { AuditFinding, AuditReport } from "@/domain/types";
import { AuditReportLLM } from "@/domain/schemas";
import type { Repository } from "@/data/repository";
import { getLLM } from "./llm";
import { AUDITOR_SYSTEM } from "./prompts";
import { runRules, rulesSummary } from "./auditor-rules";
import { nowISO } from "@/lib/clock";

/** Referencia legible sin PII: el código de seguimiento/matrícula si el título empieza con uno. */
function codeRef(f: AuditFinding): string | null {
  const m = /^(ADM-\d{4}-[A-Z0-9]+|MAT-\d{4}-[A-Z0-9]+)/.exec(f.title);
  return m ? m[1]! : null;
}

/** Auditoría: reglas siempre; si hay IA, el modelo prioriza, confirma y amplía. Si falla, quedan las reglas. */
export async function runAudit(repo: Repository, scope: "todo" | "solicitudes" | "pagos" = "todo"): Promise<AuditReport> {
  const snapshot = await repo.getAuditSnapshot();
  const rules = runRules(snapshot, scope);
  const llm = getLLM();
  const base: AuditReport = { generatedAt: nowISO(), source: "reglas", summary: rulesSummary(rules), findings: rules };
  if (llm.source !== "anthropic") return base;

  // Resumen compacto SIN datos personales: solo ids, códigos, estados, fechas y montos.
  // No se envían nombres, cédulas ni contactos (los títulos de las reglas los contienen y NO se envían).
  const compact = {
    now: snapshot.now,
    applications: snapshot.applications.slice(0, 120).map((a) => ({
      id: a.id, code: a.trackingCode, status: a.status, grade: a.gradeApplied, updatedAt: a.updatedAt, interviewAt: a.interviewAt ?? null,
      missingDocs: a.documents.filter((d) => !d.received).map((d) => d.kind),
      // Resultado de la revisión de documentos con IA (sin datos personales).
      docReview: a.aiReview
        ? {
            inconsistencies: a.aiReview.inconsistencies.map((x) => ({ severity: x.severity, documents: x.documents })),
            paymentCapacity: a.aiReview.financial.capacity,
            pensionToIncomePct: a.aiReview.financial.pensionToIncomePct,
            mlRisk: a.aiReview.mlRisk?.level ?? null,
            scholarshipCandidate: a.aiReview.financial.scholarshipCandidate,
          }
        : null,
    })),
    enrollments: snapshot.enrollments.slice(0, 120).map((e) => ({ id: e.id, code: e.code, status: e.status, applicationId: e.applicationId ?? null })),
    overdueInstallments: snapshot.installments
      .filter((i) => i.status === "vencida" || i.status === "parcial")
      .slice(0, 200)
      .map((i) => ({ id: i.id, studentId: i.studentId, enrollmentId: i.enrollmentId, concept: i.concept, due: i.dueDate, owed: i.amount - i.amountPaid })),
  };
  const prompt = `Alcance: ${scope}.\n\n<registros>\n${JSON.stringify(compact)}\n</registros>\n\n<hallazgos_reglas>\n${JSON.stringify(rules.map((f) => ({ severity: f.severity, category: f.category, entity: f.entity, entityId: f.entityId ?? null, ref: codeRef(f) })))}\n</hallazgos_reglas>`;

  try {
    const out = await llm.generateJSON({ system: AUDITOR_SYSTEM, prompt, schema: AuditReportLLM });
    const merged = new Map<string, AuditFinding>();
    for (const f of rules) merged.set(`${f.category}:${f.entityId ?? f.title}`, f);
    out.findings.forEach((f, n) => {
      const key = `${f.category}:${f.entityId ?? f.title}`;
      merged.set(key, { ...f, entityId: f.entityId ?? undefined, id: `ia-${n}-${key}` });
    });
    const order = { alta: 0, media: 1, baja: 2 } as const;
    return {
      generatedAt: nowISO(),
      source: "ia",
      summary: out.summary,
      findings: [...merged.values()].sort((a, b) => order[a.severity] - order[b.severity]),
    };
  } catch (error) {
    console.error("[auditor] IA no disponible, se usan reglas:", error instanceof Error ? error.message : error);
    return base;
  }
}
