import "server-only";
import type {
  Application, ApplicationStatus, ApplicationView, AuditLog, DocumentKind, DocumentReview, Enrollment, EnrollmentView, Guardian, Installment, InstallmentView, StoredFile, Student,
} from "@/domain/types";
import type { Repository } from "../repository";
import { APPLICATION_CONFLICT_MSG, ConflictError, INSTALLMENT_CLOSED_MSG, NotFoundError, effectiveInstallmentStatus, matchesSearch, paginate } from "../repository";
import { computeDashboardStats } from "../stats";
import { enrollmentPlan } from "../enrollment-plan";
import { getSupabase } from "./client";
import { now as clockNow, nowISO } from "@/lib/clock";
import { institution } from "@/content/institution";

/* eslint-disable @typescript-eslint/no-explicit-any -- filas sin tipos generados; ejecutar `supabase gen types` más adelante */
type Row = Record<string, any>;

const toGuardian = (r: Row): Guardian => ({
  id: r.id, code: r.code ?? undefined, fullName: r.full_name ?? `Representante ${r.code ?? ""}`.trim(), documentId: r.document_id ?? undefined, email: r.email ?? "", phone: r.phone ?? "",
  relationship: r.relationship, address: r.address ?? undefined, createdAt: r.created_at,
});
const toStudent = (r: Row): Student => ({
  id: r.id, code: r.code ?? undefined, fullName: r.full_name, documentId: r.document_id ?? undefined, birthDate: r.birth_date ?? undefined,
  birthYear: r.birth_year ?? undefined, scholarshipPct: r.scholarship_pct ?? 0, gender: r.gender ?? undefined,
  guardianId: r.guardian_id, previousSchool: r.previous_school ?? undefined, specialNeeds: r.special_needs ?? undefined, createdAt: r.created_at,
});
const toApplication = (r: Row): Application => ({
  id: r.id, trackingCode: r.tracking_code, studentId: r.student_id, guardianId: r.guardian_id, gradeApplied: r.grade_applied,
  academicYear: r.academic_year, status: r.status, documents: r.documents ?? [],
  history: ((r.application_status_events ?? []) as Row[])
    .map((e) => ({ status: e.status, at: e.at, by: e.actor, note: e.note ?? undefined }))
    .sort((a, b) => a.at.localeCompare(b.at)),
  interviewAt: r.interview_at ?? undefined, submittedAt: r.submitted_at, updatedAt: r.updated_at, notes: r.notes ?? undefined,
  aiReview: r.ai_review ?? undefined,
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

/**
 * Lee todas las filas por páginas: PostgREST devuelve como máximo 1000 filas por consulta
 * (hay 2400 cuotas en el dataset). `build` debe crear la consulta con un orden total (p. ej. … y luego id).
 */
const PAGE_ROWS = 1000;
async function selectAll(build: () => { range(from: number, to: number): PromiseLike<{ data: unknown; error: SbError }> }): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const rows = must(await build().range(from, from + PAGE_ROWS - 1)) as Row[];
    out.push(...rows);
    if (rows.length < PAGE_ROWS) return out;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;
  private get sb() { return getSupabase(); }

  private toView(r: Row): ApplicationView {
    return { ...toApplication(r), student: toStudent(r.student), guardian: toGuardian(r.guardian) };
  }

  async listApplications(p?: Parameters<Repository["listApplications"]>[0]) {
    const rows = (await selectAll(() => {
      let q = this.sb.from("applications").select(APP_SELECT).order("updated_at", { ascending: false }).order("id");
      if (p?.status) q = q.eq("status", p.status);
      if (p?.grade) q = q.eq("grade_applied", p.grade);
      return q;
    })).map((r) => this.toView(r));
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

  async listApplicationsByGuardianDocument(guardianDocumentId: string) {
    const g = must(await this.sb.from("guardians").select("id").eq("document_id", guardianDocumentId).maybeSingle()) as Row | null;
    if (!g) return [];
    const rows = must(await this.sb.from("applications").select(APP_SELECT).eq("guardian_id", g.id).order("submitted_at", { ascending: false }).limit(20)) as Row[];
    return rows.map((r) => this.toView(r));
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
      p_now: nowISO(), // fecha de la app (reloj de demostración), ver migración demo_clock
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
    const at = nowISO();
    const res = await this.sb.from("applications").update({ status, updated_at: at }).eq("id", id).select("id").maybeSingle();
    if (!must(res)) throw new NotFoundError("Solicitud");
    must(await this.sb.from("application_status_events").insert({ application_id: id, status, actor: by, note: note ?? null, at }));
    return (await this.getApplication(id))!;
  }

  /** Atómico en Postgres (public.attach_document). */
  async attachDocument(applicationId: string, kind: DocumentKind, file: StoredFile) {
    if (!UUID_RE.test(applicationId)) throw new NotFoundError("Solicitud");
    const { error } = await this.sb.rpc("attach_document", { p_application_id: applicationId, p_kind: kind, p_file: file, p_now: nowISO() });
    if (error) {
      if (error.message.includes("application_not_found")) throw new NotFoundError("Solicitud");
      throw new Error(`Supabase: ${error.message}`);
    }
  }

  async saveDocumentReview(applicationId: string, review: DocumentReview) {
    must(await this.sb.from("applications").update({ ai_review: review }).eq("id", applicationId));
  }

  /** Atómico e idempotente en Postgres (public.enroll_application). */
  async enrollApplication(applicationId: string, by: string) {
    if (!UUID_RE.test(applicationId)) throw new NotFoundError("Solicitud");
    const app = must(await this.sb.from("applications").select("academic_year").eq("id", applicationId).maybeSingle()) as Row | null;
    if (!app) throw new NotFoundError("Solicitud");
    const { data, error } = await this.sb.rpc("enroll_application", {
      p_application_id: applicationId, p_installments: enrollmentPlan(app.academic_year, clockNow()), p_actor: by, p_now: nowISO(),
    });
    if (error) {
      if (error.message.includes("application_not_found")) throw new NotFoundError("Solicitud");
      if (error.message.includes("application_not_approved")) throw new ConflictError("Solo se puede matricular una solicitud aprobada.");
      throw new Error(`Supabase: ${error.message}`);
    }
    const row = (data as Row[])[0]!;
    const enr = must(await this.sb.from("enrollments").select("*").eq("id", row.enrollment_id).single()) as Row;
    return { enrollment: toEnrollment(enr), created: Boolean(row.created) };
  }

  async getEnrollmentDetail(id: string) {
    if (!UUID_RE.test(id)) return null;
    const r = must(await this.sb.from("enrollments").select("*, student:students(*, guardian:guardians(*)), application:applications(id, tracking_code, status)").eq("id", id).maybeSingle()) as Row | null;
    if (!r) return null;
    const ins = must(await this.sb.from("installments").select("*").eq("enrollment_id", id).order("due_date")) as Row[];
    return {
      enrollment: toEnrollment(r),
      student: toStudent(r.student),
      guardian: toGuardian(r.student.guardian),
      installments: ins.map(toInstallment),
      application: r.application ? { id: r.application.id, trackingCode: r.application.tracking_code, status: r.application.status } : undefined,
    };
  }

  async getEnrollmentByApplication(applicationId: string) {
    if (!UUID_RE.test(applicationId)) return null;
    const r = must(await this.sb.from("enrollments").select("*").eq("application_id", applicationId).order("enrolled_at", { ascending: false }).limit(1).maybeSingle()) as Row | null;
    return r ? toEnrollment(r) : null;
  }

  async listEnrollments(p?: Parameters<Repository["listEnrollments"]>[0]) {
    const rows: EnrollmentView[] = (await selectAll(() => {
      let q = this.sb.from("enrollments").select("*, student:students(full_name, code, document_id, guardian_id, scholarship_pct, guardian:guardians(code))").order("code").order("id");
      if (p?.status) q = q.eq("status", p.status);
      if (p?.grade) q = q.eq("grade", p.grade);
      if (p?.academicYear) q = q.eq("academic_year", p.academicYear);
      return q;
    })).map((r) => ({ ...toEnrollment(r), studentName: r.student?.full_name ?? "—", studentCode: r.student?.code ?? undefined, studentDocumentId: r.student?.document_id ?? undefined,
      guardianKey: r.student?.guardian?.code ?? r.student?.guardian_id ?? undefined, scholarshipPct: Number(r.student?.scholarship_pct ?? 0) }));
    return paginate(rows.filter((e) => matchesSearch([e.code, e.studentName, e.studentCode, e.studentDocumentId], p?.search)), p);
  }

  async listInstallments(p?: Parameters<Repository["listInstallments"]>[0]) {
    const rows: InstallmentView[] = (await selectAll(() => {
      let q = this.sb.from("installments").select("*, student:students(full_name, code, document_id), enrollment:enrollments(grade)").order("due_date").order("id");
      if (p?.period) q = q.eq("period", p.period);
      if (p?.studentId) q = q.eq("student_id", p.studentId);
      return q;
    })).map((r) => ({ ...toInstallment(r), studentName: r.student?.full_name ?? "—", grade: r.enrollment?.grade, studentCode: r.student?.code ?? undefined, studentDocumentId: r.student?.document_id ?? undefined }));
    return paginate(rows.filter((i) => (!p?.status || i.status === p.status) && matchesSearch([i.studentName, i.studentCode, i.studentDocumentId, i.description, i.reference], p?.search)), p);
  }

  async findPaymentsForFamily(studentQuery: string, guardianDocumentId: string) {
    // Coincidencia exacta (la ruta ya valida el formato: EST-###, cédula o MAT-AAAA-XXXX; REP-### o cédula).
    const q = studentQuery.trim().toUpperCase();
    const g = guardianDocumentId.trim().toUpperCase();
    const byCode = q.startsWith("MAT-") ? (must(await this.sb.from("enrollments").select("*").eq("code", q).maybeSingle()) as Row | null) : null;
    const sel = this.sb.from("students").select("*, guardian:guardians(code, document_id)");
    const studentRow = (byCode
      ? must(await sel.eq("id", byCode.student_id).maybeSingle())
      : must(await sel.eq(q.startsWith("EST-") ? "code" : "document_id", q).maybeSingle())) as Row | null;
    const guardian = studentRow?.guardian as Row | undefined;
    if (!studentRow || !guardian || !(guardian.code === g || (guardian.document_id != null && guardian.document_id === g))) return null;
    const enrollmentRow = byCode ?? (must(await this.sb.from("enrollments").select("*").eq("student_id", studentRow.id).order("enrolled_at", { ascending: false }).limit(1).maybeSingle()) as Row | null);
    if (!enrollmentRow) return null;
    const ins = must(await this.sb.from("installments").select("*").eq("enrollment_id", enrollmentRow.id).order("due_date")) as Row[];
    return { student: toStudent(studentRow), enrollment: toEnrollment(enrollmentRow), installments: ins.map(toInstallment) };
  }

  /** Atómico en Postgres (public.register_payment): bloqueo de fila, idempotencia por referencia y bitácora. */
  async registerPayment(id: string, data: Parameters<Repository["registerPayment"]>[1]) {
    if (!UUID_RE.test(id)) throw new NotFoundError("Cuota");
    const { data: rows, error } = await this.sb.rpc("register_payment", {
      p_installment_id: id, p_amount: data.amount, p_method: data.method, p_reference: data.reference ?? null, p_actor: data.by, p_now: nowISO(),
    });
    if (error) {
      if (error.message.includes("installment_not_found")) throw new NotFoundError("Cuota");
      if (error.message.includes("installment_closed")) throw new ConflictError(INSTALLMENT_CLOSED_MSG);
      throw new Error(`Supabase: ${error.message}`);
    }
    const row = (rows as Row[] | null)?.[0];
    if (!row) throw new Error("Supabase: register_payment sin resultado");
    let installment = toInstallment(row.installment as Row);
    // Demo del récord de puntualidad: fecha de pago elegida (puntual o atrasada) en lugar de «hoy».
    if (data.paidAt && row.applied && installment.status === "pagada") {
      installment = toInstallment(must(await this.sb.from("installments").update({ paid_at: data.paidAt }).eq("id", id).select("*").single()) as Row);
    }
    return { installment, applied: Boolean(row.applied) };
  }

  /** Atómico en Postgres (public.undo_demo_payment). */
  async undoDemoPayment(id: string, by: string) {
    if (!UUID_RE.test(id)) throw new NotFoundError("Cuota");
    const { data, error } = await this.sb.rpc("undo_demo_payment", { p_installment_id: id, p_actor: by, p_now: nowISO() });
    if (error) {
      if (error.message.includes("installment_not_found")) throw new NotFoundError("Cuota");
      if (error.message.includes("not_demo_payment")) throw new ConflictError("Solo se pueden deshacer pagos de demostración de pensiones.");
      throw new Error(`Supabase: ${error.message}`);
    }
    return toInstallment(data as Row);
  }

  async listAuditLogs(p?: Parameters<Repository["listAuditLogs"]>[0]) {
    let q = this.sb.from("audit_logs").select("*").order("at", { ascending: false }).limit(p?.limit ?? 200);
    if (p?.entity) q = q.eq("entity", p.entity);
    const rows = (must(await q) as Row[]).map(toLog);
    return rows.filter((l) => matchesSearch([l.action, l.actor, l.entityId], p?.search));
  }

  async addAuditLog(entry: Omit<AuditLog, "id" | "at">) {
    const r = must(await this.sb.from("audit_logs").insert({ at: nowISO(), actor: entry.actor, action: entry.action, entity: entry.entity, entity_id: entry.entityId ?? null, details: entry.details ?? null }).select().single()) as Row;
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
    return { applications, installments, enrollments, now: nowISO() };
  }
}
