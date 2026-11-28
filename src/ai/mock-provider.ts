import "server-only";
import { institution } from "@/content/institution";
import { formatMoney } from "@/domain/format";
import { normalize } from "@/data/repository";
import { LLMNotAvailableError, type ChatTurn, type LLMProvider } from "./llm";

const i = institution;
const money = (n: number) => formatMoney(n);

const intents: { keys: string[]; answer: () => string }[] = [
  {
    keys: ["requisit", "document", "papeles", "necesito"],
    answer: () =>
      `Para la admisión necesitas:\n\n${i.requirements.map((r) => `- ${r.label}${r.required ? "" : " (opcional)"}`).join("\n")}\n\nPuedes iniciar tu solicitud en línea en **/admision** y adjuntar lo que tengas; secretaría te avisará si falta algo.`,
  },
  {
    keys: ["cost", "cuanto", "precio", "pension", "valor", "mensualidad", "descuento"],
    answer: () =>
      `Los valores del año ${i.academicYear} son:\n\n- **Matrícula:** ${money(i.fees.enrollment)}\n- **Pensión mensual:** ${money(i.fees.monthly)} durante ${i.fees.months} meses (${i.fees.firstMonth} a ${i.fees.lastMonth})\n\n${i.fees.discounts} La pensión vence el día ${i.fees.dueDay} de cada mes.`,
  },
  {
    keys: ["fecha", "calendario", "cuando", "inicio", "clases", "plazo"],
    answer: () => `Fechas importantes:\n\n${i.calendar.map((c) => `- **${c.label}:** ${c.date}`).join("\n")}`,
  },
  {
    keys: ["estado", "seguimiento", "codigo", "como va", "mi solicitud"],
    answer: () =>
      `Puedes consultar el estado de tu solicitud en **/estado** con tu código de seguimiento (por ejemplo ADM-2026-0001) y la cédula del representante. Ahí verás cada etapa y si falta algún documento.`,
  },
  {
    keys: ["pago", "pagar", "metodo", "transferencia", "mora", "atras", "deuda", "vencid"],
    answer: () =>
      `Métodos de pago disponibles:\n\n${i.paymentMethods.map((m) => `- **${m.label}:** ${m.detail}`).join("\n")}\n\n${i.fees.lateFeePolicy} Puedes revisar tus cuotas en **/pagos**.`,
  },
  {
    keys: ["matricul", "inscrip", "admision", "proceso", "pasos", "inscribir"],
    answer: () =>
      `El proceso tiene ${i.process.length} pasos:\n\n${i.process.map((p, n) => `${n + 1}. **${p.step}:** ${p.detail}`).join("\n")}\n\n¿Quieres empezar? Ve a **/admision**.`,
  },
  {
    keys: ["horario", "contacto", "telefono", "correo", "whatsapp", "persona", "direccion", "ubicacion"],
    answer: () =>
      `Puedes contactarnos así:\n\n- **Secretaría:** ${i.contact.secretaria.email} · ${i.contact.secretaria.phone} · WhatsApp ${i.contact.secretaria.whatsapp}\n- **Colecturía:** ${i.contact.colecturia.email} · ${i.contact.colecturia.phone}\n- **Horario:** ${i.contact.schedule}\n- **Dirección:** ${i.address}`,
  },
  {
    keys: ["hola", "buenas", "buenos", "saludos", "hey"],
    answer: () =>
      `¡Hola! Soy ${i.assistant.name}, el asistente virtual de ${i.shortName}. Puedo ayudarte con requisitos de admisión, costos, fechas, el estado de tu solicitud y tus pagos. ¿Qué necesitas?`,
  },
];

const fallback = () =>
  `Puedo orientarte sobre admisiones, matrículas y pagos de ${i.name}. Prueba preguntando por los **requisitos**, los **costos**, las **fechas** o **cómo consultar tu estado**. Si prefieres hablar con una persona, escribe a ${i.contact.secretaria.email}.`;

export function mockAnswer(text: string): string {
  const n = normalize(text);
  return (intents.find((it) => it.keys.some((k) => n.includes(k)))?.answer ?? fallback)();
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });

export class MockProvider implements LLMProvider {
  readonly source = "mock" as const;

  async *streamChat({ messages, signal }: { system: string; messages: ChatTurn[]; signal?: AbortSignal }): AsyncIterable<string> {
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const tokens = mockAnswer(last).split(/(\s+)/);
    for (const t of tokens) {
      if (signal?.aborted) return;
      yield t;
      if (t.trim()) await sleep(15 + Math.random() * 15, signal);
    }
  }

  async generateJSON<T>(): Promise<T> {
    throw new LLMNotAvailableError();
  }
}
