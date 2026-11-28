import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { PREFS_INIT_SCRIPT } from "@/components/providers/preferences";
import { SkipLink } from "@/components/a11y/SkipLink";
import { Aurora } from "@/components/ui/Aurora";
import { institution } from "@/content/institution";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${institution.name} · Admisiones, matrículas y pagos`, template: `%s · ${institution.name}` },
  description: "Solicita la admisión, consulta tu estado y tus pagos, y conversa con el asesor virtual.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf0f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1420" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${grotesk.variable} ${atkinson.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_INIT_SCRIPT }} />
      </head>
      <body>
        <SkipLink />
        <Aurora />
        {children}
      </body>
    </html>
  );
}
