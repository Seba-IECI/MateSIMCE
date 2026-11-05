"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { finishExamAction, resumeExamAction, saveExamAnswerAction, startExamAction } from "@/app/exam-actions";
import { MathText } from "./exercise-browser";
import { Button } from "@/components/ui/button";
import { examAxes, type ExamAttempt, type ExamResponse } from "@/lib/exams/types";

const card = "rounded-xl border border-[var(--ms-border)] bg-white p-5";
const primary = "bg-[var(--ms-primary)] text-white hover:bg-[var(--ms-primary-hover)]";
const messages: Record<Exclude<ExamResponse["status"], "ok">, string> = {
  unauthenticated: "Tu sesión expiró. Vuelve a iniciar sesión.",
  forbidden: "Esta cuenta no tiene acceso a los ensayos de estudiantes.",
  unavailable: "No pudimos verificar tu acceso. Inténtalo nuevamente.",
  configuration_required: "El ensayo requiere habilitación en Supabase. Contacta al responsable de MateSIMCE.",
  content_unavailable: "No hay suficientes preguntas verificadas disponibles: se necesitan tres por cada eje.",
  not_found: "El intento o la pregunta no están disponibles para esta cuenta.",
  invalid: "No pudimos guardar la operación. Recarga el intento y vuelve a probar.",
  error: "No pudimos completar la operación. Tu selección anterior se conserva; vuelve a intentarlo.",
};

export function ExamBrowser({ onHome }: { onHome: () => void }) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [position, setPosition] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const locked = useRef(false);
  const sequence = useRef(0);

  useEffect(() => {
    const id = ++sequence.current;
    resumeExamAction().then((result) => {
      if (id !== sequence.current) return;
      if (result.status === "ok") setAttempt(result.data);
      else setError(messages[result.status]);
      setBusy(false);
    }).catch(() => {
      if (id === sequence.current) { setError(messages.error); setBusy(false); }
    });
    return () => { sequence.current += 1; };
  }, []);

  async function run(action: () => Promise<ExamResponse>, resetPosition = false) {
    if (locked.current || busy) return;
    locked.current = true;
    const id = ++sequence.current;
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (id !== sequence.current) return;
      if (result.status === "ok") {
        setAttempt(result.data);
        setConfirming(false);
        if (resetPosition) setPosition(0);
      } else setError(messages[result.status]);
    } catch {
      if (id === sequence.current) setError(messages.error);
    } finally {
      locked.current = false;
      if (id === sequence.current) setBusy(false);
    }
  }

  const question = attempt?.questions[position];
  const answered = attempt?.questions.filter((q) => q.selectedIndex !== null).length ?? 0;
  const completed = attempt?.state === "completado";

  return <section data-cy="exam-browser" aria-busy={busy} className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Ensayo tipo SIMCE</h1>
        <p className="mt-2 text-sm text-[var(--ms-muted)]">Matemática de II medio · 12 preguntas · tres por eje</p></div>
      <Button variant="outline" disabled={busy} onClick={onHome}>Volver al inicio</Button>
    </div>
    {busy && <p role="status" className="text-sm">{attempt ? "Guardando y recuperando el intento… No recargues hasta que termine." : "Cargando ensayo…"}</p>}
    {error && <div role="alert" className={card}><p>{error}</p>
      <Button className="mt-3" variant="outline" disabled={busy} onClick={() => startTransition(() => { void run(() => resumeExamAction(attempt?.id ?? null)); })}>Recuperar intento</Button>
      {error === messages.unauthenticated && <a className="ml-4 underline" href="/login">Iniciar sesión</a>}
    </div>}
    {!attempt && !busy && <div className={card}>
      <h2 className="text-lg font-semibold">Practica una evaluación breve</h2>
      <p className="mt-3 text-sm leading-6">Responde una pregunta a la vez. Puedes avanzar, regresar y cambiar tus alternativas antes de finalizar. Cada selección se guarda en tu cuenta; al regresar al módulo recuperarás el intento.</p>
      <p className="mt-3 text-sm leading-6">Las preguntas pendientes se cuentan como sin responder. Los aciertos se calculan sobre las 12 preguntas. Las soluciones y el tutor permanecen ocultos durante el ensayo.</p>
      <p className="mt-3 text-sm text-[var(--ms-muted)]">Es una práctica educativa, sin puntaje ni equivalencia oficial SIMCE. No tiene límite de tiempo.</p>
      <Button data-cy="exam-start" className={primary + " mt-5"} disabled={Boolean(error)} onClick={() => startTransition(() => { void run(startExamAction, true); })}>Comenzar ensayo</Button>
    </div>}

    {attempt?.state === "completado" && <section className={card} data-cy="exam-results" aria-labelledby="exam-results-title">
      <h2 id="exam-results-title" className="text-xl font-semibold">Resultados del ensayo</h2>
      <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        {[["Preguntas", attempt.result.total], ["Respondidas", attempt.result.answered], ["Correctas", attempt.result.correct], ["Incorrectas", attempt.result.incorrect], ["Sin responder", attempt.result.unanswered], ["Aciertos", `${attempt.result.accuracy} %`]].map(([label, value]) => <div key={label}>
          <dt className="text-xs text-[var(--ms-muted)]">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd>
        </div>)}
      </dl>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{attempt.result.axes.map((axis) => <div className="rounded-lg border border-[var(--ms-border)] p-3" key={axis.category}>
        <h3 className="text-sm font-semibold">{axis.name}</h3>
        <p className="mt-1 text-sm">{axis.correct} de {axis.total} correctas · {axis.accuracy} %</p>
        <p className="mt-1 text-xs text-[var(--ms-muted)]">{axis.incorrect} incorrectas · {axis.unanswered} sin responder</p>
      </div>)}</div>
      <p className="mt-4 text-sm leading-6">{attempt.result.interpretation}</p>
      <p className="mt-2 text-xs text-[var(--ms-muted)]">La práctica individual y su diagnóstico se mantienen separados de este ensayo.</p>
      <Button disabled={busy} className={primary + " mt-4"} onClick={() => startTransition(() => { void run(startExamAction, true); })}>Comenzar otro ensayo</Button>
    </section>}

    {attempt && question && <>
      <div className={card}>
        <h2 className="font-semibold">{completed ? "Revisión de preguntas" : "Tu avance"}</h2>
        <p className="mt-2 text-sm">{answered} de 12 respondidas. {completed ? "Intento finalizado: las respuestas no pueden modificarse." : "Puedes cambiar una alternativa hasta finalizar."}</p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Preguntas del ensayo">
          {attempt.questions.map((q, i) => <button data-cy="exam-question-nav" key={q.id} type="button" disabled={busy}
            aria-label={`Pregunta ${q.number}, ${q.selectedIndex === null ? "pendiente" : "respondida"}`} aria-current={position === i ? "step" : undefined}
            onClick={() => { setPosition(i); setConfirming(false); }}
            className={"h-10 w-10 rounded-md border text-sm " + (position === i ? "border-[var(--ms-primary)] ring-2 ring-[var(--ms-primary)] " : "border-[var(--ms-border)] ") + (q.selectedIndex === null ? "bg-white" : "bg-[var(--ms-tint)] font-semibold")}>{q.number}</button>)}
        </div>
      </div>
      <article className={card} data-cy="exam-question">
        <p className="text-xs font-medium text-[var(--ms-primary-hover)]">{examAxes[question.category]}</p>
        <h2 className="mt-2 font-semibold">Pregunta {question.number} de 12</h2>
        <div className="mt-4 text-sm leading-7"><MathText text={question.statement} /></div>
        <fieldset disabled={busy || completed} className="mt-5 space-y-3"><legend className="mb-3 text-sm font-medium">Selecciona una alternativa</legend>
          {question.choices.map((choice, i) => <label key={i} className={"flex items-start gap-3 rounded-lg border p-3 text-sm " + (question.selectedIndex === i ? "border-[var(--ms-primary)] bg-[var(--ms-tint)]" : "border-[var(--ms-border)]")}>
            <input data-cy="exam-choice" type="radio" name={question.id} value={i} checked={question.selectedIndex === i}
              onChange={() => startTransition(() => { void run(() => saveExamAnswerAction(attempt.id, question.id, i)); })} />
            <span className="font-medium">{String.fromCharCode(65 + i)}.</span><MathText text={choice} />
          </label>)}
        </fieldset>
        {attempt.state === "completado" && <div data-cy="exam-review" className="mt-5 rounded-lg bg-[var(--ms-background)] p-4 text-sm leading-7">
          <p className="font-semibold">{question.selectedIndex === null ? "Sin responder" : question.selectedIndex === attempt.questions[position].correctIndex ? "Respuesta correcta" : "Respuesta incorrecta"}</p>
          <p>Alternativa correcta: {String.fromCharCode(65 + attempt.questions[position].correctIndex)}. <MathText text={question.choices[attempt.questions[position].correctIndex]} /></p>
          <div className="mt-3"><MathText text={attempt.questions[position].explanation} /></div>
        </div>}
        <div className="mt-5 flex justify-between gap-3">
          <Button variant="outline" disabled={busy || position === 0} onClick={() => { setPosition(position - 1); setConfirming(false); }}>Anterior</Button>
          <Button variant="outline" disabled={busy || position === 11} onClick={() => { setPosition(position + 1); setConfirming(false); }}>Siguiente</Button>
        </div>
      </article>
      {!completed && <div className={card}>
        {!confirming ? <Button data-cy="exam-finish" disabled={busy} className={primary} onClick={() => setConfirming(true)}>Finalizar ensayo</Button>
          : <div role="group" aria-label="Confirmar finalización">
            <p className="text-sm leading-6">Quedan {12 - answered} preguntas sin responder. Al finalizar no podrás modificar tus respuestas. ¿Deseas continuar?</p>
            <div className="mt-3 flex gap-3"><Button data-cy="exam-confirm" disabled={busy} className={primary} onClick={() => startTransition(() => { void run(() => finishExamAction(attempt.id)); })}>Confirmar y finalizar</Button>
              <Button disabled={busy} variant="outline" onClick={() => setConfirming(false)}>Seguir respondiendo</Button></div>
          </div>}
      </div>}
    </>}
  </section>;
}
