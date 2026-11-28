import { z } from "zod";
import { APPLICATION_STATUSES, PAYMENT_METHODS } from "./labels";
import { institution } from "@/content/institution";

const gradeIds = institution.grades.map((g) => g.id) as [string, ...string[]];
const docIds = institution.requirements.map((r) => r.kind) as [string, ...string[]];

export const cedula = z.string().trim().regex(/^\d{10}$/, "Debe tener 10 dígitos");

export const StudentStep = z.object({
  studentName: z.string().trim().min(3, "Ingresa el nombre completo").max(120),
  studentDocument: cedula,
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha"),
  gender: z.enum(["F", "M", "X"]).optional(),
  previousSchool: z.string().trim().max(120).optional(),
  specialNeeds: z.string().trim().max(500).optional(),
});
export const GuardianStep = z.object({
  guardianName: z.string().trim().min(3, "Ingresa el nombre completo").max(120),
  guardianDocument: cedula,
  email: z.email("Correo no válido").max(160),
  phone: z.string().trim().regex(/^[+\d\s-]{7,20}$/, "Teléfono no válido"),
  relationship: z.enum(["madre", "padre", "tutor", "otro"]),
  address: z.string().trim().max(200).optional(),
});
export const GradeStep = z.object({
  gradeApplied: z.enum(gradeIds, { message: "Selecciona un grado" }),
  documents: z.array(z.enum(docIds)).max(docIds.length),
  consent: z.literal(true, { message: "Debes aceptar el tratamiento de datos" }),
});
export const ApplicationInput = StudentStep.extend(GuardianStep.shape).extend(GradeStep.shape);
export type ApplicationInput = z.infer<typeof ApplicationInput>;

export const StatusLookupInput = z.object({
  trackingCode: z.string().trim().toUpperCase().regex(/^ADM-\d{4}-[A-Z0-9]{4,8}$/, "Formato: ADM-2026-K7P2QX"),
  guardianDocument: cedula,
});
export const PaymentsLookupInput = z.object({
  studentQuery: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(\d{10}|MAT-\d{4}-[A-Z0-9]{4,8})$/, "Ingresa la cédula (10 dígitos) o el código de matrícula (MAT-2026-0001)"),
  guardianDocument: cedula,
});

/** Límites del chat público (abuso de costo): el servidor además recorta a CHAT_MAX_TURNS y CHAT_MAX_TOTAL_CHARS. */
export const CHAT_MAX_TURNS = 20;
export const CHAT_MAX_TOTAL_CHARS = 12_000;
export const ChatRequest = z.object({
  messages: z
    .array(
      z.discriminatedUnion("role", [
        z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(4000) }),
        // Las respuestas previas vienen del cliente: se aceptan vacías o largas y el servidor las filtra/recorta.
        z.object({ role: z.literal("assistant"), content: z.string().max(16_000) }),
      ]),
    )
    .min(1)
    .max(60)
    .refine((m) => m[m.length - 1]?.role === "user", "El último mensaje debe ser del usuario"),
  sessionId: z.string().uuid().optional(),
});

export const StatusChangeInput = z.object({
  status: z.enum(APPLICATION_STATUSES as [string, ...string[]]),
  note: z.string().trim().max(500).optional(),
});
export const MarkPaidInput = z.object({
  amount: z.number().positive().max(100000),
  method: z.enum(PAYMENT_METHODS as [string, ...string[]]),
  reference: z.string().trim().max(80).optional(),
});
export const AuditorInput = z.object({ scope: z.enum(["todo", "solicitudes", "pagos"]).default("todo") });

export const N8nEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("application.status_update"),
    trackingCode: z.string().optional(),
    applicationId: z.string().optional(),
    status: z.enum(APPLICATION_STATUSES as [string, ...string[]]),
    note: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal("payment.registered"),
    installmentId: z.string(),
    amount: z.number().positive(),
    method: z.enum(PAYMENT_METHODS as [string, ...string[]]),
    reference: z.string().max(80).optional(),
  }),
  z.object({
    type: z.literal("reminder.sent"),
    installmentId: z.string(),
    channel: z.enum(["email", "whatsapp", "sms"]),
    sentAt: z.string(),
  }),
]);

/** Esquema para la salida estructurada del auditor IA. */
export const AuditReportLLM = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      severity: z.enum(["alta", "media", "baja"]),
      category: z.enum(["estancada", "documentos", "inconsistencia", "mora", "datos"]),
      title: z.string(),
      detail: z.string(),
      entity: z.enum(["application", "enrollment", "installment", "system", "chat"]),
      entityId: z.string().nullable(),
      recommendation: z.string(),
    }),
  ),
});
export type AuditReportLLM = z.infer<typeof AuditReportLLM>;
