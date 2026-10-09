"use client";

import { useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MessageCircleQuestion,
  Play,
  Sigma,
  Target,
  Trophy,
  X,
} from "lucide-react";

type Topic = {
  name: string;
  key: string;
  description: string;
  completed: number;
  total: number;
  icon: typeof Sigma;
  color: string;
};

const topics: Topic[] = [
  { name: "Números", key: "numeros", description: "Potencias, raíces y proporcionalidad", completed: 8, total: 12, icon: Sigma, color: "#2f6f68" },
  { name: "Geometría", key: "geometria", description: "Áreas, perímetros y semejanza", completed: 5, total: 12, icon: Compass, color: "#b36b35" },
  { name: "Álgebra y funciones", key: "algebra", description: "Expresiones, ecuaciones y gráficos", completed: 11, total: 16, icon: BarChart3, color: "#405a82" },
  { name: "Estadística y probabilidades", key: "estadistica", description: "Datos, azar y toma de decisiones", completed: 3, total: 10, icon: Target, color: "#8a5475" },
];

const menuItems = [
  { label: "Mi inicio", icon: LayoutDashboard },
  { label: "Practicar por tema", icon: BookOpenCheck },
  { label: "Ensayos SIMCE", icon: FileText },
  { label: "Mi progreso", icon: BarChart3 },
];

export default function Home() {
  const [activeTopic, setActiveTopic] = useState("numeros");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const selectedTopic = topics.find((topic) => topic.key === activeTopic) ?? topics[0];
  const SelectedIcon = selectedTopic.icon;

  return (
    <main className="min-h-screen bg-[#f3f5f2] text-[#1f302e]">
      <div className="flex min-h-screen">
        <aside className={`${isMenuOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-[#d9e0dc] bg-[#fbfcfa] px-5 py-6 transition-transform lg:static lg:translate-x-0`}>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#245a54] text-white"><BrainCircuit size={21} aria-hidden="true" /></span>
              <div><p className="font-semibold tracking-tight text-[#1f302e]">MateSIMCE</p><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#71807b]">Espacio de aprendizaje</p></div>
            </div>
            <button type="button" className="rounded-lg p-2 text-[#62726d] hover:bg-[#edf1ee] lg:hidden" onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menú"><X size={19} aria-hidden="true" /></button>
          </div>

          <div className="mt-10 rounded-2xl bg-[#e8efeb] p-4">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d2e1da] text-sm font-semibold text-[#245a54]">US</div><div><p className="text-sm font-semibold">Usuario</p><p className="text-xs text-[#687873]">2° medio</p></div></div>
            <div className="mt-4 flex items-center justify-between text-xs text-[#687873]"><span>Avance general</span><span className="font-semibold text-[#245a54]">54%</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#cbdad2]"><div className="h-full w-[54%] rounded-full bg-[#2f6f68]" /></div>
          </div>

          <nav className="mt-8 space-y-1" aria-label="Navegación del estudiante">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#899590]">Mi espacio</p>
            {menuItems.map(({ label, icon: Icon }, index) => (
              <button type="button" key={label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${index === 0 ? "bg-[#e5efeb] font-semibold text-[#245a54]" : "text-[#667671] hover:bg-[#f0f3f1] hover:text-[#245a54]"}`} onClick={() => setIsMenuOpen(false)}>
                <Icon size={18} aria-hidden="true" />{label}{index === 2 && <span className="ml-auto rounded-full bg-[#f2e5da] px-2 py-0.5 text-[10px] font-semibold text-[#9a5d31]">2</span>}
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t border-[#e0e6e2] pt-5"><div className="flex items-start gap-3 rounded-xl bg-[#f7f4ee] p-3"><LockKeyhole className="mt-0.5 shrink-0 text-[#8a7868]" size={16} aria-hidden="true" /><p className="text-xs leading-5 text-[#766e67]">Vista de avance. El acceso de estudiantes se habilitará en la siguiente etapa.</p></div></div>
        </aside>

        {isMenuOpen && <button type="button" className="fixed inset-0 z-20 bg-[#1f302e]/20 lg:hidden" onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menú" />}

        <section className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b border-[#dfe5e1] bg-[#fbfcfa] px-5 sm:px-8 lg:px-10">
            <button type="button" className="rounded-lg p-2 text-[#62726d] hover:bg-[#edf1ee] lg:hidden" onClick={() => setIsMenuOpen(true)} aria-label="Abrir menú"><Menu size={21} aria-hidden="true" /></button>
            <div className="hidden lg:block"><p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8a9691]">Panel del estudiante</p><p className="mt-1 text-sm text-[#5d6d68]">Preparación Matemática · 2° medio</p></div>
            <div className="flex items-center gap-3"><span className="hidden rounded-full border border-[#d7e0db] bg-white px-3 py-1.5 text-xs text-[#687873] sm:inline-flex">Sesión de demostración</span><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#245a54] text-xs font-semibold text-white">AS</div></div>
          </header>

          <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#71807b]">Lunes, 21 de septiembre</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f302e] sm:text-4xl">Hola, Usuario. ¿Qué aprenderemos hoy?</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#65746f]">Elige un área para practicar. Tu progreso se construye resolviendo con calma y entendiendo cada procedimiento.</p></div><div className="flex items-center gap-2 text-sm text-[#667671]"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2e5da] text-[#a46132]"><Trophy size={16} aria-hidden="true" /></span><span><strong className="text-[#1f302e]">3 días</strong> de práctica</span></div></div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_0.72fr]">
              <section className="rounded-2xl border border-[#d9e2dc] bg-[#fbfcfa] p-5 shadow-[0_10px_30px_rgba(31,48,46,0.04)] sm:p-6">
                <div className="flex items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#71807b]"><BookOpenCheck size={15} className="text-[#2f6f68]" aria-hidden="true" />Practica por tema</div><h2 className="mt-2 text-xl font-semibold text-[#1f302e]">Tus áreas de aprendizaje</h2></div><span className="hidden rounded-full bg-[#edf3ef] px-3 py-1.5 text-xs font-medium text-[#467068] sm:inline-flex">2° medio</span></div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {topics.map((topic) => { const Icon = topic.icon; const percentage = Math.round((topic.completed / topic.total) * 100); const isSelected = topic.key === activeTopic; return <button type="button" key={topic.key} onClick={() => setActiveTopic(topic.key)} className={`group rounded-xl border p-4 text-left transition ${isSelected ? "border-[#8db8aa] bg-[#edf5f1] shadow-sm" : "border-[#e2e8e4] bg-white hover:border-[#b7cbc1] hover:bg-[#f8faf8]"}`} aria-pressed={isSelected}><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: topic.color }}><Icon size={18} aria-hidden="true" /></span>{isSelected ? <Check size={17} className="text-[#2f6f68]" aria-label="Tema seleccionado" /> : <ChevronRight size={17} className="text-[#a0ada8] transition group-hover:translate-x-0.5" aria-hidden="true" />}</div><p className="mt-4 text-sm font-semibold text-[#253b37]">{topic.name}</p><p className="mt-1 text-xs leading-5 text-[#74817d]">{topic.description}</p><div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#dfe8e2]"><div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: topic.color }} /></div><span className="text-xs font-medium text-[#70807a]">{percentage}%</span></div></button>; })}
                </div>
              </section>

              <section className="rounded-2xl bg-[#245a54] p-6 text-white shadow-[0_10px_30px_rgba(36,90,84,0.15)]"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-[#d9eee6]"><SelectedIcon size={20} aria-hidden="true" /></div><span className="rounded-full bg-[#d5e9df]/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.13em] text-[#d9eee6]">Sugerido</span></div><p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-[#a9d0c1]">Continúa con</p><h2 className="mt-2 text-2xl font-semibold">{selectedTopic.name}</h2><p className="mt-3 text-sm leading-6 text-[#d9e9e3]">Practica ejercicios sobre {selectedTopic.description.toLowerCase()} y fortalece tu base para el SIMCE.</p><div className="mt-6 flex items-center gap-4 border-t border-white/15 pt-4 text-xs text-[#c9e0d7]"><span className="flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />15 min</span><span className="flex items-center gap-1.5"><BookOpenCheck size={14} aria-hidden="true" />5 ejercicios</span></div><button type="button" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#f1c28f] px-4 py-3 text-sm font-semibold text-[#31564d] transition hover:bg-[#f6d1a7]">Iniciar práctica <Play size={15} fill="currentColor" aria-hidden="true" /></button></section>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-2xl border border-[#d9e2dc] bg-[#fbfcfa] p-6 shadow-[0_10px_30px_rgba(31,48,46,0.04)]"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#71807b]"><FileText size={15} className="text-[#b36b35]" aria-hidden="true" />Desafío SIMCE</div><h2 className="mt-2 text-xl font-semibold">Ensayo diagnóstico 01</h2></div><span className="rounded-full border border-[#ead8c7] bg-[#fff8f0] px-3 py-1.5 text-xs font-medium text-[#a46132]">Pendiente</span></div><p className="mt-4 max-w-xl text-sm leading-6 text-[#667671]">Responde una selección de preguntas de los cuatro ejes. Al finalizar podrás revisar tus resultados y detectar qué contenidos reforzar.</p><div className="mt-6 flex flex-wrap gap-4 text-xs text-[#71807b]"><span className="flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />45 minutos</span><span className="flex items-center gap-1.5"><FileText size={14} aria-hidden="true" />20 preguntas</span><span className="flex items-center gap-1.5"><Target size={14} aria-hidden="true" />Nivel 2° medio</span></div><button type="button" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#245a54] hover:text-[#173f3a]">Revisar instrucciones <ChevronRight size={16} aria-hidden="true" /></button></section>

              <section className="rounded-2xl border border-[#d9e2dc] bg-[#fbfcfa] p-6 shadow-[0_10px_30px_rgba(31,48,46,0.04)]"><div className="flex items-start gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2e5da] text-[#a46132]"><MessageCircleQuestion size={20} aria-hidden="true" /></div><div><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Tutor MateSIMCE</h2><span className="rounded-full bg-[#eef0ed] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7b8781]">En desarrollo</span></div><p className="mt-3 text-sm leading-6 text-[#667671]">Pronto podrás pedir pistas, revisar procedimientos y recibir explicaciones paso a paso sin que te entreguen la respuesta de inmediato.</p></div></div><div className="mt-6 rounded-xl border border-dashed border-[#cbd8d1] bg-[#f4f7f4] p-4 text-sm text-[#7b8983]"><span className="font-medium text-[#52645e]">Próximo avance:</span> integración con Gemini y expresiones matemáticas mediante KaTeX.</div></section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
