import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  GraduationCap,
  MessageSquareText,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

const features = [
  {
    title: "Explicación guiada",
    description:
      "Desglosa cada ejercicio para que el estudiante entienda el porqué de cada paso.",
    icon: BrainCircuit,
  },
  {
    title: "Retroalimentación inteligente",
    description:
      "Detecta errores comunes y ofrece correcciones con lenguaje claro y cercano.",
    icon: MessageSquareText,
  },
  {
    title: "Plan de estudio",
    description:
      "Recomienda rutas de práctica según el nivel, la materia y los objetivos del alumno.",
    icon: GraduationCap,
  },
];

const steps = [
  {
    title: "1. Elige un tema",
    text: "Selecciona algebra, trigonometría, funciones o geometría para comenzar tu sesión.",
  },
  {
    title: "2. Resuelve con apoyo",
    text: "El tutor acompaña el proceso, explica conceptos y valida cada procedimiento.",
  },
  {
    title: "3. Mejora tu confianza",
    text: "Revisa errores, fortalece habilidades y avanza con ejercicios cada vez más desafiantes.",
  },
];

const stats = [
  { value: "3x", label: "más práctica guiada" },
  { value: "24/7", label: "acceso de apoyo" },
  { value: "95%", label: "claridad en pasos" },
];

const topics = [
  "Aritmética",
  "Álgebra",
  "Geometría",
  "Trigonometría",
  "Funciones",
  "Estadística",
];

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-[#f7f4ee] text-[#1e2927]">
      <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#d8e7dc] opacity-80 blur-3xl" />
      <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-[#f2c9a5] opacity-70 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-6 sm:px-8 lg:px-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-[#d9d4cc] bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e85d2a] text-white shadow-sm">
              <BrainCircuit size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">MateSIMCE</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#63706b]">
                Tutor IA
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-[#4f5d59] md:flex">
            <a href="#features" className="transition hover:text-[#1e2927]">
              Características
            </a>
            <a href="#how-it-works" className="transition hover:text-[#1e2927]">
              Cómo funciona
            </a>
            <a href="#path" className="transition hover:text-[#1e2927]">
              Ruta de estudio
            </a>
          </nav>

          <Button variant="default" size="sm" className="rounded-full px-4">
            Acceder
          </Button>
        </header>

        <section className="mx-auto grid max-w-6xl gap-12 pb-16 pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:pt-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d9d4cc] bg-white/80 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#e85d2a] shadow-sm">
              <Sparkles size={14} aria-hidden="true" />
              Aprende resolviendo
            </div>

            <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-[#1e2927] sm:text-6xl lg:text-7xl">
              Entiende las matemáticas, paso a paso.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-[#63706b]">
              MateSIMCE acompaña a estudiantes de preparatoria con explicaciones claras,
              retroalimentación precisa y práctica adaptada a su nivel.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button className="gap-2 rounded-full bg-[#1e2927] px-6 text-white hover:bg-[#2b3c39]">
                Comenzar a practicar
                <ArrowRight size={17} aria-hidden="true" />
              </Button>
              <Button variant="outline" className="rounded-full border-[#cfc6bb] bg-white/60 px-6 text-[#1e2927]">
                Ver demo
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-5 text-sm text-[#4f5d59]">
              {topics.map((topic) => (
                <span key={topic} className="rounded-full border border-[#d9d4cc] bg-white/70 px-3 py-1.5">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-[#e4ddd4] bg-white/80 p-5 shadow-[0_30px_80px_rgba(30,41,39,0.08)] backdrop-blur-sm">
              <div className="rounded-[1.5rem] bg-[#f4efe8] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#63706b]">Sesión actual</p>
                    <h2 className="mt-1 text-2xl font-semibold">Ecuaciones cuadráticas</h2>
                  </div>
                  <span className="rounded-full bg-[#d8e7dc] px-2.5 py-1 text-xs font-medium text-[#1d4d3f]">
                    En curso
                  </span>
                </div>

                <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm text-[#63706b]">Problema</p>
                  <div className="rounded-xl bg-[#f7f4ee] p-4 text-lg font-medium text-[#1e2927]">
                    x² - 5x + 6 = 0
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-xl bg-[#edf5f1] p-3">
                      <CheckCircle2 className="mt-0.5 text-[#1d4d3f]" size={18} />
                      <p className="text-sm text-[#31524b]">
                        Factorizamos: (x - 2)(x - 3) = 0
                      </p>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl bg-[#fff8ef] p-3">
                      <Target className="mt-0.5 text-[#b3692a]" size={18} />
                      <p className="text-sm text-[#7a4f1f]">
                        Soluciones: x = 2 y x = 3
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl py-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e85d2a]">
              Beneficios
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#1e2927] sm:text-4xl">
              Una experiencia de aprendizaje que convierte dudas en confianza.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="rounded-[1.75rem] border border-[#e5dfd8] bg-white/75 p-6 shadow-sm"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf5f1] text-[#1d4d3f]">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-[#1e2927]">{title}</h3>
                <p className="mt-3 text-base leading-7 text-[#63706b]">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl py-20">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e85d2a]">
              Cómo funciona
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#1e2927] sm:text-4xl">
              Tu tutor personalizado en tres pasos
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {steps.map(({ title, text }) => (
              <div key={title} className="rounded-[1.75rem] border border-[#e5dfd8] bg-[#f8f5f1] p-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#1e2927] text-sm font-semibold text-white">
                  {title.split(".")[0]}
                </div>
                <h3 className="text-xl font-semibold text-[#1e2927]">{title}</h3>
                <p className="mt-3 text-base leading-7 text-[#63706b]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="path" className="mx-auto max-w-6xl py-8">
          <div className="rounded-[2rem] border border-[#e0d8cf] bg-[#1e2927] p-8 text-white shadow-[0_25px_80px_rgba(30,41,39,0.18)] sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f2c9a5]">
                  Rutas de estudio
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Diseñado para acompañar cada nivel escolar.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#dfe9e6]">
                  Desde reforzamiento básico hasta preparación para evaluaciones de nivel preparatoria,
                  el sistema adapta el nivel de dificultad y la forma de explicar.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl bg-white/7 p-4">
                  <TrendingUp className="mb-3 text-[#f2c9a5]" size={22} />
                  <p className="text-lg font-semibold">Nivel inicial</p>
                  <p className="mt-2 text-sm text-[#dfe9e6]">Reconstruye fundamentos y fortalece la base.</p>
                </div>
                <div className="rounded-2xl bg-white/7 p-4">
                  <Target className="mb-3 text-[#f2c9a5]" size={22} />
                  <p className="text-lg font-semibold">Nivel intermedio</p>
                  <p className="mt-2 text-sm text-[#dfe9e6]">Resuelve problemas con mayor autonomía y precisión.</p>
                </div>
                <div className="rounded-2xl bg-white/7 p-4">
                  <GraduationCap className="mb-3 text-[#f2c9a5]" size={22} />
                  <p className="text-lg font-semibold">Nivel avanzado</p>
                  <p className="mt-2 text-sm text-[#dfe9e6]">Prepara evaluaciones y mejora la comprensión profunda.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl pb-10 pt-16">
          <div className="grid gap-5 rounded-[2rem] border border-[#e5dfd8] bg-white/75 p-8 sm:grid-cols-3">
            {stats.map(({ value, label }) => (
              <div key={value} className="rounded-2xl bg-[#f7f4ee] p-5 text-center">
                <p className="text-3xl font-semibold tracking-tight text-[#1e2927]">{value}</p>
                <p className="mt-2 text-sm text-[#63706b]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-[#d9d4cc] py-8 text-sm text-[#63706b] sm:flex-row">
          <p>© 2026 MateSIMCE. Aprender matemáticas con claridad.</p>
          <div className="flex items-center gap-5">
            <a href="#features" className="transition hover:text-[#1e2927]">
              Recursos
            </a>
            <a href="#how-it-works" className="transition hover:text-[#1e2927]">
              Proceso
            </a>
            <a href="#path" className="transition hover:text-[#1e2927]">
              Objetivos
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
