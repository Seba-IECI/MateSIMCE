import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "https://example.supabase.co" }) }));
vi.mock("@/lib/exercises/queries", () => ({ getExercise: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/student", () => ({ getStudentAccess: vi.fn() }));

import { createClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getStudentAccess } from "@/lib/auth/student";
import { getExercise } from "@/lib/exercises/queries";
import { checkExerciseAnswer } from "@/lib/exercises/correction";
import type { ExerciseDetail } from "@/lib/exercises/types";

// Synthetic fixture only; does not use the private bank or connect to Supabase.
const id = "33333333-3333-4333-8333-333333333333";
const attemptId = "55555555-5555-4555-8555-555555555555";
const userId = "11111111-1111-4111-8111-111111111111";
const previousQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
const detail: ExerciseDetail = {
  id, title: "Ejemplo de prueba", topicName: "Tema simulado", statement: "Calcula $2^3$.",
  instructions: null, responseType: "opcion_multiple", choices: ["6", "8", "9", "16"],
  difficulty: "facil", challenge: "inicial", estimatedSeconds: null, imageUrl: null, imageUnavailable: false,
};
const solution = {
  respuesta_correcta: { version: 1, tipo: "opcion_multiple", indice_correcto: 1 },
  desarrollo_paso_a_paso: "$2^3=8$.",
  campo_privado: "NO SERIALIZAR",
};
let query: {
  select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>;
};
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_synthetic_test_value");
  vi.mocked(getExercise).mockResolvedValue({ status: "ok", data: detail });
  vi.mocked(getStudentAccess).mockResolvedValue({ status: "authorized", student: { id: userId, name: "Test" } });
  previousQuery.select.mockReturnThis(); previousQuery.eq.mockReturnThis();
  vi.mocked(createSessionClient).mockResolvedValue({ from: vi.fn().mockReturnValue(previousQuery) } as unknown as Awaited<ReturnType<typeof createSessionClient>>);
  query = { insert: vi.fn().mockResolvedValue({ error: null }), select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: solution, error: null }) };
  from = vi.fn().mockReturnValue(query);
  vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>);
});
afterEach(() => vi.unstubAllEnvs());

it("rechaza un identificador de intento inválido sin consultar la base", async () => {
  await expect(checkExerciseAnswer(id, 1, "invalid")).resolves.toEqual({ status: "invalid" });
  expect(createClient).not.toHaveBeenCalled();
});

it("acepta un reenvío idéntico tras colisión de PK sin actualizar ni duplicar el intento", async () => {
  query.insert.mockResolvedValue({ error: { code: "23505" } });
  previousQuery.maybeSingle.mockResolvedValue({ data: {
    ejercicio_id: id, es_correcta: true,
    respuesta_json: { version: 1, tipo: "opcion_multiple", indice_seleccionado: 1 },
  }, error: null });
  const result = await checkExerciseAnswer(id, 1, attemptId);
  expect(result.status).toBe("ok");
  expect(previousQuery.eq).toHaveBeenCalledWith("usuario_id", userId);
  expect(previousQuery.eq).toHaveBeenCalledWith("id", attemptId);
  expect(query.insert).toHaveBeenCalledOnce();
});

it("no reutiliza una respuesta ajena o diferente ni devuelve éxito si falla el guardado", async () => {
  query.insert.mockResolvedValue({ error: { code: "23505" } });
  for (const data of [null, { ejercicio_id: id, es_correcta: false, respuesta_json: { indice_seleccionado: 0 } }]) {
    previousQuery.maybeSingle.mockResolvedValue({ data, error: null });
    await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "invalid" });
  }
  query.insert.mockResolvedValue({ error: { code: "42501", message: "PRIVATE DATABASE ERROR" } });
  await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "error" });
});

it("no guarda si la identidad está desactivada al obtener el propietario del intento", async () => {
  vi.mocked(getStudentAccess).mockResolvedValue({ status: "forbidden" });
  await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "forbidden" });
  expect(createClient).not.toHaveBeenCalled();
});

it("rechaza índices ausentes, no enteros o fuera de rango antes de consultar", async () => {
  for (const index of [-1, 4, 1.5, NaN, undefined, "1"]) {
    await expect(checkExerciseAnswer(id, index as number, attemptId)).resolves.toEqual({ status: "invalid" });
  }
  expect(getExercise).not.toHaveBeenCalled();
  expect(createClient).not.toHaveBeenCalled();
});

it("propaga denegaciones y ejercicios retirados sin crear el cliente privilegiado", async () => {
  for (const status of ["unauthenticated", "forbidden", "not_found", "invalid", "course_ambiguous", "error"] as const) {
    vi.mocked(getExercise).mockResolvedValue({ status });
    await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status });
  }
  expect(getExercise).toHaveBeenCalledWith(id);
  expect(createClient).not.toHaveBeenCalled();
});

it("no corrige formatos no compatibles o alternativas incompletas", async () => {
  for (const choices of [null, ["1", "2"], ["1", "2", "3", "3"], ["", "2", "3", "4"]]) {
    vi.mocked(getExercise).mockResolvedValue({ status: "ok", data: { ...detail, choices } });
    await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "unavailable" });
  }
  vi.mocked(getExercise).mockResolvedValue({ status: "ok", data: { ...detail, responseType: "calculo" } });
  await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "unavailable" });
  expect(createClient).not.toHaveBeenCalled();
});

it.each([[1, true], [0, false]])("corrige el índice %i en servidor (acierto: %s) y proyecta solo su retroalimentación", async (selectedIndex, correct) => {
  const result = await checkExerciseAnswer(id, selectedIndex, attemptId);
  expect(result).toEqual({ status: "ok", data: {
    attemptId, exerciseId: id, selectedIndex, correct, explanation: solution.desarrollo_paso_a_paso,
  } });
  expect(from).toHaveBeenNthCalledWith(1, "soluciones_ejercicios");
  expect(from).toHaveBeenNthCalledWith(2, "respuestas_estudiante");
  expect(query.insert).toHaveBeenCalledWith({ id: attemptId, usuario_id: userId, ejercicio_id: id,
    respuesta_json: { version: 1, tipo: "opcion_multiple", indice_seleccionado: selectedIndex },
    es_correcta: correct, puntaje_obtenido: correct ? 1 : 0 });
  expect(query.select).toHaveBeenCalledWith("respuesta_correcta,desarrollo_paso_a_paso,ejercicio:ejercicios!inner(id)");
  expect(query.eq).toHaveBeenCalledWith("ejercicio_id", id);
  expect(query.eq).toHaveBeenCalledWith("ejercicio.publicado", true);
  expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "sb_secret_synthetic_test_value", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: expect.any(Function) },
  });
  expect(JSON.stringify(result)).not.toMatch(/indice_correcto|respuesta_correcta|campo_privado|NO SERIALIZAR|sb_secret/);
});

it("falla de forma segura si falta la clave de servidor", async () => {
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "unavailable" });
  expect(createClient).not.toHaveBeenCalled();
});

it("rechaza soluciones con versión, tipo o índice inválidos y explicaciones vacías", async () => {
  for (const answer of [null, [], { ...solution.respuesta_correcta, version: 2 },
    { ...solution.respuesta_correcta, tipo: "calculo" }, { ...solution.respuesta_correcta, indice_correcto: "1" },
    { ...solution.respuesta_correcta, indice_correcto: 4 }, { ...solution.respuesta_correcta, indice_correcto: 1.5 }]) {
    query.maybeSingle.mockResolvedValue({ data: { ...solution, respuesta_correcta: answer }, error: null });
    await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "unavailable" });
  }
  query.maybeSingle.mockResolvedValue({ data: { ...solution, desarrollo_paso_a_paso: " " }, error: null });
  await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "unavailable" });
});

it("gestiona solución ausente y errores de Supabase sin detalles internos", async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "unavailable" });
  query.maybeSingle.mockResolvedValue({ data: null, error: { message: "PRIVATE SQL" } });
  await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "error" });
  query.maybeSingle.mockRejectedValue(new Error("PRIVATE NETWORK"));
  await expect(checkExerciseAnswer(id, 1, attemptId)).resolves.toEqual({ status: "error" });
});
