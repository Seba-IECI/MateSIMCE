import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "https://example.supabase.co" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/student", () => ({ getStudentAccess: vi.fn() }));
vi.mock("@/lib/exercises/queries", () => ({ getExercise: vi.fn() }));
vi.mock("@/lib/ai/gemini", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/ai/gemini")>(), generateTutorHelp: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getStudentAccess } from "@/lib/auth/student";
import { getExercise } from "@/lib/exercises/queries";
import { getExerciseHint, getTutorFeedback } from "@/lib/exercises/tutor";
import { generateTutorHelp } from "@/lib/ai/gemini";
import type { TutorHelpKind } from "@/lib/exercises/types";
import { verifiedTutorExplanation } from "@/lib/exercises/tutor-fallback";
import katex from "katex";

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
  vi.mocked(generateTutorHelp).mockResolvedValue({ source: "verified", reason: "disabled" });
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

it.each([
  { topic: "Números", statement: String.raw`Calcula $\frac{3}{4}+\frac{1}{4}$.`,
    selectedChoice: String.raw`$\frac{1}{2}$`, correctChoice: "$1$",
    procedure: String.raw`Conserva el denominador: $\frac{3+1}{4}=\frac{4}{4}=1$.`, guidance: "denominadores compatibles" },
  { topic: "Álgebra y funciones", statement: "Resuelve $3x+2=11$.", selectedChoice: "$x=2$", correctChoice: "$x=3$",
    procedure: "Resta $2$ a ambos lados: $3x=9$. Divide por $3$: $x=3$.", guidance: "Identifica la incógnita" },
  { topic: "Geometría", statement: "Determina la longitud de la diagonal.", selectedChoice: "$2$", correctChoice: String.raw`$2\sqrt{2}$`,
    procedure: String.raw`Aplica Pitágoras: $d^{2}=2^{2}+2^{2}=8$, por tanto $d=2\sqrt{2}$.`, guidance: "unidades" },
  { topic: "Estadística y probabilidades", statement: "Calcula la probabilidad del evento indicado.", selectedChoice: String.raw`$\frac{1}{3}$`, correctChoice: String.raw`$\frac{1}{2}$`,
    procedure: String.raw`El enunciado describe dos casos equiprobables y uno favorable: $P=\frac{1}{2}$.`, guidance: "resultados cuentan" },
])("el respaldo de $topic conserva la referencia completa y orienta sin inventar cálculos", (item) => {
  const text = verifiedTutorExplanation({ ...item, correct: false });
  expect(text).toContain(`Seleccionaste: ${item.selectedChoice}`);
  expect(text).toContain(`Solución verificada: ${item.correctChoice}`);
  expect(text).toContain(item.guidance);
  expect(text.endsWith(item.procedure)).toBe(true);
  expect(text).toContain("no podemos determinar el error específico");
  for (const match of text.matchAll(/\$([^$\n]+)\$/g)) {
    expect(() => katex.renderToString(match[1], { trust: false, throwOnError: true, strict: "error" })).not.toThrow();
  }
});

it("ofrece una pista previa con datos públicos, sin leer soluciones, intentos ni llamar a Gemini", async () => {
  const result = await getExerciseHint(exerciseId);
  expect(result).toMatchObject({ status: "ok", data: { exerciseId, text: expect.any(String) } });
  expect(getExercise).toHaveBeenCalledExactlyOnceWith(exerciseId);
  expect(createClient).not.toHaveBeenCalled();
  expect(createSessionClient).not.toHaveBeenCalled();
  expect(generateTutorHelp).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toMatch(/indice_correcto|respuesta_correcta|PRIVATE|2\^3=|sb_secret/);
});

it.each(["unauthenticated", "forbidden", "not_found"] as const)("no entrega pista previa con acceso %s", async (status) => {
  vi.mocked(getExercise).mockResolvedValue({ status });
  await expect(getExerciseHint(exerciseId)).resolves.toEqual({ status });
  expect(createClient).not.toHaveBeenCalled();
  expect(generateTutorHelp).not.toHaveBeenCalled();
});

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
  expect(generateTutorHelp).not.toHaveBeenCalled();
});

it.each(["unauthenticated", "forbidden", "unavailable"] as const)("deniega %s, incluidos administradores, antes de leer intentos o soluciones", async (status) => {
  vi.mocked(getStudentAccess).mockResolvedValue({ status });
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status });
  expect(sessionQuery.select).not.toHaveBeenCalled(); expect(createClient).not.toHaveBeenCalled();
  expect(generateTutorHelp).not.toHaveBeenCalled();
});

it("un intento sin corregir o de ensayo no desbloquea la ayuda", async () => {
  records[0].es_correcta = null;
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "not_found" });
  records[0].es_correcta = false; records[0].ejercicio_id = null;
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "not_found" });
  expect(createClient).not.toHaveBeenCalled();
  expect(generateTutorHelp).not.toHaveBeenCalled();
});

it("un ejercicio retirado no permite crear el cliente privilegiado", async () => {
  vi.mocked(getExercise).mockResolvedValue({ status: "not_found" });
  await expect(getTutorFeedback(ownId, "procedure")).resolves.toEqual({ status: "not_found" });
  expect(createClient).not.toHaveBeenCalled();
  expect(generateTutorHelp).not.toHaveBeenCalled();
});

it.each(["hint", "error", "procedure"] as const)("identifica %s generado y conserva el procedimiento original cuando corresponde", async (kind) => {
  vi.mocked(generateTutorHelp).mockResolvedValue({ source: "gemini", text: "Explicación matemática simulada y contextualizada.", model: "gemini-2.5-flash" });
  const result = await getTutorFeedback(ownId, kind);
  expect(result).toMatchObject({ status: "ok", data: { source: "gemini", kind } });
  expect(generateTutorHelp).toHaveBeenCalledExactlyOnceWith(userId, ownId, kind, {
    title: "Potencia de prueba", topic: "Números", statement: "Calcula $2^3$.", instructions: "Justifica tu elección.",
    selectedChoice: "6", correct: false, correctChoice: "8", procedure: solution.desarrollo_paso_a_paso,
  });
  if (result.status !== "ok") throw new Error("Expected help");
  if (kind === "procedure") expect(result.data.verifiedProcedure).toBe(solution.desarrollo_paso_a_paso);
  else expect(result.data.verifiedProcedure).toBeUndefined();
  if (kind === "error") expect(result.data.text).toContain("Seleccionaste: 6\n\nTu respuesta es incorrecta.");
  expect(query.insert).not.toHaveBeenCalled(); expect(query.update).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toMatch(/indice_correcto|respuesta_correcta|PRIVATE|usuario_id|sb_secret/);
});

it.each(["limited", "configuration", "unavailable", "invalid", "timeout", "busy"] as const)("conserva el apoyo verificado ante %s sin presentarlo como IA", async (reason) => {
  vi.mocked(generateTutorHelp).mockResolvedValue({ source: "verified", reason });
  const result = await getTutorFeedback(ownId, "procedure");
  expect(result).toMatchObject({ status: "ok", data: {
    source: "verified", text: expect.stringContaining(solution.desarrollo_paso_a_paso),
    notice: expect.stringContaining(reason === "invalid" ? "no superó los controles" : reason === "timeout" ? "superó el tiempo de espera" : reason === "busy" ? "después de un reintento" : "IA no está disponible"),
  } });
  if (reason === "invalid" || reason === "timeout") expect(JSON.stringify(result)).not.toContain("IA no está disponible");
  expect(query.insert).not.toHaveBeenCalled(); expect(query.update).not.toHaveBeenCalled();
  if (result.status !== "ok") throw new Error("Expected feedback");
  expect(result.data.text).toContain("Seleccionaste: 6");
  expect(result.data.text).toContain("Solución verificada: 8");
  expect(result.data.text).toContain("base completa y el exponente");
});

it("conserva la alternativa registrada y el desarrollo original cuando se descarta una atribución trigonométrica", async () => {
  const exercise = await getExercise(exerciseId);
  if (exercise.status !== "ok") throw new Error("Expected fixture");
  const selected = String.raw`$12\cos(45^{\circ})-8\sin(45^{\circ})$`;
  const verified = String.raw`$12\cos(45^{\circ})+8\sin(45^{\circ})$`;
  const procedure = "Las componentes apuntan en el mismo sentido. Se suman sin cambiar los términos.";
  vi.mocked(getExercise).mockResolvedValue({ status: "ok", data: { ...exercise.data,
    topicName: "Geometría", statement: "Se estudian las componentes de dos desplazamientos.",
    choices: [selected, verified, "Otra expresión", "Una cuarta expresión"],
  } });
  query.maybeSingle.mockResolvedValue({ error: null, data: { ...solution, desarrollo_paso_a_paso: procedure } });
  vi.mocked(generateTutorHelp).mockResolvedValue({ source: "verified", reason: "invalid" });
  const result = await getTutorFeedback(ownId, "error");
  expect(result).toMatchObject({ status: "ok", data: { source: "verified", text: expect.stringContaining(procedure) } });
  if (result.status !== "ok") throw new Error("Expected feedback");
  expect(result.data.text).toContain(`Seleccionaste: ${selected}`);
  expect(result.data.text).toContain("La diferencia observable es un signo de suma/resta");
  expect(result.data.text).not.toMatch(/función trigonométrica incorrecta|seno en lugar de coseno/);
  expect(generateTutorHelp).toHaveBeenCalledWith(userId, ownId, "error", expect.objectContaining({ selectedChoice: selected, correctChoice: verified }));
  const hint = await getTutorFeedback(ownId, "hint");
  expect(hint).toMatchObject({ status: "ok", data: { source: "verified", text: expect.stringContaining("sentido apunta cada componente") } });
  if (hint.status !== "ok") throw new Error("Expected hint");
  expect(hint.data.text).not.toMatch(/debes sumar|debes restar|se suman|coseno|seno/);
  expect(hint.data.text).not.toContain(verified);
  expect(hint.data.text).not.toContain(procedure);
  expect(query.insert).not.toHaveBeenCalled(); expect(query.update).not.toHaveBeenCalled();
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
