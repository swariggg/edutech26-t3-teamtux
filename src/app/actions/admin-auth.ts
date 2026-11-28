"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, createSessionToken, getAdminConfig, timingSafeEqual } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string };

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/admin") && !s.startsWith("//") ? s : "/admin";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const cfg = getAdminConfig();
  if (!cfg.passcode || !cfg.secret) {
    return { error: "El acceso administrativo no está configurado en este servidor." };
  }
  // Límite por IP y global (en memoria; ver lib/rate-limit.ts). La IP depende de cabeceras del proxy de despliegue.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const perIp = rateLimit(`login:ip:${ip}`, 5, 60_000);
  const global = rateLimit("login:global", 30, 60_000);
  if (!perIp.ok || !global.ok) {
    return { error: `Demasiados intentos. Espera ${Math.max(perIp.retryAfter, global.retryAfter)} s e inténtalo de nuevo.` };
  }
  const pass = String(formData.get("passcode") ?? "");
  if (!timingSafeEqual(pass, cfg.passcode)) {
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Clave incorrecta" };
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, await createSessionToken(cfg.secret), {
    httpOnly: true, sameSite: "lax", secure: cfg.secureCookie, path: "/", maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
