import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/student", () => ({ getStudentAccess: vi.fn() }));
vi.mock("@/lib/exercises/queries", () => ({ getCurrentCourse: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getStudentAccess } from "@/lib/auth/student";
import { getCurrentCourse } from "@/lib/exercises/queries";
import { getPracticeDiagnosis, summarizePractice } from "@/lib/exercises/progress";

function setupDiagnosis() {
  const userId = "11111111-1111-4111-8111-111111111111";
  const courseId = "22222222-2222-4222-8222-222222222222";
  const tema = { categoria: "numeros", activo: true, curso_id: courseId, curso: { activo: true, nivel: "2_medio" } };
  const records = [
    { id: "own", usuario_id: userId, es_correcta: true, ejercicio: { tema } },
    { id: "other", usuario_id: "another-student", es_correcta: false, ejercicio: { tema } },
    { id: "ungraded", usuario_id: userId, es_correcta: null, ejercicio: { tema } },
  ];
  const filters: Array<[string, unknown]> = [];
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return query; }),
    not: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    range: vi.fn(async () => ({ error: null, data: records.filter((record) => record.es_correcta !== null && filters.every(([column, value]) => {
      let actual: unknown = record;
      for (const part of column.split(".")) actual = (actual as Record<string, unknown>)?.[part];
      return actual === value;
    })) })),
  };
  const from = vi.fn().mockReturnValue(query);
  vi.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>);
  vi.mocked(getStudentAccess).mockResolvedValue({ status: "authorized", student: { id: userId, name: "Test" } });
  vi.mocked(getCurrentCourse).mockResolvedValue({ status: "ok", data: { id: courseId, name: "Matemática", level: "2_medio", description: "" } });
  return { userId, from, query };
}

it("consulta con la sesión y el propietario real; no cuenta otro alumno ni respuestas sin corregir", async () => {
  const fixture = setupDiagnosis();
  const result = await getPracticeDiagnosis();
  expect(result.status).toBe("ok");
  if (result.status !== "ok") throw new Error("Expected diagnosis");
  expect(result.data[0]).toMatchObject({ attempts: 1, correct: 1, accuracy: 100 });
  expect(fixture.from).toHaveBeenCalledWith("respuestas_estudiante");
  expect(fixture.query.eq).toHaveBeenCalledWith("usuario_id", fixture.userId);
  expect(fixture.query.not).toHaveBeenCalledWith("es_correcta", "is", null);
  expect(JSON.stringify(result)).not.toMatch(/another-student|usuario_id|respuesta_json|indice_correcto/);
});

it("no consulta respuestas si el alumno no está autorizado", async () => {
  const fixture = setupDiagnosis();
  vi.mocked(getStudentAccess).mockResolvedValue({ status: "forbidden" });
  await expect(getPracticeDiagnosis()).resolves.toEqual({ status: "forbidden" });
  expect(fixture.from).not.toHaveBeenCalled();
});

it("mantiene genéricos los errores de consulta del diagnóstico", async () => {
  const fixture = setupDiagnosis();
  fixture.query.range.mockRejectedValue(new Error("PRIVATE DATABASE ERROR"));
  await expect(getPracticeDiagnosis()).resolves.toEqual({ status: "error" });
});

it("presenta los cuatro ejes sin atribuir un 0 % a quien aún no tiene intentos", () => {
  const result = summarizePractice([]);
  expect(result).toHaveLength(4);
  expect(new Set(result.map((axis) => axis.category)).size).toBe(4);
  for (const axis of result) {
    expect(axis.attempts).toBe(0);
    expect(axis.correct).toBe(0);
    expect(axis.accuracy).toBeNull();
    expect(axis.recommendation).toContain("para comenzar");
  }
});

it("calcula intentos, aciertos y porcentaje de cada eje sin mezclar resultados", () => {
  const result = summarizePractice([
    { category: "numeros", correct: true }, { category: "numeros", correct: false },
    { category: "numeros", correct: true }, { category: "algebra_y_funciones", correct: false },
  ]);
  expect(result[0]).toMatchObject({ category: "numeros", attempts: 3, correct: 2, accuracy: 67 });
  expect(result[1]).toMatchObject({ category: "algebra_y_funciones", attempts: 1, correct: 0, accuracy: 0 });
  expect(result[1].recommendation).toContain("pocos intentos");
  expect(result[2]).toMatchObject({ category: "geometria", attempts: 0, accuracy: null });
});

it("basa el refuerzo en la fracción exacta de aciertos, sin usar el porcentaje redondeado", () => {
  const attempts = Array.from({ length: 3 }, () => ({ category: "numeros" as const, correct: false }));
  expect(summarizePractice(attempts)[0].recommendation).toContain("Refuerza este eje");
  expect(summarizePractice(attempts.map((attempt) => ({ ...attempt, correct: true })))[0].recommendation)
    .toContain("Buen resultado");
});
