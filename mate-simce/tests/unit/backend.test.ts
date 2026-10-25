import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), clearSessionCookies: vi.fn() }));

import { getStudentAccess } from "@/lib/auth/student";
import { login } from "@/app/login/actions";
import { getExercise, listExercises } from "@/lib/exercises/queries";
import { createClient } from "@/lib/supabase/server";

const studentId = "11111111-1111-4111-8111-111111111111";
const courseId = "22222222-2222-4222-8222-222222222222";
const exerciseId = "33333333-3333-4333-8333-333333333333";

// Only external SDK I/O is replaced. Production authorization and projections run.
function client(exercise: unknown = null) {
  const profile = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: studentId, nombre: " Alumno ", activo: true }, error: null }),
  };
  const courses = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [{ id: courseId }], error: null }),
  };
  const exercises = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: exercise, error: null }),
  };
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: studentId } }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    from: vi.fn((table: string) => {
      if (table === "usuarios") return profile;
      if (table === "cursos") return courses;
      if (table === "ejercicios") return exercises;
      throw new Error("Unexpected table");
    }),
  };
  return { supabase: supabase as unknown as SupabaseClient, profile, courses, exercises, calls: supabase };
}

beforeEach(() => vi.resetAllMocks());

it("U1 getStudentAccess autoriza un alumno activo con identidad verificada", async () => {
  const fixture = client();
  await expect(getStudentAccess(fixture.supabase)).resolves.toEqual({
    status: "authorized", student: { id: studentId, name: "Alumno" },
  });
  expect(fixture.calls.auth.getUser).toHaveBeenCalledOnce();
  expect(fixture.calls.from).toHaveBeenCalledExactlyOnceWith("usuarios");
  expect(fixture.profile.eq).toHaveBeenCalledWith("id", studentId);
  expect(fixture.calls.rpc).toHaveBeenCalledExactlyOnceWith("usuario_tiene_rol", { roles_permitidos: ["alumno"] });
});

it("U2 login rechaza un correo inválido antes de crear el cliente de Auth", async () => {
  const form = new FormData();
  form.set("email", "correo-invalido");
  form.set("password", "valor-sintetico");
  await expect(login({ success: false, message: null }, form)).resolves.toEqual({
    success: false, message: null, errors: { email: "Ingresa un correo electrónico válido." },
  });
  expect(createClient).not.toHaveBeenCalled();
});

it("U3 listExercises rechaza la página cero sin acceder a Supabase", async () => {
  await expect(listExercises(exerciseId, 0)).resolves.toEqual({ status: "invalid" });
  expect(createClient).not.toHaveBeenCalled();
});

it("U4 getExercise proyecta el detalle público y descarta soluciones privadas", async () => {
  const fixture = client({
    id: exerciseId, titulo: "Potencias", enunciado: "Calcula $2^3$.",
    instrucciones: "Lee las alternativas.", tipo_respuesta: "opcion_multiple",
    opciones: ["6", "8", "9", "16"], dificultad: "facil", nivel_desafio: "inicial",
    tiempo_estimado_segundos: 60, imagen_url: null, tema: { nombre: "Números" },
    respuesta_correcta: { indice_correcto: 1 }, desarrollo_paso_a_paso: "PRIVADO",
    soluciones_ejercicios: { respuesta_correcta: "PRIVADO" },
  });
  vi.mocked(createClient).mockResolvedValue(fixture.supabase);
  const result = await getExercise(exerciseId);
  expect(result).toEqual({ status: "ok", data: {
    id: exerciseId, title: "Potencias", statement: "Calcula $2^3$.", topicName: "Números",
    instructions: "Lee las alternativas.", responseType: "opcion_multiple", choices: ["6", "8", "9", "16"],
    difficulty: "facil", challenge: "inicial", estimatedSeconds: 60, imageUrl: null, imageUnavailable: false,
  } });
  expect(fixture.calls.from.mock.calls.map(([table]) => table)).toEqual(["usuarios", "cursos", "ejercicios"]);
  expect(fixture.exercises.eq).toHaveBeenCalledWith("id", exerciseId);
  expect(fixture.exercises.eq).toHaveBeenCalledWith("publicado", true);
  expect(fixture.exercises.eq).toHaveBeenCalledWith("tema.curso_id", courseId);
  expect(fixture.exercises.select.mock.calls[0][0]).not.toContain("*");
  expect(JSON.stringify(result)).not.toMatch(/PRIVADO|respuesta_correcta|indice_correcto|desarrollo_paso_a_paso|soluciones_ejercicios/);
});
