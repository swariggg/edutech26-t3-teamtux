"use client";
import { useRef, type KeyboardEvent } from "react";

/**
 * Patrón ARIA radiogroup: una sola parada de tabulación (el radio activo) y flechas/Inicio/Fin
 * para moverse, seleccionando al mover el foco.
 */
export function useRovingRadio<T>(values: readonly T[], selected: T, onSelect: (v: T) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, values.indexOf(selected));

  const move = (to: number) => {
    const i = (to + values.length) % values.length;
    const v = values[i];
    if (v === undefined) return;
    onSelect(v);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown": e.preventDefault(); move(activeIndex + 1); break;
      case "ArrowLeft":
      case "ArrowUp": e.preventDefault(); move(activeIndex - 1); break;
      case "Home": e.preventDefault(); move(0); break;
      case "End": e.preventDefault(); move(values.length - 1); break;
    }
  };

  const itemProps = (i: number) => ({
    ref: (el: HTMLButtonElement | null) => { refs.current[i] = el; },
    tabIndex: i === activeIndex ? 0 : -1,
  });

  return { groupProps: { onKeyDown }, itemProps };
}
