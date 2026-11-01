import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "https://example.supabase.co" }) }));
vi.mock("@/lib/exercises/queries", () => ({ getExercise: vi.fn() }));

import { createClient } from "@supabase/supabase-js";
import { getExercise } from "@/lib/exercises/queries";
import { checkExerciseAnswer } from "@/lib/exercises/correction";
import type { ExerciseDetail } from "@/lib/exercises/types";

// Synthetic fixture only; does not use the private bank or connect to Supabase.
const id = "33333333-3333-4333-8333-333333333333";
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
  maybeSingle: ReturnType<typeof vi.fn>;
};
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_synthetic_test_value");
  vi.mocked(getExercise).mockResolvedValue({ status: "ok", data: detail });
  query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: solution, error: null }) };
  from = vi.fn().mockReturnValue(query);
  vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>);
});
afterEach(() => vi.unstubAllEnvs());

it("rechaza índices ausentes, no enteros o fuera de rango antes de consultar", async () => {
  for (const index of [-1, 4, 1.5, NaN, undefined, "1"]) {
    await expect(checkExerciseAnswer(id, index as number)).resolves.toEqual({ status: "invalid" });
  }
  expect(getExercise).not.toHaveBeenCalled();
  expect(createClient).not.toHaveBeenCalled();
});

it("propaga denegaciones y ejercicios retirados sin crear el cliente privilegiado", async () => {
  for (const status of ["unauthenticated", "forbidden", "not_found", "invalid", "course_ambiguous", "error"] as const) {
    vi.mocked(getExercise).mockResolvedValue({ status });
    await expect(checkExerciseAnswer(id, 1)).resolves.toEqual({ status });
  }
  expect(getExercise).toHaveBeenCalledWith(id);
  expect(createClient).not.toHaveBeenCalled();
});

it("no corrige formatos no compatibles o alternativas incompletas", async () => {
  for (const choices of [null, ["1", "2"], ["1", "2", "3", "3"], ["", "2", "3", "4"]]) {
    vi.mocked(getExercise).mockResolvedValue({ status: "ok", data: { ...detail, choices } });
    await expect(checkExerciseAnswer(id, 1)).resolves.toEqual({ status: "unavailable" });
  }
  vi.mocked(getExercise).mockResolvedValue({ status: "ok", data: { ...detail, responseType: "calculo" } });
  await expect(checkExerciseAnswer(id, 1)).resolves.toEqual({ status: "unavailable" });
  expect(createClient).not.toHaveBeenCalled();
});

it.each([[1, true], [0, false]])("corrige el índice %i en servidor (acierto: %s) y proyecta solo su retroalimentación", async (selectedIndex, correct) => {
  const result = await checkExerciseAnswer(id, selectedIndex);
  expect(result).toEqual({ status: "ok", data: {
    exerciseId: id, selectedIndex, correct, explanation: solution.desarrollo_paso_a_paso,
  } });
  expect(from).toHaveBeenCalledExactlyOnceWith("soluciones_ejercicios");
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
  await expect(checkExerciseAnswer(id, 1)).resolves.toEqual({ status: "unavailable" });
  expect(createClient).not.toHaveBeenCalled();
});

it("rechaza soluciones con versión, tipo o índice inválidos y explicaciones vacías", async () => {
  for (const answer of [null, [], { ...solution.respuesta_correcta, version: 2 },
    { ...solution.respuesta_correcta, tipo: "calculo" }, { ...solution.respuesta_correcta, indice_correcto: "1" },
    { ...solution.respuesta_correcta, indice_correcto: 4 }, { ...solution.respuesta_correcta, indice_correcto: 1.5 }]) {
    query.maybeSingle.mockResolvedValue({ data: { ...solution, respuesta_correcta: answer }, error: null });
    await expect(checkExerciseAnswer(id, 1)).resolves.toEqual({ status: "unavailable" });
  }
  query.maybeSingle.mockResolvedValue({ data: { ...solution, desarrollo_paso_a_paso: " " }, error: null });
  await expect(checkExerciseAnswer(id, 1)).resolves.toEqual({ status: "unavailable" });
});

it("gestiona solución ausente y errores de Supabase sin detalles internos", async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(checkExerciseAnswer(id, 1)).resolves.toEqual({ status: "unavailable" });
  query.maybeSingle.mockResolvedValue({ data: null, error: { message: "PRIVATE SQL" } });
  await expect(checkExerciseAnswer(id, 1)).resolves.toEqual({ status: "error" });
  query.maybeSingle.mockRejectedValue(new Error("PRIVATE NETWORK"));
  await expect(checkExerciseAnswer(id, 1)).resolves.toEqual({ status: "error" });
});
