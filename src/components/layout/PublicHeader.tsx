"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { A11yPanel } from "@/components/a11y/A11yPanel";
import { ThemeToggle } from "@/components/a11y/ThemeToggle";
import { institution } from "@/content/institution";
import { cn } from "@/lib/cn";

export const PUBLIC_NAV = [
  { href: "/", label: "Inicio" },
  { href: "/admision", label: "Admisión" },
  { href: "/estado", label: "Estado" },
  { href: "/pagos", label: "Pagos" },
  { href: "/asesor", label: "Asesor IA" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function MobileMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Cierra el menú al navegar (ajuste de estado durante el render, sin efecto).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="menu-movil"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setOpen((v) => !v)}
        className="glass-inset inline-flex size-11 items-center justify-center rounded-full"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
      </button>
      <nav id="menu-movil" aria-label="Principal (móvil)" hidden={!open} className="glass glass-strong absolute right-0 mt-2 w-56 rounded-lg p-2">
        <ul>
          {PUBLIC_NAV.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setOpen(false)} aria-current={isActive(pathname, l.href) ? "page" : undefined} className={cn("flex min-h-11 items-center rounded-md px-3 font-medium", isActive(pathname, l.href) ? "text-primary" : "")}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function PublicHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
      <div className="glass glass-strong mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-xl px-3 py-2 sm:px-4">
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-md px-1 font-heading text-lg font-semibold">
          <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-on-primary">8</span>
          <span>{institution.shortName}</span>
        </Link>
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {PUBLIC_NAV.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(pathname, l.href) ? "page" : undefined}
                  className={cn("inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors", isActive(pathname, l.href) ? "bg-primary/12 text-primary" : "text-muted hover:text-foreground")}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden lg:block"><ThemeToggle /></div>
          <A11yPanel />
          <MobileMenu pathname={pathname} />
        </div>
      </div>
    </header>
  );
}
