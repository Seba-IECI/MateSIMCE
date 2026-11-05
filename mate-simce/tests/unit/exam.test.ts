import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/student", () => ({ getStudentAccess: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getStudentAccess } from "@/lib/auth/student";
import { runExam, summarizeExam } from "@/lib/exams/service";
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
