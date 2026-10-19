import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrainCircuit, LockKeyhole } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { getStudentAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Iniciar sesión | MateSIMCE" };
export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  "sin-acceso": "Esta cuenta no tiene acceso al espacio de estudiantes. Contacta a tu docente.",
  "servicio-no-disponible": "No pudimos verificar tu acceso. Inténtalo nuevamente o contacta a tu docente.",
  "sesion-cerrada": "Cerraste sesión en este dispositivo.",
  "salida-local": "La sesión se eliminó de este dispositivo, pero no pudimos confirmar su cierre remoto.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const access = await getStudentAccess(await createClient());
  if (access.status === "authorized") redirect("/");

  const { motivo } = await searchParams;
  const notice = typeof motivo === "string" && Object.hasOwn(notices, motivo) ? notices[motivo]
    : access.status === "forbidden" ? notices["sin-acceso"]
    : access.status === "unavailable" ? notices["servicio-no-disponible"]
    : undefined;

  return (
    <main className="matesimce-view flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <section aria-labelledby="welcome-title">
          <Link href="/" className="inline-flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ms-primary)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ms-ink)] text-white">
              <BrainCircuit size={23} aria-hidden="true" />
            </span>
            <span className="text-2xl font-semibold tracking-tight">MateSIMCE</span>
          </Link>
          <p className="mt-10 text-xs font-medium uppercase tracking-[0.12em] text-[var(--ms-primary)]">Matemática · 2.º medio</p>
          <h1 id="welcome-title" className="mt-4 max-w-md text-3xl font-semibold leading-tight tracking-tight lg:text-[2.6rem]">
            Aprende matemática.<br />Entiende cada paso.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-[var(--ms-muted)]">
            Un espacio para practicar los contenidos de 2.º medio y preparar el SIMCE con calma y método.
          </p>
          <div className="mt-9 hidden max-w-sm border-t border-[var(--ms-border)] pt-6 lg:block">
            <p className="text-sm font-medium">Ejercicios, ensayos y progreso</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ms-muted)]">Cada procedimiento cuenta. Lo importante es comprender cómo llegas a una respuesta.</p>
          </div>
        </section>

        <section aria-labelledby="login-title" className="rounded-xl border border-[var(--ms-border)] bg-white p-7 shadow-[0_4px_20px_rgba(37,55,70,0.035)] sm:p-9">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--ms-muted)]">Acceso de estudiantes</p>
          <h2 id="login-title" className="mt-3 text-2xl font-semibold tracking-tight">Inicia sesión</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ms-muted)]">Ingresa con la cuenta que te proporcionó tu establecimiento.</p>
          <LoginForm notice={notice} />
          <p className="mt-6 flex items-start gap-2.5 border-t border-[var(--ms-border)] pt-5 text-xs leading-5 text-[var(--ms-muted)]">
            <LockKeyhole size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            En un equipo compartido, recuerda cerrar sesión al terminar.
          </p>
        </section>
      </div>
    </main>
  );
}
