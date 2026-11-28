import "server-only";

/** Limitador en memoria (ventana fija) por clave. Suficiente para una sola instancia; usar Redis/Upstash en producción. */
const g = globalThis as unknown as { __eaRate?: Map<string, { count: number; reset: number }> };
const buckets = (g.__eaRate ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.reset - now) / 1000) };
}

/** true si la clave ya alcanzó el límite en la ventana vigente (no cuenta un intento nuevo). */
export function isLimited(key: string, limit: number): boolean {
  const b = buckets.get(key);
  return Boolean(b && b.reset > Date.now() && b.count >= limit);
}

/**
 * Límite de búsquedas FALLIDAS por identificador (código de seguimiento / estudiante), independiente de la IP:
 * frena la enumeración de cédulas aunque el atacante rote IPs o cabeceras.
 */
export const LOOKUP_FAIL_LIMIT = 5;
export const LOOKUP_FAIL_WINDOW_MS = 15 * 60_000;
export function lookupBlocked(scope: string, identifier: string): boolean {
  return isLimited(`fail:${scope}:${identifier}`, LOOKUP_FAIL_LIMIT);
}
export function recordLookupFailure(scope: string, identifier: string): void {
  rateLimit(`fail:${scope}:${identifier}`, LOOKUP_FAIL_LIMIT, LOOKUP_FAIL_WINDOW_MS);
}
