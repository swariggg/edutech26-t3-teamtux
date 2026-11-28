/**
 * Datos simulados deterministas (PRNG con semilla fija). Las fechas se calculan
 * respecto a "hoy" para que siempre existan casos vencidos o estancados que el auditor detecte.
 * Todos los nombres, cédulas y correos son ficticios.
 */
import type { Application, AuditLog, Enrollment, Grade, Guardian, Installment, PaymentMethod, Relationship, Student, ApplicationStatus } from "@/domain/types";
import { institution } from "@/content/institution";

export interface MockDB {
  guardians: Guardian[];
  students: Student[];
  applications: Application[];
  enrollments: Enrollment[];
  installments: Installment[];
  auditLogs: AuditLog[];
  chatMessages: { id: string; sessionId: string; role: "user" | "assistant"; content: string; createdAt: string }[];
  seq: { application: number; enrollment: number; id: number };
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_F = ["Valentina", "Camila", "Isabella", "Martina", "Sofía", "Lucía", "Emilia", "Renata", "Antonella", "Paula", "Daniela", "Gabriela", "Mía", "Abril", "Julieta"];
const FIRST_M = ["Mateo", "Santiago", "Sebastián", "Benjamín", "Joaquín", "Emiliano", "Thiago", "Nicolás", "Martín", "Diego", "Gabriel", "Samuel", "Tomás", "Lucas", "Andrés"];
const LAST = ["Andrade", "Benítez", "Cárdenas", "Delgado", "Espinoza", "Figueroa", "Guerrero", "Herrera", "Iturralde", "Jaramillo", "León", "Mendoza", "Naranjo", "Ortega", "Paredes", "Quintero", "Rosales", "Salazar", "Torres", "Valencia", "Zambrano"];
const ADULT_F = ["María", "Ana", "Carmen", "Patricia", "Verónica", "Lorena", "Silvia", "Mónica"];
const ADULT_M = ["José", "Carlos", "Luis", "Jorge", "Fernando", "Ricardo", "Marco", "Pablo"];
const SCHOOLS = ["Escuela Horizonte (ficticia)", "Colegio Nueva Luz (ficticio)", "Unidad Educativa Brisa (ficticia)"];
const STAFF = ["secretaria.ana", "secretaria.luis", "colecturia.marta"];

export function buildSeed(now = new Date()): MockDB {
  const r = mulberry32(808);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)] as T;
  const day = 86_400_000;
  const ago = (d: number) => new Date(now.getTime() - d * day).toISOString();
  let id = 0;
  const nid = (p: string) => `${p}_${(++id).toString(36).padStart(4, "0")}`;
  const cedulaN = (n: number) => `09${(10_000_000 + n * 7919).toString().slice(-8)}`;

  const year = institution.academicYear;
  const startYear = Number(year.slice(0, 4));
  const gradeIds = institution.grades.map((g) => g.id) as Grade[];

  const guardians: Guardian[] = [];
  const students: Student[] = [];
  for (let n = 0; n < 60; n++) {
    const sibling = n > 0 && n % 11 === 0; // algunos hermanos comparten representante
    const last1 = pick(LAST), last2 = pick(LAST);
    let guardian: Guardian;
    if (sibling) {
      guardian = guardians[guardians.length - 1]!;
    } else {
      const isMother = r() < 0.6;
      const rel: Relationship = isMother ? "madre" : r() < 0.85 ? "padre" : "tutor";
      const first = isMother ? pick(ADULT_F) : pick(ADULT_M);
      guardian = {
        id: nid("gua"),
        fullName: `${first} ${last1} ${last2}`,
        documentId: n === 0 ? "0912345678" : cedulaN(1000 + n),
        email: `${first.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")}.${last1.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")}${n}@ejemplo.com`,
        phone: `+593 99 ${String(100 + n).padStart(3, "0")} ${String(1000 + n * 13).slice(-4)}`,
        relationship: rel,
        address: `Calle ${pick(LAST)} ${10 + n}, Ciudad Aurora`,
        createdAt: ago(200 + n),
      };
      guardians.push(guardian);
    }
    const female = r() < 0.5;
    const ageYears = 4 + Math.floor(r() * 13);
    students.push({
      id: nid("stu"),
      fullName: `${female ? pick(FIRST_F) : pick(FIRST_M)} ${guardian.fullName.split(" ").slice(-2).join(" ")}`,
      documentId: n === 59 ? cedulaN(25) : cedulaN(n), // n=59 duplica la cédula del estudiante 25 (ambos con solicitud)
      birthDate: new Date(Date.UTC(startYear - ageYears, Math.floor(r() * 12), 1 + Math.floor(r() * 27))).toISOString().slice(0, 10),
      gender: female ? "F" : "M",
      guardianId: guardian.id,
      previousSchool: r() < 0.4 ? pick(SCHOOLS) : undefined,
      createdAt: ago(190 - (n % 30)),
    });
  }

  // ---- Solicitudes (40): estudiantes 20..59
  const applications: Application[] = [];
  const planned: { status: ApplicationStatus; daysAgo: number; idleDays: number }[] = [];
  for (let k = 0; k < 15; k++) planned.push({ status: "aprobada", daysAgo: 60 + k * 3, idleDays: 40 }); // 0..14 aprobadas (13 con matrícula)
  planned.push({ status: "en_revision", daysAgo: 30, idleDays: 22 }, { status: "en_revision", daysAgo: 28, idleDays: 19 }, { status: "en_revision", daysAgo: 25, idleDays: 17 }); // estancadas
  planned.push({ status: "entrevista_agendada", daysAgo: 20, idleDays: 10 }); // entrevista ya pasó
  const rest: ApplicationStatus[] = ["enviada", "enviada", "enviada", "en_revision", "en_revision", "documentos_pendientes", "documentos_pendientes", "documentos_pendientes", "entrevista_agendada", "entrevista_agendada", "rechazada", "rechazada", "lista_espera", "lista_espera", "enviada", "en_revision", "aprobada", "aprobada", "enviada", "documentos_pendientes", "en_revision"]; // 15 + 3 + 1 + 21 = 40 solicitudes (estudiantes 20..59)
  for (const s of rest) planned.push({ status: s, daysAgo: 2 + Math.floor(r() * 9), idleDays: Math.floor(r() * 3) });

  planned.forEach((p, k) => {
    const st = students[20 + k];
    if (!st) return;
    const submittedAt = ago(p.daysAgo);
    const updatedAt = ago(p.idleDays);
    const flow: ApplicationStatus[] = ["enviada"];
    if (["en_revision", "documentos_pendientes", "entrevista_agendada", "aprobada", "rechazada", "lista_espera"].includes(p.status)) flow.push("en_revision");
    if (["entrevista_agendada", "aprobada", "rechazada", "lista_espera"].includes(p.status)) flow.push("entrevista_agendada");
    if (!flow.includes(p.status)) flow.push(p.status);
    const history = flow.map((status, idx) => ({
      status,
      at: idx === 0 ? submittedAt : idx === flow.length - 1 ? updatedAt : new Date((new Date(submittedAt).getTime() + new Date(updatedAt).getTime()) / 2).toISOString(),
      by: idx === 0 ? "familia" : pick(STAFF),
    }));
    const missingDocs = p.status === "documentos_pendientes" || k === 1;
    applications.push({
      id: nid("app"),
      trackingCode: `ADM-${startYear}-${String(k + 1).padStart(4, "0")}`,
      studentId: st.id,
      guardianId: st.guardianId,
      gradeApplied: k === 0 ? "cuarto_egb" : pick(gradeIds),
      academicYear: year,
      status: p.status,
      documents: institution.requirements.map((req, i) => ({ kind: req.kind, received: !(missingDocs && i % 2 === 1) && !(req.kind === "certificado_medico" && r() < 0.5) })),
      history,
      interviewAt: p.status === "entrevista_agendada" ? (k === 18 ? ago(6) : new Date(now.getTime() + (2 + Math.floor(r() * 8)) * day).toISOString()) : undefined,
      submittedAt,
      updatedAt,
    });
  });
  // la solicitud 0 (demo) usa al representante 0
  if (applications[0] && guardians[0]) {
    const s0 = students[20]!;
    s0.guardianId = guardians[0].id;
    applications[0].guardianId = guardians[0].id;
  }

  // ---- Matrículas: estudiantes 0..19 (antiguos) + aprobadas 0..12 (13 de 15; 2 aprobadas quedan sin matrícula)
  const enrollments: Enrollment[] = [];
  const enrollStudents: { student: Student; appId?: string; grade: Grade }[] = [];
  for (let n = 0; n < 20; n++) enrollStudents.push({ student: students[n]!, grade: pick(gradeIds) });
  for (let k = 0; k < 13; k++) enrollStudents.push({ student: students[20 + k]!, appId: applications[k]!.id, grade: applications[k]!.gradeApplied });
  enrollStudents.forEach(({ student, appId, grade }, idx) => {
    enrollments.push({
      id: nid("enr"),
      code: `MAT-${startYear}-${String(idx + 1).padStart(4, "0")}`,
      studentId: student.id,
      applicationId: appId,
      grade,
      section: pick(["A", "B", "C"]),
      academicYear: year,
      status: idx === 7 ? "pendiente_pago" : idx === 31 ? "retirada" : "activa",
      enrolledAt: new Date(Date.UTC(startYear, 7, 1 + (idx % 20))).toISOString(),
    });
  });

  // ---- Cuotas: matrícula (20 ago) + 10 pensiones (día 5, sep..jun)
  const installments: Installment[] = [];
  const methods: PaymentMethod[] = ["transferencia", "transferencia", "deposito", "tarjeta", "efectivo"];
  const lateFamilies = new Set([2, 5, 9, 14, 22, 27]); // familias con mora
  enrollments.forEach((e, idx) => {
    const items: { concept: Installment["concept"]; period: string; description: string; amount: number; due: Date }[] = [
      { concept: "matricula", period: `${startYear}-08`, description: `Matrícula ${year}`, amount: institution.fees.enrollment, due: new Date(Date.UTC(startYear, 7, 20)) },
    ];
    for (let m = 0; m < institution.fees.months; m++) {
      const due = new Date(Date.UTC(startYear, 8 + m, institution.fees.dueDay));
      const period = due.toISOString().slice(0, 7);
      items.push({ concept: "pension", period, description: `Pensión ${period}`, amount: institution.fees.monthly, due });
    }
    items.forEach((it, j) => {
      const isPast = it.due < now;
      let paid = false;
      if (isPast) {
        if (it.concept === "matricula") paid = idx !== 7 && idx !== 3; // idx 3: matrícula activa sin pagar (inconsistencia)
        else if (lateFamilies.has(idx)) paid = j === 1 && idx % 2 === 0 ? true : false;
        else paid = r() < 0.93;
      }
      const partial = !paid && isPast && r() < 0.15;
      const amountPaid = paid ? it.amount : partial ? Math.round(it.amount * 0.5) : 0;
      installments.push({
        id: nid("ins"),
        enrollmentId: e.id,
        studentId: e.studentId,
        concept: it.concept,
        period: it.period,
        description: it.description,
        amount: it.amount,
        amountPaid,
        dueDate: it.due.toISOString().slice(0, 10),
        status: paid ? "pagada" : partial ? "parcial" : "pendiente",
        paidAt: paid ? new Date(it.due.getTime() - Math.floor(r() * 4) * day).toISOString() : undefined,
        method: paid || partial ? pick(methods) : undefined,
        reference: paid ? `REF-${Math.floor(r() * 900000 + 100000)}` : undefined,
      });
    });
  });
  // Error de datos sembrado: una cuota "pagada" sin fecha de pago
  const odd = installments.find((i) => i.status === "pagada" && i.concept === "pension");
  if (odd) odd.paidAt = undefined;

  const auditLogs: AuditLog[] = [];
  applications.slice(0, 12).forEach((a) => {
    auditLogs.push({ id: nid("log"), at: a.updatedAt, actor: pick(STAFF), action: "application.status_changed", entity: "application", entityId: a.id, details: { trackingCode: a.trackingCode, status: a.status } });
  });
  installments.filter((i) => i.status === "pagada").slice(-8).forEach((i) => {
    auditLogs.push({ id: nid("log"), at: i.paidAt ?? ago(3), actor: "colecturia.marta", action: "payment.received", entity: "installment", entityId: i.id, details: { amount: i.amount, method: i.method } });
  });
  auditLogs.sort((a, b) => b.at.localeCompare(a.at));

  return {
    guardians, students, applications, enrollments, installments, auditLogs, chatMessages: [],
    seq: { application: applications.length, enrollment: enrollments.length, id },
  };
}
