"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, BookOpenCheck, ChartNoAxesCombined, ChevronLeft, ChevronRight, Compass, FileText, House, Lightbulb, Menu, Sigma, X } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ExerciseBrowser } from "@/components/exercises/exercise-browser";
import { ExamBrowser } from "@/components/exercises/exam-browser";
import { getTopicsAction } from "@/app/exercises-actions";
import type { ExerciseTopic } from "@/lib/exercises/types";

const axes = [
  { category: "numeros", name: "Números", icon: Sigma },
  { category: "algebra_y_funciones", name: "Álgebra y funciones", icon: ChartNoAxesCombined },
  { category: "geometria", name: "Geometría", icon: Compass },
  { category: "estadistica_y_probabilidades", name: "Estadística y probabilidades", icon: ChartNoAxesCombined },
];
const tips = [
  { axis: "Números", text: "Un exponente negativo indica un recíproco: si la base es distinta de cero, invierte la potencia. No cambia por sí solo el signo del resultado." },
  { axis: "Álgebra y funciones", text: "Antes de resolver una ecuación, identifica la incógnita. Después, comprueba la solución sustituyéndola en la ecuación original." },
  { axis: "Geometría", text: "Revisa las unidades. Una longitud se expresa en unidades lineales; un área, en unidades cuadradas; un volumen, en unidades cúbicas." },
  { axis: "Estadística y probabilidades", text: "La razón entre casos favorables y posibles se aplica cuando los resultados elementales son equiprobables. Comprueba esa condición antes de usarla." },
];
type Section = "Inicio" | "Práctica por ejes" | "Ensayo SIMCE";
const menu = [{ label: "Inicio", icon: House }, { label: "Práctica por ejes", icon: BookOpenCheck }, { label: "Ensayo SIMCE", icon: FileText }] as const;

export default function Home() {
  const [section, setSection] = useState<Section>("Inicio");
  const [category, setCategory] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const [topics, setTopics] = useState<ExerciseTopic[]>([]);
  const [topicStatus, setTopicStatus] = useState("loading");
  useEffect(() => {
    let current = true;
    getTopicsAction().then((result) => {
      if (!current) return;
      setTopicStatus(result.status);
      if (result.status === "ok") setTopics(result.data);
    }).catch(() => { if (current) setTopicStatus("error"); });
    return () => { current = false; };
  }, []);
  function navigate(next: Section, selected?: string) {
    setCategory(selected); setSection(next); setMenuOpen(false);
  }
  return <main className="matesimce-view min-h-screen">
    <div className="flex min-h-screen">
      <aside id="learning-navigation" className={(menuOpen ? "translate-x-0" : "-translate-x-full") + " fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col border-r border-[var(--ms-border)] bg-[var(--sidebar)] p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"}>
        <div className="flex items-center gap-3 pb-6"><Image src="/icon.svg" width={44} height={44} alt="" className="shrink-0" />
          <div><p className="text-lg font-semibold tracking-tight">MateSIMCE</p><p className="mt-0.5 text-[11px] text-[var(--ms-muted)]">Matemática · II medio</p></div>
          <button type="button" className="ml-auto lg:hidden" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
        <nav aria-label="Navegación principal" className="mt-6 space-y-2">{menu.map(({ label, icon: Icon }) => <button key={label} type="button" aria-current={section === label ? "page" : undefined} onClick={() => navigate(label)}
          className={"flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors " + (section === label ? "bg-[var(--ms-tint)] font-semibold text-[var(--ms-primary-hover)]" : "text-[var(--ms-muted)] hover:bg-[var(--ms-surface)] hover:text-[var(--ms-ink)]")}><Icon size={18} aria-hidden="true" />{label}</button>)}</nav>
        <div className="mt-auto border-t border-[var(--ms-border)] pt-5"><p className="mb-3 text-xs text-[var(--ms-muted)]">Espacio del estudiante</p><LogoutButton /></div>
      </aside>
      {menuOpen && <button type="button" aria-label="Cerrar navegación" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <section className="min-w-0 flex-1">
        <header className="flex h-16 items-center gap-3 border-b border-[var(--ms-border)] px-5 lg:px-8">
          <button type="button" aria-label="Abrir menú" aria-expanded={menuOpen} aria-controls="learning-navigation" className="rounded-md p-2 lg:hidden" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <p className="text-sm font-medium">{section}</p><span className="ml-auto rounded-full border border-[var(--ms-border)] px-3 py-1 text-xs text-[var(--ms-muted)]">II medio · Chile</span></header>
        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
          {section === "Práctica por ejes" ? <ExerciseBrowser key={category ?? "all"} initialCategory={category} />
            : section === "Ensayo SIMCE" ? <ExamBrowser onHome={() => navigate("Inicio")} />
            : <div className="ms-enter space-y-6">
              <div className="ms-hero rounded-2xl py-3"><p className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--ms-primary)]">Tu espacio de aprendizaje</p><h1 className="text-3xl font-semibold tracking-tight">Bienvenido a MateSIMCE</h1><p className="mt-2 text-sm text-[var(--ms-muted)]">Practica, comprende tus errores y prepárate a tu ritmo.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <button type="button" onClick={() => navigate("Práctica por ejes")} className="ms-card ms-interactive flex items-center gap-4 p-5 text-left"><BookOpenCheck size={28} className="shrink-0 text-[var(--ms-primary)]" aria-hidden="true" /><span><span className="block text-lg font-semibold">Práctica por eje temático</span><span className="mt-1 block text-sm text-[var(--ms-muted)]">Ejercicios, retroalimentación y apoyo del tutor.</span></span><ArrowRight size={18} className="ml-auto shrink-0 text-[var(--ms-primary)]" aria-hidden="true" /></button>
                <button type="button" onClick={() => navigate("Ensayo SIMCE")} className="ms-card ms-interactive flex items-center gap-4 p-5 text-left"><FileText size={28} className="shrink-0 text-[var(--ms-primary)]" aria-hidden="true" /><span><span className="block text-lg font-semibold">Ensayo tipo SIMCE</span><span className="mt-1 block text-sm text-[var(--ms-muted)]">12 preguntas. Revisa tus resultados por eje.</span></span><ArrowRight size={18} className="ml-auto shrink-0 text-[var(--ms-primary)]" aria-hidden="true" /></button>
              </div>
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
                <section aria-labelledby="home-practice-title"><h2 id="home-practice-title" className="mb-3 text-base font-semibold">¿Qué quieres practicar hoy?</h2>
                  {topicStatus === "loading" && <p role="status" className="mb-3 text-sm text-[var(--ms-muted)]">Consultando los contenidos disponibles…</p>}
                  {topicStatus !== "loading" && topicStatus !== "ok" && <p role="alert" className="mb-3 text-sm text-[var(--ms-danger)]">No pudimos consultar los contenidos. Puedes reintentarlo desde Práctica por ejes.</p>}
                  <div className="grid gap-3 sm:grid-cols-2">{axes.map(({ category, name, icon: Icon }) => {
                    const available = topics.filter((topic) => topic.category === category);
                    return <button type="button" key={category} data-cy="dashboard-topic" data-category={category} disabled={topicStatus !== "ok" || !available.length} onClick={() => navigate("Práctica por ejes", category)} className="ms-card ms-interactive min-h-32 p-4 text-left disabled:opacity-50">
                      <span className="flex items-center justify-between text-[var(--ms-primary)]"><Icon size={21} aria-hidden="true" /><ChevronRight size={17} aria-hidden="true" /></span><span className="mt-3 block font-semibold">{name}</span><span className="mt-1 block text-xs leading-5 text-[var(--ms-muted)]">{available.length === 1 ? available[0].description || "Abrir ejercicios disponibles" : available.length ? "Explora los temas disponibles de este eje" : "Contenido no disponible"}</span></button>;
                  })}</div>
                </section>
                <aside className="ms-card p-5" aria-labelledby="tips-title"><Lightbulb className="mb-3 text-[var(--ms-primary)]" size={24} aria-hidden="true" /><h2 id="tips-title" className="font-semibold">Tips académicos</h2><p className="mt-4 text-xs font-medium text-[var(--ms-primary-hover)]">{tips[tip].axis}</p><p data-cy="tip-text" className="mt-2 min-h-24 text-sm leading-6 text-[var(--ms-muted)]">{tips[tip].text}</p>
                  <div className="mt-4 flex items-center justify-between gap-2"><button type="button" aria-label="Consejo anterior" className="rounded-full border border-[var(--ms-border)] p-2" onClick={() => setTip((tip + tips.length - 1) % tips.length)}><ChevronLeft size={16} /></button><div className="flex gap-2">{tips.map((item, i) => <button type="button" key={item.axis} aria-label={`Consejo de ${item.axis}`} aria-pressed={tip === i} onClick={() => setTip(i)} className="grid size-6 place-items-center rounded-full"><span className={"h-2 w-2 rounded-full " + (tip === i ? "bg-[var(--ms-primary)]" : "bg-[var(--ms-border)]")} /></button>)}</div><button type="button" aria-label="Consejo siguiente" className="rounded-full border border-[var(--ms-border)] p-2" onClick={() => setTip((tip + 1) % tips.length)}><ChevronRight size={16} /></button></div>
                </aside>
              </div>
            </div>}
        </div>
      </section>
    </div>
  </main>;
}
