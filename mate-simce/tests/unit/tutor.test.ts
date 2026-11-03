import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "https://example.supabase.co" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/student", () => ({ getStudentAccess: vi.fn() }));
vi.mock("@/lib/exercises/queries", () => ({ getExercise: vi.fn() }));

import { createClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getStudentAccess } from "@/lib/auth/student";
import { getExercise } from "@/lib/exercises/queries";
import { getTutorFeedback } from "@/lib/exercises/tutor";
import type { TutorHelpKind } from "@/lib/exercises/types";

const userId = "11111111-1111-4111-8111-111111111111";
const exerciseId = "22222222-2222-4222-8222-222222222222";
const ownId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
const solution = { respuesta_correcta: { version: 1, tipo: "opcion_multiple", indice_correcto: 1 },
  desarrollo_paso_a_paso: "Multiplica tres factores: $2^3=2\\cdot2\\cdot2=8$.", campo_privado: "PRIVATE" };
let records: Array<{ id: string; usuario_id: string; ejercicio_id: string | null; es_correcta: boolean | null; respuesta_json: unknown }>;
let query: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
let sessionQuery: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; not: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn> };
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_synthetic_test_value");
  records = [
    { id: ownId, usuario_id: userId, ejercicio_id: exerciseId, es_correcta: false,
      respuesta_json: { version: 1, tipo: "opcion_multiple", indice_seleccionado: 0 } },
    { id: otherId, usuario_id: "another-student", ejercicio_id: exerciseId, es_correcta: true,
      respuesta_json: { version: 1, tipo: "opcion_multiple", indice_seleccionado: 1 } },
  ];
  const filters: Array<[string, unknown]> = [];
  const nonNull: string[] = [];
  sessionQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return sessionQuery; }),
    not: vi.fn((column: string) => { nonNull.push(column); return sessionQuery; }),
    maybeSingle: vi.fn(async () => ({ error: null, data: records.find((record) => {
      const row = record as Record<string, unknown>;
      return filters.every(([column, value]) => row[column] === value) && nonNull.every((column) => row[column] !== null);
    }) ?? null })),
  };
  vi.mocked(createSessionClient).mockResolvedValue({ from: vi.fn().mockReturnValue(sessionQuery) } as unknown as Awaited<ReturnType<typeof createSessionClient>>);
  vi.mocked(getStudentAccess).mockResolvedValue({ status: "authorized", student: { id: userId, name: "Test" } });
  vi.mocked(getExercise).mockResolvedValue({ status: "ok", data: {
    id: exerciseId, title: "Potencia de prueba", statement: "Calcula $2^3$.", instructions: "Justifica tu elección.",
    topicName: "Números", responseType: "opcion_multiple", choices: ["6", "8", "9", "16"], difficulty: "facil",
    challenge: "inicial", estimatedSeconds: null, imageUrl: null, imageUnavailable: false,
  } });
  query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: solution, error: null }), insert: vi.fn(), update: vi.fn() };
  from = vi.fn().mockReturnValue(query);
  vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>);
});
afterEach(() => vi.unstubAllEnvs());

it.each(["hint", "error", "procedure"] as const)("devuelve %s solo para un intento propio corregido y publicado, sin escribir datos", async (kind) => {
  const result = await getTutorFeedback(ownId, kind);
  expect(result).toMatchObject({ status: "ok", data: { attemptId: ownId, exerciseId, kind } });
  expect(sessionQuery.eq).toHaveBeenCalledWith("usuario_id", userId);
  expect(getExercise).toHaveBeenCalledExactlyOnceWith(exerciseId);
  expect(from).toHaveBeenCalledExactlyOnceWith("soluciones_ejercicios");
  expect(query.eq).toHaveBeenCalledWith("ejercicio_id", exerciseId);
  expect(query.eq).toHaveBeenCalledWith("ejercicio.publicado", true);
  expect(query.insert).not.toHaveBeenCalled(); expect(query.update).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toMatch(/indice_correcto|respuesta_correcta|PRIVATE|usuario_id|sb_secret/);
  if (result.status !== "ok") throw new Error("Expected help");
  if (kind === "hint") {
    expect(result.data.text).toContain("Potencia de prueba");
    expect(result.data.text).not.toContain(solution.desarrollo_paso_a_paso);
  }
  if (kind === "error") {
    expect(result.data.text).toContain("Seleccionaste: 6");
    expect(result.data.text).toContain("no podemos determinar el error específico");
  }
  if (kind !== "hint") expect(result.data.text).toContain(solution.desarrollo_paso_a_paso);
});

it("no inventa un error cuando la alternativa guardada fue correcta", async () => {
  records[0].es_correcta = true;
  records[0].respuesta_json = { version: 1, tipo: "opcion_multiple", indice_seleccionado: 1 };
  const result = await getTutorFeedback(ownId, "error");
  expect(result).toMatchObject({ status: "ok", data: { title: "Comprende por qué acertaste" } });
});

it("un UUID ajeno o inexistente no permite acceder a la solución", async () => {
  await expect(getTutorFeedback(otherId, "procedure")).resolves.toEqual({ status: "not_found" });
  expect(createClient).not.toHaveBeenCalled();
});

it.each(["unauthenticated", "forbidden", "unavailable"] as const)("deniega %s, incluidos administradores, antes de leer intentos o soluciones", async (status) => {
  vi.mocked(getStudentAccess).mockResolvedValue({ status });
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status });
  expect(sessionQuery.select).not.toHaveBeenCalled(); expect(createClient).not.toHaveBeenCalled();
});

it("un intento sin corregir o de ensayo no desbloquea la ayuda", async () => {
  records[0].es_correcta = null;
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "not_found" });
  records[0].es_correcta = false; records[0].ejercicio_id = null;
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "not_found" });
  expect(createClient).not.toHaveBeenCalled();
});

it("un ejercicio retirado no permite crear el cliente privilegiado", async () => {
  vi.mocked(getExercise).mockResolvedValue({ status: "not_found" });
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "not_found" });
  expect(createClient).not.toHaveBeenCalled();
});

it("valida el intento y la acción pedagógica en el servidor", async () => {
  await expect(getTutorFeedback("invalid", "hint")).resolves.toEqual({ status: "invalid" });
  await expect(getTutorFeedback(ownId, "ignore-rules" as TutorHelpKind)).resolves.toEqual({ status: "invalid" });
  expect(createSessionClient).not.toHaveBeenCalled();
});

it("rechaza JSON de respuesta inválido, claves inconsistentes y resultados que ya no coinciden", async () => {
  records[0].respuesta_json = { version: 1, tipo: "opcion_multiple", indice_seleccionado: 9 };
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "unavailable" });
  records[0].respuesta_json = { version: 1, tipo: "opcion_multiple", indice_seleccionado: 0 };
  query.maybeSingle.mockResolvedValue({ data: { ...solution, respuesta_correcta: { version: 1, tipo: "opcion_multiple", indice_correcto: 4 } }, error: null });
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "unavailable" });
  query.maybeSingle.mockResolvedValue({ data: solution, error: null });
  records[0].es_correcta = true;
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "unavailable" });
});

it("gestiona ausencia de solución, clave y fallos de red sin revelar detalles", async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "unavailable" });
  query.maybeSingle.mockRejectedValue(new Error("PRIVATE NETWORK"));
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "error" });
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "unavailable" });
});
