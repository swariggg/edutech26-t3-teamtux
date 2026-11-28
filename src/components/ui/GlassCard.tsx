import { cn } from "@/lib/cn";

type Props = React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "aside"; strong?: boolean };

export function GlassCard({ as: Tag = "div", strong = true, className, ...rest }: Props) {
  return <Tag className={cn("glass rounded-xl", strong && "glass-strong", className)} {...rest} />;
}
