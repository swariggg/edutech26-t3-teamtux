export type ID = string;
export type ISODate = string;

export type Grade =
  | "inicial_1" | "inicial_2" | "primero_egb" | "segundo_egb" | "tercero_egb" | "cuarto_egb"
  | "quinto_egb" | "sexto_egb" | "septimo_egb" | "octavo_egb" | "noveno_egb" | "decimo_egb"
  | "primero_bgu" | "segundo_bgu" | "tercero_bgu";

export type ApplicationStatus =
  | "borrador" | "enviada" | "en_revision" | "documentos_pendientes"
  | "entrevista_agendada" | "aprobada" | "rechazada" | "lista_espera";
export type EnrollmentStatus = "pendiente_pago" | "activa" | "retirada" | "anulada";
export type InstallmentStatus = "pendiente" | "pagada" | "vencida" | "parcial" | "anulada";
export type InstallmentConcept = "matricula" | "pension" | "otros";
export type PaymentMethod = "transferencia" | "tarjeta" | "efectivo" | "deposito";
export type DocumentKind =
  | "cedula_estudiante" | "cedula_representante" | "partida_nacimiento"
  | "certificado_notas" | "foto" | "certificado_medico" | "estado_cuenta";
export type Relationship = "madre" | "padre" | "tutor" | "otro";
export type AuditEntity = "application" | "enrollment" | "installment" | "system" | "chat";

export interface Guardian {
  /** code: REP-### del dataset; documentId: cédula (solo representantes que postulan en línea). */
  id: ID; code?: string; fullName: string; documentId?: string; email: string; phone: string;
  relationship: Relationship; address?: string; createdAt: ISODate;
}
export interface Student {
  /** code: EST-### del dataset. Los estudiantes del dataset no tienen cédula ni fecha exacta de nacimiento. */
  id: ID; code?: string; fullName: string; documentId?: string; birthDate?: ISODate; birthYear?: number; scholarshipPct?: number; gender?: "F" | "M" | "X";
  guardianId: ID; previousSchool?: string; specialNeeds?: string; createdAt: ISODate;
}
/** Archivo subido por la familia (almacenamiento privado). */
export interface StoredFile { path: string; name: string; mimeType: string; size: number; uploadedAt: ISODate }
export interface ApplicationDocument { kind: DocumentKind; received: boolean; note?: string; file?: StoredFile }

/** Revisión de documentos con IA: apoyo a la decisión del personal, nunca una decisión automática. */
export type DocReviewStatus = "ok" | "observado" | "ilegible" | "no_corresponde";
export type PaymentCapacity = "alta" | "media" | "baja" | "desconocida";
export interface DocumentReview {
  reviewedAt: ISODate;
  source: "ia" | "sin_ia";
  summary: string;
  documents: { kind: DocumentKind; status: DocReviewStatus; issues: string[] }[];
  inconsistencies: { severity: FindingSeverity; title: string; detail: string; documents: DocumentKind[] }[];
  /** Análisis del estado de cuenta: capacidad de pago frente a la pensión. */
  financial: {
    analyzed: boolean;
    holderMatchesGuardian: boolean | null;
    periodMonths: number | null;
    avgMonthlyIncome: number | null;
    avgMonthlyBalance: number | null;
    incomeRegularity: "estable" | "variable" | "irregular" | "desconocida";
    negativeEvents: string[];
    /** Pensión mensual / ingreso promedio, calculado en el servidor (no por el modelo). */
    pensionToIncomePct: number | null;
    capacity: PaymentCapacity;
    signals: string[];
    recommendation: string;
    scholarshipCandidate: boolean;
    scholarshipReason: string | null;
  };
  /** Riesgo según los modelos de ML del equipo (perfil de la familia, sin historial). */
  mlRisk: { level: "bajo" | "medio" | "alto"; probability: number } | null;
}
export interface StatusEvent { status: ApplicationStatus; at: ISODate; by: string; note?: string }
export interface Application {
  id: ID; trackingCode: string; studentId: ID; guardianId: ID; gradeApplied: Grade;
  academicYear: string; status: ApplicationStatus; documents: ApplicationDocument[];
  history: StatusEvent[]; interviewAt?: ISODate; submittedAt: ISODate; updatedAt: ISODate; notes?: string;
  aiReview?: DocumentReview;
}
export interface Enrollment {
  id: ID; code: string; studentId: ID; applicationId?: ID; grade: Grade; section?: string;
  academicYear: string; status: EnrollmentStatus; enrolledAt: ISODate;
}
export interface Installment {
  id: ID; enrollmentId: ID; studentId: ID; concept: InstallmentConcept; period: string;
  description: string; amount: number; amountPaid: number; dueDate: ISODate; status: InstallmentStatus;
  paidAt?: ISODate; method?: PaymentMethod; reference?: string;
}
export interface AuditLog {
  id: ID; at: ISODate; actor: string; action: string; entity: AuditEntity; entityId?: ID;
  details?: Record<string, unknown>;
}
export interface ChatMessageRecord {
  id: ID; sessionId: string; role: "user" | "assistant"; content: string; createdAt: ISODate;
}
export interface DashboardStats {
  totals: {
    applications: number; pendingReview: number; enrollmentsActive: number;
    collected: number; pending: number; overdue: number; collectionRate: number;
  };
  applicationsByStatus: { status: ApplicationStatus; label: string; count: number }[];
  enrollmentsByGrade: { grade: Grade; label: string; count: number }[];
  collections: { name: "Cobrado" | "Pendiente" | "Vencido"; value: number }[];
  monthlyRevenue: { month: string; label: string; billed: number; collected: number }[];
}
export type FindingSeverity = "alta" | "media" | "baja";
export type FindingCategory = "estancada" | "documentos" | "inconsistencia" | "mora" | "datos" | "riesgo_pago" | "oportunidad";
export interface AuditFinding {
  id: string; severity: FindingSeverity; category: FindingCategory; title: string; detail: string;
  entity: AuditEntity; entityId?: ID; recommendation: string;
}
export interface AuditReport {
  generatedAt: ISODate; source: "ia" | "reglas"; summary: string; findings: AuditFinding[];
}
export type ApplicationView = Application & { student: Student; guardian: Guardian };
/** studentCode (EST-###) y studentDocumentId (cédula) permiten buscar por código o cédula en administración. */
export type InstallmentView = Installment & { studentName: string; grade: Grade; studentCode?: string; studentDocumentId?: string };
/** Ficha de matrícula para administración: estudiante, representante, cuotas y la solicitud de origen. */
export interface EnrollmentDetail {
  enrollment: Enrollment; student: Student; guardian: Guardian; installments: Installment[];
  application?: { id: ID; trackingCode: string; status: ApplicationStatus };
}
/** guardianKey: código REP-### o, para familias nuevas, el id del representante (agrupa hermanos como una familia). */
export type EnrollmentView = Enrollment & { studentName: string; studentCode?: string; studentDocumentId?: string; guardianKey?: string; scholarshipPct?: number };
