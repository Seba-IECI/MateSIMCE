"use client";

import { useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  BarChart3, BookOpenCheck, BrainCircuit, Check, ChevronRight, Clock3,
  Compass, FileText, House, Menu, MessageCircleQuestion, Sigma, Target, X,
} from "lucide-react";

type Topic = {
  name: string;
  key: string;
  description: string;
  completed: number;
  total: number;
  icon: typeof Sigma;
};

const topics: Topic[] = [
  { name: "Números", key: "numeros", description: "Potencias, raíces y proporcionalidad", completed: 8, total: 12, icon: Sigma },
  { name: "Geometría", key: "geometria", description: "Áreas, perímetros y semejanza", completed: 5, total: 12, icon: Compass },
  { name: "Álgebra y funciones", key: "algebra", description: "Expresiones, ecuaciones y gráficos", completed: 11, total: 16, icon: BarChart3 },
  { name: "Estadística y probabilidades", key: "estadistica", description: "Datos, azar y toma de decisiones", completed: 3, total: 10, icon: Target },
];

const menuItems = [
  { label: "Inicio", icon: House, pending: false },
  { label: "Ejercicios", icon: BookOpenCheck, pending: true },
  { label: "Ensayos SIMCE", icon: FileText, pending: true },
  { label: "Tutor IA", icon: MessageCircleQuestion, pending: true },
  { label: "Mi progreso", icon: BarChart3, pending: true },
];

const cardClass = "rounded-xl border border-[var(--ms-border)] bg-white";
const pendingClass = "rounded-md bg-[var(--ms-background)] px-2 py-1 text-[11px] font-medium text-[var(--ms-muted)]";

export default function Home() {
  const [activeTopic, setActiveTopic] = useState("numeros");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const selectedTopic = topics.find((topic) => topic.key === activeTopic) ?? topics[0];
  const SelectedIcon = selectedTopic.icon;
  const completed = topics.reduce((sum, topic) => sum + topic.completed, 0);
  const total = topics.reduce((sum, topic) => sum + topic.total, 0);
  const progress = Math.round((completed / total) * 100);

  return (
    <main className="matesimce-view min-h-screen">
      <div className="flex min-h-screen">
        <aside id="demo-navigation"
          className={(isMenuOpen ? "translate-x-0" : "-translate-x-full") + " fixed inset-y-0 left-0 z-30 flex w-60 shrink-0 flex-col border-r border-[var(--ms-border)] bg-white px-5 py-7 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ms-ink)] text-white"><BrainCircuit size={20} aria-hidden="true" /></span>
              <p className="text-lg font-semibold tracking-tight">MateSIMCE</p>
            </div>
            <button type="button" className="rounded-md p-1 text-[var(--ms-muted)] lg:hidden" onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menú"><X size={18} aria-hidden="true" /></button>
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--ms-muted)]">Matemática para 2.º medio</p>

          <nav className="mt-10 space-y-1.5" aria-label="Navegación de demostración">
            <p className="mb-4 px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ms-muted)]">Aprendizaje</p>
            {menuItems.map(({ label, icon: Icon, pending }) => (
              <button key={label} type="button" disabled={pending} aria-current={!pending ? "page" : undefined}
                onClick={!pending ? () => setIsMenuOpen(false) : undefined}
                className={"flex w-full items-center gap-2 rounded-lg px-2.5 py-3 text-left text-sm " + (pending ? "cursor-default text-[var(--ms-muted)]" : "bg-[var(--ms-tint)] font-medium text-[var(--ms-primary-hover)]")}>
                <Icon size={17} className="shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{label}</span>
                {pending && <span className="ml-auto shrink-0 text-[10px]">Pendiente</span>}
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t border-[var(--ms-border)] pt-5">
            <p className="text-xs font-medium">Vista de demostración</p>
            <p className="mt-2 text-xs leading-5 text-[var(--ms-muted)]">Los módulos de aprendizaje están en desarrollo. Los datos mostrados son ejemplos.</p>
          </div>
        </aside>

        {isMenuOpen && <button type="button" className="fixed inset-0 z-20 bg-[var(--ms-ink)]/20 lg:hidden" onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menú" />}

        <section className="min-w-0 flex-1">
          <header className="border-b border-[var(--ms-border)] bg-white px-5 py-4 lg:px-8">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button type="button" className="rounded-lg p-2 text-[var(--ms-muted)] lg:hidden" onClick={() => setIsMenuOpen(true)} aria-label="Abrir menú" aria-expanded={isMenuOpen} aria-controls="demo-navigation"><Menu size={20} aria-hidden="true" /></button>
                <div>
                  <p className="text-sm font-semibold">Inicio</p>
                  <p className="mt-1 hidden text-xs text-[var(--ms-muted)] sm:block">Preparación matemática para el SIMCE</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="hidden text-xs text-[var(--ms-muted)] md:inline">Demostración</span>
                <LogoutButton />
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8">
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Bienvenido a MateSIMCE</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ms-muted)]">Practicar, comprender y reconocer tus avances. Así se organizará tu espacio de aprendizaje.</p>
              </div>
              <span className="rounded-md border border-[var(--ms-border)] bg-white px-3 py-1.5 text-xs font-medium">2.º medio · Chile</span>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
              <section className={cardClass + " p-5"} aria-labelledby="topics-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="topics-title" className="text-base font-semibold">Contenidos matemáticos</h2>
                    <p className="mt-1.5 text-xs leading-5 text-[var(--ms-muted)]">Selecciona un área para explorar la vista de práctica.</p>
                  </div>
                  <span className="rounded-md bg-[var(--ms-amber-tint)] px-2 py-1 text-[11px] font-medium text-[var(--ms-amber-ink)]">Datos de ejemplo</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {topics.map((topic) => {
                    const Icon = topic.icon;
                    const percentage = Math.round((topic.completed / topic.total) * 100);
                    const selected = topic.key === activeTopic;
                    return (
                      <button type="button" key={topic.key} onClick={() => setActiveTopic(topic.key)} aria-pressed={selected}
                        className={"rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ms-primary)] " + (selected ? "border-[var(--ms-primary)] bg-[var(--ms-tint)]" : "border-[var(--ms-border)] bg-white hover:bg-[var(--ms-background)]")}>
                        <div className="flex items-start justify-between gap-3">
                          <Icon size={18} className="shrink-0 text-[var(--ms-primary)]" aria-hidden="true" />
                          {selected ? <Check size={16} className="text-[var(--ms-primary)]" aria-hidden="true" /> : <ChevronRight size={16} className="text-[var(--ms-muted)]" aria-hidden="true" />}
                        </div>
                        <h3 className="mt-3 text-sm font-medium leading-5">{topic.name}</h3>
                        <p className="mt-1 text-xs leading-5 text-[var(--ms-muted)]">{topic.description}</p>
                        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--ms-border)]" aria-hidden="true">
                          <div className="h-full rounded-full bg-[var(--ms-primary)]" style={{ width: percentage + "%" }} />
                        </div>
                        <p className="mt-2 text-[11px] text-[var(--ms-muted)]">{topic.completed} de {topic.total} ejercicios · ejemplo</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="flex flex-col rounded-xl border border-[var(--ms-border)] bg-[var(--ms-tint)] p-6" aria-labelledby="practice-title">
                <div className="flex items-center justify-between gap-3">
                  <SelectedIcon size={23} className="text-[var(--ms-primary)]" aria-hidden="true" />
                  <span className="text-[11px] font-medium text-[var(--ms-muted)]">Ejemplo de actividad</span>
                </div>
                <p className="mt-7 text-xs font-medium text-[var(--ms-primary-hover)]">Vista de práctica</p>
                <h2 id="practice-title" className="mt-2 text-2xl font-semibold tracking-tight">{selectedTopic.name}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--ms-muted)]">Ejercicios sobre {selectedTopic.description.toLowerCase()}, con espacio para desarrollar cada procedimiento.</p>
                <div className="mt-5 flex flex-wrap gap-4 text-xs text-[var(--ms-muted)]">
                  <span className="flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />15 minutos</span>
                  <span>5 ejercicios</span>
                </div>
                <div className="mt-auto pt-6">
                  <button type="button" disabled className="w-full cursor-default rounded-lg border border-[#bccfcd] bg-[#dce8e5] px-4 py-3 text-sm font-medium text-[var(--ms-primary-hover)]">Práctica próximamente</button>
                  <p className="mt-3 text-center text-xs text-[var(--ms-muted)]">Vista previa; actividad aún no disponible.</p>
                </div>
              </section>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <section className={cardClass + " p-5"} aria-labelledby="exam-title">
                <div className="flex items-center justify-between gap-3">
                  <FileText size={19} className="text-[var(--ms-primary)]" aria-hidden="true" />
                  <span className={pendingClass}>Pendiente</span>
                </div>
                <h2 id="exam-title" className="mt-4 text-base font-semibold">Ensayos SIMCE</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ms-muted)]">Practica con preguntas de los cuatro ejes y revisa qué contenidos necesitas reforzar.</p>
                <div className="mt-5 border-t border-[var(--ms-border)] pt-3 text-xs leading-5 text-[var(--ms-muted)]">
                  <p className="font-medium text-[var(--ms-ink)]">Ejemplo: ensayo diagnóstico</p>
                  <p className="mt-1">20 preguntas · 45 minutos</p>
                </div>
              </section>

              <section className={cardClass + " p-5"} aria-labelledby="tutor-title">
                <div className="flex items-center justify-between gap-3">
                  <MessageCircleQuestion size={19} className="text-[var(--ms-primary)]" aria-hidden="true" />
                  <span className={pendingClass}>Pendiente</span>
                </div>
                <h2 id="tutor-title" className="mt-4 text-base font-semibold">Tutor IA</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ms-muted)]">Un apoyo para pedir pistas, revisar procedimientos y comprender cada paso.</p>
                <p className="mt-5 border-t border-[var(--ms-border)] pt-3 text-xs leading-5 text-[var(--ms-muted)]">Pensado para acompañar tu aprendizaje. Este módulo está en desarrollo.</p>
              </section>

              <section className={cardClass + " p-5"} aria-labelledby="progress-title">
                <div className="flex items-center justify-between gap-3">
                  <BarChart3 size={19} className="text-[var(--ms-primary)]" aria-hidden="true" />
                  <span className="rounded-md bg-[var(--ms-amber-tint)] px-2 py-1 text-[11px] font-medium text-[var(--ms-amber-ink)]">Ejemplo</span>
                </div>
                <h2 id="progress-title" className="mt-4 text-base font-semibold">Mi progreso</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ms-muted)]">Así podrás revisar tu avance en los distintos contenidos matemáticos.</p>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <span className="text-xs text-[var(--ms-muted)]">Avance de ejemplo</span>
                  <span className="text-xl font-semibold text-[var(--ms-primary-hover)]">{progress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ms-border)]" aria-hidden="true"><div className="h-full rounded-full bg-[var(--ms-primary)]" style={{ width: progress + "%" }} /></div>
                <p className="mt-2 text-xs text-[var(--ms-muted)]">{completed} de {total} ejercicios de muestra</p>
              </section>
            </div>

            <p className="mt-5 text-xs leading-5 text-[var(--ms-muted)]">Esta demostración no representa el progreso de una cuenta real.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
