import { AlertTriangle, CheckCircle2, Circle, Info, XCircle } from "lucide-react";
import type { Tone } from "@/domain/labels";
import { cn } from "@/lib/cn";

const tones: Record<Tone, { cls: string; Icon: typeof Info }> = {
  neutral: { cls: "text-muted bg-[color-mix(in_srgb,var(--fg-muted)_12%,transparent)]", Icon: Circle },
  info: { cls: "text-info bg-[color-mix(in_srgb,var(--info)_12%,transparent)]", Icon: Info },
  success: { cls: "text-success bg-[color-mix(in_srgb,var(--success)_14%,transparent)]", Icon: CheckCircle2 },
  warning: { cls: "text-warning bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]", Icon: AlertTriangle },
  danger: { cls: "text-danger bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]", Icon: XCircle },
};

/** Estado = icono + texto + color (nunca solo color). */
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const { cls, Icon } = tones[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-medium", cls, className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}
