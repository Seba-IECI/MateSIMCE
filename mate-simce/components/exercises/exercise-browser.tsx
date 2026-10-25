"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, BookOpenCheck, LoaderCircle } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

import { getExerciseAction, getExercisesAction, getTopicsAction } from "@/app/exercises-actions";
import { Button } from "@/components/ui/button";
import type { ContentResult, ExerciseDetail, ExercisePage, ExerciseTopic } from "@/lib/exercises/types";

type Failure = Exclude<ContentResult<never>["status"], "ok">;
type View = {
  topics: ExerciseTopic[];
  topicId: string;
  exerciseId: string;
  listing: ExercisePage | null;
  detail: ExerciseDetail | null;
  page: number;
  loading: boolean;
  loaded: boolean;
  imageFailed: boolean;
  error: Failure | null;
};

const initialView: View = {
  topics: [], topicId: "", exerciseId: "", listing: null, detail: null,
  page: 1, loading: true, loaded: false, imageFailed: false, error: null,
};
const card = "rounded-xl border border-[var(--ms-border)] bg-white p-5";
const primary = "bg-[var(--ms-primary)] text-white hover:bg-[var(--ms-primary-hover)]";
const categories: Record<string, string> = {
  numeros: "Números", geometria: "Geometría", algebra_y_funciones: "Álgebra y funciones",
  estadistica_y_probabilidades: "Estadística y probabilidades",
};
const difficultyLabels = { facil: "Fácil", media: "Media", dificil: "Difícil" };
const challengeLabels = { inicial: "Inicial", intermedio: "Intermedio", avanzado: "Avanzado" };
const errorMessages: Record<Failure, string> = {
  unauthenticated: "Tu sesión ya no está disponible. Vuelve a iniciar sesión para continuar.",
  forbidden: "Esta cuenta no tiene acceso al espacio de estudiantes. Contacta a tu docente.",
  unavailable: "No pudimos verificar tu acceso. Inténtalo nuevamente.",
  invalid: "No pudimos abrir el contenido seleccionado. Vuelve a seleccionarlo.",
  not_found: "El ejercicio no está disponible. Puede haber sido retirado de la publicación.",
  course_unavailable: "Los contenidos de Matemática de 2.º medio aún no están disponibles. Contacta a tu docente.",
  course_ambiguous: "No pudimos determinar el curso de Matemática de 2.º medio. La configuración requiere revisión; contacta a tu docente.",
  error: "No pudimos cargar el contenido. Inténtalo nuevamente más tarde.",
};

// Plain text stays escaped by React. Only KaTeX-generated markup becomes HTML.
function MathText({ text }: { text: string }) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g);
  return <span className="whitespace-pre-wrap break-words">{parts.map((part, index) => {
    if (index % 2 === 0) return <span key={index}>{part}</span>;
    const block = (part.startsWith("$$") && part.endsWith("$$")) || (part.startsWith("\\[") && part.endsWith("\\]"));
    const delimiter = block || part.startsWith("\\") ? 2 : 1;
    try {
      const html = katex.renderToString(part.slice(delimiter, -delimiter), {
        displayMode: block, trust: false, throwOnError: true, strict: "error", maxExpand: 200, maxSize: 10,
      });
      return <span key={index} className={block ? "my-3 block max-w-full overflow-x-auto" : ""} dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <span key={index}>{part}</span>;
    }
  })}</span>;
}

export function ExerciseBrowser() {
  const [view, setView] = useState<View>(initialView);
  const sequence = useRef(0);

  useEffect(() => {
    const id = ++sequence.current;
    getTopicsAction().then((result) => {
      if (id !== sequence.current) return;
      setView((current) => result.status === "ok"
        ? { ...current, topics: result.data, loaded: true, loading: false }
        : { ...current, error: result.status, loading: false });
    }).catch(() => {
      if (id === sequence.current) setView((current) => ({ ...current, error: "error", loading: false }));
    });
    return () => { sequence.current += 1; };
  }, []);

  async function request<T>(
    action: () => Promise<ContentResult<T>>,
    start: Partial<View>,
    finish: (data: T) => Partial<View>,
  ) {
    const id = ++sequence.current;
    setView((current) => ({ ...current, ...start, loading: true, error: null }));
    try {
      const result = await action();
      if (id !== sequence.current) return;
      setView((current) => result.status === "ok"
        ? { ...current, ...finish(result.data), loading: false }
        : { ...current, error: result.status, loading: false });
    } catch {
      if (id === sequence.current) setView((current) => ({ ...current, error: "error", loading: false }));
    }
  }

  const loadTopics = () => request(getTopicsAction, {
    topics: [], topicId: "", exerciseId: "", listing: null, detail: null, loaded: false,
  }, (topics) => ({ topics, loaded: true }));
  const selectTopic = (topicId: string, page = 1) => request(() => getExercisesAction(topicId, page), {
    topicId, page, exerciseId: "", listing: null, detail: null,
  }, (listing) => ({ listing }));
  const openExercise = (exerciseId: string) => request(() => getExerciseAction(exerciseId), {
    exerciseId, detail: null, imageFailed: false,
  }, (detail) => ({ detail }));
  const backToList = () => {
    sequence.current += 1;
    setView((current) => ({ ...current, exerciseId: "", detail: null, error: null, loading: false }));
  };
  const retry = () => {
    if (view.error === "course_unavailable" || view.error === "course_ambiguous") return loadTopics();
    if (view.exerciseId) return openExercise(view.exerciseId);
    if (view.topicId) return selectTopic(view.topicId, view.page);
    return loadTopics();
  };
  const denied = view.error === "unauthenticated" || view.error === "forbidden";
  const courseUnavailable = view.error === "course_unavailable" || view.error === "course_ambiguous";
  const topic = view.topics.find((item) => item.id === view.topicId);
  const detail = view.detail;

  return (
    <div className="space-y-5" aria-busy={view.loading} data-cy="exercise-browser">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ejercicios de matemática</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ms-muted)]">Explora los temas disponibles y consulta sus ejercicios publicados.</p>
      </div>

      {view.error && <div role="alert" className="rounded-lg border border-[#e8d3cc] bg-[#fbf2ef] p-4 text-sm leading-6 text-[#8c3f34]">
        <p>{errorMessages[view.error]}</p>
        {denied ? <a href="/login" className="mt-2 inline-block font-medium underline underline-offset-4">Volver al ingreso</a>
          : <Button type="button" variant="outline" className="mt-3" onClick={retry} disabled={view.loading}>Reintentar</Button>}
      </div>}

      {!denied && !courseUnavailable && <>
        {!view.exerciseId && view.loaded && view.topics.length > 0 && <section className={card} aria-labelledby="content-selection-title">
          <h2 id="content-selection-title" className="text-base font-semibold">Contenidos de 2.º medio</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Temas disponibles">
            {view.topics.map((item) => <button type="button" key={item.id} disabled={view.loading} aria-pressed={view.topicId === item.id} data-cy="exercise-topic"
              onClick={() => selectTopic(item.id)} className={"rounded-lg border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ms-primary)] disabled:opacity-60 "
                + (view.topicId === item.id ? "border-[var(--ms-primary)] bg-[var(--ms-tint)]" : "border-[var(--ms-border)] hover:bg-[var(--ms-background)]")}>
              <span className="text-[11px] text-[var(--ms-primary-hover)]">{categories[item.category] ?? "Contenido matemático"}</span>
              <span className="mt-1 block text-sm font-medium">{item.name}</span>
              {item.description && <span className="mt-2 block text-xs leading-5 text-[var(--ms-muted)]">{item.description}</span>}
            </button>)}
          </div>
        </section>}

        {view.loading && <p role="status" className="flex items-center gap-2 text-sm text-[var(--ms-muted)]"><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Cargando contenido…</p>}

        {!view.loading && !view.error && view.loaded && view.topics.length === 0 && <div className={card} role="status">
          <h2 className="font-medium">Todavía no hay temas disponibles para 2.º medio</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ms-muted)]">Los contenidos aparecerán aquí cuando estén habilitados.</p>
        </div>}

        {!view.exerciseId && view.listing && <section className={card} aria-labelledby="exercise-list-title">
          <h2 id="exercise-list-title" className="text-base font-semibold">{topic?.name ?? "Ejercicios publicados"}</h2>
          {view.listing.exercises.length === 0 ? <div role="status" className="mt-4 rounded-lg bg-[var(--ms-background)] p-5">
            <BookOpenCheck size={22} className="text-[var(--ms-primary)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">Todavía no hay ejercicios publicados para este tema</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ms-muted)]">Puedes consultar otro tema. Aquí aparecerán los ejercicios cuando estén disponibles.</p>
          </div> : <ul className="mt-4 divide-y divide-[var(--ms-border)]">
            {view.listing.exercises.map((exercise) => <li key={exercise.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium"><MathText text={exercise.title} /></h3>
                <p className="mt-1 text-xs text-[var(--ms-muted)]">{exercise.topicName}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--ms-muted)]">Dificultad {difficultyLabels[exercise.difficulty].toLowerCase()} · Desafío {challengeLabels[exercise.challenge].toLowerCase()}
                  {exercise.estimatedSeconds !== null && <> · {Math.ceil(exercise.estimatedSeconds / 60)} min aprox.</>}</p>
              </div>
              <Button type="button" className={primary} disabled={view.loading} onClick={() => openExercise(exercise.id)} data-cy="exercise-open">Ver ejercicio</Button>
            </li>)}
          </ul>}
          {(view.page > 1 || view.listing.hasNext) && <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--ms-border)] pt-4">
            <Button type="button" variant="outline" disabled={view.loading || view.page === 1} onClick={() => selectTopic(view.topicId, view.page - 1)}>Anterior</Button>
            <span className="text-xs text-[var(--ms-muted)]">Página {view.page}</span>
            <Button type="button" variant="outline" disabled={view.loading || !view.listing.hasNext} onClick={() => selectTopic(view.topicId, view.page + 1)}>Siguiente</Button>
          </div>}
        </section>}

        {view.exerciseId && <Button type="button" variant="outline" onClick={backToList}><ArrowLeft aria-hidden="true" />Volver al listado</Button>}
        {detail && <article className={card} aria-labelledby="exercise-detail-title">
          <p className="text-xs text-[var(--ms-primary-hover)]">{detail.topicName}</p>
          <h2 id="exercise-detail-title" className="mt-2 text-xl font-semibold"><MathText text={detail.title} /></h2>
          <p className="mt-3 text-xs leading-5 text-[var(--ms-muted)]">Dificultad {difficultyLabels[detail.difficulty].toLowerCase()} · Desafío {challengeLabels[detail.challenge].toLowerCase()}
            {detail.estimatedSeconds !== null && <> · {Math.ceil(detail.estimatedSeconds / 60)} min aprox.</>}</p>
          <div className="mt-6 max-w-3xl text-base leading-8" data-cy="exercise-statement"><MathText text={detail.statement} /></div>
          {detail.instructions && <section className="mt-5 rounded-lg bg-[var(--ms-tint)] p-4">
            <h3 className="text-sm font-medium">Instrucciones</h3>
            <div className="mt-2 text-sm leading-7 text-[var(--ms-muted)]"><MathText text={detail.instructions} /></div>
          </section>}
          {detail.imageUrl && !view.imageFailed && <Image src={detail.imageUrl} alt="Imagen de apoyo del ejercicio" unoptimized width={960} height={540}
            className="mt-5 max-h-96 w-full rounded-lg object-contain" onError={() => setView((current) => ({ ...current, imageFailed: true }))} />}
          {(detail.imageUnavailable || view.imageFailed) && <p className="mt-5 text-sm text-[var(--ms-muted)]">La imagen de apoyo no está disponible.</p>}
          {detail.responseType === "opcion_multiple" && <section className="mt-6" aria-labelledby="exercise-choices-title">
            <h3 id="exercise-choices-title" className="text-sm font-medium">Alternativas</h3>
            {detail.choices ? <ol className="mt-3 space-y-3">{detail.choices.map((choice, index) => <li key={index} className="flex gap-3 rounded-lg border border-[var(--ms-border)] p-4 text-sm leading-6">
              <span className="font-medium text-[var(--ms-primary-hover)]">{index + 1}.</span><MathText text={choice} />
            </li>)}</ol> : <p className="mt-3 text-sm leading-6 text-[var(--ms-muted)]">Las alternativas de este ejercicio aún no están disponibles para consulta.</p>}
          </section>}
          <p className="mt-6 border-t border-[var(--ms-border)] pt-4 text-xs leading-5 text-[var(--ms-muted)]">Vista de consulta. La resolución y el envío de respuestas todavía no están disponibles.</p>
        </article>}
      </>}
    </div>
  );
}
