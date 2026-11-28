/**
 * Acceso administrativo PROVISIONAL: clave compartida + sesión firmada (HMAC, Web Crypto).
 * Única fuente de verdad para la clave y el secreto de sesión (la usan proxy, server actions y rutas).
 * TODO: reemplazar por Supabase Auth con roles en app_metadata (secretaria, colecturia, admin).
 *
 * Producción: exige ADMIN_PASSCODE (≥16 caracteres) y SESSION_SECRET (≥32). Si faltan, el acceso
 * queda CERRADO (fail closed). La clave de demostración solo existe fuera de producción.
 * Limitación conocida: el cierre de sesión borra la cookie pero no revoca un token robado antes de su expiración (8 h).
 */
const isProd = process.env.NODE_ENV === "production";

export const DEMO_PASSCODE = "admin-demo";
export const ADMIN_COOKIE = isProd ? "__Host-ea_admin" : "ea_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8; // 8 h
const MIN_PASSCODE = 16;
const MIN_SECRET = 32;

export interface AdminConfig {
  /** Clave vigente, o null si el acceso está deshabilitado por mala configuración. */
  passcode: string | null;
  /** Secreto para firmar sesiones, o null si falta. */
  secret: string | null;
  /** true cuando se usa la clave de demostración (solo desarrollo). */
  demo: boolean;
  /** Motivo legible si el acceso está cerrado. */
  problem?: string;
  secureCookie: boolean;
}

export function getAdminConfig(): AdminConfig {
  const raw = process.env.ADMIN_PASSCODE?.trim() || "";
  const rawSecret = process.env.SESSION_SECRET?.trim() || "";
  if (isProd) {
    const passcode = raw.length >= MIN_PASSCODE ? raw : null;
    const secret = rawSecret.length >= MIN_SECRET ? rawSecret : null;
    const problem = !passcode
      ? `ADMIN_PASSCODE no está definido o tiene menos de ${MIN_PASSCODE} caracteres.`
      : !secret
        ? `SESSION_SECRET no está definido o tiene menos de ${MIN_SECRET} caracteres.`
        : undefined;
    return { passcode: problem ? null : passcode, secret: problem ? null : secret, demo: false, problem, secureCookie: true };
  }
  const passcode = raw || DEMO_PASSCODE;
  return { passcode, secret: rawSecret || `dev-only:${passcode}`, demo: !raw, secureCookie: false };
}

const enc = new TextEncoder();

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): string {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

/** Crea un token de sesión `payload.firma` con expiración y nonce. */
export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const payload = b64url(JSON.stringify({ exp: now + ADMIN_COOKIE_MAX_AGE * 1000, n: nonce }));
  return `${payload}.${await hmacHex(secret, `ea-admin:v2:${payload}`)}`;
}

export async function verifySessionToken(value: string | undefined, secret: string | null, now = Date.now()): Promise<boolean> {
  if (!value || !secret) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!timingSafeEqual(sig, await hmacHex(secret, `ea-admin:v2:${payload}`))) return false;
  try {
    const data = JSON.parse(fromB64url(payload)) as { exp?: unknown };
    return typeof data.exp === "number" && data.exp > now;
  } catch {
    return false;
  }
}

/** Valida la cookie de sesión con la configuración vigente. */
export function isValidAdminCookie(value: string | undefined): Promise<boolean> {
  return verifySessionToken(value, getAdminConfig().secret);
}
