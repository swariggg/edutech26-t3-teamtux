import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

const control = "w-full min-h-11 rounded-md border border-line bg-surface px-3 py-2 text-foreground placeholder:text-muted/80 transition-colors focus-visible:border-primary aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger/5 aria-[invalid=true]:focus-visible:border-danger";

/**
 * `announceError`: anuncia el error con role="alert". Úsalo en formularios sin resumen de errores
 * (p. ej. login); el asistente de admisión ya anuncia un resumen propio.
 */
export function Field({ id, label, hint, error, required, announceError = false, children, className }: { id: string; label: string; hint?: string; error?: string; required?: boolean; announceError?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-medium">
        {label} {required ? <span aria-hidden className="text-danger">*</span> : <span className="text-sm font-normal text-muted">(opcional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role={announceError ? "alert" : undefined} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...rest} />;
}
export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "pr-8", className)} {...rest} />;
}
export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24", className)} {...rest} />;
}
