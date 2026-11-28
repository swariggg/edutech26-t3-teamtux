/**
 * Se ejecuta una vez al arrancar el servidor (convención de Next.js).
 * Red de las llamadas salientes (Claude API, n8n): Node prueba cada dirección solo 250 ms antes de pasar
 * a la siguiente. En redes lentas (conexión > 250 ms) con IPv6 roto, eso termina en ETIMEDOUT /
 * "Connection error" aunque haya internet. Se prioriza IPv4 y se da más margen a cada intento.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    const net = await import("node:net");
    dns.setDefaultResultOrder("ipv4first");
    net.setDefaultAutoSelectFamilyAttemptTimeout(2500);
  }
}
