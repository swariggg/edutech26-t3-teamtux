import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const map = {
  info: { Icon: Info, cls: "border-info/40 text-foreground", ic: "text-info" },
  success: { Icon: CheckCircle2, cls: "border-success/40 text-foreground", ic: "text-success" },
  warning: { Icon: AlertTriangle, cls: "border-warning/50 text-foreground", ic: "text-warning" },
  danger: { Icon: XCircle, cls: "border-danger/50 text-foreground", ic: "text-danger" },
} as const;

export function Alert({ tone = "info", title, children, className, role }: { tone?: keyof typeof map; title?: string; children?: React.ReactNode; className?: string; role?: "alert" | "status" }) {
  const { Icon, cls, ic } = map[tone];
  return (
    <div role={role} className={cn("glass glass-strong flex gap-3 rounded-lg border-l-4 p-4", cls, className)}>
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", ic)} />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm text-muted [&_a]:font-medium [&_a]:text-primary [&_a]:underline">{children}</div>}
      </div>
    </div>
  );
}
