import { Loader2 } from "lucide-react";
export function Spinner({ label = "Cargando" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <Loader2 aria-hidden className="size-4 animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
