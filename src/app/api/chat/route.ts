import { CHAT_MAX_TOTAL_CHARS, CHAT_MAX_TURNS, ChatRequest } from "@/domain/schemas";
import { getLLM } from "@/ai/llm";
import { ADVISOR_SYSTEM } from "@/ai/prompts";
import { getRepository } from "@/data";
import { iterableToStream } from "@/lib/stream";
import { clientIp, jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Turn = { role: "user" | "assistant"; content: string };

/**
 * El historial viene del cliente: se descartan respuestas vacías, se recortan las largas,
 * se conservan los últimos CHAT_MAX_TURNS turnos y un máximo de CHAT_MAX_TOTAL_CHARS caracteres.
 * El modelo trata todo el historial como datos (ver ADVISOR_SYSTEM); no tiene herramientas ni datos privados.
 */
function trimHistory(input: Turn[]): Turn[] {
  let turns = input
    .filter((m) => m.content.trim() !== "")
    .map((m) => (m.role === "assistant" ? { ...m, content: m.content.slice(0, 4000) } : m))
    .slice(-CHAT_MAX_TURNS);
  let total = turns.reduce((n, m) => n + m.content.length, 0);
  while (turns.length > 1 && total > CHAT_MAX_TOTAL_CHARS) {
    total -= turns[0]!.content.length;
    turns = turns.slice(1);
  }
  while (turns.length > 1 && turns[0]!.role !== "user") turns = turns.slice(1);
  return turns;
}

export async function POST(req: Request) {
  // Límite en memoria por IP (la IP depende de las cabeceras del proxy de despliegue) + tope global.
  const rl = rateLimit(`chat:${clientIp(req)}`, 20, 60_000);
  const global = rateLimit("chat:global", 200, 60_000);
  if (!rl.ok || !global.ok) return jsonError("Demasiados mensajes. Espera un momento.", 429, { retryAfter: Math.max(rl.retryAfter, global.retryAfter) });
  const parsed = await parseBody(req, ChatRequest, 160_000);
  if ("response" in parsed) return parsed.response;
  const { sessionId } = parsed.data;
  const messages = trimHistory(parsed.data.messages);

  const llm = getLLM();
  const repo = getRepository();
  const last = messages[messages.length - 1]!;
  if (sessionId) void repo.saveChatMessage({ sessionId, role: "user", content: last.content }).catch(() => {});

  const body = iterableToStream(llm.streamChat({ system: ADVISOR_SYSTEM, messages, signal: req.signal }), (full) => {
    if (sessionId && full) void repo.saveChatMessage({ sessionId, role: "assistant", content: full }).catch(() => {});
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-LLM-Source": llm.source },
  });
}
