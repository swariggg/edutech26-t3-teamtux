import type { Metadata } from "next";
import { AdminShell } from "@/components/layout/AdminShell";
import { getRepository } from "@/data";
import { getAdminConfig } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Administración", template: "%s · Administración" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const kind = getRepository().kind;
  return (
    <AdminShell demoWarning={getAdminConfig().demo} dataSource={kind === "mock" ? "simulados (en memoria)" : "Supabase"}>
      {children}
    </AdminShell>
  );
}
