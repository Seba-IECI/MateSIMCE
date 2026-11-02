import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PublicationForm } from "@/components/admin/publication-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { getAdminDashboard } from "@/lib/admin/catalog";
import { getAdminAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administración | MateSIMCE" };
export const dynamic = "force-dynamic";

const axes = [
  { category: "numeros", name: "Números" },
  { category: "algebra_y_funciones", name: "Álgebra y funciones" },
  { category: "geometria", name: "Geometría" },
  { category: "estadistica_y_probabilidades", name: "Estadística y probabilidades" },
];

export default async function AdminPage() {
  const access = await getAdminAccess(await createClient());
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "unavailable") redirect("/login?motivo=servicio-no-disponible");
  if (access.status !== "authorized" || access.role !== "administrador") redirect("/login?motivo=sin-acceso");

  const result = await getAdminDashboard();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "forbidden") redirect("/login?motivo=sin-acceso");
  const panel = "rounded-xl border border-[var(--ms-border)] bg-white";
  const groups = result.status === "ok" ? [
    ...axes.map((axis) => ({ ...axis, exercises: result.data.exercises.filter((exercise) => exercise.category === axis.category) })),
    { category: "sin_eje", name: "Sin eje disponible", exercises: result.data.exercises.filter((exercise) => !axes.some((axis) => axis.category === exercise.category)) },
  ].filter((group) => group.exercises.length > 0) : [];
  return (
    <main className="matesimce-view min-h-screen px-6 py-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[var(--ms-border)] pb-6">
          <div>
            <p className="text-sm font-semibold text-[var(--ms-primary)]">MateSIMCE · Administración</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Panel de administración</h1>
            <p className="mt-2 text-sm text-[var(--ms-muted)]">Sesión de {access.user.name}. Gestión básica del catálogo educativo.</p>
          </div>
          <LogoutButton />
        </header>

        {result.status !== "ok" ? <div role="alert" className={`${panel} mt-8 p-6 text-sm text-[var(--ms-muted)]`}>
          No pudimos consultar el resumen. Recarga la página o revisa los permisos del catálogo.
        </div> : <>
          <section aria-label="Resumen de la plataforma" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Estudiantes registrados", result.data.students], ["Ejercicios de entrenamiento", result.data.total],
              ["Publicados", result.data.published], ["Sin publicar", result.data.unpublished],
            ].map(([label, value]) => <div key={label} className={`${panel} p-5`}>
              <p className="text-sm text-[var(--ms-muted)]">{label}</p>
              <p className="mt-3 text-3xl font-semibold">{value}</p>
            </div>)}
          </section>
          <p className="mt-3 text-xs text-[var(--ms-muted)]">El total de estudiantes incluye perfiles activos e inactivos con rol alumno.</p>

          <section className={`${panel} mt-8 overflow-hidden`} aria-labelledby="catalog-title">
            <div className="border-b border-[var(--ms-border)] p-5">
              <h2 id="catalog-title" className="text-lg font-semibold">Ejercicios de entrenamiento</h2>
              <p className="mt-2 text-sm text-[var(--ms-muted)]">Abre un eje para consultar sus ejercicios y gestionar su publicación. Los intentos ya registrados se conservan.</p>
            </div>
            {result.data.exercises.length === 0 ? <p className="p-6 text-sm text-[var(--ms-muted)]">Todavía no hay ejercicios en el catálogo.</p> :
              groups.map((group, index) => <details key={group.category} open={index === 0} className="border-t border-[var(--ms-border)] first:border-t-0">
                <summary className="cursor-pointer bg-[var(--ms-background)] px-5 py-4 text-[var(--ms-ink)] focus-visible:outline-2 focus-visible:outline-[var(--ms-primary)]">
                  <h3 className="inline text-sm font-semibold">{group.name}
                    <span className="ml-3 text-xs font-normal text-[var(--ms-muted)]">{group.exercises.length} ejercicios · {group.exercises.filter((exercise) => exercise.published).length} publicados</span>
                  </h3>
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[var(--ms-muted)]">
                      <tr><th scope="col" className="px-5 py-4 font-medium">Ejercicio</th><th scope="col" className="px-5 py-4 font-medium">Tema</th><th scope="col" className="px-5 py-4 font-medium">Estado</th><th scope="col" className="px-5 py-4 font-medium">Publicación</th></tr>
                    </thead>
                    <tbody>{group.exercises.map((exercise) => <tr key={exercise.id} className="border-t border-[var(--ms-border)]">
                      <th scope="row" className="px-5 py-5 font-medium">{exercise.title}</th>
                      <td className="px-5 py-5 text-[var(--ms-muted)]">{exercise.topicName}</td>
                      <td className="whitespace-nowrap px-5 py-5"><span className={`rounded-md px-2 py-1 text-xs ${exercise.published ? "bg-[var(--ms-tint)] text-[var(--ms-primary-hover)]" : "bg-[var(--ms-background)] text-[var(--ms-muted)]"}`}>{exercise.published ? "Publicado" : "No publicado"}</span></td>
                      <td className="px-5 py-5"><PublicationForm exerciseId={exercise.id} title={exercise.title} published={exercise.published} /></td>
                    </tr>)}</tbody>
                  </table>
                </div>
              </details>)}
          </section>
          <section className={`${panel} mt-6 p-5`} aria-labelledby="exams-title">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="exams-title" className="text-lg font-semibold">Ensayos SIMCE</h2>
              <span className="rounded-md bg-[var(--ms-background)] px-2 py-1 text-xs text-[var(--ms-muted)]">Pendiente de implementar</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ms-muted)]">Las preguntas de ensayos se administrarán en un apartado propio, separado de los ejercicios de entrenamiento por eje.</p>
          </section>
        </>}
      </div>
    </main>
  );
}
