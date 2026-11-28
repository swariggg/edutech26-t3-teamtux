"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Send } from "lucide-react";
import type { z } from "zod";
import { GradeStep, GuardianStep, StudentStep } from "@/domain/schemas";
import { institution } from "@/content/institution";
import { relationshipLabel } from "@/domain/labels";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alert } from "@/components/ui/Alert";

const STEPS = ["Estudiante", "Representante", "Grado y documentos", "Revisión"];
type Values = Record<string, string | string[] | boolean>;
type Errors = Record<string, string>;

/** Nombre visible de cada campo, para indicar en el resumen cuál tiene el error. */
const FIELD_LABELS: Record<string, string> = {
  studentName: "Nombre completo del estudiante", studentDocument: "Cédula del estudiante", birthDate: "Fecha de nacimiento",
  gender: "Género", previousSchool: "Institución anterior", specialNeeds: "Necesidades educativas o de salud",
  guardianName: "Nombre completo del representante", guardianDocument: "Cédula del representante", email: "Correo electrónico",
  phone: "Teléfono", relationship: "Parentesco", address: "Dirección",
  gradeApplied: "Grado al que postula", consent: "Términos y condiciones",
};

const initial: Values = {
  studentName: "", studentDocument: "", birthDate: "", gender: "", previousSchool: "", specialNeeds: "",
  guardianName: "", guardianDocument: "", email: "", phone: "", relationship: "madre", address: "",
  gradeApplied: "", documents: [], consent: false,
};

function clean(v: Values): Values {
  const out: Values = {};
  for (const [k, val] of Object.entries(v)) if (!(typeof val === "string" && val.trim() === "")) out[k] = typeof val === "string" ? val.trim() : val;
  return out;
}

function validate(schema: z.ZodType, v: Values): Errors {
  const cleaned = clean(v);
  const r = schema.safeParse(cleaned);
  if (r.success) return {};
  const errs: Errors = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (!key || errs[key]) continue;
    // Campo obligatorio vacío: clean() lo quitó, así que zod reporta "undefined" con un mensaje genérico.
    if (cleaned[key] === undefined) errs[key] = "Campo obligatorio";
    else errs[key] = issue.message.startsWith("Invalid") ? "Revisa este campo" : issue.message;
  }
  return errs;
}

const schemas = [StudentStep, GuardianStep, GradeStep];

export function AdmissionWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const set = (k: string, v: string | string[] | boolean) => {
    setValues((p) => ({ ...p, [k]: v }));
    // Al corregir un campo se limpia su error (se vuelve a validar al avanzar).
    setErrors((e) => {
      if (!(k in e)) return e;
      const rest = { ...e };
      delete rest[k];
      return rest;
    });
  };
  const str = (k: string) => (values[k] as string) ?? "";

  function focusFirstError(errs: Errors) {
    const first = Object.keys(errs)[0];
    if (first) requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  }

  function go(to: number) {
    setStep(to);
    setErrors({});
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function next() {
    const schema = schemas[step];
    if (schema) {
      const errs = validate(schema, values);
      setErrors(errs);
      if (Object.keys(errs).length) return focusFirstError(errs);
    }
    go(step + 1);
  }

  async function submit() {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(clean(values)) });
      const data = (await res.json()) as { trackingCode?: string; error?: string };
      if (!res.ok || !data.trackingCode) throw new Error(data.error ?? "No pudimos enviar la solicitud");
      router.push(`/admision/confirmacion?codigo=${encodeURIComponent(data.trackingCode)}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "No pudimos enviar la solicitud");
      setSubmitting(false);
    }
  }

  const input = (name: string, label: string, opts: { type?: string; required?: boolean; hint?: string; autoComplete?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] } = {}) => (
    <Field id={name} label={label} required={opts.required} hint={opts.hint} error={errors[name]}>
      <Input
        id={name} name={name} type={opts.type ?? "text"} value={str(name)} onChange={(e) => set(name, e.target.value)}
        aria-invalid={Boolean(errors[name])} aria-describedby={describedBy(name, opts.hint, errors[name])}
        autoComplete={opts.autoComplete} inputMode={opts.inputMode} required={opts.required}
      />
    </Field>
  );

  const errorCount = Object.keys(errors).length;
  const docs = values.documents as string[];

  return (
    <GlassCard className="flex flex-col gap-6 p-5 sm:p-8">
      <Stepper steps={STEPS} current={step} />
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
        Paso {step + 1} de {STEPS.length}: {STEPS[step]}
      </h2>

      {errorCount > 0 && (
        <Alert tone="danger" role="alert" title={`Revisa ${errorCount === 1 ? "1 campo" : `${errorCount} campos`} antes de continuar`}>
          <ul className="list-disc pl-5">
            {Object.entries(errors).map(([k, m]) => (<li key={k}><a href={`#${k}`}>{FIELD_LABELS[k] ?? k}: {m}</a></li>))}
          </ul>
        </Alert>
      )}

      <form ref={formRef} noValidate onSubmit={(e) => { e.preventDefault(); if (step < 3) next(); else void submit(); }} className="flex flex-col gap-5">
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {input("studentName", "Nombre completo del estudiante", { required: true, autoComplete: "off" })}
            {input("studentDocument", "Cédula del estudiante", { required: true, hint: "10 dígitos, sin guiones", inputMode: "numeric" })}
            {input("birthDate", "Fecha de nacimiento", { type: "date", required: true })}
            <Field id="gender" label="Género" error={errors.gender}>
              <Select id="gender" name="gender" value={str("gender")} onChange={(e) => set("gender", e.target.value)}>
                <option value="">Prefiero no indicar</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
                <option value="X">Otro</option>
              </Select>
            </Field>
            {input("previousSchool", "Institución anterior")}
            <Field id="specialNeeds" label="Necesidades educativas o de salud" hint="Nos ayuda a preparar los apoyos necesarios." error={errors.specialNeeds} className="sm:col-span-2">
              <Textarea id="specialNeeds" name="specialNeeds" value={str("specialNeeds")} onChange={(e) => set("specialNeeds", e.target.value)} aria-invalid={Boolean(errors.specialNeeds)} aria-describedby={describedBy("specialNeeds", "hint", errors.specialNeeds)} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {input("guardianName", "Nombre completo del representante", { required: true, autoComplete: "name" })}
            {input("guardianDocument", "Cédula del representante", { required: true, hint: "La usarás para consultar el estado", inputMode: "numeric" })}
            {input("email", "Correo electrónico", { type: "email", required: true, autoComplete: "email" })}
            {input("phone", "Teléfono", { type: "tel", required: true, autoComplete: "tel" })}
            <Field id="relationship" label="Parentesco" required error={errors.relationship}>
              <Select id="relationship" name="relationship" required value={str("relationship")} onChange={(e) => set("relationship", e.target.value)} aria-invalid={Boolean(errors.relationship)} aria-describedby={describedBy("relationship", undefined, errors.relationship)}>
                {Object.entries(relationshipLabel).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
              </Select>
            </Field>
            {input("address", "Dirección", { autoComplete: "street-address" })}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <Field id="gradeApplied" label="Grado al que postula" required error={errors.gradeApplied}>
              <Select id="gradeApplied" name="gradeApplied" required value={str("gradeApplied")} onChange={(e) => set("gradeApplied", e.target.value)} aria-invalid={Boolean(errors.gradeApplied)} aria-describedby={describedBy("gradeApplied", undefined, errors.gradeApplied)}>
                <option value="">Selecciona un grado</option>
                {institution.grades.map((g) => (<option key={g.id} value={g.id}>{g.label} · {g.level}</option>))}
              </Select>
            </Field>
            <fieldset className="flex flex-col gap-2" aria-describedby="documents-help">
              <legend className="mb-1 font-medium">Documentos que ya tienes listos</legend>
              <p id="documents-help" className="text-sm text-muted">Los entregarás en secretaría o por correo. Puedes enviar la solicitud aunque falte alguno.</p>
              {institution.requirements.map((r) => (
                <label key={r.kind} className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-black/[0.03] dark:hover:bg-white/5">
                  <input type="checkbox" name="documents" className="size-5 accent-[var(--primary)]" checked={docs.includes(r.kind)} onChange={(e) => set("documents", e.target.checked ? [...docs, r.kind] : docs.filter((d) => d !== r.kind))} />
                  <span>{r.label}{!r.required && <span className="text-muted"> (opcional)</span>}</span>
                </label>
              ))}
            </fieldset>
            {/* Consentimiento: se distingue de los documentos con un recuadro de color y una casilla circular. */}
            <div className={`rounded-lg border-2 p-4 ${errors.consent ? "border-danger bg-danger/5" : "border-warning/60 bg-warning/10"}`}>
              <p id="consent-title" className="mb-2 font-semibold text-warning">Términos y condiciones (obligatorio)</p>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <span className="relative mt-0.5 inline-flex size-7 shrink-0">
                  <input type="checkbox" id="consent" name="consent" className={`peer size-7 cursor-pointer appearance-none rounded-full border-2 bg-surface checked:border-warning checked:bg-warning ${errors.consent ? "border-danger" : "border-warning"}`} checked={values.consent === true} onChange={(e) => set("consent", e.target.checked)} required aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-title consent-error" : "consent-title"} />
                  <Check aria-hidden strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto size-4 text-[var(--bg)] opacity-0 peer-checked:opacity-100" />
                </span>
                <span>Acepto que {institution.name} use estos datos solo para el proceso de admisión. <span aria-hidden className="text-danger">*</span></span>
              </label>
              {errors.consent && (
                <p id="consent-error" className="mt-1 flex items-start gap-1.5 text-sm font-medium text-danger">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {errors.consent}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: "Estudiante", rows: [["Nombre", str("studentName")], ["Cédula", str("studentDocument")], ["Nacimiento", str("birthDate")]] },
              { title: "Representante", rows: [["Nombre", str("guardianName")], ["Cédula", str("guardianDocument")], ["Correo", str("email")], ["Teléfono", str("phone")]] },
              { title: "Postulación", rows: [["Grado", institution.grades.find((g) => g.id === str("gradeApplied"))?.label ?? "—"], ["Documentos listos", `${docs.length} de ${institution.requirements.length}`]] },
            ].map((sec, idx) => (
              <section key={sec.title} className="glass-inset rounded-lg p-4" aria-labelledby={`rev-${idx}`}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 id={`rev-${idx}`} className="font-semibold">{sec.title}</h3>
                  <button type="button" onClick={() => go(idx)} className="min-h-11 px-2 text-sm font-medium text-primary hover:underline">Editar<span className="sr-only"> {sec.title.toLowerCase()}</span></button>
                </div>
                <dl className="grid gap-1 text-sm">
                  {sec.rows.map(([k, v]) => (<div key={k}><dt className="text-muted">{k}</dt><dd className="break-words font-medium">{v || "—"}</dd></div>))}
                </dl>
              </section>
            ))}
          </div>
        )}

        {serverError && <Alert tone="danger" role="alert" title="No se pudo enviar">{serverError}</Alert>}

        <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-5">
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || submitting}>
            <ArrowLeft aria-hidden className="size-4" /> Atrás
          </Button>
          {step < 3 ? (
            <Button type="submit">Continuar <ArrowRight aria-hidden className="size-4" /></Button>
          ) : (
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              <Send aria-hidden className="size-4" /> {submitting ? "Enviando…" : "Enviar solicitud"}
            </Button>
          )}
        </div>
      </form>
    </GlassCard>
  );
}
