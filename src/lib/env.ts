import "server-only";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const EnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: optional,
  SUPABASE_URL: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  ANTHROPIC_API_KEY: optional,
  ANTHROPIC_MODEL: optional,
  N8N_WEBHOOK_SECRET: optional,
  N8N_OUTBOUND_WEBHOOK_URL: optional,
  APP_URL: optional,
  NODE_ENV: optional,
});

const parsed = EnvSchema.safeParse(process.env);
const raw = parsed.success ? parsed.data : ({} as z.infer<typeof EnvSchema>);

export const DEFAULT_MODEL = "claude-opus-5-5";

export const env = {
  appName: raw.NEXT_PUBLIC_APP_NAME ?? "Eight Academy",
  supabaseUrl: raw.SUPABASE_URL,
  supabaseServiceRoleKey: raw.SUPABASE_SERVICE_ROLE_KEY,
  anthropicApiKey: raw.ANTHROPIC_API_KEY,
  anthropicModel: raw.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
  n8nWebhookSecret: raw.N8N_WEBHOOK_SECRET,
  n8nOutboundUrl: raw.N8N_OUTBOUND_WEBHOOK_URL,
  /** URL pública de la app para enlaces en correos (si falta, se usa el origen de la petición). */
  appUrl: raw.APP_URL?.replace(/\/+$/, ""),
  isProd: raw.NODE_ENV === "production",
};

export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
export const hasLLM = Boolean(env.anthropicApiKey);
// La configuración de acceso administrativo vive en src/lib/auth.ts (getAdminConfig).
