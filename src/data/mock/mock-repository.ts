import "server-only";
import type { ApplicationView, AuditLog, Enrollment, EnrollmentView, Installment, InstallmentView, Student } from "@/domain/types";
import type { Repository } from "../repository";
import { APPLICATION_CONFLICT_MSG, ConflictError, INSTALLMENT_CLOSED_MSG, NotFoundError, effectiveInstallmentStatus, matchesSearch, newTrackingCode, paginate } from "../repository";
import { computeDashboardStats } from "../stats";
import { buildSeed, type MockDB } from "./seed";
import { institution } from "@/content/institution";
import { nowISO } from "@/lib/clock";

const g = globalThis as unknown as { __eaMockDB?: MockDB; __eaMockPaymentRefs?: Set<string> };
/** Referencias de pago ya aplicadas (idempotencia, como el índice único de installment_payments). */
const paymentRefs = (g.__eaMockPaymentRefs ??= new Set<string>());

function db(): MockDB {
  if (!g.__eaMockDB) g.__eaMockDB = buildSeed();
  return g.__eaMockDB;
}

const clone = <T,>(v: T): T => structuredClone(v);

export class MockRepository implements Repository {
  readonly kind = "mock" as const;

  private nid(prefix: string) {
    const d = db();
    d.seq.id += 1;
    return `${prefix}_${d.seq.id.toString(36).padStart(4, "0")}`;
  }

  private appView(a: MockDB["applications"][number]): ApplicationView {
    const d = db();
    const student = d.students.find((s) => s.id === a.studentId)!;
    const guardian = d.guardians.find((x) => x.id === a.guardianId)!;
    return clone({ ...a, student, guardian });
  }

  private insView(i: Installment): InstallmentView {
    const d = db();
    const st = d.students.find((s) => s.id === i.studentId);
    const en = d.enrollments.find((e) => e.id === i.enrollmentId);
    return clone({ ...i, status: effectiveInstallmentStatus(i), studentName: st?.fullName ?? "—", grade: en?.grade ?? "primero_egb" });
  }

  private enrView(e: Enrollment): EnrollmentView {
    const st = db().students.find((s) => s.id === e.studentId);
    return clone({ ...e, studentName: st?.fullName ?? "—" });
  }

  async listApplications(p?: Parameters<Repository["listApplications"]>[0]) {
    const rows = db()
      .applications.filter((a) => (!p?.status || a.status === p.status) && (!p?.grade || a.gradeApplied === p.grade))
      .map((a) => this.appView(a))
      .filter((a) => matchesSearch([a.trackingCode, a.student.fullName, a.guardian.fullName, a.student.documentId], p?.search))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return paginate(rows, p);
  }

  async getApplication(id: string) {
    const a = db().applications.find((x) => x.id === id);
    return a ? this.appView(a) : null;
  }

  async findApplicationByTracking(trackingCode: string, guardianDocumentId: string) {
    const d = db();
    const a = d.applications.find((x) => x.trackingCode === trackingCode.toUpperCase());
    if (!a) return null;
    const guardian = d.guardians.find((x) => x.id === a.guardianId);
    if (guardian?.documentId !== guardianDocumentId) return null;
    return this.appView(a);
  }

  async findApplicationByCode(trackingCode: string) {
    const a = db().applications.find((x) => x.trackingCode === trackingCode.toUpperCase());
    return a ? this.appView(a) : null;
  }

  async listApplicationsByGuardianDocument(guardianDocumentId: string) {
    const d = db();
    const guardian = d.guardians.find((g) => g.documentId !== undefined && g.documentId === guardianDocumentId);
    if (!guardian) return [];
    return d.applications
      .filter((a) => a.guardianId === guardian.id)
      .map((a) => this.appView(a))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  // Mismas reglas que public.create_application: no se modifican datos de un representante existente,
  // se reutiliza el estudiante solo si pertenece al mismo representante y hay una solicitud activa por año.
  async createApplication(input: Parameters<Repository["createApplication"]>[0]) {
    const d = db();
    const now = nowISO();
    let guardian = d.guardians.find((x) => x.documentId === input.guardianDocument);
    const existingStudent = d.students.find((s) => s.documentId === input.studentDocument);
    if (existingStudent && existingStudent.guardianId !== guardian?.id) throw new ConflictError(APPLICATION_CONFLICT_MSG);
    if (existingStudent && d.applications.some((a) => a.studentId === existingStudent.id && a.academicYear === institution.academicYear && a.status !== "rechazada")) {
      throw new ConflictError(APPLICATION_CONFLICT_MSG);
    }
    if (!guardian) {
      guardian = {
        id: this.nid("gua"), fullName: input.guardianName, documentId: input.guardianDocument, email: input.email,
        phone: input.phone, relationship: input.relationship, address: input.address, createdAt: now,
      };
      d.guardians.push(guardian);
    }
    let student: Student | undefined = existingStudent;
    if (!student) {
      student = {
        id: this.nid("stu"), fullName: input.studentName, documentId: input.studentDocument, birthDate: input.birthDate,
        gender: input.gender, guardianId: guardian.id, previousSchool: input.previousSchool, specialNeeds: input.specialNeeds, createdAt: now,
      };
      d.students.push(student);
    }
    d.seq.application += 1;
    let trackingCode = newTrackingCode();
    while (d.applications.some((a) => a.trackingCode === trackingCode)) trackingCode = newTrackingCode();
    const app = {
      id: this.nid("app"),
      trackingCode,
      studentId: student.id,
      guardianId: guardian.id,
      gradeApplied: input.gradeApplied as ApplicationView["gradeApplied"],
      academicYear: institution.academicYear,
      status: "enviada" as const,
      documents: institution.requirements.map((r) => ({ kind: r.kind, received: input.documents.includes(r.kind) })),
      history: [{ status: "enviada" as const, at: now, by: "familia" }],
      submittedAt: now,
      updatedAt: now,
    };
    d.applications.push(app);
    return this.appView(app);
  }

  async updateApplicationStatus(id: string, status: ApplicationView["status"], by: string, note?: string) {
    const a = db().applications.find((x) => x.id === id);
    if (!a) throw new NotFoundError("Solicitud");
    const now = nowISO();
    a.status = status;
    a.updatedAt = now;
    a.history.push({ status, at: now, by, note });
    return this.appView(a);
  }

  async listEnrollments(p?: Parameters<Repository["listEnrollments"]>[0]) {
    const rows = db()
      .enrollments.filter((e) => (!p?.status || e.status === p.status) && (!p?.grade || e.grade === p.grade) && (!p?.academicYear || e.academicYear === p.academicYear))
      .map((e) => this.enrView(e))
      .filter((e) => matchesSearch([e.code, e.studentName], p?.search))
      .sort((a, b) => a.code.localeCompare(b.code));
    return paginate(rows, p);
  }

  async listInstallments(p?: Parameters<Repository["listInstallments"]>[0]) {
    const rows = db()
      .installments.map((i) => this.insView(i))
      .filter((i) => (!p?.status || i.status === p.status) && (!p?.period || i.period === p.period) && (!p?.studentId || i.studentId === p.studentId))
      .filter((i) => matchesSearch([i.studentName, i.description, i.reference], p?.search))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.studentName.localeCompare(b.studentName));
    return paginate(rows, p);
  }

  async findPaymentsForFamily(studentQuery: string, guardianDocumentId: string) {
    const d = db();
    const q = studentQuery.trim().toUpperCase();
    const enrollmentByCode = d.enrollments.find((e) => e.code === q);
    const student = enrollmentByCode
      ? d.students.find((s) => s.id === enrollmentByCode.studentId)
      : d.students.find((s) => s.code === q || (s.documentId !== undefined && s.documentId === q));
    if (!student) return null;
    const guardian = d.guardians.find((x) => x.id === student.guardianId);
    const g = guardianDocumentId.trim().toUpperCase();
    if (!guardian || !(guardian.code === g || (guardian.documentId !== undefined && guardian.documentId === g))) return null;
    const enrollment = enrollmentByCode ?? d.enrollments.filter((e) => e.studentId === student.id).sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))[0];
    if (!enrollment) return null;
    const installments = d.installments
      .filter((i) => i.enrollmentId === enrollment.id)
      .map((i) => ({ ...i, status: effectiveInstallmentStatus(i) }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return clone({ student, enrollment, installments });
  }

  // Mismas reglas que public.register_payment.
  async registerPayment(id: string, data: Parameters<Repository["registerPayment"]>[1]) {
    const i = db().installments.find((x) => x.id === id);
    if (!i) throw new NotFoundError("Cuota");
    const ref = data.reference?.trim() || undefined;
    if (ref && paymentRefs.has(`${id}|${ref}`)) {
      return { installment: clone({ ...i, status: effectiveInstallmentStatus(i) }), applied: false };
    }
    if (i.status === "anulada" || i.status === "pagada") throw new ConflictError(INSTALLMENT_CLOSED_MSG);
    const before = i.amountPaid;
    i.amountPaid = Math.min(i.amount, Math.round((i.amountPaid + data.amount) * 100) / 100);
    const applied = Math.round((i.amountPaid - before) * 100) / 100;
    const full = i.amountPaid >= i.amount;
    i.status = full ? "pagada" : "parcial";
    i.paidAt = full ? nowISO() : undefined;
    i.method = data.method;
    if (ref) { i.reference = ref; paymentRefs.add(`${id}|${ref}`); }
    await this.addAuditLog({ actor: data.by, action: "payment.received", entity: "installment", entityId: id, details: { amount: applied, requested: data.amount, method: data.method, reference: ref, status: i.status } });
    return { installment: clone({ ...i, status: effectiveInstallmentStatus(i) }), applied: true };
  }

  async listAuditLogs(p?: Parameters<Repository["listAuditLogs"]>[0]) {
    const rows = db()
      .auditLogs.filter((l) => !p?.entity || l.entity === p.entity)
      .filter((l) => matchesSearch([l.action, l.actor, l.entityId], p?.search));
    return clone(paginate(rows, p));
  }

  async addAuditLog(entry: Omit<AuditLog, "id" | "at">) {
    const log: AuditLog = { ...entry, id: this.nid("log"), at: nowISO() };
    db().auditLogs.unshift(log);
    return clone(log);
  }

  async getDashboardStats() {
    const [apps, enr, ins] = await Promise.all([this.listApplications(), this.listEnrollments(), this.listInstallments({ limit: 10_000 })]);
    return computeDashboardStats(apps, enr, ins);
  }

  async saveChatMessage(m: { sessionId: string; role: "user" | "assistant"; content: string }) {
    const d = db();
    d.chatMessages.push({ ...m, id: this.nid("msg"), createdAt: nowISO() });
    if (d.chatMessages.length > 500) d.chatMessages.splice(0, d.chatMessages.length - 500);
  }

  async getAuditSnapshot() {
    const [applications, installments, enrollments] = await Promise.all([this.listApplications(), this.listInstallments({ limit: 10_000 }), this.listEnrollments()]);
    return { applications, installments, enrollments, now: nowISO() };
  }
}
