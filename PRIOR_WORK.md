# Trabajo previo y componentes

Aquí se declaran las librerías, servicios, datos, modelos y otros recursos que usa el proyecto.

## Librerías de la aplicación

| Paquete | Versión | Uso |
|---|---|---|
| `@anthropic-ai/sdk` | 1.14.0 | Cliente de la API de Claude (Clipo, revisión de documentos y auditor) |
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
| API de Anthropic (Claude) | Asistente Clipo (texto y voz), revisión de documentos y auditor de procesos | Integrada; se activa con `ANTHROPIC_API_KEY` |
| Supabase | Base de datos y almacenamiento privado de documentos | Código, migraciones y datos de carga incluidos; se activa con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` |
| n8n | Avisos a las familias | Flujo exportado en `n8n/workflows/codigo-seguimiento.json` |
| Gmail | Envío de los correos desde n8n | Nodo activo; la cuenta se conecta en n8n |
| SMTP | Alternativa para enviar correos | Nodo incluido, desactivado |
| WhatsApp Cloud API (Meta) | Avisos por WhatsApp | Nodo incluido, desactivado |
| Web Speech API del navegador | Reconocimiento y voces de Clipo en el modo voz | Son las del navegador; no usamos un servicio de voz propio |

## Automatización con n8n

El equipo armó este flujo en n8n:

1. **Evento de la app** (Webhook): recibe el aviso.
2. **¿Es un aviso para la familia?** (IF): deja pasar el código de seguimiento, la matrícula creada y el recordatorio de pago.
3. **Armar mensaje** (Code): prepara el texto.
4. **Enviar correo (Gmail).** El nodo SMTP queda como alternativa, desactivado.
5. **¿Tiene teléfono?** y **Enviar WhatsApp (Cloud API)**, este último desactivado ya que es una propuesta futura
## Modelos de machine learning

 **Para el entrenamiento solo se usaron los datos sintéticos** del dataset ficticio; ningún dato de otra fuente.

| Librería (Python) | Uso |
|---|---|
| scikit-learn (1.6.1 en los modelos de cobranza) | Regresión logística, árbol de decisión y random forest |
| pandas y NumPy | Preparación de datos |
| joblib | Guardar y cargar los modelos |

Las versiones de pandas, NumPy y joblib no están fijadas en el repositorio.

- Modelos de cobranza: `Modelos/*.joblib` (también en `Modelos/modelos_clasificacion.zip`). Está el script de exportación `Modelos/exportar_modelos.py`, pero no el de entrenamiento.
- Modelos de familias nuevas: `Modelos/nuevo_cliente/`, entrenados con `Modelos/entrenar_nuevo_cliente.py`.
- La app usa los modelos exportados a JSON y los calcula en TypeScript (`src/ml/`).

## Datos

- `dataset-ficticio-colegio/`: dataset ficticio del Hackathon EduTech 2026 (CC0).
- `scripts/generar_solicitudes_demo.py` y `supabase/seed/demo_solicitudes.sql`: datos de demostración inventados por el equipo para el panel (no se usan para entrenar los modelos).

## Diseño e imágenes

- `design-system/eight-academy/`: guía visual y colores de partida (usa el nombre anterior del proyecto). `MASTER.md` indica en su encabezado que fue generado automáticamente el 2026-11-27.
- `public/brand/` y los iconos de `src/app/`: imágenes de la marca ficticia Nodo y de su asistente Clipo.

## Fuentes e iconos

- Google Fonts, cargadas con `next/font/google`: Inter, Space Grotesk y Atkinson Hyperlegible.
- Iconos de `lucide-react`.
