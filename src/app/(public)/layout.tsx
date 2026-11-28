import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pt-8 outline-none sm:px-6 sm:pt-12">
        {children}
      </main>
      <PublicFooter />
    </>
  );
}
