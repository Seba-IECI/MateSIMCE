import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpenCheck, BrainCircuit, ShieldCheck } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { StudentSession } from "@/components/auth/student-session";
import { getStudentAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Acceso de estudiantes | MateSIMCE" };
export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const access = await getStudentAccess(await createClient());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") redirect("/login?motivo=sin-acceso");
  if (access.status === "unavailable") redirect("/login?motivo=servicio-no-disponible");
  if (access.status !== "authorized") redirect("/login");

  return (
    <StudentSession userId={access.student.id}>
      <main className="min-h-screen bg-[#f3f5f2] text-[#1f302e]">
        <header className="border-b border-[#dfe5e1] bg-[#fbfcfa] px-5 py-5">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 font-semibold"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#245a54] text-white"><BrainCircuit size={21} aria-hidden="true" /></span>MateSIMCE</div>
            <LogoutButton />
          </div>
        </header>
        <section className="mx-auto max-w-4xl px-5 py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#71807b]">Espacio del estudiante · 2.º medio</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Hola, {access.student.name}</h1>
          <div className="mt-8 rounded-2xl border border-[#d9e2dc] bg-[#fbfcfa] p-6 shadow-[0_10px_30px_rgba(31,48,46,0.04)]">
            <ShieldCheck className="text-[#2f6f68]" size={28} aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold">Tu acceso está habilitado</h2>
            <p className="mt-3 text-sm leading-6 text-[#65746f]">Has ingresado correctamente a MateSIMCE con tu cuenta de estudiante.</p>
            <p className="mt-5 flex items-center gap-2 text-sm text-[#71807b]"><BookOpenCheck size={18} aria-hidden="true" />Las actividades de aprendizaje estarán disponibles en una próxima etapa.</p>
          </div>
        </section>
      </main>
    </StudentSession>
  );
}
