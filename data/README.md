# Datos

**Todos los datos del sistema son sintéticos.** No corresponden a personas reales.

La única fuente de datos es `dataset-ficticio-colegio/`, el dataset ficticio del Hackathon EduTech 2026 (CC0, generado
con semilla fija). Incluye 240 estudiantes de 8.º EGB a 3.º BGU, del año lectivo 2025-2026, con corte en enero de 2026.
No se modificó ni se agregaron datos inventados.

| CSV | Tabla en Supabase | Modo simulado (memoria) |
|---|---|---|
| `estudiantes.csv` | `guardians` (por `representante_codigo`), `students`, `enrollments` | sí |
| `pensiones.csv` | `installments` (concepto pensión, vence el día 10) | sí |
| `docentes.csv` | `teachers` | no (todavía sin pantalla) |
| `horarios.csv` | `schedule_blocks` | no |
| `asistencia.csv` | `attendance` | no |
| `notas.csv` | `grade_records` | no |

Equivalencias:
- **Códigos:** `MAT-2025-0001` corresponde a `EST-001`. Representantes y estudiantes se identifican por código
  (`REP-###`, `EST-###`), porque el dataset no trae cédulas.
- **Estados de pensión:** `pagado` pasa a `pagada`. `vencido` y `por_vencer` se guardan como `pendiente`, y la app
  calcula si está vencida según la fecha.
- **Solicitudes de admisión y bitácora:** empiezan vacías y se llenan al usar el sistema.
- **Reloj de la demo:** arranca en la fecha de corte del dataset (31 ene 2026) para que «vencido» y «por vencer»
  coincidan con los CSV. Para cambiarlo, usa `DEMO_TODAY`.

Para regenerar `supabase/seed.sql`, ejecuta `pnpm db:seed` (`scripts/build-seed-sql.mjs`).
