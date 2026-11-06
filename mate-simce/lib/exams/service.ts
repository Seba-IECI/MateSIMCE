import "server-only";

import { getStudentAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";
import { generateTutorHelp } from "@/lib/ai/gemini";
import { publicExerciseHint } from "@/lib/exercises/hints";
import { examAxes, type ExamCounts, type ExamHintResponse, type ExamQuestion, type ExamResponse, type ExamResult, type ExamTutorResponse, type ReviewedExamQuestion } from "./types";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const index = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid exam");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid exam");
  return value;
}

// Only called with server-verified solutions after the attempt is completed.
export function summarizeExam(questions: readonly ReviewedExamQuestion[]): ExamResult {
  if (questions.length !== 12 || new Set(questions.map((q) => q.id)).size !== 12
    || Object.keys(examAxes).some((axis) => questions.filter((q) => q.category === axis).length !== 3)
    || questions.some((q) => !index(q.correctIndex) || (q.selectedIndex !== null && !index(q.selectedIndex)))) {
    throw new Error("Invalid completed exam");
  }
  const count = (items: readonly ReviewedExamQuestion[]): ExamCounts => {
    const answered = items.filter((q) => q.selectedIndex !== null).length;
    const correct = items.filter((q) => q.selectedIndex === q.correctIndex).length;
    return { total: items.length, answered, correct, incorrect: answered - correct,
      unanswered: items.length - answered, accuracy: Math.round(correct / items.length * 100) };
  };
  const total = count(questions);
  return { ...total, axes: (Object.keys(examAxes) as Array<keyof typeof examAxes>).map((category) => ({
    category, name: examAxes[category], ...count(questions.filter((q) => q.category === category)),
  })), interpretation: "Este resultado describe solo estas 12 preguntas. Revisa los ejes con menos aciertos y las preguntas pendientes; no equivale a un puntaje ni a un nivel oficial SIMCE." };
}

// Whitelist the DTO even if a future RPC accidentally adds private columns.
function project(value: unknown): ExamResponse {
  if (value === null) return { status: "ok", data: null };
  const raw = record(value);
  const id = text(raw.id);
  if (!uuid.test(id) || !Array.isArray(raw.questions) || raw.questions.length !== 12
    || (raw.state !== "en_curso" && raw.state !== "completado")) throw new Error("Invalid exam");
  const questions = raw.questions.map((value): ExamQuestion | ReviewedExamQuestion => {
    const q = record(value);
    if (!uuid.test(text(q.id)) || !Number.isInteger(q.number) || Number(q.number) < 1 || Number(q.number) > 12
      || typeof q.category !== "string" || !Object.hasOwn(examAxes, q.category)
      || !Array.isArray(q.choices) || q.choices.length !== 4
      || q.choices.some((choice) => typeof choice !== "string" || !choice.trim()) || new Set(q.choices).size !== 4
      || (q.selectedIndex !== null && !index(q.selectedIndex))) throw new Error("Invalid question");
    const item: ExamQuestion = {
      id: text(q.id), number: Number(q.number), category: q.category as ExamQuestion["category"],
      statement: text(q.statement), choices: q.choices.map(text), selectedIndex: q.selectedIndex as number | null,
    };
    if (raw.state === "en_curso") return item;
    if (!index(q.correctIndex)) throw new Error("Invalid solution");
    return { ...item, correctIndex: q.correctIndex, explanation: text(q.explanation) };
  });
  if (new Set(questions.map((q) => q.id)).size !== 12 || new Set(questions.map((q) => q.number)).size !== 12
    || Object.keys(examAxes).some((axis) => questions.filter((q) => q.category === axis).length !== 3)) throw new Error("Invalid exam distribution");
  questions.sort((a, b) => a.number - b.number);
  const attempt = { id, startedAt: text(raw.startedAt), finishedAt: raw.finishedAt === null ? null : text(raw.finishedAt) };
  if (raw.state === "en_curso") {
    if (attempt.finishedAt !== null) throw new Error("Invalid state");
    return { status: "ok", data: { ...attempt, state: "en_curso", questions } };
  }
  if (!attempt.finishedAt) throw new Error("Invalid state");
  const reviewed = questions as ReviewedExamQuestion[];
  const result = summarizeExam(reviewed);
  if (raw.score !== result.correct) throw new Error("Inconsistent score");
  return { status: "ok", data: { ...attempt, state: "completado", questions: reviewed, result } };
}

export async function runExam(
  operation: "resume" | "start" | "save" | "finish",
  attemptId: string | null = null,
  questionId: string | null = null,
  selectedIndex: number | null = null,
): Promise<ExamResponse> {
  if (!["resume", "start", "save", "finish"].includes(operation)
    || (attemptId !== null && (typeof attemptId !== "string" || !uuid.test(attemptId)))
    || ((operation === "save" || operation === "finish") && attemptId === null)
    || (operation === "save" && (typeof questionId !== "string" || !uuid.test(questionId) || !index(selectedIndex)))) {
    return { status: "invalid" };
  }
  try {
    const session = await createClient();
    const access = await getStudentAccess(session);
    if (access.status !== "authorized") return { status: access.status };
    // Session JWT, never service_role. The RPC repeats authorization and locks the owned attempt.
    const { data, error } = await session.rpc("matesimce_exam", {
      p_operation: operation, p_attempt: attemptId, p_question: questionId, p_selected: selectedIndex,
    });
    if (error) {
      // Diagnostics deliberately exclude SQL details, JWTs, user IDs and question/solution content.
      console.warn("MateSIMCE exam RPC: " + JSON.stringify({ operation, code: error.code,
        column: /column reference "([a-z_]+)"/.exec(error.message)?.[1] }));
      if (error.code === "PGRST202" || error.code === "42883") return { status: "configuration_required" };
      if (error.message === "content_unavailable") return { status: "content_unavailable" };
      if (error.message === "not_found") return { status: "not_found" };
      if (error.message === "forbidden") return { status: "forbidden" };
      if (error.message === "invalid") return { status: "invalid" };
      return { status: "error" };
    }
    return project(data);
  } catch {
    return { status: "error" };
  }
}

export async function getExamHint(attemptId: string, questionId: string): Promise<ExamHintResponse> {
  if (typeof attemptId !== "string" || !uuid.test(attemptId) || typeof questionId !== "string" || !uuid.test(questionId)) return { status: "invalid" };
  // Session-bound RPC repeats student/ownership checks. project() strips solutions in progress.
  const result = await runExam("resume", attemptId);
  if (result.status !== "ok") return result;
  if (!result.data || result.data.id !== attemptId) return { status: "not_found" };
  if (result.data.state !== "en_curso") return { status: "forbidden" };
  const question = result.data.questions.find((item) => item.id === questionId);
  if (!question) return { status: "not_found" };
  return { status: "ok", data: { attemptId, questionId,
    text: publicExerciseHint(question.statement, examAxes[question.category]) } };
}

// Deliberately separate from practice-attempt authorization. No new SQL, privileged key or writes.
export async function getExamTutorFeedback(attemptId: string, questionId: string): Promise<ExamTutorResponse> {
  if (typeof attemptId !== "string" || !uuid.test(attemptId) || typeof questionId !== "string" || !uuid.test(questionId)) return { status: "invalid" };
  try {
    const session = await createClient();
    const access = await getStudentAccess(session);
    if (access.status !== "authorized") return { status: access.status };
    // The audited RPC filters ownership using auth.uid(); project() withholds all keys in progress.
    const result = await runExam("resume", attemptId);
    if (result.status !== "ok") return result;
    if (!result.data || result.data.id !== attemptId) return { status: "not_found" };
    if (result.data.state !== "completado") return { status: "forbidden" };
    const question = result.data.questions.find((item) => item.id === questionId);
    if (!question) return { status: "not_found" };
    const generated = await generateTutorHelp(access.student.id, `exam:${attemptId}:${questionId}`, "procedure", {
      title: `Pregunta ${question.number} del ensayo`, topic: examAxes[question.category],
      statement: question.statement, instructions: null,
      selectedChoice: question.selectedIndex === null ? "Sin respuesta registrada" : question.choices[question.selectedIndex],
      correct: question.selectedIndex === question.correctIndex,
      correctChoice: question.choices[question.correctIndex], procedure: question.explanation,
    });
    return { status: "ok", data: { attemptId, questionId,
      source: generated.source,
      text: generated.source === "gemini" ? generated.text : question.explanation,
      ...(generated.source === "verified" ? { notice: `No se generó una explicación con IA para esta solicitud. En esta pregunta de ${examAxes[question.category]}, compara tu alternativa registrada con el desarrollo verificado, operación por operación. No conocemos tus pasos de resolución.` } : {}),
    } };
  } catch {
    return { status: "error" };
  }
}
