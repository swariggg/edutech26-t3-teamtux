"use client";
import { FileCheck2, Landmark, X } from "lucide-react";
import { institution } from "@/content/institution";
import type { DocumentKind } from "@/domain/types";
import { DOC_MAX_BYTES, DOC_MIME_TYPES } from "@/domain/schemas";

export type PickedFiles = Partial<Record<DocumentKind, File>>;

const ACCEPT = DOC_MIME_TYPES.join(",");
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Valida en el navegador (el servidor y el almacenamiento vuelven a validar). */
export function checkFile(f: File): string | null {
  if (!(DOC_MIME_TYPES as readonly string[]).includes(f.type)) return "Formato no permitido: usa PDF, JPG, PNG o WEBP.";
  if (f.size > DOC_MAX_BYTES) return `El archivo pesa ${fmtSize(f.size)}; el máximo es 5 MB.`;
  if (f.size === 0) return "El archivo está vacío.";
  return null;
}

/** Un selector de archivo por requisito. Los archivos se suben al enviar la solicitud. */
export function DocumentPicker({ files, errors, onChange }: { files: PickedFiles; errors: Partial<Record<DocumentKind, string>>; onChange: (kind: DocumentKind, file: File | null) => void }) {
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby="documents-help">
      <legend className="mb-1 font-medium">Documentos</legend>
      <p id="documents-help" className="text-sm text-muted">
        Sube cada documento en PDF o como foto (JPG, PNG), de hasta 5 MB. Desde el celular puedes tomar la foto directamente.
        Si te falta alguno, puedes enviar la solicitud y entregarlo luego en secretaría.
      </p>
      <ul className="flex flex-col gap-3">
        {institution.requirements.map((r) => {
          const id = `doc-${r.kind}`;
          const file = files[r.kind];
          const err = errors[r.kind];
          const statement = r.kind === "estado_cuenta";
          return (
            <li key={r.kind} className={`glass-inset flex flex-col gap-2 rounded-lg p-3 ${err ? "border border-danger" : ""}`}>
              <div className="flex items-start gap-2">
                {statement ? <Landmark aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" /> : <FileCheck2 aria-hidden className={`mt-0.5 size-5 shrink-0 ${file ? "text-success" : "text-muted"}`} />}
                <label htmlFor={id} className="font-medium">
                  {r.label}
                  {!r.required && <span className="font-normal text-muted"> (opcional)</span>}
                </label>
              </div>
              {statement && (
                <p id={`${id}-hint`} className="text-sm text-muted">
                  Lo usamos para acordar contigo un plan de pago a tu medida y para identificar a familias que pueden acceder a una beca.
                  Una inteligencia artificial lo revisa y el personal de colecturía toma la decisión. El archivo se guarda de forma privada y el análisis no registra números de cuenta ni movimientos individuales.
                </p>
              )}
              {file ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium" title={file.name}>{file.name}</span>
                  <span className="text-muted">{fmtSize(file.size)}</span>
                  <button type="button" onClick={() => onChange(r.kind, null)} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-medium text-danger hover:bg-danger/10">
                    <X aria-hidden className="size-4" /> Quitar<span className="sr-only"> {r.label}</span>
                  </button>
                </div>
              ) : (
                <input
                  id={id}
                  name={id}
                  type="file"
                  accept={ACCEPT}
                  aria-invalid={Boolean(err)}
                  aria-describedby={[statement ? `${id}-hint` : "", err ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
                  onChange={(e) => onChange(r.kind, e.target.files?.[0] ?? null)}
                  className="min-h-11 w-full text-sm text-muted file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-on-primary hover:file:opacity-90"
                />
              )}
              {err && <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">{err}</p>}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
