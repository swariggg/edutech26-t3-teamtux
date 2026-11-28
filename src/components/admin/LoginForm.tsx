"use client";
import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { login, type LoginState } from "@/app/actions/admin-auth";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field id="passcode" label="Clave de acceso" required announceError error={state.error}>
        <Input id="passcode" name="passcode" type="password" autoComplete="current-password" required aria-invalid={Boolean(state.error)} aria-describedby={state.error ? "passcode-error" : undefined} />
      </Field>
      <Button type="submit" disabled={pending} aria-busy={pending}><LogIn aria-hidden className="size-4" /> {pending ? "Ingresando…" : "Ingresar"}</Button>
    </form>
  );
}
