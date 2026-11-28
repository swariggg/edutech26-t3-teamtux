import { institution } from "@/content/institution";

const money = new Intl.NumberFormat(institution.locale, { style: "currency", currency: institution.currency, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat(institution.locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat(institution.locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const monthFmt = new Intl.DateTimeFormat(institution.locale, { month: "short", year: "2-digit", timeZone: "UTC" });

export const formatMoney = (n: number) => money.format(n);
export const formatDate = (iso?: string) => (iso ? dateFmt.format(new Date(iso)) : "—");
export const formatDateTime = (iso?: string) => (iso ? dateTimeFmt.format(new Date(iso)) : "—");
export const formatMonth = (period: string) => monthFmt.format(new Date(`${period}-01T00:00:00Z`));
export const formatPercent = (n: number) => `${Math.round(n * 100)}%`;

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function relativeDays(iso: string, now = new Date()): string {
  const d = daysBetween(iso, now);
  if (d === 0) return "hoy";
  if (d === 1) return "ayer";
  if (d > 1) return `hace ${d} días`;
  if (d === -1) return "mañana";
  return `en ${-d} días`;
}
