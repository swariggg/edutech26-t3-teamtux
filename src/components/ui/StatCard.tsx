import type { LucideIcon } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/cn";

export function StatCard({ label, value, hint, Icon, tone = "primary" }: { label: string; value: string; hint?: string; Icon: LucideIcon; tone?: "primary" | "accent" | "success" | "warning" | "danger" }) {
  const toneCls = { primary: "text-primary", accent: "text-accent", success: "text-success", warning: "text-warning", danger: "text-danger" }[tone];
  return (
    <GlassCard className="flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <Icon aria-hidden className={cn("size-5", toneCls)} />
      </div>
      <p className="font-heading text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </GlassCard>
  );
}
