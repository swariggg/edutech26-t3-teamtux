import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminCookie } from "./auth";

/** Defensa en profundidad: las rutas admin vuelven a validar la sesión (firma + expiración) además del proxy. */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminCookie(store.get(ADMIN_COOKIE)?.value);
}
