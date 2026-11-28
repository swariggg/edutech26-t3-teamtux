# Eight Academy — Dirección visual (override de MASTER.md)

> Este archivo **reemplaza** las secciones de Color, Tipografía y Superficies de `MASTER.md`.
> El resto de MASTER.md (espaciado, checklist, anti-patrones) sigue vigente.
> Motivo: la paleta generada (violeta #7C3AED sobre lila) es el cliché "AI purple" y genera fatiga visual.

## Concepto

**Neofuturismo + Liquid Glass, en calma.** Capas translúcidas esmeriladas con reflejos especulares sutiles,
profundidad suave y un fondo "aurora" de baja saturación. Tecnológico pero sereno: es una app que la secretaría
usa 8 horas al día y que familias usan con estrés. Nada de neón, nada de blanco puro ni negro puro.

## Paleta (baja fatiga visual, WCAG 2.2 AA)

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#EAF0F4` niebla fría | `#0B1420` azul noche | Fondo base (nunca #FFF / #000) |
| `--bg-aurora-1` | `#B9DCE6` | `#123A4A` | Blob de aurora (blur) |
| `--bg-aurora-2` | `#CFE3D8` | `#14322B` | Blob de aurora (blur) |
| `--fg` | `#0F1E2E` tinta | `#E3EAF1` | Texto principal |
| `--fg-muted` | `#4A5B6C` | `#9AABBD` | Texto secundario (≥4.5:1 sobre superficie) |
| `--primary` | `#0E6E8C` teal profundo | `#5CC8E6` | Acciones, links, foco |
| `--on-primary` | `#FFFFFF` | `#06202B` | Texto sobre primary |
| `--accent` | `#2F9E83` menta aurora | `#6EE7C5` | Detalles, gráficos (no texto pequeño en claro) |
| `--success` | `#1F7A55` | `#5FD3A0` | Pagado, aprobado |
| `--warning` | `#9A5B00` | `#F2B75B` | Pendiente, por vencer |
| `--danger` | `#8F4A52` | `#D9A5AA` | Vencido, rechazado, errores de formulario. Tono poco saturado a propósito |
| `--ring` | `#0E6E8C` | `#7FD6EE` | Anillo de foco 2px + offset 2px |

## Superficies glass

| Token | Claro | Oscuro |
|---|---|---|
| `--glass-bg` | `rgba(255,255,255,0.55)` | `rgba(20,32,48,0.55)` |
| `--glass-bg-strong` | `rgba(255,255,255,0.78)` | `rgba(20,32,48,0.82)` |
| `--glass-border` | `rgba(255,255,255,0.65)` | `rgba(148,180,210,0.18)` |
| `--glass-highlight` | gradiente 1px superior blanco 70% → 0 | blanco 12% → 0 |
| `--glass-blur` | `18px` + `saturate(160%)` | igual |
| `--glass-shadow` | `0 8px 32px rgba(15,30,46,0.10)` | `0 8px 32px rgba(0,0,0,0.35)` |

**Fallbacks obligatorios:**
- `prefers-reduced-transparency: reduce` o toggle del usuario → superficies sólidas (`--glass-bg-strong` opaco), sin blur.
- `data-contrast="high"` → superficies sólidas, bordes 2px de `--fg`, texto 7:1.
- `@supports not (backdrop-filter: blur(1px))` → superficie sólida.
- El texto siempre va sobre `--glass-bg-strong` cuando el fondo detrás es variable.

## Tipografía

- **Títulos:** Space Grotesk (600) — carácter neofuturista.
- **Cuerpo / UI:** Inter (400/500/600).
- **Modo lectura fácil (toggle):** Atkinson Hyperlegible en todo.
- Base 16px, escala de usuario 100% / 112.5% / 125% / 150% vía `data-text-size` en `<html>`.
- Números tabulares (`font-variant-numeric: tabular-nums`) en montos y tablas.

## Movimiento

- 150–250 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`. Solo transform/opacity.
- `prefers-reduced-motion` o toggle → sin animaciones de aurora ni transiciones de desplazamiento.

## Accesibilidad e inclusión

- Panel de accesibilidad persistente: tamaño de texto, alto contraste, reducir movimiento, reducir transparencia, fuente de lectura fácil, tema claro/oscuro/sistema.
- Skip link, landmarks semánticos, foco visible siempre, objetivos táctiles ≥ 44px.
- Estados nunca solo por color: badge = color + icono + texto.
- Lenguaje claro en español, `lang="es"`.
