import "server-only";
import { hasSupabase } from "./env";

/**
 * Reloj de la app. En modo demo (sin Supabase) arranca en la fecha de corte del dataset ficticio
 * (enero de 2026) y avanza en tiempo real, para que «vencido» y «por vencer» coincidan con los CSV.
 * DEMO_TODAY (ISO) fuerza una fecha de inicio; con Supabase y sin DEMO_TODAY se usa la fecha real.
 */
export const DATASET_CUTOFF = "2026-01-31T15:00:00.000Z";

const g = globalThis as unknown as { __eaClock?: { base: number; boot: number } | null };

function clock() {
  if (g.__eaClock !== undefined) return g.__eaClock;
  const raw = process.env.DEMO_TODAY?.trim() || (hasSupabase ? "" : DATASET_CUTOFF);
  const base = raw ? Date.parse(raw) : Number.NaN;
  g.__eaClock = Number.isNaN(base) ? null : { base, boot: Date.now() };
  return g.__eaClock;
}

export function now(): Date {
  const c = clock();
  return c ? new Date(c.base + (Date.now() - c.boot)) : new Date();
}

export const nowISO = () => now().toISOString();
export const isSimulatedClock = () => clock() !== null;
