"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { finishExamAction, getExamTutorFeedbackAction, resumeExamAction, saveExamAnswerAction, startExamAction } from "@/app/exam-actions";
import { MathText } from "./exercise-browser";
import { Button } from "@/components/ui/button";
import { examAxes, type ExamAttempt, type ExamResponse, type ExamTutorFeedback } from "@/lib/exams/types";

const card = "ms-card p-5";
const primary = "bg-[var(--ms-primary)] text-[var(--ms-on-primary)] hover:bg-[var(--ms-primary-hover)]";
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
  const [opened, setOpened] = useState(false);
  const [position, setPosition] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const locked = useRef(false);
  const sequence = useRef(0);
  const [help, setHelp] = useState<Record<string, ExamTutorFeedback>>({});
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState<{ questionId: string; message: string } | null>(null);
  const helpSequence = useRef(0);
  const helpPending = useRef<number | null>(null);

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
    return () => { sequence.current += 1; helpSequence.current += 1; };
  }, []);

  async function run(action: () => Promise<ExamResponse>, resetPosition = false, openAttempt = false) {
    if (locked.current || busy) return;
    locked.current = true;
    helpSequence.current += 1;
    helpPending.current = null;
    setHelpLoading(false);
    setHelpError(null);
    if (resetPosition) setHelp({});
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
        if (openAttempt && result.data) setOpened(true);
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

  async function explainQuestion() {
    if (!attempt || attempt.state !== "completado" || !question || help[question.id] || helpPending.current !== null) return;
    const id = ++helpSequence.current;
    const questionId = question.id;
    const attemptId = attempt.id;
    helpPending.current = id;
    setHelpLoading(true);
    setHelpError(null);
    try {
      const result = await getExamTutorFeedbackAction(attemptId, questionId);
      if (id !== helpSequence.current) return;
      if (result.status === "ok" && result.data.questionId === questionId && result.data.attemptId === attemptId) {
        setHelp((previous) => ({ ...previous, [questionId]: result.data }));
      } else setHelpError({ questionId, message: "No pudimos recuperar la ayuda para esta pregunta. El desarrollo verificado sigue disponible." });
    } catch {
      if (id === helpSequence.current) setHelpError({ questionId, message: "No pudimos conectar con el tutor. Puedes consultar el desarrollo verificado." });
    } finally {
      if (id === helpSequence.current) { helpPending.current = null; setHelpLoading(false); }
    }
  }

  return <section data-cy="exam-browser" aria-busy={busy} className="ms-enter space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Ensayo tipo SIMCE</h1><p className="mt-1 text-sm text-[var(--ms-muted)]">12 preguntas · tres por eje · sin puntaje oficial</p></div>
      <Button variant="outline" disabled={busy} onClick={onHome}>Volver al inicio</Button>
    </div>
    {busy && <p role="status" className="text-sm text-[var(--ms-muted)]">{attempt ? "Guardando el intento… Espera antes de recargar." : "Recuperando tu ensayo…"}</p>}
    {error && <div role="alert" className={card}><p className="text-[var(--ms-danger)]">{error}</p><Button className="mt-3" variant="outline" disabled={busy} onClick={() => startTransition(() => { void run(() => resumeExamAction(attempt?.id ?? null)); })}>Recuperar intento</Button>{error === messages.unauthenticated && <a className="ml-4 underline" href="/login">Iniciar sesión</a>}</div>}
    {!opened && <div data-cy="exam-preparation" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><div className={card}>
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ms-primary)]">Una práctica, cuatro ejes</span><h2 className="mt-3 text-xl font-semibold">Pon a prueba lo que has aprendido</h2>
      <ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--ms-muted)]"><li>Responde 12 preguntas, tres de cada eje de Matemática de II medio.</li><li>Cada alternativa se guarda en tu cuenta. Puedes avanzar, regresar y modificarla antes de finalizar.</li><li>Las preguntas pendientes se cuentan como sin responder. El porcentaje de aciertos considera las 12 preguntas.</li><li>Las respuestas correctas, los procedimientos y el tutor se habilitan solo al finalizar.</li></ul>
      <p className="mt-5 text-xs text-[var(--ms-muted)]">Sin límite de tiempo. Esta práctica no equivale a una evaluación ni a un puntaje oficial SIMCE.</p>
      {attempt?.state === "en_curso" ? <Button data-cy="exam-continue" className={primary + " mt-5"} disabled={busy || Boolean(error)} onClick={() => startTransition(() => { void run(() => resumeExamAction(attempt.id), true, true); })}>Continuar ensayo</Button> : <Button data-cy="exam-start" className={primary + " mt-5"} disabled={busy || Boolean(error)} onClick={() => startTransition(() => { void run(startExamAction, true, true); })}>Comenzar ensayo</Button>}
    </div><aside className={card} aria-label="Estado del ensayo">
      <h2 className="font-semibold">{busy ? "Consultando tu ensayo" : error ? "Estado no disponible" : attempt?.state === "en_curso" ? "Tienes un ensayo en curso" : "Listo para comenzar"}</h2>
      {!busy && !error && <><p data-cy="exam-preparation-progress" className="mt-3 text-sm text-[var(--ms-muted)]">{attempt?.state === "en_curso" ? `${answered} de 12 respondidas` : "Nuevo ensayo: 0 de 12 respondidas"}</p><p className="mt-3 text-xs leading-6 text-[var(--ms-muted)]">{attempt?.state === "en_curso" ? "Continuar conserva tus preguntas y las respuestas guardadas. No crea otro intento." : "Cuatro ejes matemáticos. Tres preguntas por eje. Tus selecciones se guardarán al responder."}</p>
      {completed && <Button variant="outline" className="mt-4" onClick={() => { setPosition(0); setOpened(true); }}>Ver últimos resultados</Button>}</>}
    </aside></div>}
    {opened && attempt?.state === "completado" && <section className={card} data-cy="exam-results" aria-labelledby="exam-results-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="exam-results-title" className="text-xl font-semibold">Resultados del ensayo</h2><Button disabled={busy} className={primary} onClick={() => { setOpened(false); setConfirming(false); }}>Preparar otro ensayo</Button></div>
      <div className="mt-5 grid items-center gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative mx-auto grid size-40 place-items-center"><svg viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="none" stroke="var(--ms-border)" strokeWidth="9" /><circle cx="60" cy="60" r="50" pathLength="100" fill="none" stroke="var(--ms-primary)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${attempt.result.accuracy} 100`} /></svg><div className="text-center"><p className="text-3xl font-semibold">{attempt.result.accuracy} %</p><p className="mt-1 text-xs text-[var(--ms-muted)]">{attempt.result.correct} de 12 aciertos</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">{attempt.result.axes.map((axis) => <div key={axis.category}><h3 className="text-sm font-medium">{axis.name}</h3><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ms-border)]"><div className="h-full rounded-full bg-[var(--ms-primary)]" style={{ width: `${axis.accuracy}%` }} /></div><p className="mt-2 text-xs text-[var(--ms-muted)]">{axis.correct}/{axis.total} correctas · {axis.accuracy} % · {axis.unanswered} pendientes</p></div>)}</div>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--ms-border)] pt-4 text-sm">{[["Preguntas", attempt.result.total], ["Respondidas", attempt.result.answered], ["Correctas", attempt.result.correct], ["Incorrectas", attempt.result.incorrect], ["Sin responder", attempt.result.unanswered]].map(([label,value]) => <div key={label} className="flex gap-2"><dt className="text-[var(--ms-muted)]">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
      <p className="mt-4 max-w-4xl text-xs leading-6 text-[var(--ms-muted)]">{attempt.result.interpretation} El diagnóstico de práctica individual se mantiene separado.</p>
    </section>}
    {opened && attempt && question && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
      <article key={`${attempt.id}:${question.id}`} className={card + " min-w-0"} data-cy="exam-question">
        <p className="text-xs font-medium text-[var(--ms-primary-hover)]">{examAxes[question.category]}</p><h2 tabIndex={-1} className="mt-2 text-lg font-semibold">Pregunta {question.number} de 12</h2>
        <div className="mt-4 text-sm leading-7"><MathText text={question.statement} /></div>
        <fieldset disabled={busy || completed} className="mt-5 space-y-2"><legend className="mb-3 text-sm font-medium">{completed ? "Tu alternativa registrada" : "Selecciona una alternativa"}</legend>
          {question.choices.map((choice,i) => <label key={i} className={"flex items-start gap-3 rounded-lg border p-3 text-sm " + (question.selectedIndex === i ? "border-[var(--ms-primary)] bg-[var(--ms-tint)]" : "border-[var(--ms-border)]")}><input data-cy="exam-choice" className="mt-1 shrink-0" type="radio" name={question.id} value={i} checked={question.selectedIndex === i} onChange={() => startTransition(() => { void run(() => saveExamAnswerAction(attempt.id, question.id, i)); })} /><span className="font-medium text-[var(--ms-primary-hover)]">{String.fromCharCode(65+i)}.</span><MathText text={choice} /></label>)}
        </fieldset>
        {attempt.state === "completado" && <section data-cy="exam-review" className="mt-5 space-y-4 border-t border-[var(--ms-border)] pt-5 text-sm leading-7">
          <div className="rounded-lg bg-[var(--ms-tint)] p-4"><h3 className="font-semibold">{question.selectedIndex === null ? "Sin responder" : question.selectedIndex === attempt.questions[position].correctIndex ? "Respuesta correcta" : "Respuesta incorrecta"}</h3><p className="mt-1">Tu respuesta: {question.selectedIndex === null ? "No registraste una alternativa" : <>{String.fromCharCode(65+question.selectedIndex)}. <MathText text={question.choices[question.selectedIndex]} /></>}</p><p className="mt-1">Alternativa correcta: {String.fromCharCode(65+attempt.questions[position].correctIndex)}. <MathText text={question.choices[attempt.questions[position].correctIndex]} /></p></div>
          <div><h3 className="mb-2 font-semibold">Desarrollo original verificado</h3><MathText text={attempt.questions[position].explanation} /></div>
          <div className="rounded-lg border border-[var(--ms-border)] p-4" data-cy="exam-tutor"><h3 className="font-semibold">Tutor MateSIMCE</h3><p className="mt-1 text-xs leading-5 text-[var(--ms-muted)]">Una explicación adicional de esta pregunta. El desarrollo verificado permanece arriba.</p><Button type="button" variant="outline" className="mt-3" disabled={helpLoading || Boolean(help[question.id]) || busy} onClick={() => startTransition(() => { void explainQuestion(); })}>{helpLoading ? "Preparando explicación…" : help[question.id] ? "Ayuda consultada" : "Explicar con tutor IA"}</Button>
            {helpError?.questionId === question.id && <p role="alert" className="mt-3 text-xs text-[var(--ms-danger)]">{helpError.message}</p>}
            {help[question.id] && <div className="mt-3 border-t border-[var(--ms-border)] pt-3"><p className="mb-2 text-xs text-[var(--ms-muted)]">{help[question.id].source === "gemini" ? "Explicación generada por Gemini IA. Puede contener errores; compárala con el desarrollo verificado." : "Apoyo basado en contenido revisado."}</p>{help[question.id].notice && <p className="text-xs leading-6 text-[var(--ms-muted)]">{help[question.id].notice}</p>}{help[question.id].source === "gemini" && <MathText text={help[question.id].text} />}</div>}
          </div>
        </section>}
        <div className="mt-5 flex justify-between gap-3"><Button variant="outline" disabled={busy || position === 0} onClick={() => { setPosition(position-1); setConfirming(false); setHelpError(null); }}>Anterior</Button><Button variant="outline" disabled={busy || position === 11} onClick={() => { setPosition(position+1); setConfirming(false); setHelpError(null); }}>Siguiente</Button></div>
      </article>
      <aside className={card} aria-label="Navegador de preguntas"><h2 className="font-semibold">{completed ? "Revisión de preguntas" : "Tu avance"}</h2><p data-cy="exam-progress" className="mt-2 text-xs text-[var(--ms-muted)]">{answered} de 12 respondidas</p>
        <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Preguntas del ensayo">{attempt.questions.map((q,i) => <button data-cy="exam-question-nav" type="button" key={q.id} disabled={busy} aria-label={`Pregunta ${q.number}, ${q.selectedIndex === null ? "pendiente" : "respondida"}`} aria-current={position === i ? "step" : undefined} onClick={() => { setPosition(i); setConfirming(false); setHelpError(null); }} className={"h-10 rounded-lg border text-sm " + (position === i ? "border-[var(--ms-primary)] ring-1 ring-[var(--ms-primary)] " : "border-[var(--ms-border)] ") + (q.selectedIndex === null ? "bg-[var(--ms-background)]" : "bg-[var(--ms-tint)] text-[var(--ms-primary-hover)] font-semibold")}>{q.number}</button>)}</div>
        <p className="mt-4 text-xs leading-6 text-[var(--ms-muted)]">Las casillas turquesa tienen respuesta. El borde resalta tu pregunta actual.</p>
        {completed ? <p className="mt-4 border-t border-[var(--ms-border)] pt-4 text-xs text-[var(--ms-muted)]">Intento finalizado. Tus respuestas no pueden modificarse.</p> : <div className="mt-4 border-t border-[var(--ms-border)] pt-4">{!confirming ? <Button data-cy="exam-finish" className={primary + " w-full"} disabled={busy} onClick={() => setConfirming(true)}>Finalizar ensayo</Button> : <div role="group" aria-label="Confirmar finalización"><p className="text-xs leading-6">Quedan {12-answered} preguntas sin responder. Al finalizar no podrás modificar tus respuestas.</p><Button data-cy="exam-confirm" className={primary + " mt-3 w-full"} disabled={busy} onClick={() => startTransition(() => { void run(() => finishExamAction(attempt.id)); })}>Confirmar y finalizar</Button><Button className="mt-2 w-full" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Seguir respondiendo</Button></div>}</div>}
      </aside>
    </div>}
  </section>;
}
