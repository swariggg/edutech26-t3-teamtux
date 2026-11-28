# Uso de inteligencia artificial

## 1. IA usada para construir el proyecto

### Claude (Anthropic), modelo Claude Sonnet 5.5, desde la aplicación de Claude

Uso en la sesión del 2026-11-27 al 2026-11-28:

| Tarea | Resultado |
|---|---|
| Análisis de las reglas, la rúbrica y el estado del repositorio | Recomendaciones al equipo |
| Propuesta de dónde usar n8n (requisitos, pensiones, cobranza y errores), manejo de fallos, chatbot con voz y diagrama del flujo | Propuesta; Claude no la implementó en esta sesión |
| Borrador del problema y la solución, preguntas de entrevista, fórmula de ahorro y orden de trabajo | Material para revisión del equipo |
| Revisión del estado de Git, lectura de partes del código y búsqueda de secretos por patrones | Informe al equipo |
| Ayuda con Git, la unión de ramas (modelos y n8n), los comandos para correr la app y dudas sobre el chatbot y la clave de API | Explicaciones y recomendaciones |
| Corrección de las rutas del dataset al unir las ramas | Código: `src/ml/features.ts`, `next.config.ts`, `Modelos/entrenar_nuevo_cliente.py` y la página `/admin/modelos` |
| Mejoras del formulario de admisión: decir qué campo falta, marcar en rojo solo ese campo y diferenciar la casilla de consentimiento | Código en los componentes del formulario y de la interfaz (`src/components/`) |
| Accesibilidad: rojo de error menos saturado, etiquetas y avisos ARIA e icono de una persona en el panel de accesibilidad | Código en `src/` y la guía de diseño. No se probó con un lector de pantalla |
| Redacción y actualización de documentos (`README.md`, `PRIOR_WORK.md`, `AI_USAGE.md`, `data/README.md`, `n8n/README.md`, `docs/ARCHITECTURE.md`) y líneas de `.gitignore` y `.env.example` | Borradores y cambios para revisión del equipo |
| Auditorías del proyecto y estimaciones con la rúbrica | Informes al equipo |
| Verificación de la fuente del dato estadístico, casos ficticios de ahorro de tiempo y viabilidad de la beca, y estimación del costo mensual | Texto y cálculos en `README.md` |
| Diseño de las correcciones pendientes e instrucciones para un agente de código | `docs/PENDIENTES.md` (sin cambios de código) |

En esta sesión Claude escribió los cambios de código indicados, pero no hizo commits ni push; esos pasos los hizo el equipo. Claude no pudo ejecutar `typecheck`, `lint` ni `build` desde su entorno.

### Claude Code (Anthropic)

Todos los integrantes del grupo usan Claude Code como asistente de IA para construir el proyecto.

El historial de Git muestra además commits firmados como coescritos con Claude; por ejemplo, el modo de voz (`fe9b7fa`, Claude Opus 5.5).

## 2. IA dentro del producto

Claude (API de Anthropic) se usa en Clipo, en la revisión de documentos y en el auditor de procesos. Los modelos de predicción son modelos propios hechos con scikit-learn. Cómo funciona cada parte, sus límites y qué pasa si falla está en `README.md` («IA y automatización»).

