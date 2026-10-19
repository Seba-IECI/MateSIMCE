"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle, LogIn } from "lucide-react";

import { login, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const initialState: LoginState = { success: false, message: null };
const inputClass = "mt-2 h-12 w-full rounded-lg border border-[var(--ms-border)] bg-white px-3.5 text-sm text-[var(--ms-ink)] outline-none transition-colors focus:border-[var(--ms-primary)] focus:ring-2 focus:ring-[var(--ms-primary)]/20 aria-invalid:border-[#b56a5b] aria-invalid:focus:ring-[#b56a5b]/20 disabled:bg-[var(--ms-background)] disabled:opacity-70";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      window.location.replace("/");
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="mt-7 space-y-5" aria-busy={pending}>
      <div>
        <label htmlFor="email" className="text-sm font-medium">Correo electrónico</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
          disabled={pending || state.success} className={inputClass}
          aria-invalid={Boolean(state.errors?.email)} aria-describedby={state.errors?.email ? "email-error" : undefined} />
        {state.errors?.email && <p id="email-error" className="mt-2 text-xs leading-5 text-[#8c3f34]">{state.errors.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024}
          disabled={pending || state.success} className={inputClass}
          aria-invalid={Boolean(state.errors?.password)} aria-describedby={state.errors?.password ? "password-error" : undefined} />
        {state.errors?.password && <p id="password-error" className="mt-2 text-xs leading-5 text-[#8c3f34]">{state.errors.password}</p>}
      </div>
      <div aria-live="polite" aria-atomic="true">
        {(state.message || notice) && <p role={state.message ? "alert" : "status"}
          className={`rounded-lg border px-3.5 py-3 text-sm leading-6 ${state.message ? "border-[#e8d3cc] bg-[#fbf2ef] text-[#8c3f34]" : "border-[var(--ms-border)] bg-[var(--ms-tint)] text-[var(--ms-muted)]"}`}>
          {state.message || notice}
        </p>}
      </div>
      <Button type="submit" disabled={pending || state.success}
        className="h-12 w-full rounded-lg bg-[var(--ms-primary)] text-white hover:bg-[var(--ms-primary-hover)] focus-visible:ring-[var(--ms-primary)]/25 disabled:opacity-75">
        {pending || state.success ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <LogIn aria-hidden="true" />}
        {pending || state.success ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
