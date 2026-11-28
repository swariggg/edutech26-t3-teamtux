# Arquitectura

## Capas

- **UI (Next.js App Router, React 19, Tailwind v4):** páginas públicas en `src/app/(public)`, panel en `src/app/admin/(panel)`. Componentes glass en `src/components/ui`. Las preferencias de accesibilidad (tema, tamaño de texto, contraste, movimiento, transparencia, fuente de lectura fácil) se guardan en `localStorage` y se aplican como atributos `data-*` en `<html>` antes del primer pintado.
- **API (Route Handlers):** validan con zod (`src/domain/schemas.ts`), aplican límite de peticiones en memoria y registran en la bitácora (`audit_logs`).
- **Datos:** interfaz `Repository` (`src/data/repository.ts`) con dos implementaciones: `MockRepository` (semilla determinista, en memoria) y `SupabaseRepository` (service role, solo servidor). Se elige automáticamente según las variables de entorno.
- **IA:** interfaz `LLMProvider` (`src/ai/llm.ts`). `AnthropicProvider` usa `@anthropic-ai/sdk` con streaming para el chat (esfuerzo bajo, fallback de rechazo del lado del servidor) y salida estructurada (zod) para el auditor. `MockProvider` responde con datos de `content/institution.ts`.
- **Auditor de procesos:** reglas deterministas (`src/ai/auditor-rules.ts`) siempre; si hay IA, el modelo confirma, prioriza y añade hallazgos. Si la IA falla, se devuelven las reglas.
- **Acceso administrativo (provisional):** clave compartida + cookie HMAC verificada en `src/proxy.ts` y de nuevo en cada ruta `/api/admin/*`. Se reemplazará por Supabase Auth con roles.

## Próximos pasos

1. Contexto real de la institución en `src/content/institution.ts`.
2. Asesor: herramientas (consultar estado/pagos con verificación), voz, memoria de sesión.
3. Supabase Auth para el personal y portal de familias.
4. Flujos n8n de avisos y recordatorios.
