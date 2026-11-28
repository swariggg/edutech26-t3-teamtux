# Datos

**Todos los datos del sistema son sintéticos.** No corresponden a personas reales.

La base es `dataset-ficticio-colegio/`, el dataset ficticio del Hackathon EduTech 2026 (CC0, generado
con semilla fija). Incluye 240 estudiantes de 8.º EGB a 3.º BGU, del año lectivo 2025-2026, con corte en enero de 2026.
Para la demo del panel se pueden agregar datos inventados (ver «Datos de demostración generados»).

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
- **Solicitudes de admisión y bitácora:** con `seed.sql` o en modo simulado empiezan vacías y se llenan al usar el sistema.
- **Reloj de la demo:** arranca en la fecha de corte del dataset (31 ene 2026) para que «vencido» y «por vencer»
  coincidan con los CSV. Para cambiarlo, usa `DEMO_TODAY`.

Para regenerar `supabase/seed.sql`, ejecuta `pnpm db:seed` (`scripts/build-seed-sql.mjs`).

## Datos de demostración generados

`scripts/generar_solicitudes_demo.py` crea `supabase/seed/demo_solicitudes.sql` con semilla fija. Es opcional y todo es
inventado:

- Completa a los representantes y estudiantes del dataset con cédulas ficticias (con formato válido), fechas de nacimiento
  y, para los representantes, nombre, teléfono, parentesco, dirección y un correo `@familias.invalid`.
- Crea una solicitud aprobada del año 2025-2026 por estudiante y unas 40 postulaciones nuevas para 2026-2027.

La app no envía correos a las direcciones `.invalid`.

