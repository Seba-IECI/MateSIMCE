"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { requestPasswordReset, type RecoveryState } from "@/app/login/recovery-actions";
import { Button } from "@/components/ui/button";

const initial: RecoveryState = { status: "idle", message: null };
const inputClass = "mt-2 h-12 w-full rounded-lg border border-[var(--ms-border)] bg-[var(--ms-surface)] px-3.5 text-sm outline-none focus:border-[var(--ms-primary)] focus:ring-2 focus:ring-[var(--ms-primary)]/20 disabled:opacity-70";

export function RecoveryForm({ action = requestPasswordReset, reset = false }: {
  action?: (state: RecoveryState, form: FormData) => Promise<RecoveryState>; reset?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const submitted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const finished = state.status === "sent" || state.status === "updated";
  useEffect(() => {
    if (!pending) submitted.current = false;
    if (finished) formRef.current?.reset();
  }, [pending, finished]);
  const fields = reset ? [
    { name: "password", label: "Nueva contraseña", type: "password" },
    { name: "confirmation", label: "Confirmar contraseña", type: "password" },
  ] as const : [{ name: "email", label: "Correo electrónico", type: "email" }] as const;
  return <form ref={formRef} action={formAction} aria-busy={pending} className="mt-6 space-y-4" onSubmit={(event) => {
    if (submitted.current) event.preventDefault(); else submitted.current = true;
  }}>
    {!finished && fields.map((field) => <div key={field.name}>
      <label htmlFor={`recovery-${field.name}`} className="text-sm font-medium">{field.label}</label>
      <input id={`recovery-${field.name}`} name={field.name} type={field.type} required disabled={pending}
        minLength={reset ? 8 : undefined} maxLength={reset ? 1024 : 254} autoComplete={reset ? "new-password" : "email"}
        className={inputClass} aria-invalid={Boolean(state.errors?.[field.name])}
        aria-describedby={state.errors?.[field.name] ? `recovery-${field.name}-error` : undefined} />
      {state.errors?.[field.name] && <p id={`recovery-${field.name}-error`} className="mt-1 text-xs text-[var(--ms-danger)]">{state.errors[field.name]}</p>}
    </div>)}
    <div aria-live="polite">{state.message && <p role={state.status === "error" ? "alert" : "status"}
      className="rounded-lg border border-[var(--ms-border)] p-3 text-sm leading-6">{state.message}</p>}</div>
    {!reset && <p className="text-xs leading-5 text-[var(--ms-muted)]">Abre el enlace en el mismo navegador y dispositivo donde lo solicitaste, sin cambiar a una ventana de incógnito.</p>}
    {!finished && <Button type="submit" disabled={pending} className="h-12 w-full bg-[var(--ms-primary)] text-[var(--ms-on-primary)]">
      {pending && <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
      {pending ? "Procesando…" : reset ? "Guardar nueva contraseña" : "Enviar instrucciones"}
    </Button>}
    <Link href="/login" className="block text-center text-sm text-[var(--ms-primary)] underline underline-offset-4">Volver a Iniciar sesión</Link>
  </form>;
}
