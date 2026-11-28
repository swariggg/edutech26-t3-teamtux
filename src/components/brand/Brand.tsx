import { cn } from "@/lib/cn";

/**
 * Símbolo «N» de Nodo sobre una pastilla clara: así conserva sus colores de marca (azul profundo, celeste y
 * amarillo) y se lee igual en tema claro u oscuro. La palabra «Nodo» se escribe como texto real (cambia con el tema).
 */
export function NodoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- logo pequeño y estático */}
      <img src="/brand/nodo-mark.png" alt="" width={28} height={28} className="size-full object-contain" />
    </span>
  );
}

/**
 * Clipo, el asistente virtual de Nodo. Es una silueta (máscara) pintada con el color actual (currentColor),
 * así se adapta al tema y al alto contraste sin otra imagen.
 */
export function ClipoIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-6 shrink-0 bg-current", className)}
      style={{ WebkitMask: "url(/brand/clipo-mask.png) center / contain no-repeat", mask: "url(/brand/clipo-mask.png) center / contain no-repeat" }}
    />
  );
}
