import "server-only";
import type { Repository } from "@/data/repository";
import type { AuditLog } from "@/domain/types";

/** Registra en la bitácora sin romper el flujo principal si falla. */
export async function logAudit(repo: Repository, entry: Omit<AuditLog, "id" | "at">): Promise<void> {
  try {
    await repo.addAuditLog(entry);
  } catch (error) {
    console.error("[audit] no se pudo registrar", entry.action, error);
  }
}
