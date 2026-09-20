import { ArrowRight, BrainCircuit } from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[#f7f4ee] px-6 py-12 text-[#1e2927]">
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#d8e7dc] opacity-70" />
      <div className="absolute -bottom-48 -left-24 h-96 w-96 rounded-full bg-[#f2c9a5] opacity-60" />
      <section className="relative mx-auto w-full max-w-4xl">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e85d2a] text-white">
              <BrainCircuit size={20} aria-hidden="true" />
            </span>
            MateSIMCE
          </div>
          <span className="text-sm text-[#63706b]">Tutor de matematica</span>
        </nav>

        <div className="max-w-2xl py-28 sm:py-36">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#e85d2a]">
            Aprende resolviendo
          </p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-7xl">
            Entiende las matematicas, paso a paso.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-[#63706b]">
            MateSIMCE te acompana con orientacion clara para resolver ejercicios,
            detectar errores y ganar confianza.
          </p>
          <button className="mt-9 inline-flex items-center gap-3 rounded-full bg-[#1e2927] px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
            Comenzar a practicar
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-[#63706b]">Una herramienta de apoyo para estudiantes de preparatoria.</p>
      </section>
    </main>
  );
}
