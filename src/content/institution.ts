/**
 * CONTEXTO INSTITUCIONAL — único archivo editable con la información de la institución.
 * NODO es una institución FICTICIA creada para la demostración (no existe ni representa a ninguna real).
 * Clipo (el asistente IA), los correos de n8n, las respuestas simuladas y la web leen de aquí.
 */
import type { DocumentKind, Grade, PaymentMethod } from "@/domain/types";

export const institution = {
  name: "Unidad Educativa Nodo",
  shortName: "Nodo",
  tagline: "Conectamos aprendizaje, familias y futuro.",
  city: "Ciudad Aurora (ficticia)",
  address: "Av. de las Conexiones 404, Ciudad Aurora",
  /** Identidad: lo que Clipo cuenta cuando preguntan «¿qué es Nodo?» o «¿qué los diferencia?». */
  about: {
    mission: "Formar estudiantes que conectan conocimiento, tecnología y comunidad, acompañando a cada familia en todo el proceso.",
    highlights: [
      "Procesos 100 % en línea: admisión, seguimiento, documentos y pagos desde el celular.",
      "Fidelización: las familias puntuales ganan una beca del 20 % en la pensión del año siguiente.",
      "Acompañamiento cercano: un asistente virtual disponible todo el día y personal que decide con criterio humano.",
    ],
  },
  /** Asistente virtual con IA. */
  assistant: {
    name: "Clipo",
    greeting: "¡Hola! Soy Clipo, el asistente virtual de Nodo. Te ayudo con la admisión, la matrícula y los pagos. ¿En qué te ayudo hoy?",
  },
  locale: "es-EC",
  currency: "USD",
  // Año lectivo en curso (estudiantes y pensiones del dataset ficticio) y año al que se postula.
  currentYear: "2025-2026",
  academicYear: "2026-2027",
  contact: {
    secretaria: { email: "secretaria@nodo.example", phone: "+593 2 000 0404", whatsapp: "+593 99 000 0404" },
    colecturia: { email: "colecturia@nodo.example", phone: "+593 2 000 0405" },
    schedule: "Lunes a viernes, 07:30 – 16:00",
  },
  grades: [
    { id: "octavo_egb", label: "8.º EGB", level: "Educación General Básica" },
    { id: "noveno_egb", label: "9.º EGB", level: "Educación General Básica" },
    { id: "decimo_egb", label: "10.º EGB", level: "Educación General Básica" },
    { id: "primero_bgu", label: "1.º BGU", level: "Bachillerato" },
    { id: "segundo_bgu", label: "2.º BGU", level: "Bachillerato" },
    { id: "tercero_bgu", label: "3.º BGU", level: "Bachillerato" },
  ] as { id: Grade; label: string; level: string }[],
  fees: {
    enrollment: 150,
    monthly: 185,
    months: 10,
    firstMonth: "septiembre",
    lastMonth: "junio",
    dueDay: 10,
    lateFeePolicy:
      "Desde el día 11 de cada mes la pensión se considera vencida. Tras 30 días de mora se contacta a la familia para acordar un plan de pagos; no se cobran intereses durante los primeros 15 días.",
    discounts: "Becas de 10%, 25% o 50% sobre la pensión, asignadas por evaluación socioeconómica o mérito académico.",
  },
  paymentMethods: [
    { id: "transferencia", label: "Transferencia bancaria", detail: "Banco Ficticio, cuenta corriente 000-404040-4 a nombre de Unidad Educativa Nodo" },
    { id: "deposito", label: "Depósito en ventanilla", detail: "Mismo número de cuenta; enviar el comprobante a colecturía" },
    { id: "tarjeta", label: "Tarjeta de crédito o débito", detail: "En línea desde la sección Pagos (demostración) o en colecturía" },
    { id: "efectivo", label: "Efectivo", detail: "Solo en colecturía, en horario de atención" },
  ] as { id: PaymentMethod; label: string; detail: string }[],
  requirements: [
    { kind: "cedula_estudiante", label: "Copia de cédula del estudiante", required: true },
    { kind: "cedula_representante", label: "Copia de cédula del representante", required: true },
    { kind: "partida_nacimiento", label: "Partida de nacimiento", required: true },
    { kind: "certificado_notas", label: "Certificado de notas del año anterior", required: true },
    { kind: "foto", label: "Fotografía tamaño carné", required: true },
    { kind: "certificado_medico", label: "Certificado médico", required: false },
    { kind: "estado_cuenta", label: "Estado de cuenta bancario del representante (últimos 3 meses)", required: true },
  ] as { kind: DocumentKind; label: string; required: boolean }[],
  process: [
    { step: "Solicitud", detail: "Completa el formulario en línea y recibe tu código de seguimiento." },
    { step: "Revisión", detail: "Secretaría revisa documentos y agenda una entrevista con la familia." },
    { step: "Matrícula", detail: "Con la admisión aprobada, se paga la matrícula y se asigna paralelo." },
    { step: "Pensiones", detail: "Se pagan 10 pensiones mensuales de septiembre a junio." },
  ],
  calendar: [
    { label: "Apertura de admisiones", date: "1 de marzo" },
    { label: "Cierre de admisiones", date: "31 de julio" },
    { label: "Matrículas ordinarias", date: "1 al 20 de agosto" },
    { label: "Inicio de clases", date: "1 de septiembre" },
  ],
  faq: [
    { q: "¿Cuáles son los requisitos de admisión?", a: "Cédulas del estudiante y del representante, partida de nacimiento, certificado de notas del año anterior, una foto tamaño carné y el estado de cuenta bancario del representante de los últimos 3 meses. El certificado médico es opcional. Todo se sube en línea al enviar la solicitud." },
    { q: "¿Para qué piden el estado de cuenta?", a: "Para acordar contigo un plan de pago a tu medida e identificar a familias que pueden acceder a una beca. Una inteligencia artificial lo revisa, pero la decisión la toma siempre el personal de colecturía; el archivo se guarda de forma privada." },
    { q: "¿Cuánto cuesta la matrícula y la pensión?", a: "La matrícula cuesta USD 150 y la pensión mensual USD 185, durante 10 meses (septiembre a junio)." },
    { q: "¿Cómo consulto el estado de mi solicitud?", a: "En la sección «Estado» con tu código de seguimiento (por ejemplo ADM-2026-0001) y la cédula del representante." },
    { q: "¿Hasta qué fecha puedo pagar la pensión?", a: "Hasta el día 10 de cada mes. Desde el día 11 se considera vencida." },
    { q: "¿Qué métodos de pago aceptan?", a: "Transferencia, depósito, tarjeta en colecturía y efectivo en colecturía." },
    { q: "¿Ofrecen becas?", a: "Sí, becas de 10%, 25% o 50% sobre la pensión, que se solicitan en secretaría con la documentación socioeconómica o el récord académico. Además, la beca por puntualidad: cada pensión pagada a tiempo suma 10 % a tu récord (atrasada 5 %); con 80 % o más y ningún mes sin pagar ganas un 20 % de descuento en la pensión del año siguiente. Tu récord se ve en la sección Pagos." },
    { q: "¿Qué pasa si me atraso en un pago?", a: "Tras 30 días de mora colecturía te contactará para acordar un plan de pagos. Durante los primeros 15 días no hay intereses." },
    { q: "¿Cómo obtengo mi código de matrícula?", a: "Cuando tu solicitud es aprobada se crea tu matrícula automáticamente y te llega por correo el código (MAT-…). También lo ves en la sección Estado. Con ese código y tu cédula consultas y pagas tus cuotas en Pagos." },
    { q: "¿Puedo hablar con una persona?", a: "Claro. Secretaría atiende de lunes a viernes de 07:30 a 16:00 en secretaria@nodo.example o al +593 2 000 0404." },
  ],
} as const;

export function gradeLabel(id: string): string {
  return institution.grades.find((g) => g.id === id)?.label ?? id;
}

/** Texto estable (sin fechas dinámicas) para el system prompt del asesor. */
export function toPromptContext(): string {
  const i = institution;
  const lines = [
    `Institución: ${i.name} («${i.shortName}», ${i.city}). Lema: ${i.tagline} Dirección: ${i.address}.`,
    `Misión: ${i.about.mission} Lo que nos distingue: ${i.about.highlights.join(" ")}`,
    `Año lectivo en curso: ${i.currentYear}. Admisiones abiertas para el año ${i.academicYear}. Moneda: ${i.currency}.`,
    `Contacto secretaría: ${i.contact.secretaria.email}, ${i.contact.secretaria.phone}, WhatsApp ${i.contact.secretaria.whatsapp}. Colecturía: ${i.contact.colecturia.email}, ${i.contact.colecturia.phone}. Horario: ${i.contact.schedule}.`,
    `Niveles y grados: ${i.grades.map((g) => g.label).join(", ")}.`,
    `Costos: matrícula USD ${i.fees.enrollment}; pensión USD ${i.fees.monthly} x ${i.fees.months} meses (${i.fees.firstMonth} a ${i.fees.lastMonth}); vencimiento el día ${i.fees.dueDay} de cada mes.`,
    `Política de mora: ${i.fees.lateFeePolicy}`,
    `Descuentos: ${i.fees.discounts}`,
    `Métodos de pago: ${i.paymentMethods.map((m) => `${m.label} (${m.detail})`).join("; ")}.`,
    `Requisitos: ${i.requirements.map((r) => `${r.label}${r.required ? "" : " (opcional)"}`).join("; ")}.`,
    `Proceso: ${i.process.map((p, n) => `${n + 1}. ${p.step}: ${p.detail}`).join(" ")}`,
    `Calendario: ${i.calendar.map((c) => `${c.label}: ${c.date}`).join("; ")}.`,
    `Secciones de la web: /admision (solicitud en línea), /estado (consultar solicitud con código y cédula del representante), /pagos (consultar y pagar cuotas, ver el récord de puntualidad), /asesor (este chat con ${i.assistant.name}).`,
    `Preguntas frecuentes:\n${i.faq.map((f) => `- ${f.q} ${f.a}`).join("\n")}`,
  ];
  return lines.join("\n");
}
