import "server-only";
import { hasSupabase } from "@/lib/env";
import type { Repository } from "./repository";
import { MockRepository } from "./mock/mock-repository";
import { SupabaseRepository } from "./supabase/supabase-repository";

const g = globalThis as unknown as { __eaRepo?: Repository };

/** Supabase si hay credenciales de servidor; si no, datos simulados en memoria. */
export function getRepository(): Repository {
  if (!g.__eaRepo) g.__eaRepo = hasSupabase ? new SupabaseRepository() : new MockRepository();
  return g.__eaRepo;
}
