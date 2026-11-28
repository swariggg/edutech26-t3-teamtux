import "server-only";
import type { ApplicationView, DocumentReview, PaymentCapacity } from "@/domain/types";
import { DocumentReviewLLM } from "@/domain/schemas";
import { documentLabel } from "@/domain/labels";
import { gradeLabel, institution } from "@/content/institution";
import type { Repository } from "@/data/repository";
import { getDocStorage } from "@/data/storage";
import { evaluateFamily } from "@/ml/nuevo-cliente";
import { logAudit } from "@/lib/audit";
import { nowISO } from "@/lib/clock";
import { getLLM, type Attachment } from "./llm";
import { DOC_REVIEW_SYSTEM } from "./prompts";

/** Tope de lo que se envía al modelo en una revisión (los archivos ya vienen limitados a 5 MB cada uno). */
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const GRADE_NUM: Record<string, number> = { octavo_egb: 8, noveno_egb: 9, decimo_egb: 10, primero_bgu: 11, segundo_bgu: 12, tercero_bgu: 13 };

/** Riesgo según los modelos de ML del equipo (perfil de familia nueva: curso, NEE, sin beca). */
function mlRisk(app: ApplicationView): DocumentReview["mlRisk"] {
  const grado = GRADE_NUM[app.gradeApplied];
  if (!grado) return null;
  const r = evaluateFamily({ hijos: [{ grado, nee: Boolean(app.student.specialNeeds?.trim()) }], beca: 0 });
  return { level: r.nivel, probability: Math.round(r.promedio * 1000) / 1000 };
}

/**
 * Capacidad de pago calculada en el servidor (no la decide el modelo): pensión / ingreso promedio,
 * regularidad del ingreso y eventos negativos (sobregiros, cheques devueltos…).
 */
export function paymentCapacity(f: Pick<DocumentReview["financial"], "analyzed" | "avgMonthlyIncome" | "incomeRegularity" | "negativeEvents">): { pct: number | null; capacity: PaymentCapacity } {
  if (!f.analyzed || !f.avgMonthlyIncome || f.avgMonthlyIncome <= 0) return { pct: null, capacity: "desconocida" };
  const pct = Math.round((institution.fees.monthly / f.avgMonthlyIncome) * 1000) / 10;
  let capacity: PaymentCapacity = pct <= 15 ? "alta" : pct <= 30 ? "media" : "baja";
  // Ingreso irregular o eventos negativos repetidos (3 o más: un sobregiro y su comisión cuentan como un solo
  // incidente para el modelo, que suele listarlos por separado) bajan un nivel.
  if (f.incomeRegularity === "irregular" || f.negativeEvents.length >= 3) capacity = capacity === "alta" ? "media" : "baja";
  return { pct, capacity };
}

function emptyFinancial(recommendation: string): DocumentReview["financial"] {
  return {
    analyzed: false, holderMatchesGuardian: null, periodMonths: null, avgMonthlyIncome: null, avgMonthlyBalance: null,
    incomeRegularity: "desconocida", negativeEvents: [], pensionToIncomePct: null, capacity: "desconocida", signals: [],
    recommendation, scholarshipCandidate: false, scholarshipReason: null,
  };
}

/**
 * Revisa los documentos subidos de una solicitud: legibilidad, que cada archivo sea lo que dice ser,
 * coherencia con el formulario y, con el estado de cuenta, capacidad de pago y posible beca.
 * Es apoyo a la decisión: guarda la revisión y deja rastro en la bitácora; nunca cambia el estado de la solicitud.
 */
export async function reviewApplicationDocuments(repo: Repository, applicationId: string): Promise<DocumentReview | null> {
  const app = await repo.getApplication(applicationId);
  if (!app) return null;
  const uploaded = app.documents.filter((d) => d.file);
  const missing = institution.requirements.filter((r) => r.required && !app.documents.find((d) => d.kind === r.kind)?.file);
  const llm = getLLM();
  const risk = mlRisk(app);

  const base: DocumentReview = {
    reviewedAt: nowISO(),
    source: "sin_ia",
    summary: "",
    documents: uploaded.map((d) => ({ kind: d.kind, status: "observado", issues: ["Pendiente de revisión manual (IA no disponible)."] })),
    inconsistencies: missing.map((r) => ({ severity: "media", title: `Falta: ${r.label}`, detail: "La familia aún no subió este documento obligatorio.", documents: [r.kind] })),
    financial: emptyFinancial("Sin análisis automático: revisar el estado de cuenta manualmente."),
    mlRisk: risk,
  };

  let review: DocumentReview = { ...base, summary: uploaded.length ? "La revisión con IA no está disponible; los documentos deben revisarse manualmente." : "La familia todavía no ha subido documentos." };

  if (llm.source === "anthropic" && uploaded.length > 0) {
    const storage = getDocStorage();
    const attachments: Attachment[] = [];
    let total = 0;
    const skipped: string[] = [];
    for (const d of uploaded) {
      const f = await storage.download(d.file!.path);
      if (!f || total + f.bytes.byteLength > MAX_TOTAL_BYTES) { skipped.push(documentLabel[d.kind]); continue; }
      total += f.bytes.byteLength;
      attachments.push({
        label: `Documento adjunto · tipo: ${d.kind} (${documentLabel[d.kind]})`,
        mediaType: d.file!.mimeType as Attachment["mediaType"],
        data: Buffer.from(f.bytes).toString("base64"),
      });
    }
    const form = {
      estudiante: { nombre: app.student.fullName, cedula: app.student.documentId ?? null, fecha_nacimiento: app.student.birthDate ?? null, institucion_anterior: app.student.previousSchool ?? null },
      representante: { nombre: app.guardian.fullName, cedula: app.guardian.documentId ?? null, parentesco: app.guardian.relationship },
      grado_postulado: gradeLabel(app.gradeApplied),
      anio_lectivo: app.academicYear,
      fecha_solicitud: app.submittedAt.slice(0, 10),
      pension_mensual_usd: institution.fees.monthly,
    };
    const prompt = `Revisa los documentos adjuntos de la solicitud ${app.trackingCode}.

<formulario>
${JSON.stringify(form, null, 1)}
</formulario>

Documentos obligatorios que NO se subieron: ${missing.map((r) => r.kind).join(", ") || "ninguno"}.
${skipped.length ? `No se pudieron adjuntar por tamaño: ${skipped.join(", ")}.` : ""}
Devuelve una entrada en "documents" por cada documento adjunto, usando su tipo.`;
    try {
      const out = await llm.generateJSON({ system: DOC_REVIEW_SYSTEM, prompt, schema: DocumentReviewLLM, attachments, maxTokens: 12000 });
      const { pct, capacity } = paymentCapacity(out.financial);
      review = {
        reviewedAt: nowISO(),
        source: "ia",
        summary: out.summary,
        // Solo documentos que de verdad se subieron (el modelo no puede inventar entradas).
        documents: out.documents.filter((d) => uploaded.some((u) => u.kind === d.kind)) as DocumentReview["documents"],
        inconsistencies: [...base.inconsistencies, ...(out.inconsistencies as DocumentReview["inconsistencies"])],
        financial: { ...out.financial, pensionToIncomePct: pct, capacity },
        mlRisk: risk,
      };
    } catch (error) {
      console.error("[document-review] IA no disponible:", error instanceof Error ? error.message : error);
      review = { ...base, summary: "La revisión con IA falló; se puede reintentar desde el panel. Mientras tanto, revisar manualmente." };
    }
  }

  await repo.saveDocumentReview(app.id, review);
  await logAudit(repo, {
    actor: "sistema",
    action: "documents.reviewed",
    entity: "application",
    entityId: app.id,
    details: {
      source: review.source,
      documents: review.documents.length,
      issues: review.inconsistencies.length,
      capacity: review.financial.capacity,
      scholarshipCandidate: review.financial.scholarshipCandidate,
    },
  });
  return review;
}
