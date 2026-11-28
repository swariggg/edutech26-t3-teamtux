import "server-only";
import type {
  Application, ApplicationStatus, ApplicationView, AuditLog, Enrollment, EnrollmentView, Guardian, Installment, InstallmentView, Student,
} from "@/domain/types";
import type { Repository } from "../repository";
import { APPLICATION_CONFLICT_MSG, ConflictError, INSTALLMENT_CLOSED_MSG, NotFoundError, effectiveInstallmentStatus, matchesSearch, paginate } from "../repository";
import { computeDashboardStats } from "../stats";
import { getSupabase } from "./client";
import { institution } from "@/content/institution";

/* eslint-disable @typescript-eslint/no-explicit-any -- filas sin tipos generados; ejecutar `supabase gen types` más adelante */
type Row = Record<string, any>;

const toGuardian = (r: Row): Guardian => ({
  id: r.id, fullName: r.full_name, documentId: r.document_id, email: r.email ?? "", phone: r.phone ?? "",
  relationship: r.relationship, address: r.address ?? undefined, createdAt: r.created_at,
});
const toStudent = (r: Row): Student => ({
  id: r.id, fullName: r.full_name, documentId: r.document_id, birthDate: r.birth_date, gender: r.gender ?? undefined,
  guardianId: r.guardian_id, previousSchool: r.previous_school ?? undefined, specialNeeds: r.special_needs ?? undefined, createdAt: r.created_at,
});
const toApplication = (r: Row): Application => ({
  id: r.id, trackingCode: r.tracking_code, studentId: r.student_id, guardianId: r.guardian_id, gradeApplied: r.grade_applied,
  academicYear: r.academic_year, status: r.status, documents: r.documents ?? [],
  history: ((r.application_status_events ?? []) as Row[])
    .map((e) => ({ status: e.status, at: e.at, by: e.actor, note: e.note ?? undefined }))
    .sort((a, b) => a.at.localeCompare(b.at)),
  interviewAt: r.interview_at ?? undefined, submittedAt: r.submitted_at, updatedAt: r.updated_at, notes: r.notes ?? undefined,
});
const toEnrollment = (r: Row): Enrollment => ({
  id: r.id, code: r.code, studentId: r.student_id, applicationId: r.application_id ?? undefined, grade: r.grade,
  section: r.section ?? undefined, academicYear: r.academic_year, status: r.status, enrolledAt: r.enrolled_at,
});
const toInstallment = (r: Row): Installment => {
  const base: Installment = {
    id: r.id, enrollmentId: r.enrollment_id, studentId: r.student_id, concept: r.concept, period: r.period, description: r.description,
    amount: Number(r.amount), amountPaid: Number(r.amount_paid), dueDate: r.due_date, status: r.status,
    paidAt: r.paid_at ?? undefined, method: r.method ?? undefined, reference: r.reference ?? undefined,
  };
  return { ...base, status: effectiveInstallmentStatus(base) };
};
const toLog = (r: Row): AuditLog => ({
  id: r.id, at: r.at, actor: r.actor, action: r.action, entity: r.entity, entityId: r.entity_id ?? undefined, details: r.details ?? undefined,
});

const APP_SELECT = "*, student:students(*), guardian:guardians(*), application_status_events(*)";

type SbError = { message: string; code?: string } | null;

function must<T>(res: { data: T | null; error: SbError }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data as T;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;
  private get sb() { return getSupabase(); }

  private toView(r: Row): ApplicationView {
    return { ...toApplication(r), student: toStudent(r.student), guardian: toGuardian(r.guardian) };
  }

  async listApplications(p?: Parameters<Repository["listApplications"]>[0]) {
    let q = this.sb.from("applications").select(APP_SELECT).order("updated_at", { ascending: false });
    if (p?.status) q = q.eq("status", p.status);
    if (p?.grade) q = q.eq("grade_applied", p.grade);
    const rows = (must(await q) as Row[]).map((r) => this.toView(r));
    return paginate(rows.filter((a) => matchesSearch([a.trackingCode, a.student.fullName, a.guardian.fullName, a.student.documentId], p?.search)), p);
  }

  async getApplication(id: string) {
    const res = await this.sb.from("applications").select(APP_SELECT).eq("id", id).maybeSingle();
    const r = must(res) as Row | null;
    return r ? this.toView(r) : null;
  }

  async findApplicationByTracking(trackingCode: string, guardianDocumentId: string) {
    const res = await this.sb.from("applications").select(APP_SELECT).eq("tracking_code", trackingCode.toUpperCase()).maybeSingle();
    const r = must(res) as Row | null;
    if (!r || r.guardian?.document_id !== guardianDocumentId) return null;
    return this.toView(r);
  }

  async findApplicationByCode(trackingCode: string) {
    const res = await this.sb.from("applications").select(APP_SELECT).eq("tracking_code", trackingCode.toUpperCase()).maybeSingle();
    const r = must(res) as Row | null;
    return r ? this.toView(r) : null;
  }

  /** Transacción única en Postgres (public.create_application): no sobrescribe representantes, código aleatorio. */
  async createApplication(input: Parameters<Repository["createApplication"]>[0]) {
    const { data, error } = await this.sb.rpc("create_application", {
      p_student_name: input.studentName, p_student_document: input.studentDocument, p_birth_date: input.birthDate,
      p_gender: input.gender ?? null, p_previous_school: input.previousSchool ?? null, p_special_needs: input.specialNeeds ?? null,
      p_guardian_name: input.guardianName, p_guardian_document: input.guardianDocument, p_email: input.email, p_phone: input.phone,
      p_relationship: input.relationship, p_address: input.address ?? null,
      p_grade: input.gradeApplied, p_academic_year: institution.academicYear,
      p_documents: institution.requirements.map((r) => ({ kind: r.kind, received: input.documents.includes(r.kind) })),
    });
    if (error) {
      if (error.message.includes("application_conflict")) throw new ConflictError(APPLICATION_CONFLICT_MSG);
      throw new Error(`Supabase: ${error.message}`);
    }
    const app = await this.getApplication(data as string);
    if (!app) throw new Error("Supabase: solicitud creada no encontrada");
    return app;
  }

  async updateApplicationStatus(id: string, status: ApplicationStatus, by: string, note?: string) {
    const res = await this.sb.from("applications").update({ status }).eq("id", id).select("id").maybeSingle();
    if (!must(res)) throw new NotFoundError("Solicitud");
    must(await this.sb.from("application_status_events").insert({ application_id: id, status, actor: by, note: note ?? null }));
    return (await this.getApplication(id))!;
  }

  async listEnrollments(p?: Parameters<Repository["listEnrollments"]>[0]) {
    let q = this.sb.from("enrollments").select("*, student:students(full_name)").order("code");
    if (p?.status) q = q.eq("status", p.status);
    if (p?.grade) q = q.eq("grade", p.grade);
    if (p?.academicYear) q = q.eq("academic_year", p.academicYear);
    const rows: EnrollmentView[] = (must(await q) as Row[]).map((r) => ({ ...toEnrollment(r), studentName: r.student?.full_name ?? "—" }));
    return paginate(rows.filter((e) => matchesSearch([e.code, e.studentName], p?.search)), p);
  }

  async listInstallments(p?: Parameters<Repository["listInstallments"]>[0]) {
    let q = this.sb.from("installments").select("*, student:students(full_name), enrollment:enrollments(grade)").order("due_date");
    if (p?.period) q = q.eq("period", p.period);
    if (p?.studentId) q = q.eq("student_id", p.studentId);
    const rows: InstallmentView[] = (must(await q) as Row[]).map((r) => ({ ...toInstallment(r), studentName: r.student?.full_name ?? "—", grade: r.enrollment?.grade }));
    return paginate(rows.filter((i) => (!p?.status || i.status === p.status) && matchesSearch([i.studentName, i.description, i.reference], p?.search)), p);
  }

  async findPaymentsForFamily(studentQuery: string, guardianDocumentId: string) {
    // Coincidencia exacta (la ruta ya valida el formato: cédula de 10 dígitos o MAT-AAAA-XXXX).
    const q = studentQuery.trim().toUpperCase();
    const byCode = q.startsWith("MAT-") ? (must(await this.sb.from("enrollments").select("*").eq("code", q).maybeSingle()) as Row | null) : null;
    const studentRow = byCode
      ? (must(await this.sb.from("students").select("*, guardian:guardians(document_id)").eq("id", byCode.student_id).maybeSingle()) as Row | null)
      : (must(await this.sb.from("students").select("*, guardian:guardians(document_id)").eq("document_id", q).maybeSingle()) as Row | null);
    if (!studentRow || studentRow.guardian?.document_id !== guardianDocumentId) return null;
    const enrollmentRow = byCode ?? (must(await this.sb.from("enrollments").select("*").eq("student_id", studentRow.id).order("enrolled_at", { ascending: false }).limit(1).maybeSingle()) as Row | null);
    if (!enrollmentRow) return null;
    const ins = must(await this.sb.from("installments").select("*").eq("enrollment_id", enrollmentRow.id).order("due_date")) as Row[];
    return { student: toStudent(studentRow), enrollment: toEnrollment(enrollmentRow), installments: ins.map(toInstallment) };
  }

  /** Atómico en Postgres (public.register_payment): bloqueo de fila, idempotencia por referencia y bitácora. */
  async registerPayment(id: string, data: Parameters<Repository["registerPayment"]>[1]) {
    if (!UUID_RE.test(id)) throw new NotFoundError("Cuota");
    const { data: rows, error } = await this.sb.rpc("register_payment", {
      p_installment_id: id, p_amount: data.amount, p_method: data.method, p_reference: data.reference ?? null, p_actor: data.by,
    });
    if (error) {
      if (error.message.includes("installment_not_found")) throw new NotFoundError("Cuota");
      if (error.message.includes("installment_closed")) throw new ConflictError(INSTALLMENT_CLOSED_MSG);
      throw new Error(`Supabase: ${error.message}`);
    }
    const row = (rows as Row[] | null)?.[0];
    if (!row) throw new Error("Supabase: register_payment sin resultado");
    return { installment: toInstallment(row.installment as Row), applied: Boolean(row.applied) };
  }

  async listAuditLogs(p?: Parameters<Repository["listAuditLogs"]>[0]) {
    let q = this.sb.from("audit_logs").select("*").order("at", { ascending: false }).limit(p?.limit ?? 200);
    if (p?.entity) q = q.eq("entity", p.entity);
    const rows = (must(await q) as Row[]).map(toLog);
    return rows.filter((l) => matchesSearch([l.action, l.actor, l.entityId], p?.search));
  }

  async addAuditLog(entry: Omit<AuditLog, "id" | "at">) {
    const r = must(await this.sb.from("audit_logs").insert({ actor: entry.actor, action: entry.action, entity: entry.entity, entity_id: entry.entityId ?? null, details: entry.details ?? null }).select().single()) as Row;
    return toLog(r);
  }

  async getDashboardStats() {
    const [apps, enr, ins] = await Promise.all([this.listApplications(), this.listEnrollments(), this.listInstallments({ limit: 10_000 })]);
    return computeDashboardStats(apps, enr, ins);
  }

  async saveChatMessage(m: { sessionId: string; role: "user" | "assistant"; content: string }) {
    if (!UUID_RE.test(m.sessionId)) throw new Error("Supabase: sessionId inválido");
    must(await this.sb.from("chat_sessions").upsert({ id: m.sessionId }, { onConflict: "id", ignoreDuplicates: true }));
    must(await this.sb.from("chat_messages").insert({ session_id: m.sessionId, role: m.role, content: m.content.slice(0, 16_000) }));
  }

  async getAuditSnapshot() {
    const [applications, installments, enrollments] = await Promise.all([this.listApplications(), this.listInstallments({ limit: 10_000 }), this.listEnrollments()]);
    return { applications, installments, enrollments, now: new Date().toISOString() };
  }
}
