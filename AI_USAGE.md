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

## 2. IA dentro del producto

### 2.1 IA generativa: Claude (API de Anthropic)

Se usa en Clipo (asistente para familias), en la revisión de documentos de admisión y en el auditor de procesos. Cómo funciona cada parte, sus límites y qué pasa si falla está en `README.md` («IA y automatización»).

### 2.2 Modelos de predicción propios (scikit-learn)

El equipo entrenó tres modelos de clasificación en Python con scikit-learn, usando **solo el dataset ficticio del hackatón**:

| Modelo | Hiperparámetros principales |
|---|---|
| Regresión logística (con `StandardScaler`) | `C=1.0`, `class_weight="balanced"` |
| Árbol de decisión | `max_depth=4` (pagos) · `max_depth=3`, `min_samples_leaf=10` (cliente nuevo) |
| Random Forest | 200 árboles, `max_depth=5` (pagos) · `max_depth=4`, `min_samples_leaf=5` (cliente nuevo) |

Se usan los tres modelos en dos casos:

**a) Comportamiento de pago del mes (`/admin/modelos`).** Predice si cada familia pagará **puntual, tarde o no pagará** la pensión del mes. Usa su historial: obligaciones y valor del mes, meses de historial, tasas de puntualidad, tardanza e incumplimiento.
- Entrenamiento: 2 meses (408 filas, ~86 % puntuales). Evaluación: en meses posteriores no vistos, con F1 macro y matriz de confusión. Se compara contra la referencia ingenua «todos pagan puntual».

**b) Evaluar a una familia nueva (`/admin/nuevo-cliente`).** Estima si una familia sin historial es propensa a dejar al menos una pensión impaga. Solo usa datos que se conocen al matricular: número de hijos, porcentaje de beca, valor mensual, curso menor y mayor, y si hay necesidad educativa especial.
- Datos: 204 familias, 27 % con impago. Validación cruzada `StratifiedKFold(5)`.
- Resultados (AUC / F1 de la clase impago): RL 0,57 / 0,40 · Árbol 0,58 / 0,41 · RF 0,56 / 0,35.

**Cómo corren en la app:** `Modelos/exportar_modelos.py` y `Modelos/entrenar_nuevo_cliente.py` convierten los modelos `.joblib` a JSON. La inferencia se hace en TypeScript (`src/ml/inference.ts`), sin Python en producción y sin enviar datos a servicios externos.

**Límites (declarados también en la interfaz):**
- Los datos son sintéticos y hay muy poco historial. Los modelos de pago quedan **por debajo de la referencia ingenua en exactitud**, porque `class_weight="balanced"` prioriza no ignorar a los tardíos e impagos.
- El modelo de cliente nuevo tiene un AUC de ~0,57, apenas mejor que el azar. Sirve como demostración del enfoque, **no para decidir**.
- Ningún modelo admite, rechaza ni cobra a nadie de forma automática. Solo prioriza a quién recordar o contactar, y la decisión es siempre del personal de colecturía.
- **Riesgo de sesgo:** variables como la beca o tener una necesidad educativa especial **no deben usarse para negar una matrícula**. En una implementación real habría que auditar el sesgo y reentrenar con datos reales anonimizados (LOPDP).

**Si falla:** si el JSON de un modelo no carga, las páginas de modelos muestran el error y el resto del sistema (admisión, pagos, recordatorios) sigue funcionando igual.
