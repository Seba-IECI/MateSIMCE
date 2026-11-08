"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";

import { signup, type SignupState } from "@/app/login/signup-actions";
import { Button } from "@/components/ui/button";

const initialState: SignupState = { status: "idle", message: null };
const inputClass = "mt-2 h-12 w-full rounded-lg border border-[var(--ms-border)] bg-[var(--ms-surface)] px-3.5 text-sm text-[var(--ms-ink)] outline-none focus:border-[var(--ms-primary)] focus:ring-2 focus:ring-[var(--ms-primary)]/20 aria-invalid:border-[#b56a5b] disabled:opacity-70";
const fields = [
  { name: "name", label: "Nombre", type: "text", autoComplete: "given-name", maxLength: 100 },
  { name: "email", label: "Correo electrónico", type: "email", autoComplete: "email", maxLength: 254 },
  { name: "password", label: "Contraseña", type: "password", autoComplete: "new-password", maxLength: 1024 },
  { name: "confirmation", label: "Confirmar contraseña", type: "password", autoComplete: "new-password", maxLength: 1024 },
] as const;

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const authenticated = state.status === "authenticated";
  const awaitingEmail = state.status === "confirmation_required";

  useEffect(() => {
    if (!pending) submitting.current = false;
    if (authenticated || awaitingEmail) formRef.current?.reset();
    if (authenticated) {
      try { window.sessionStorage.removeItem("matesimce-academic-tips-v1"); } catch { /* Almacenamiento opcional. */ }
      window.location.replace("/");
    }
  }, [pending, authenticated, awaitingEmail]);

  return (
    <form ref={formRef} action={formAction} className="mt-6 space-y-4" aria-busy={pending}
      onSubmit={(event) => {
        if (submitting.current) event.preventDefault();
        else submitting.current = true;
      }}>
      {!awaitingEmail && fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={`signup-${field.name}`} className="text-sm font-medium">{field.label}</label>
          <input {...field} id={`signup-${field.name}`} required className={inputClass}
            minLength={field.type === "password" ? 8 : undefined}
            disabled={pending || authenticated}
            aria-invalid={Boolean(state.errors?.[field.name])}
            aria-describedby={state.errors?.[field.name] ? `signup-${field.name}-error` : field.name === "password" ? "signup-password-help" : undefined} />
          {field.name === "password" && <p id="signup-password-help" className="mt-1 text-xs leading-5 text-[var(--ms-muted)]">Al menos 8 caracteres. El servicio también comprobará sus requisitos de seguridad.</p>}
          {state.errors?.[field.name] && <p id={`signup-${field.name}-error`} className="mt-1 text-xs leading-5 text-[var(--ms-danger)]">{state.errors[field.name]}</p>}
        </div>
      ))}
      <div aria-live="polite" aria-atomic="true">
        {state.message && <p role={state.status === "error" ? "alert" : "status"}
          className={`rounded-lg border px-3.5 py-3 text-sm leading-6 ${state.status === "error" ? "border-[var(--ms-danger)]/30 bg-[var(--ms-danger-bg)] text-[var(--ms-danger)]" : "border-[var(--ms-border)] bg-[var(--ms-tint)] text-[var(--ms-muted)]"}`}>
          {state.message}
        </p>}
      </div>
      {!awaitingEmail && <Button type="submit" disabled={pending || authenticated}
        className="h-12 w-full rounded-lg bg-[var(--ms-primary)] text-[var(--ms-on-primary)] hover:bg-[var(--ms-primary-hover)] disabled:opacity-75">
        {pending || authenticated ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <UserPlus aria-hidden="true" />}
        {pending ? "Registrando…" : authenticated ? "Ingresando…" : "Crear cuenta de alumno"}
      </Button>}
      {!pending && !authenticated && <p className="text-center text-sm text-[var(--ms-muted)]">
        <Link href="/login" className="font-medium text-[var(--ms-primary)] underline underline-offset-4">Volver a Iniciar sesión</Link>
      </p>}
    </form>
  );
}
