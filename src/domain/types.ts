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
  | "certificado_notas" | "foto" | "certificado_medico";
export type Relationship = "madre" | "padre" | "tutor" | "otro";
export type AuditEntity = "application" | "enrollment" | "installment" | "system" | "chat";

export interface Guardian {
  id: ID; fullName: string; documentId: string; email: string; phone: string;
  relationship: Relationship; address?: string; createdAt: ISODate;
}
export interface Student {
  id: ID; fullName: string; documentId: string; birthDate: ISODate; gender?: "F" | "M" | "X";
  guardianId: ID; previousSchool?: string; specialNeeds?: string; createdAt: ISODate;
}
export interface ApplicationDocument { kind: DocumentKind; received: boolean; note?: string }
export interface StatusEvent { status: ApplicationStatus; at: ISODate; by: string; note?: string }
export interface Application {
  id: ID; trackingCode: string; studentId: ID; guardianId: ID; gradeApplied: Grade;
  academicYear: string; status: ApplicationStatus; documents: ApplicationDocument[];
  history: StatusEvent[]; interviewAt?: ISODate; submittedAt: ISODate; updatedAt: ISODate; notes?: string;
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
export type FindingCategory = "estancada" | "documentos" | "inconsistencia" | "mora" | "datos";
export interface AuditFinding {
  id: string; severity: FindingSeverity; category: FindingCategory; title: string; detail: string;
  entity: AuditEntity; entityId?: ID; recommendation: string;
}
export interface AuditReport {
  generatedAt: ISODate; source: "ia" | "reglas"; summary: string; findings: AuditFinding[];
}
export type ApplicationView = Application & { student: Student; guardian: Guardian };
export type InstallmentView = Installment & { studentName: string; grade: Grade };
export type EnrollmentView = Enrollment & { studentName: string };
