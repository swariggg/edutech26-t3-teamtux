import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/env";
import type { Attachment, ChatTurn, LLMProvider } from "./llm";

const REFUSAL_MSG = "Lo siento, no puedo ayudarte con esa solicitud. Si tu consulta es sobre admisiones, matrículas o pagos, intenta reformularla o escribe a secretaría.";
const ERROR_MSG = "Tuve un problema para responder en este momento. Intenta de nuevo en unos segundos o contacta a secretaría.";

export class AnthropicProvider implements LLMProvider {
  readonly source = "anthropic" as const;
  private client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
  private model = env.anthropicModel;

  async *streamChat({ system, messages, signal }: { system: string; messages: ChatTurn[]; signal?: AbortSignal }): AsyncIterable<string> {
    try {
      // Opus 5.5: thinking siempre activo (no enviar `thinking`), sin temperature/top_p, sin prefill.
      // Esfuerzo bajo para chat. Fallback de rechazo en servidor ("default" enruta por categoría).
      const stream = this.client.beta.messages.stream(
        {
          model: this.model,
          // Tope de costo por respuesta del chat público. Incluye el razonamiento interno del modelo
          // (siempre activo en Opus 5.5), por eso no se baja de ~2k: respuestas cortas en pasos.
          max_tokens: 2048,
          system,
          messages,
          output_config: { effort: "low" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        { signal },
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") yield `\n\n${REFUSAL_MSG}`;
      else if (final.stop_reason === "max_tokens") yield "\n\n(Respuesta recortada por longitud.)";
    } catch (error) {
      if (signal?.aborted) return;
      if (error instanceof Anthropic.RateLimitError) {
        console.error("[asesor] rate limit", error.status);
        yield "Hay mucha demanda en este momento. Intenta de nuevo en un minuto.";
      } else if (error instanceof Anthropic.APIError) {
        console.error("[asesor] API error", error.status, error.message);
        yield ERROR_MSG;
      } else {
        console.error("[asesor] error", error);
        yield ERROR_MSG;
      }
    }
  }

  async generateJSON<T>({ system, prompt, schema, attachments = [], maxTokens = 16000 }: { system: string; prompt: string; schema: z.ZodType<T>; attachments?: Attachment[]; maxTokens?: number }): Promise<T> {
    // Cada archivo va precedido por su etiqueta; el texto con la tarea va al final (mejor con documentos largos).
    const files = attachments.flatMap((a) => [
      { type: "text" as const, text: a.label },
      a.mediaType === "application/pdf"
        ? { type: "document" as const, source: { type: "base64" as const, media_type: a.mediaType, data: a.data } }
        : { type: "image" as const, source: { type: "base64" as const, media_type: a.mediaType, data: a.data } },
    ]);
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: files.length ? [...files, { type: "text" as const, text: prompt }] : prompt }],
      output_config: { effort: "medium", format: zodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal") throw new Error("El modelo rechazó la auditoría");
    if (response.parsed_output == null) throw new Error("Salida estructurada vacía o inválida");
    return response.parsed_output as T;
  }
}
