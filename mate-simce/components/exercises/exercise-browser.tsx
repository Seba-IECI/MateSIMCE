"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, BookOpenCheck, LoaderCircle } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

import { checkExerciseAnswerAction, getExerciseAction, getExercisesAction, getPracticeDiagnosisAction, getTopicsAction, getTutorFeedbackAction } from "@/app/exercises-actions";
import { Button } from "@/components/ui/button";
import type { ContentResult, ExerciseFeedback, ExercisePage, ExerciseTopic, PracticeExercise, TutorFeedback, TutorHelpKind } from "@/lib/exercises/types";
import type { AxisDiagnosis } from "@/lib/exercises/progress";

type Failure = Exclude<ContentResult<never>["status"], "ok">;
type View = {
  topics: ExerciseTopic[];
  topicId: string;
  exerciseId: string;
  listing: ExercisePage | null;
  detail: PracticeExercise | null;
  page: number;
  loading: boolean;
  loaded: boolean;
  imageFailed: boolean;
  error: Failure | null;
  selectedChoice: number | null;
  checking: boolean;
  feedback: ExerciseFeedback | null;
  answerError: string | null;
  tutorKind: TutorHelpKind | null;
  tutorReplies: Partial<Record<TutorHelpKind, TutorFeedback>>;
  tutorLoading: boolean;
  tutorError: string | null;
  diagnosis: AxisDiagnosis[] | null;
  diagnosisLoading: boolean;
  diagnosisError: boolean;
};

const initialView: View = {
  topics: [], topicId: "", exerciseId: "", listing: null, detail: null,
  page: 1, loading: true, loaded: false, imageFailed: false, error: null,
  selectedChoice: null, checking: false, feedback: null, answerError: null,
  tutorKind: null, tutorReplies: {}, tutorLoading: false, tutorError: null,
  diagnosis: null, diagnosisLoading: true, diagnosisError: false,
};
const card = "rounded-xl border border-[var(--ms-border)] bg-white p-5";
const primary = "bg-[var(--ms-primary)] text-white hover:bg-[var(--ms-primary-hover)]";
const categories: Record<string, string> = {
  numeros: "Números", geometria: "Geometría", algebra_y_funciones: "Álgebra y funciones",
  estadistica_y_probabilidades: "Estadística y probabilidades",
};
const difficultyLabels = { facil: "Fácil", media: "Media", dificil: "Difícil" };
const challengeLabels = { inicial: "Inicial", intermedio: "Intermedio", avanzado: "Avanzado" };
const tutorOptions: Array<{ kind: TutorHelpKind; label: string }> = [
  { kind: "hint", label: "Dame una pista" },
  { kind: "error", label: "Explica mi error" },
  { kind: "procedure", label: "Muéstrame el procedimiento" },
];
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
  const diagnosisSequence = useRef(0);
  const tutorPending = useRef<number | null>(null);

  useEffect(() => {
    const id = ++sequence.current;
    const diagnosisId = ++diagnosisSequence.current;
    getPracticeDiagnosisAction().then((result) => {
      if (diagnosisId !== diagnosisSequence.current) return;
      setView((current) => ({ ...current, diagnosisLoading: false, diagnosisError: result.status !== "ok",
        diagnosis: result.status === "ok" ? result.data : null }));
    }).catch(() => {
      if (diagnosisId === diagnosisSequence.current) setView((current) => ({ ...current, diagnosisLoading: false, diagnosisError: true }));
    });
    getTopicsAction().then((result) => {
      if (id !== sequence.current) return;
      setView((current) => result.status === "ok"
        ? { ...current, topics: result.data, loaded: true, loading: false }
        : { ...current, error: result.status, loading: false });
    }).catch(() => {
      if (id === sequence.current) setView((current) => ({ ...current, error: "error", loading: false }));
    });
    return () => { sequence.current += 1; diagnosisSequence.current += 1; };
  }, []);

  async function refreshDiagnosis() {
    const id = ++diagnosisSequence.current;
    setView((current) => ({ ...current, diagnosisLoading: true, diagnosisError: false }));
    try {
      const result = await getPracticeDiagnosisAction();
      if (id !== diagnosisSequence.current) return;
      setView((current) => ({ ...current, diagnosisLoading: false, diagnosisError: result.status !== "ok",
        diagnosis: result.status === "ok" ? result.data : null }));
    } catch {
      if (id === diagnosisSequence.current) setView((current) => ({ ...current, diagnosisLoading: false, diagnosisError: true, diagnosis: null }));
    }
  }

  async function request<T>(
    action: () => Promise<ContentResult<T>>,
    start: Partial<View>,
    finish: (data: T) => Partial<View>,
  ) {
    const id = ++sequence.current;
    setView((current) => ({ ...current, ...start, loading: true, error: null,
      selectedChoice: null, checking: false, feedback: null, answerError: null,
      tutorKind: null, tutorReplies: {}, tutorLoading: false, tutorError: null }));
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
    setView((current) => ({ ...current, exerciseId: "", detail: null, error: null, loading: false,
      selectedChoice: null, checking: false, feedback: null, answerError: null,
      tutorKind: null, tutorReplies: {}, tutorLoading: false, tutorError: null }));
  };
  async function checkAnswer() {
    if (!view.detail || view.checking || view.feedback) return;
    if (view.selectedChoice === null) {
      setView((current) => ({ ...current, answerError: "Selecciona una alternativa antes de comprobar tu respuesta." }));
      return;
    }
    const id = ++sequence.current;
    setView((current) => ({ ...current, checking: true, answerError: null }));
    try {
      const result = await checkExerciseAnswerAction(view.detail.id, view.selectedChoice, view.detail.attemptId);
      // A save can complete while the student returns to the list; refresh the summary in either case.
      if (result.status === "ok") void refreshDiagnosis();
      if (id !== sequence.current) return;
      if (result.status === "ok") {
        setView((current) => ({ ...current, checking: false, feedback: result.data }));
      } else if (result.status === "unauthenticated" || result.status === "forbidden" || result.status === "not_found") {
        setView((current) => ({ ...current, checking: false, detail: null, error: result.status }));
      } else {
        setView((current) => ({ ...current, checking: false,
          answerError: "No pudimos comprobar la respuesta. Inténtalo nuevamente; si el problema continúa, contacta a tu docente." }));
      }
    } catch {
      if (id === sequence.current) setView((current) => ({ ...current, checking: false,
        answerError: "No pudimos conectar para comprobar la respuesta. Inténtalo nuevamente." }));
    }
  }
  async function askTutor(kind: TutorHelpKind) {
    if (!view.detail || !view.feedback || view.feedback.attemptId !== view.detail.attemptId
      || tutorPending.current === sequence.current) return;
    if (view.tutorReplies[kind]) {
      setView((current) => ({ ...current, tutorKind: kind, tutorError: null }));
      return;
    }
    const id = sequence.current;
    const attemptId = view.feedback.attemptId;
    const exerciseId = view.detail.id;
    tutorPending.current = id;
    setView((current) => ({ ...current, tutorKind: kind, tutorLoading: true, tutorError: null }));
    try {
      const result = await getTutorFeedbackAction(attemptId, kind);
      // Retry, navigation or unmount invalidates both the request and any cached help.
      if (id !== sequence.current) return;
      if (result.status === "ok" && result.data.attemptId === attemptId && result.data.exerciseId === exerciseId && result.data.kind === kind) {
        setView((current) => ({ ...current, tutorLoading: false, tutorReplies: { ...current.tutorReplies, [kind]: result.data } }));
      } else if (result.status === "unauthenticated" || result.status === "forbidden") {
        setView((current) => ({ ...current, detail: null, feedback: null, error: result.status,
          tutorLoading: false, tutorReplies: {}, tutorError: null }));
      } else {
        setView((current) => ({ ...current, tutorLoading: false, tutorError: "No hay orientación verificada disponible para este intento. Puedes volver a intentarlo o consultar a tu docente." }));
      }
    } catch {
      if (id === sequence.current) setView((current) => ({ ...current, tutorLoading: false,
        tutorError: "No pudimos cargar la ayuda. Inténtalo nuevamente." }));
    } finally {
      if (tutorPending.current === id) tutorPending.current = null;
    }
  }
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
  const tutorReply = view.tutorKind ? view.tutorReplies[view.tutorKind] : undefined;
  const canAnswer = detail?.responseType === "opcion_multiple" && detail.choices?.length === 4
    && detail.choices.every((choice) => choice.trim()) && new Set(detail.choices).size === 4;

  return (
    <div className="space-y-5" aria-busy={view.loading || view.checking || view.tutorLoading} data-cy="exercise-browser">
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
        <section className={card} aria-labelledby="practice-diagnosis-title" data-cy="practice-diagnosis" aria-busy={view.diagnosisLoading}>
          <h2 id="practice-diagnosis-title" className="text-base font-semibold">Resumen de tu práctica</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--ms-muted)]">Intentos corregidos en los ejercicios disponibles de 2.º medio. Reabrir un ejercicio permite un intento nuevo; reenviar el mismo intento no vuelve a contarlo.</p>
          {view.diagnosisLoading && <p role="status" className="mt-3 text-sm text-[var(--ms-muted)]">Actualizando resumen…</p>}
          {view.diagnosisError && <div role="alert" className="mt-3 text-sm text-[#8c3f34]">
            <p>No pudimos consultar tu resumen. Puedes seguir practicando y volver a intentarlo.</p>
            <Button type="button" variant="outline" className="mt-2" onClick={refreshDiagnosis} disabled={view.diagnosisLoading}>Actualizar resumen</Button>
          </div>}
          {view.diagnosis && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{view.diagnosis.map((axis) => <div key={axis.category}
            className="rounded-lg border border-[var(--ms-border)] p-4" data-cy="practice-axis" data-category={axis.category}>
            <h3 className="text-sm font-medium">{axis.name}</h3>
            <p className="mt-3 text-sm"><span data-cy="practice-attempts">{axis.attempts}</span> intentos · {axis.correct} aciertos</p>
            <p className="mt-2 font-semibold text-[var(--ms-primary-hover)]">{axis.accuracy === null ? "Sin intentos" : `${axis.accuracy} % de aciertos`}</p>
            <p className="mt-3 text-xs leading-5 text-[var(--ms-muted)]">{axis.recommendation}</p>
          </div>)}</div>}
          <p className="mt-4 text-xs leading-5 text-[var(--ms-muted)]">Orientación básica de práctica; no equivale a un puntaje SIMCE ni a un diagnóstico completo del aprendizaje.</p>
        </section>
        {!view.exerciseId && view.loaded && view.topics.length > 0 && <section className={card} aria-labelledby="content-selection-title">
          <h2 id="content-selection-title" className="text-base font-semibold">Contenidos de 2.º medio</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Temas disponibles">
            {view.topics.map((item) => <button type="button" key={item.id} disabled={view.loading} aria-pressed={view.topicId === item.id} data-cy="exercise-topic" data-category={item.category}
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
            {detail.choices ? <fieldset disabled={view.checking || Boolean(view.feedback)} className="mt-3">
              <legend className="sr-only">Selecciona una alternativa</legend>
              <ol className="space-y-3">{detail.choices.map((choice, index) => <li key={index}>
                <label className={"flex gap-3 rounded-lg border p-4 text-sm leading-6 "
                  + (view.selectedChoice === index ? "border-[var(--ms-primary)] bg-[var(--ms-tint)]" : "border-[var(--ms-border)]")
                  + (canAnswer ? " cursor-pointer" : "")}>
                  {canAnswer && <input type="radio" name="exercise-choice" value={index} checked={view.selectedChoice === index}
                    className="mt-1 size-4 shrink-0 accent-[var(--ms-primary)]" aria-describedby={view.answerError ? "answer-error" : undefined}
                    onChange={() => setView((current) => ({ ...current, selectedChoice: index, answerError: null }))} />}
                  <span className="font-medium text-[var(--ms-primary-hover)]">{index + 1}.</span><MathText text={choice} />
                </label>
              </li>)}</ol>
            </fieldset> : <p className="mt-3 text-sm leading-6 text-[var(--ms-muted)]">Las alternativas de este ejercicio aún no están disponibles para consulta.</p>}
          </section>}
          {canAnswer ? <div className="mt-6 border-t border-[var(--ms-border)] pt-4">
            {view.answerError && <p id="answer-error" role="alert" className="mb-3 text-sm text-[#8c3f34]">{view.answerError}</p>}
            <Button type="button" className={primary} disabled={view.checking || Boolean(view.feedback)}
              onClick={() => startTransition(checkAnswer)} data-cy="exercise-check">
              {view.checking && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {view.checking ? "Comprobando…" : view.feedback ? "Respuesta comprobada" : "Comprobar respuesta"}
            </Button>
            {view.checking && <p role="status" className="mt-3 text-sm text-[var(--ms-muted)]">Estamos comprobando tu respuesta.</p>}
            {view.feedback && <section role="status" aria-live="polite" aria-labelledby="answer-feedback-title" data-cy="exercise-feedback"
              className="mt-5 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-tint)] p-5">
              <h3 id="answer-feedback-title" className="font-semibold">{view.feedback.correct ? "Respuesta correcta" : "Respuesta incorrecta"}</h3>
              <p className="mt-2 text-sm font-medium">Tu respuesta quedó guardada.</p>
              <p className="mt-2 text-sm text-[var(--ms-muted)]">Revisa el desarrollo. Puedes volver a intentar este ejercicio o regresar al listado.</p>
              <div className="mt-4 text-sm leading-8"><MathText text={view.feedback.explanation} /></div>
              <Button type="button" variant="outline" className="mt-4" disabled={view.loading || view.checking}
                onClick={() => openExercise(detail.id)} data-cy="exercise-retry">Volver a intentar</Button>
            </section>}
            {view.feedback && <section className="mt-5 rounded-lg border border-[var(--ms-border)] p-5" aria-labelledby="exercise-tutor-title" data-cy="exercise-tutor" aria-busy={view.tutorLoading}>
              <h3 id="exercise-tutor-title" className="font-semibold">Tutor MateSIMCE</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--ms-muted)]">Apoyo guiado con el contenido revisado de este ejercicio.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {tutorOptions.map(({ kind, label }) => <Button key={kind} type="button" variant="outline" disabled={view.tutorLoading}
                  aria-pressed={view.tutorKind === kind} data-cy={`tutor-${kind}`}
                  className={view.tutorKind === kind ? "border-[var(--ms-primary)] bg-[var(--ms-tint)] text-[var(--ms-primary-hover)]" : ""}
                  onClick={() => startTransition(() => askTutor(kind))}>{label}</Button>)}
              </div>
              {view.tutorLoading && <p role="status" className="mt-4 text-sm text-[var(--ms-muted)]">Preparando la ayuda…</p>}
              {view.tutorError && <p role="alert" className="mt-4 text-sm text-[#8c3f34]">{view.tutorError}</p>}
              {!view.tutorLoading && !view.tutorError && tutorReply && <div className="mt-4 border-t border-[var(--ms-border)] pt-4" role="status" aria-live="polite" data-cy="tutor-response">
                <h4 className="text-sm font-medium">{tutorReply.title}</h4>
                <div className="mt-3 text-sm leading-8"><MathText text={tutorReply.text} /></div>
              </div>}
            </section>}
          </div> : <p className="mt-6 border-t border-[var(--ms-border)] pt-4 text-xs leading-5 text-[var(--ms-muted)]">Vista de consulta. La corrección de este formato todavía no está disponible.</p>}
        </article>}
      </>}
    </div>
  );
}
