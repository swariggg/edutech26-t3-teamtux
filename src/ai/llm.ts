import "server-only";
import type { z } from "zod";
import { hasLLM } from "@/lib/env";
import { MockProvider } from "./mock-provider";
import { AnthropicProvider } from "./anthropic-provider";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Archivo adjunto para el modelo (PDF o imagen en base64), precedido por una etiqueta de texto. */
export type Attachment = { label: string; mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp"; data: string };

export interface LLMProvider {
  readonly source: "anthropic" | "mock";
  streamChat(args: { system: string; messages: ChatTurn[]; signal?: AbortSignal }): AsyncIterable<string>;
  generateJSON<T>(args: { system: string; prompt: string; schema: z.ZodType<T>; attachments?: Attachment[]; maxTokens?: number }): Promise<T>;
}

export class LLMNotAvailableError extends Error {
  constructor() {
    super("LLM no disponible");
    this.name = "LLMNotAvailableError";
  }
}

let provider: LLMProvider | null = null;
export function getLLM(): LLMProvider {
  if (!provider) provider = hasLLM ? new AnthropicProvider() : new MockProvider();
  return provider;
}
