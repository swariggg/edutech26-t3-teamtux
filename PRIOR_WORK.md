# Trabajo previo y componen

## Librerías de la aplicación

| Paquete | Versión | Uso |
|---|---|---|
| `@anthropic-ai/sdk` | 1.14.0 | Cliente de la API de Claude (asesor y auditor) |
| `@supabase/supabase-js` | 2.119.2 | Cliente de Supabase |
| `clsx` | 2.1.1 | Composición de clases CSS |
| `lucide-react` | 1.82.0 | Iconos |
| `next` | 16.4.6 | Framework web (interfaz y API) |
| `react` | 19.3.1 | Interfaz de usuario |
| `react-dom` | 19.3.1 | Renderizado de React en la web |
| `recharts` | 3.11.2 | Gráficos del panel |
| `server-only` | 0.0.1 | Evita usar módulos de servidor en el navegador |
| `tailwind-merge` | 3.7.1 | Combinación de clases de Tailwind |
| `zod` | 4.6.7 | Validación de datos y de la salida de la IA |

## Herramientas de desarrollo

| Paquete | Versión | Uso |
|---|---|---|
| `@tailwindcss/postcss` | 4.3.5 | Integración de Tailwind con PostCSS |
| `@types/node` | 26.6.11 | Tipos de Node.js |
| `@types/react` | 19.3.3 | Tipos de React |
| `@types/react-dom` | 19.3.0 | Tipos de React DOM |
| `eslint` | 9.39.5 | Análisis de código |
| `eslint-config-next` | 16.4.6 | Reglas de ESLint para Next.js |
| `tailwindcss` | 4.3.5 | Estilos |
| `typescript` | 5.9.3 | Lenguaje y comprobación de tipos |

Gestor de paquetes: `pnpm@10.33.0` · Node.js `>=22`. Las dependencias indirectas constan en `pnpm-lock.yaml`.

## Servicios y plataformas

| Servicio | Uso | Estado en el repositorio |
|---|---|---|
| API de Anthropic (Claude) | Asesor virtual y auditor de procesos | Código integrado; se activa con `ANTHROPIC_API_KEY` |
| Supabase | Base de datos | Código, migración y semilla incluidos; se activa con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` |
| n8n | Automatización de procesos | Webhooks y contratos incluidos; todavía no hay workflows exportados |

## Fuentes e iconos

- Google Fonts, cargadas con `next/font/google`: Inter, Space Grotesk y Atkinson Hyperlegible.
- Iconos de `lucide-react`.
node -v
