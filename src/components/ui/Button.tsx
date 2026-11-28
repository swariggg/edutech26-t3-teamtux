import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base = "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-[background-color,color,box-shadow,opacity] duration-200 disabled:opacity-50 select-none";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-sm hover:opacity-90",
  secondary: "glass-inset text-foreground hover:border-primary hover:text-primary",
  ghost: "text-foreground hover:bg-black/5 dark:hover:bg-white/10",
  danger: "bg-danger text-white hover:opacity-90 dark:text-black",
};
const sizes: Record<Size, string> = { sm: "min-h-11 px-3 text-sm", md: "min-h-11 px-5", lg: "min-h-13 px-6 text-lg" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...rest }: React.ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link data-button className={buttonClass(variant, size, className)} {...rest} />;
}
