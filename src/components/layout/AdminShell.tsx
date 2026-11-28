"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, ClipboardList, UserSearch, GraduationCap, LayoutDashboard, LogOut, ShieldCheck, Wallet } from "lucide-react";
import { A11yPanel } from "@/components/a11y/A11yPanel";
import { ThemeToggle } from "@/components/a11y/ThemeToggle";
import { logout } from "@/app/actions/admin-auth";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "Panel", Icon: LayoutDashboard },
  { href: "/admin/solicitudes", label: "Solicitudes", Icon: ClipboardList },
  { href: "/admin/matriculas", label: "Matrículas", Icon: GraduationCap },
  { href: "/admin/pagos", label: "Pagos", Icon: Wallet },
  { href: "/admin/modelos", label: "Modelos IA", Icon: BrainCircuit },
  { href: "/admin/nuevo-cliente", label: "Evaluar cliente nuevo", Icon: UserSearch },
  { href: "/admin/auditoria", label: "Auditoría", Icon: ShieldCheck },
] as const;

export function AdminShell({ children, demoWarning, dataSource }: { children: React.ReactNode; demoWarning: boolean; dataSource: string }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <div className="mx-auto flex min-h-dvh max-w-[90rem] flex-col gap-4 p-3 sm:p-4 lg:flex-row">
      <aside className="glass glass-strong flex shrink-0 flex-col gap-4 rounded-xl p-3 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:w-64">
        <Link href="/admin" className="flex min-h-11 items-center gap-2 px-2 font-heading text-lg font-semibold">
          <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-on-primary">8</span>
          Administración
        </Link>
        <nav aria-label="Administración">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link href={href} aria-current={active(href) ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 whitespace-nowrap rounded-md px-3 font-medium transition-colors", active(href) ? "bg-primary text-on-primary" : "text-muted hover:text-foreground")}>
                  <Icon aria-hidden className="size-5" /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto hidden flex-col gap-3 lg:flex">
          <p className="px-2 text-xs text-muted">Datos: {dataSource}</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="glass glass-strong flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2">
          <Link href="/" className="text-sm font-medium text-muted hover:text-primary">← Sitio público</Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <A11yPanel />
            <form action={logout}>
              <button type="submit" className="glass-inset inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium hover:text-danger">
                <LogOut aria-hidden className="size-4" /> Salir
              </button>
            </form>
          </div>
        </header>
        {demoWarning && (
          <p role="note" className="rounded-lg border border-warning/50 bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-4 py-2 text-sm">
            <strong>Modo demostración:</strong> se usa la clave por defecto. Define <code>ADMIN_PASSCODE</code> antes de publicar.
          </p>
        )}
        <main id="contenido" tabIndex={-1} className="flex flex-col gap-6 outline-none">{children}</main>
      </div>
    </div>
  );
}
