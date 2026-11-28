import Link from "next/link";
import { institution } from "@/content/institution";

export function PublicFooter() {
  const c = institution.contact;
  return (
    <footer className="px-4 pb-8 pt-16 sm:px-6">
      <div className="glass mx-auto grid max-w-6xl gap-6 rounded-xl p-6 text-sm sm:grid-cols-3">
        <div>
          <p className="font-heading text-base font-semibold">{institution.name}</p>
          <p className="text-muted">{institution.address}</p>
          <p className="mt-2 text-xs text-muted">Institución ficticia para demostración.</p>
        </div>
        <div>
          <p className="font-semibold">Secretaría</p>
          <p className="text-muted"><a href={`mailto:${c.secretaria.email}`} className="hover:text-primary">{c.secretaria.email}</a></p>
          <p className="text-muted">{c.secretaria.phone}</p>
          <p className="text-muted">{c.schedule}</p>
        </div>
        <div>
          <p className="font-semibold">Personal administrativo</p>
          <Link href="/admin" className="text-muted hover:text-primary">Ingresar al panel</Link>
        </div>
      </div>
    </footer>
  );
}
