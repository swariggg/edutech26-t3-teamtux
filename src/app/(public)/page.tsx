import { ArrowRight, Bot, ClipboardCheck, CreditCard, FileText, GraduationCap, Search, Sparkles, Wallet } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { institution } from "@/content/institution";
import { formatMoney } from "@/domain/format";

const stepIcons = [FileText, ClipboardCheck, GraduationCap, Wallet];

export default function HomePage() {
  const i = institution;
  return (
    <div className="flex flex-col gap-16 sm:gap-24">
      <section aria-labelledby="hero-title" className="grid items-center gap-10 pt-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-6">
          <p className="glass-inset inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-medium text-primary">
            <Sparkles aria-hidden className="size-4" /> Admisiones {i.academicYear} abiertas
          </p>
          <h1 id="hero-title" className="text-4xl font-semibold sm:text-5xl lg:text-6xl">
            Tu matrícula, <span className="text-primary">sin filas</span> ni incertidumbre.
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Solicita la admisión en línea, sigue cada etapa con tu código y consulta tus pensiones. Si tienes dudas, nuestro asesor virtual te guía paso a paso.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/admision" size="lg">Solicitar admisión <ArrowRight aria-hidden className="size-5" /></ButtonLink>
            <ButtonLink href="/asesor" size="lg" variant="secondary"><Bot aria-hidden className="size-5" /> Hablar con el asesor IA</ButtonLink>
          </div>
        </div>
        <GlassCard className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-accent/15 text-accent"><Bot aria-hidden className="size-6" /></span>
            <div>
              <p className="font-semibold">Asesor virtual</p>
              <p className="text-sm text-muted">Disponible 24/7</p>
            </div>
          </div>
          <div className="glass-inset rounded-lg p-4 text-sm">¿Qué documentos necesito para inscribir a mi hija en 4.º EGB?</div>
          <div className="rounded-lg bg-primary/10 p-4 text-sm">
            Necesitas la cédula del estudiante y del representante, la partida de nacimiento, el certificado de notas y una foto tamaño carné. Puedes empezar en <strong>/admision</strong>.
          </div>
          <ButtonLink href="/asesor" variant="ghost" className="self-start text-primary">Probar el asesor <ArrowRight aria-hidden className="size-4" /></ButtonLink>
        </GlassCard>
      </section>

      <section aria-labelledby="proceso-title" className="flex flex-col gap-6">
        <h2 id="proceso-title" className="text-3xl font-semibold">Así funciona</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {i.process.map((p, n) => {
            const Icon = stepIcons[n] ?? FileText;
            return (
              <li key={p.step}>
                <GlassCard className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <Icon aria-hidden className="size-6 text-primary" />
                    <span className="font-heading text-sm font-semibold text-muted">Paso {n + 1}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{p.step}</h3>
                  <p className="text-sm text-muted">{p.detail}</p>
                </GlassCard>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="acciones-title" className="flex flex-col gap-6">
        <h2 id="acciones-title" className="text-3xl font-semibold">¿Qué necesitas hacer?</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { href: "/admision", title: "Solicitar admisión", text: "Formulario guiado en 4 pasos. Al terminar recibes un código de seguimiento.", Icon: FileText },
            { href: "/estado", title: "Consultar mi solicitud", text: "Revisa la etapa, los documentos pendientes y los próximos pasos.", Icon: Search },
            { href: "/pagos", title: "Ver mis pagos", text: `Matrícula ${formatMoney(i.fees.enrollment)} y ${i.fees.months} pensiones de ${formatMoney(i.fees.monthly)}.`, Icon: CreditCard },
          ].map(({ href, title, text, Icon }) => (
            <GlassCard key={href} as="article" className="flex flex-col gap-3 p-6">
              <Icon aria-hidden className="size-6 text-accent" />
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="flex-1 text-muted">{text}</p>
              <ButtonLink href={href} variant="secondary" className="self-start">Ir <span className="sr-only">a {title.toLowerCase()}</span><ArrowRight aria-hidden className="size-4" /></ButtonLink>
            </GlassCard>
          ))}
        </div>
      </section>

      <section aria-labelledby="faq-title" className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <h2 id="faq-title" className="text-3xl font-semibold">Preguntas frecuentes</h2>
          <p className="text-muted">¿No encuentras tu respuesta? Pregúntale al asesor virtual o escribe a {i.contact.secretaria.email}.</p>
          <GlassCard className="p-5">
            <h3 className="mb-3 font-semibold">Fechas clave</h3>
            <dl className="grid gap-2 text-sm">
              {i.calendar.map((c) => (
                <div key={c.label} className="flex justify-between gap-4">
                  <dt className="text-muted">{c.label}</dt>
                  <dd className="font-medium">{c.date}</dd>
                </div>
              ))}
            </dl>
          </GlassCard>
        </div>
        <div className="flex flex-col gap-3">
          {i.faq.map((f) => (
            <details key={f.q} className="glass glass-strong group rounded-lg">
              <summary className="flex min-h-14 items-center justify-between gap-4 px-5 py-3 font-medium">
                {f.q}
                <span aria-hidden className="text-xl text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="px-5 pb-4 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
