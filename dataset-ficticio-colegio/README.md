# Dataset ficticio de un colegio · Hackathon EduTech 2026

**Todos los datos son sintéticos.** Fueron generados por un programa con una semilla fija: no
corresponden a ninguna persona real, aunque los nombres parezcan comunes. Úsalos libremente
(dominio público, CC0) para construir y demostrar tu proyecto.

Colegio imaginario con 240 estudiantes de 8vo EGB a 3ro BGU, dos paralelos por curso,
año lectivo 2025-2026 (régimen Sierra). Corte de los datos: enero de 2026.

## Archivos

| Archivo | Filas | Una fila es |
| --- | --- | --- |
| estudiantes.csv | 240 | un estudiante |
| asistencia.csv | 18480 | un estudiante en un día lectivo (sep–dic 2025) |
| notas.csv | 10080 | una nota parcial de una materia |
| pensiones.csv | 2400 | la pensión de un mes |
| horarios.csv | 420 | un bloque de clase de un curso y paralelo |
| docentes.csv | 14 | un docente |

## Diccionario de datos

**estudiantes.csv**: `codigo` (EST-###, clave), `nombre_ficticio`, `curso`, `paralelo` (A/B),
`anio_nacimiento`, `genero` (F/M/X), `necesidad_educativa` (ninguna, TDAH, dislexia, discalculia,
TEA, discapacidad visual), `beca_porcentaje` (0, 10, 25, 50), `representante_codigo` (REP-###;
hermanos comparten representante), `fecha_ingreso`.

**asistencia.csv**: `codigo_estudiante`, `fecha` (AAAA-MM-DD), `estado` (presente, atraso,
falta_justificada, falta_injustificada).

**notas.csv**: `codigo_estudiante`, `anio_lectivo`, `quimestre` (1–2), `parcial` (1–3),
`materia`, `nota` (0 a 10, dos decimales; 7 es la nota mínima para aprobar).

**pensiones.csv**: `codigo_estudiante`, `mes` (AAAA-MM), `valor` (USD, con la beca aplicada sobre
185 USD), `estado` (pagado, vencido, por_vencer), `fecha_pago` (vacía si no se pagó;
después del día 10 es pago tardío).

**horarios.csv**: `curso`, `paralelo`, `dia`, `hora_inicio`, `hora_fin`, `materia`,
`docente_codigo`.

**docentes.csv**: `codigo` (DOC-##), `nombre_ficticio`, `materia_principal`.

## Ideas

- Alerta temprana: estudiantes con asistencia baja y notas en descenso.
- Seguimiento de pensiones vencidas por familia (representante).
- Apoyo a estudiantes con necesidades educativas: cruza notas y asistencia.
- Optimización de horarios o carga docente.
