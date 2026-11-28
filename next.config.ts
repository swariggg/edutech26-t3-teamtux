import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** Cabeceras de seguridad para todas las rutas. CSP completo pendiente (requiere nonce para el script inline de preferencias). */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Solo desarrollo: permite abrir `pnpm dev` desde la red local (p. ej. http://192.168.x.y:3000) con la app interactiva.
  allowedDevOrigins: ["192.168.*.*"],
  // Sin Supabase, el modo demostración carga el dataset desde los CSV en tiempo de ejecución: se incluyen en todas las rutas.
  // (Con Supabase, incluidos los modelos IA, los datos se leen de la base.)
  outputFileTracingIncludes: { "/**": ["./dataset-ficticio-colegio/*.csv"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
