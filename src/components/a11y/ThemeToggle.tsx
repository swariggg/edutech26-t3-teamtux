"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { setPrefs, usePrefs, type ThemePref } from "@/components/providers/preferences";
import { cn } from "@/lib/cn";
import { useRovingRadio } from "./useRovingRadio";

const options: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

export function ThemeToggle({ showLabels = false }: { showLabels?: boolean }) {
  const { theme } = usePrefs();
  const { groupProps, itemProps } = useRovingRadio(options.map((o) => o.value), theme, (v) => setPrefs({ theme: v }));
  return (
    <div role="radiogroup" aria-label="Tema de color" className="glass-inset inline-flex rounded-full p-1" {...groupProps}>
      {options.map(({ value, label, Icon }, i) => {
        const active = theme === value;
        return (
          <button
            key={value}
            {...itemProps(i)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={showLabels ? undefined : label}
            title={label}
            onClick={() => setPrefs({ theme: value })}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
              active ? "bg-primary text-on-primary" : "text-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {showLabels && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
