import type {
  ApplicationStatus, ApplicationView, AuditEntity, AuditLog, ChatMessageRecord, DashboardStats, Enrollment,
  EnrollmentDetail, EnrollmentStatus, EnrollmentView, Grade, ID, Installment, InstallmentStatus, InstallmentView, PaymentMethod, Student, DocumentKind, StoredFile, DocumentReview,
} from "@/domain/types";
import type { ApplicationInput } from "@/domain/schemas";
import { now as clockNow } from "@/lib/clock";

export interface ListParams { search?: string; limit?: number; offset?: number }

export interface AuditSnapshot {
  applications: ApplicationView[];
  installments: InstallmentView[];
  enrollments: EnrollmentView[];
  now: string;
}

export interface Repository {
  readonly kind: "mock" | "supabase";
  listApplications(p?: ListParams & { status?: ApplicationStatus; grade?: Grade }): Promise<ApplicationView[]>;
  getApplication(id: ID): Promise<ApplicationView | null>;
  /** Solicitudes de un representante por su cédula (uso interno: reenvío del código al correo registrado). */
  listApplicationsByGuardianDocument(guardianDocumentId: string): Promise<ApplicationView[]>;
  findApplicationByTracking(trackingCode: string, guardianDocumentId: string): Promise<ApplicationView | null>;
  /** Búsqueda directa por código (uso interno: webhooks). No validar identidad con esto. */
  findApplicationByCode(trackingCode: string): Promise<ApplicationView | null>;
  /** Crea la solicitud en una sola transacción. Lanza ConflictError (genérico) si no se puede registrar. */
  createApplication(input: ApplicationInput): Promise<ApplicationView>;
  updateApplicationStatus(id: ID, status: ApplicationStatus, by: string, note?: string): Promise<ApplicationView>;
  /** Marca el documento como recibido con la metadata del archivo subido (atómico). Lanza NotFoundError. */
  attachDocument(applicationId: ID, kind: DocumentKind, file: StoredFile): Promise<void>;
  /** Guarda la última revisión de documentos con IA. */
  saveDocumentReview(applicationId: ID, review: DocumentReview): Promise<void>;
  /**
   * Matricula una solicitud APROBADA: crea la matrícula (pendiente de pago), la cuota de matrícula y las pensiones
   * del año, en una sola transacción, y deja rastro en la bitácora. Idempotente: si ya existe, la devuelve con
   * `created: false`. Lanza NotFoundError si la solicitud no existe y ConflictError si no está aprobada.
   */
  enrollApplication(applicationId: ID, by: string): Promise<{ enrollment: Enrollment; created: boolean }>;
  /** Ficha completa de una matrícula (o null). */
  getEnrollmentDetail(id: ID): Promise<EnrollmentDetail | null>;
  /** Matrícula creada a partir de una solicitud (o null). */
  getEnrollmentByApplication(applicationId: ID): Promise<Enrollment | null>;
  listEnrollments(p?: ListParams & { status?: EnrollmentStatus; grade?: Grade; academicYear?: string }): Promise<EnrollmentView[]>;
  listInstallments(p?: ListParams & { status?: InstallmentStatus; period?: string; studentId?: ID }): Promise<InstallmentView[]>;
  findPaymentsForFamily(studentDocumentOrCode: string, guardianDocumentId: string): Promise<{ student: Student; enrollment: Enrollment; installments: Installment[] } | null>;
  /**
   * Registra un pago (atómico; escribe la bitácora). Idempotente por referencia: repetir la misma referencia
   * devuelve `applied: false` sin volver a sumar. Lanza ConflictError si la cuota está anulada o ya pagada.
   */
  registerPayment(id: ID, data: { amount: number; method: PaymentMethod; reference?: string; by: string; paidAt?: string }): Promise<{ installment: Installment; applied: boolean }>;
  /**
   * Solo demostración: deshace un pago de DEMO (referencia «DEMO-…») de una pensión y la deja sin pagar.
   * Lanza ConflictError si no es un pago de demo y NotFoundError si la cuota no existe.
   */
  undoDemoPayment(id: ID, by: string): Promise<Installment>;
  listAuditLogs(p?: ListParams & { entity?: AuditEntity }): Promise<AuditLog[]>;
  addAuditLog(entry: Omit<AuditLog, "id" | "at">): Promise<AuditLog>;
  getDashboardStats(): Promise<DashboardStats>;
  saveChatMessage(m: Omit<ChatMessageRecord, "id" | "createdAt">): Promise<void>;
  getAuditSnapshot(): Promise<AuditSnapshot>;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} no encontrado`);
    this.name = "NotFoundError";
  }
}

/** Conflicto de negocio con mensaje apto para mostrar (no revela datos de otros registros). */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * Comparación por nombre y no con instanceof: en desarrollo el repositorio simulado vive en globalThis y sobrevive
 * a la recarga en caliente, pero las clases se recrean, así que instanceof falla y el error terminaba en un 500.
 */
export const isConflictError = (e: unknown): e is ConflictError => e instanceof Error && e.name === "ConflictError";
export const isNotFoundError = (e: unknown): e is NotFoundError => e instanceof Error && e.name === "NotFoundError";

export const APPLICATION_CONFLICT_MSG =
  "No pudimos registrar la solicitud con esos datos. Si ya enviaste una solicitud para este estudiante, consulta su estado o escribe a secretaría.";
export const INSTALLMENT_CLOSED_MSG = "La cuota está anulada o ya fue pagada.";

/** Código de seguimiento aleatorio (sin caracteres ambiguos). Formato: ADM-2026-K7P2QX. */
export function newTrackingCode(year = clockNow().getUTCFullYear()): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `ADM-${year}-${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

/** Una cuota pendiente cuya fecha ya pasó se considera vencida (derivado al leer). */
export function effectiveInstallmentStatus(i: Pick<Installment, "status" | "dueDate">, now = clockNow()): InstallmentStatus {
  if ((i.status === "pendiente" || i.status === "parcial") && new Date(i.dueDate) < startOfDay(now)) return "vencida";
  return i.status;
}

export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function matchesSearch(haystack: (string | undefined)[], search?: string): boolean {
  if (!search) return true;
  const n = normalize(search);
  return haystack.some((h) => h && normalize(h).includes(n));
}

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * Paginación en memoria. Limitación conocida (D7): en Supabase los listados traen filas y filtran/paginan en
 * la app (PostgREST limita a 1000 filas por defecto). Suficiente para el volumen de una institución pequeña;
 * para más volumen, mover filtros, .range() y agregados del dashboard a SQL (vista o RPC).
 */
export function paginate<T>(rows: T[], p?: ListParams): T[] {
  const offset = p?.offset ?? 0;
  const limit = p?.limit ?? 500;
  return rows.slice(offset, offset + limit);
}
