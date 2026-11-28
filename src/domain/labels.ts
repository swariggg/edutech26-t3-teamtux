import type { ApplicationStatus, DocumentKind, EnrollmentStatus, InstallmentConcept, InstallmentStatus, PaymentMethod, FindingSeverity, FindingCategory, Relationship } from "./types";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const applicationStatusMeta: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  borrador: { label: "Borrador", tone: "neutral" },
  enviada: { label: "Enviada", tone: "info" },
  en_revision: { label: "En revisión", tone: "info" },
  documentos_pendientes: { label: "Documentos pendientes", tone: "warning" },
  entrevista_agendada: { label: "Entrevista agendada", tone: "info" },
  aprobada: { label: "Aprobada", tone: "success" },
  rechazada: { label: "Rechazada", tone: "danger" },
  lista_espera: { label: "Lista de espera", tone: "warning" },
};
export const enrollmentStatusMeta: Record<EnrollmentStatus, { label: string; tone: Tone }> = {
  pendiente_pago: { label: "Pendiente de pago", tone: "warning" },
  activa: { label: "Activa", tone: "success" },
  retirada: { label: "Retirada", tone: "neutral" },
  anulada: { label: "Anulada", tone: "danger" },
};
export const installmentStatusMeta: Record<InstallmentStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "info" },
  pagada: { label: "Pagada", tone: "success" },
  vencida: { label: "Vencida", tone: "danger" },
  parcial: { label: "Pago parcial", tone: "warning" },
  anulada: { label: "Anulada", tone: "neutral" },
};
export const conceptLabel: Record<InstallmentConcept, string> = { matricula: "Matrícula", pension: "Pensión", otros: "Otros" };
export const methodLabel: Record<PaymentMethod, string> = { transferencia: "Transferencia", tarjeta: "Tarjeta", efectivo: "Efectivo", deposito: "Depósito" };
export const documentLabel: Record<DocumentKind, string> = {
  cedula_estudiante: "Cédula del estudiante",
  cedula_representante: "Cédula del representante",
  partida_nacimiento: "Partida de nacimiento",
  certificado_notas: "Certificado de notas",
  foto: "Foto tamaño carné",
  certificado_medico: "Certificado médico",
};
export const relationshipLabel: Record<Relationship, string> = { madre: "Madre", padre: "Padre", tutor: "Tutor/a legal", otro: "Otro" };
export const severityMeta: Record<FindingSeverity, { label: string; tone: Tone }> = {
  alta: { label: "Alta", tone: "danger" },
  media: { label: "Media", tone: "warning" },
  baja: { label: "Baja", tone: "info" },
};
export const categoryLabel: Record<FindingCategory, string> = {
  estancada: "Solicitud estancada",
  documentos: "Documentos",
  inconsistencia: "Inconsistencia",
  mora: "Mora",
  datos: "Calidad de datos",
};
export const APPLICATION_STATUSES = Object.keys(applicationStatusMeta) as ApplicationStatus[];
export const ENROLLMENT_STATUSES = Object.keys(enrollmentStatusMeta) as EnrollmentStatus[];
export const INSTALLMENT_STATUSES = Object.keys(installmentStatusMeta) as InstallmentStatus[];
export const PAYMENT_METHODS = Object.keys(methodLabel) as PaymentMethod[];
