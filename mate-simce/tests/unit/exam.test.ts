import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/student", () => ({ getStudentAccess: vi.fn() }));
vi.mock("@/lib/ai/gemini", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/ai/gemini")>(), generateTutorHelp: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getStudentAccess } from "@/lib/auth/student";
import { getExamHint, getExamTutorFeedback, runExam, summarizeExam } from "@/lib/exams/service";
import { generateTutorHelp } from "@/lib/ai/gemini";
import { examAxes, type ReviewedExamQuestion } from "@/lib/exams/types";

const attemptId = "11111111-1111-4111-8111-111111111111";
const rpc = vi.fn();
function questions(): ReviewedExamQuestion[] {
  return Object.keys(examAxes).flatMap((category, axis) => Array.from({ length: 3 }, (_, i) => ({
    id: `22222222-2222-4222-8222-${String(axis * 3 + i + 1).padStart(12, "0")}`,
    number: axis * 3 + i + 1, category: category as keyof typeof examAxes,
    statement: "Pregunta sintética: calcula $2^2$.", choices: ["2", "4", "6", "8"],
    selectedIndex: i === 2 ? null : i, correctIndex: 1, explanation: "Referencia sintética: $2^2=4$.",
  })));
}
function payload(state: "en_curso" | "completado" = "en_curso") {
  return { id: attemptId, state, startedAt: "2026-11-05T12:00:00Z",
    finishedAt: state === "completado" ? "2026-11-05T12:10:00Z" : null,
    score: state === "completado" ? 4 : null, questions: questions() };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  vi.mocked(getStudentAccess).mockResolvedValue({ status: "authorized", student: { id: attemptId, name: "Prueba" } });
  rpc.mockResolvedValue({ data: payload(), error: null });
  vi.mocked(generateTutorHelp).mockResolvedValue({ source: "verified", reason: "unavailable" });
});
afterEach(() => vi.restoreAllMocks());

it("calcula 12 preguntas, 3 por eje, y separa incorrectas de omitidas", () => {
  const result = summarizeExam(questions());
  expect(result).toMatchObject({ total: 12, answered: 8, correct: 4, incorrect: 4, unanswered: 4, accuracy: 33 });
  expect(result.axes).toHaveLength(4);
  for (const axis of result.axes) expect(axis).toMatchObject({ total: 3, answered: 2, correct: 1, incorrect: 1, unanswered: 1, accuracy: 33 });
  expect(result.interpretation).toContain("no equivale");
});

it.each([0, 1, 12])("calcula los extremos de %i aciertos sobre 12 preguntas", (correct) => {
  const items = questions().map((q, i) => ({ ...q, selectedIndex: i < correct ? 1 : 0 }));
  expect(summarizeExam(items)).toMatchObject({ correct, answered: 12, unanswered: 0, accuracy: Math.round(correct / 12 * 100) });
});

it("no confunde un ensayo vacío de respuestas con 12 errores", () => {
  expect(summarizeExam(questions().map((q) => ({ ...q, selectedIndex: null })))).toMatchObject({
    answered: 0, correct: 0, incorrect: 0, unanswered: 12, accuracy: 0,
  });
});

it("rechaza preguntas duplicadas, distribución incompleta e índices inválidos", () => {
  const items = questions();
  expect(() => summarizeExam(items.slice(0, 11))).toThrow();
  expect(() => summarizeExam(items.map((q, i) => i === 1 ? { ...q, id: items[0].id } : q))).toThrow();
  expect(() => summarizeExam(items.map((q) => ({ ...q, category: "numeros" })))).toThrow();
  expect(() => summarizeExam(items.map((q) => ({ ...q, correctIndex: 4 })))).toThrow();
});

it.each(["unauthenticated", "forbidden", "unavailable"] as const)("no llama al RPC si el acceso es %s (incluye administrador/inactivo)", async (status) => {
  vi.mocked(getStudentAccess).mockResolvedValue({ status });
  await expect(runExam("start")).resolves.toEqual({ status });
  expect(rpc).not.toHaveBeenCalled();
});

it("usa la sesión y el RPC transaccional sin enviar un usuario ni un puntaje del navegador", async () => {
  const result = await runExam("start");
  expect(result.status).toBe("ok");
  expect(rpc).toHaveBeenCalledExactlyOnceWith("matesimce_exam", {
    p_operation: "start", p_attempt: null, p_question: null, p_selected: null,
  });
});

it("descarta claves y desarrollos antes de finalizar, incluso si el RPC los incluye por error", async () => {
  const result = await runExam("resume", attemptId);
  expect(result.status).toBe("ok");
  expect(JSON.stringify(result)).not.toMatch(/correctIndex|explanation|correctas|Referencia sintética/);
  if (result.status !== "ok" || !result.data) throw new Error("Expected attempt");
  expect(result.data.questions).toHaveLength(12);
  expect(result.data.questions[1].selectedIndex).toBe(1);
});

it("un intento nuevo conserva las 12 selecciones vacías, sin elegir la alternativa cero", async () => {
  const data = payload();
  data.questions = data.questions.map((q) => ({ ...q, selectedIndex: null }));
  rpc.mockResolvedValue({ data, error: null });
  const result = await runExam("start");
  if (result.status !== "ok" || !result.data) throw new Error("Expected attempt");
  expect(result.data.questions.every((q) => q.selectedIndex === null)).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/correctIndex|explanation/);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("matesimce_exam", expect.objectContaining({ p_operation: "start", p_selected: null }));
});

it("recuperar conserva una selección real de índice cero y distingue las preguntas pendientes", async () => {
  const result = await runExam("resume", attemptId);
  if (result.status !== "ok" || !result.data) throw new Error("Expected attempt");
  expect(result.data.questions[0].selectedIndex).toBe(0);
  expect(result.data.questions[2].selectedIndex).toBeNull();
  expect(result.data.questions.filter((q) => q.selectedIndex !== null)).toHaveLength(8);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("matesimce_exam", expect.objectContaining({ p_operation: "resume", p_selected: null }));
});

it("permite guardar solo un índice válido asociado a intento y pregunta", async () => {
  await expect(runExam("save", attemptId, questions()[0].id, 4)).resolves.toEqual({ status: "invalid" });
  await expect(runExam("save", null, questions()[0].id, 1)).resolves.toEqual({ status: "invalid" });
  await expect(runExam("resume", "invalid-id")).resolves.toEqual({ status: "invalid" });
  expect(rpc).not.toHaveBeenCalled();
  await runExam("save", attemptId, questions()[0].id, 2);
  expect(rpc).toHaveBeenCalledWith("matesimce_exam", { p_operation: "save", p_attempt: attemptId, p_question: questions()[0].id, p_selected: 2 });
});

it("propaga el rechazo de un intento ajeno sin revelar detalles internos", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "not_found", details: "PRIVATE" } });
  await expect(runExam("resume", attemptId)).resolves.toEqual({ status: "not_found" });
});

it("expone revisión y resultados únicamente al recibir un intento completado consistente", async () => {
  rpc.mockResolvedValue({ data: payload("completado"), error: null });
  const first = await runExam("finish", attemptId);
  const repeated = await runExam("finish", attemptId);
  expect(repeated).toEqual(first);
  if (first.status !== "ok" || first.data?.state !== "completado") throw new Error("Expected completed attempt");
  expect(first.data.result.correct).toBe(4);
  expect(first.data.questions[0].correctIndex).toBe(1);
  expect(first.data.questions[0].explanation).toContain("sintética");
  // This tests projection of an idempotent RPC response, not database locking itself.
});

it("rechaza un puntaje incoherente en lugar de mostrar resultados inventados", async () => {
  rpc.mockResolvedValue({ data: { ...payload("completado"), score: 12 }, error: null });
  await expect(runExam("finish", attemptId)).resolves.toEqual({ status: "error" });
});

it.each([
  [{ code: "PGRST202", message: "private SQL details" }, "configuration_required"],
  [{ code: "P0001", message: "content_unavailable" }, "content_unavailable"],
  [{ code: "XX000", message: "PRIVATE" }, "error"],
])("maneja fallos sin filtrar SQL o soluciones: %j", async (error, status) => {
  rpc.mockResolvedValue({ data: null, error });
  await expect(runExam("start")).resolves.toEqual({ status });
});

it("recupera un inicio sin intentos como estado vacío", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(runExam("resume")).resolves.toEqual({ status: "ok", data: null });
});

it("no envía al tutor una pregunta de ensayo en curso", async () => {
  await expect(getExamTutorFeedback(attemptId, questions()[0].id)).resolves.toEqual({ status: "forbidden" });
  expect(generateTutorHelp).not.toHaveBeenCalled();
});

it("la pista previa usa solo la pregunta del intento propio, sin guardar, calificar ni llamar a Gemini", async () => {
  const result = await getExamHint(attemptId, questions()[0].id);
  expect(result).toMatchObject({ status: "ok", data: { attemptId, questionId: questions()[0].id, text: expect.any(String) } });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("matesimce_exam", expect.objectContaining({ p_operation: "resume", p_attempt: attemptId }));
  expect(generateTutorHelp).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toMatch(/correctIndex|explanation|Referencia sintética|2\^2=4/);
});

it.each(["unauthenticated", "forbidden"] as const)("deniega pistas del ensayo con acceso %s", async (status) => {
  vi.mocked(getStudentAccess).mockResolvedValue({ status });
  await expect(getExamHint(attemptId, questions()[0].id)).resolves.toEqual({ status });
  expect(rpc).not.toHaveBeenCalled();
});

it("rechaza pistas de intentos ajenos, preguntas externas e intentos ya finalizados", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "not_found" } });
  await expect(getExamHint(attemptId, questions()[0].id)).resolves.toEqual({ status: "not_found" });
  await expect(getExamHint(attemptId, "44444444-4444-4444-8444-444444444444")).resolves.toEqual({ status: "not_found" });
  rpc.mockResolvedValue({ data: payload("completado"), error: null });
  await expect(getExamHint(attemptId, questions()[0].id)).resolves.toEqual({ status: "forbidden" });
  expect(generateTutorHelp).not.toHaveBeenCalled();
});

// Offline regression of the patch's text preflight, NOT a PostgreSQL execution.
function patchFixture() {
  const patch = readFileSync(new URL("../../supabase/exams/diversify-practice-exam.sql", import.meta.url), "utf8");
  const installation = readFileSync(new URL("../../supabase/exams/enable-practice-exam.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const oldFragment = /\$before\$([\s\S]*?)\$before\$/.exec(patch)![1];
  const newFragment = /\$after\$([\s\S]*?)\$after\$/.exec(patch)![1];
  const normalize = (s: string) => s.replace(/\r\n/g, "\n").replace(/^\n+/, "");
  const before = normalize(oldFragment), after = normalize(newFragment);
  const count = (s: string, fragment: string) => s.split(fragment).length - 1;
  expect(count(installation, after)).toBe(1);
  expect(patch).toContain("old_fragment := ltrim(replace(old_fragment,E'\\r\\n',E'\\n'), E'\\n')");
  expect(patch).toContain("new_fragment := ltrim(replace(new_fragment,E'\\r\\n',E'\\n'), E'\\n')");
  const apply = (body: string, fragment: string) => {
    const normalized = body.replace(/\r\n/g, "\n");
    if (count(normalized, after) === 1) return normalized;
    const candidate = normalize(fragment);
    if (count(normalized, candidate) !== 1) throw new Error("incompatible");
    return normalized.replace(candidate, after);
  };
  return { patch, installation, before, after, oldFragment, apply };
}

it.each(["\n", "\r\n"])("el parche acepta finales de línea %j sin cambiar la función fuera del selector", (lineEnding) => {
  const f = patchFixture();
  const deployed = f.installation.replace(f.after, f.before);
  const windowsFragment = "\r\n" + f.before.replace(/\n/g, "\r\n");
  expect(deployed.includes(windowsFragment.replace(/^\n+/, ""))).toBe(false); // Previous P0001.
  const actual = f.apply(deployed.replace(/\n/g, lineEnding), windowsFragment);
  expect(actual).toBe(f.installation);
  expect(f.apply(actual, windowsFragment)).toBe(actual);
});

it("el parche conserva el rechazo de diferencias reales o coincidencias múltiples", () => {
  const f = patchFixture();
  const deployed = f.installation.replace(f.after, f.before);
  expect(() => f.apply(deployed.replace("JOIN public.temas t ON t.id = e.tema_id", "JOIN public.temas t ON false"), f.oldFragment)).toThrow("incompatible");
  expect(() => f.apply(deployed + f.before, f.oldFragment)).toThrow("incompatible");
  expect(f.after).toContain("q.tema_id=e.tema_id AND q.opciones=e.opciones");
  expect(f.after).toContain("q.enunciado=concat_ws(E'\\n\\n', e.titulo, e.enunciado, nullif(e.instrucciones, ''))");
  expect(f.after).toContain("ORDER BY i.fecha_termino DESC");
  expect(f.installation).toContain("FROM eligible WHERE position <= 3");
});

it("modelo local del orden SQL: tres por eje, sin repetición si hay seis candidatas y sin conjuntos consecutivos iguales si hay más de tres", () => {
  const f = patchFixture();
  expect(f.after).toContain("coalesce(history.in_latest,false), history.last_used NULLS FIRST, random(), e.id");
  // Reference model of this ordering; this does not execute PostgreSQL or its joins.
  const identity = (q: { topic: string; statement: string; choices: string[] }) =>
    JSON.stringify([q.topic, q.statement, q.choices]);
  const first = { topic: "topic", statement: "Synthetic statement", choices: ["a", "b", "c", "d"] };
  expect(identity(first)).not.toBe(identity({ ...first, topic: "other-topic" }));
  expect(identity(first)).not.toBe(identity({ ...first, statement: "Other statement" }));
  expect(identity(first)).not.toBe(identity({ ...first, choices: ["b", "a", "c", "d"] }));
  for (let size = 3; size <= 12; size++) {
    const chosen = Object.keys(examAxes).flatMap((axis) => {
      const candidates = Array.from({ length: size }, (_, i) => ({
        id: axis + ":" + i, axis, inLatest: i < 3, lastUsed: i < 3 ? 100 : i === 3 ? null : i,
        tie: size - i,
      }));
      const result = [...candidates].sort((a,b) => Number(a.inLatest) - Number(b.inLatest)
        || (a.lastUsed ?? -Infinity) - (b.lastUsed ?? -Infinity) || a.tie - b.tie).slice(0,3);
      const repeats = result.filter((q) => q.inLatest).length;
      expect(result).toHaveLength(3);
      if (size > 3) expect(repeats).toBeLessThan(3);
      if (size >= 6) expect(repeats).toBe(0);
      if (size > 3) expect(result[0].id).toBe(axis + ":3"); // Unseen before older seen items.
      if (size >= 6) expect(result[1].id).toBe(axis + ":4"); // Least recent among seen candidates.
      return result;
    });
    expect(chosen).toHaveLength(12);
    expect(new Set(chosen.map((q) => q.id)).size).toBe(12);
    for (const axis of Object.keys(examAxes)) expect(chosen.filter((q) => q.axis === axis)).toHaveLength(3);
  }
});

it("resume conserva las preguntas del intento solicitado y no solicita otra selección", async () => {
  const started = await runExam("start");
  const recovered = await runExam("resume", attemptId);
  expect(recovered).toEqual(started);
  expect(rpc.mock.calls.map(([, parameters]) => parameters.p_operation)).toEqual(["start", "resume"]);
  expect(rpc.mock.calls[1][1].p_attempt).toBe(attemptId);
});

it.each(["unauthenticated", "forbidden"] as const)("rechaza ayuda de ensayo con acceso %s, incluido administrador", async (status) => {
  vi.mocked(getStudentAccess).mockResolvedValue({ status });
  await expect(getExamTutorFeedback(attemptId, questions()[0].id)).resolves.toEqual({ status });
  expect(rpc).not.toHaveBeenCalled();
  expect(generateTutorHelp).not.toHaveBeenCalled();
});

it("rechaza un intento ajeno o una pregunta que no pertenece al ensayo", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "not_found" } });
  await expect(getExamTutorFeedback(attemptId, questions()[0].id)).resolves.toEqual({ status: "not_found" });
  rpc.mockResolvedValue({ data: payload("completado"), error: null });
  await expect(getExamTutorFeedback(attemptId, "44444444-4444-4444-8444-444444444444")).resolves.toEqual({ status: "not_found" });
  expect(generateTutorHelp).not.toHaveBeenCalled();
});

it("genera ayuda solo con la pregunta finalizada y el desarrollo verificado del servidor", async () => {
  rpc.mockResolvedValue({ data: payload("completado"), error: null });
  vi.mocked(generateTutorHelp).mockResolvedValue({ source: "gemini", text: "Explicación sintética generada.", model: "synthetic-test-model" });
  const result = await getExamTutorFeedback(attemptId, questions()[0].id);
  expect(result).toMatchObject({ status: "ok", data: { source: "gemini", questionId: questions()[0].id } });
  expect(generateTutorHelp).toHaveBeenCalledWith(attemptId, `exam:${attemptId}:${questions()[0].id}`, "procedure", expect.objectContaining({
    selectedChoice: "2", correctChoice: "4", correct: false, procedure: questions()[0].explanation,
  }));
  expect(rpc).toHaveBeenCalledExactlyOnceWith("matesimce_exam", expect.objectContaining({ p_operation: "resume", p_attempt: attemptId }));
});

it("conserva el desarrollo verificado si Gemini no genera ayuda y no cambia registros", async () => {
  rpc.mockResolvedValue({ data: payload("completado"), error: null });
  const result = await getExamTutorFeedback(attemptId, questions()[0].id);
  expect(result).toMatchObject({ status: "ok", data: { source: "verified", text: expect.stringContaining(questions()[0].explanation) } });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("matesimce_exam", expect.objectContaining({ p_operation: "resume" }));
});

it.each(["busy", "timeout", "invalid", "quota"] as const)("contextualiza el respaldo del ensayo ante %s sin alterar respuestas ni resultados", async (reason) => {
  const attempt = payload("completado");
  rpc.mockResolvedValue({ data: attempt, error: null });
  vi.mocked(generateTutorHelp).mockResolvedValue({ source: "verified", reason });
  for (const question of attempt.questions.slice(0, 3)) {
    const result = await getExamTutorFeedback(attemptId, question.id);
    expect(result).toMatchObject({ status: "ok", data: { source: "verified", text: expect.stringContaining(question.explanation) } });
    if (result.status !== "ok") throw new Error("Expected feedback");
    expect(result.data.text).toContain("Orientación (Números)");
    expect(result.data.text).toContain("Solución verificada: 4");
    expect(result.data.text).toContain(question.selectedIndex === null ? "No registraste una respuesta"
      : question.selectedIndex === question.correctIndex ? "Tu respuesta coincide" : "no podemos determinar el error específico");
    expect(result.data.notice).toContain(reason === "busy" ? "después de un reintento" : reason === "invalid"
      ? "no superó los controles" : reason === "timeout" ? "tiempo de espera" : "límite de solicitudes");
    expect(JSON.stringify(result)).not.toMatch(/usuario_id|respuesta_correcta|indice_correcto|sb_secret/);
  }
  expect(rpc.mock.calls.every(([, params]) => params.p_operation === "resume")).toBe(true);
  expect(attempt).toEqual(payload("completado"));
});
