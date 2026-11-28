import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, hasSupabase } from "@/lib/env";
import { getSupabase } from "./supabase/client";

/**
 * Almacenamiento privado de los documentos de admisión.
 * - Supabase: bucket privado `admission-docs`. El navegador sube DIRECTO con un enlace firmado de un solo uso
 *   (las funciones de Vercel aceptan como máximo 4,5 MB por petición) y el personal descarga con enlaces de 60 s.
 *   El bucket limita tamaño y tipo de archivo en el propio Supabase.
 * - Demo (sin Supabase): en memoria del servidor, mediante una ruta de subida firmada.
 */
export const DOCS_BUCKET = "admission-docs";

export interface DocStorage {
  createUploadUrl(path: string, mimeType: string): Promise<{ url: string; headers: Record<string, string> }>;
  stat(path: string): Promise<{ size: number; mimeType: string } | null>;
  download(path: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>;
  /** Enlace temporal de descarga; null si el almacenamiento no los ofrece (demo: se sirve por la API). */
  signedDownloadUrl(path: string, seconds: number): Promise<string | null>;
}

// ===== Firma HMAC compartida (enlaces de subida de demo y permisos de subida) =====
export function signingSecret(): string {
  const s = process.env.SESSION_SECRET?.trim() || env.supabaseServiceRoleKey;
  if (s) return s;
  if (env.isProd) throw new Error("Falta SESSION_SECRET para firmar subidas de documentos");
  return "dev-only-upload-secret";
}
export const hmac = (data: string) => createHmac("sha256", signingSecret()).update(data).digest("base64url");
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Permiso de subida: se entrega al crear la solicitud y solo sirve para adjuntar documentos a ESA solicitud
 * durante 2 horas. Así la familia sube sus archivos sin cuenta y nadie puede escribir en solicitudes ajenas.
 */
const UPLOAD_TTL_MS = 2 * 60 * 60_000;
export function createUploadToken(applicationId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ a: applicationId, exp: now + UPLOAD_TTL_MS })).toString("base64url");
  return `${payload}.${hmac(`ea-upload:v1:${payload}`)}`;
}
export function verifyUploadToken(token: string, now = Date.now()): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, hmac(`ea-upload:v1:${payload}`))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { a?: unknown; exp?: unknown };
    return typeof data.a === "string" && typeof data.exp === "number" && data.exp > now ? data.a : null;
  } catch {
    return null;
  }
}

/** Ruta del archivo: carpeta por solicitud, nombre aleatorio (no se usa el nombre que envía el navegador). */
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export function documentPath(applicationId: string, kind: string, mimeType: string): string {
  return `${applicationId}/${kind}-${crypto.randomUUID().slice(0, 8)}.${EXT[mimeType] ?? "bin"}`;
}

class SupabaseDocStorage implements DocStorage {
  private get bucket() {
    return getSupabase().storage.from(DOCS_BUCKET);
  }
  async createUploadUrl(path: string, mimeType: string) {
    const { data, error } = await this.bucket.createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Storage: ${error?.message ?? "sin enlace de subida"}`);
    return { url: data.signedUrl, headers: { "content-type": mimeType, "x-upsert": "false" } };
  }
  async stat(path: string) {
    const { data, error } = await this.bucket.info(path);
    if (error || !data) return null;
    return { size: Number(data.size ?? 0), mimeType: String(data.contentType ?? "") };
  }
  async download(path: string) {
    const { data, error } = await this.bucket.download(path);
    if (error || !data) return null;
    return { bytes: new Uint8Array(await data.arrayBuffer()), mimeType: data.type };
  }
  async signedDownloadUrl(path: string, seconds: number) {
    const { data, error } = await this.bucket.createSignedUrl(path, seconds);
    return error || !data ? null : data.signedUrl;
  }
}

type MemFile = { bytes: Uint8Array; mimeType: string };
const g = globalThis as unknown as { __eaDocs?: Map<string, MemFile> };
export const memoryFiles = (g.__eaDocs ??= new Map<string, MemFile>());

class MemoryDocStorage implements DocStorage {
  async createUploadUrl(path: string, mimeType: string) {
    const exp = Date.now() + 10 * 60_000;
    const sig = hmac(`upload:${path}:${mimeType}:${exp}`);
    const q = new URLSearchParams({ path, type: mimeType, exp: String(exp), sig });
    return { url: `/api/applications/documents/mock-upload?${q}`, headers: { "content-type": mimeType } };
  }
  async stat(path: string) {
    const f = memoryFiles.get(path);
    return f ? { size: f.bytes.byteLength, mimeType: f.mimeType } : null;
  }
  async download(path: string) {
    return memoryFiles.get(path) ?? null;
  }
  async signedDownloadUrl() {
    return null;
  }
}

let storage: DocStorage | null = null;
export function getDocStorage(): DocStorage {
  storage ??= hasSupabase ? new SupabaseDocStorage() : new MemoryDocStorage();
  return storage;
}
