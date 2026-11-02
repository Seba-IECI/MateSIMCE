import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), clearSessionCookies: vi.fn() }));

import AdminPage from "@/app/admin/page";
import { changePublication } from "@/app/admin/actions";
import { login } from "@/app/login/actions";
import { getAdminDashboard, setExercisePublication } from "@/lib/admin/catalog";
import { getAdminAccess, getStudentAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";

const userId = "11111111-1111-4111-8111-111111111111";
const exerciseId = "22222222-2222-4222-8222-222222222222";
const studentRoleId = "33333333-3333-4333-8333-333333333333";

// Synthetic SDK I/O only. Production role checks, queries, actions and page guards run.
function setup(role = "administrador", options: { inactive?: boolean; noUser?: boolean; noProfile?: boolean } = {}) {
  const profile = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ error: null, data: options.noProfile ? null : {
      id: userId, nombre: " Cuenta de prueba ", activo: !options.inactive,
    } }),
  };
  const count = { eq: vi.fn().mockResolvedValue({ count: 3, error: null }) };
  const users = { select: vi.fn((_columns: string, config?: { head?: boolean }) => config?.head ? count : profile) };
  const roles = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: studentRoleId }, error: null }) };
  const exercises = {
    select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: exerciseId, publicado: false }, error: null }),
    range: vi.fn().mockResolvedValue({ data: [
      { id: exerciseId, titulo: "Ejemplo sintético", publicado: true, tema: { nombre: "Tema simulado", categoria: "numeros" }, respuesta_correcta: "PRIVATE" },
      { id: "44444444-4444-4444-8444-444444444444", titulo: "Otro ejemplo", publicado: false, tema: { nombre: "Otro tema", categoria: "geometria" } },
    ], error: null }),
  };
  const sdk = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: options.noUser ? null : {
        id: userId, user_metadata: { rol: "administrador" },
      } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn(async (_name: string, args: { roles_permitidos: string[] }) => ({ data: args.roles_permitidos.includes(role), error: null })),
    from: vi.fn((table: string) => {
      if (table === "usuarios") return users;
      if (table === "roles") return roles;
      if (table === "ejercicios") return exercises;
      throw new Error("Unexpected table");
    }),
  };
  const session = sdk as unknown as SupabaseClient;
  vi.mocked(createClient).mockResolvedValue(session);
  return { session, sdk, users, count, exercises, roles };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(redirect).mockImplementation((url) => { throw new Error(`redirect:${url}`); });
});

it.each(["administrador", "alumno", "profesor"])("autoriza el panel solo al administrador: %s", async (role) => {
  const f = setup(role);
  const result = await getAdminAccess(f.session);
  expect(result.status).toBe(role === "administrador" ? "authorized" : "forbidden");
  expect(f.sdk.auth.getUser).toHaveBeenCalledOnce();
  expect(f.sdk.rpc).toHaveBeenCalledExactlyOnceWith("usuario_tiene_rol", { roles_permitidos: ["administrador"] });
  if (role === "administrador") await expect(getStudentAccess(f.session)).resolves.toEqual({ status: "forbidden" });
});

it.each([{ inactive: true }, { noProfile: true }, { noUser: true }])("deniega la administración con identidad o perfil inválido: %j", async (options) => {
  const f = setup("administrador", options);
  expect((await getAdminAccess(f.session)).status).not.toBe("authorized");
  expect(f.sdk.rpc).not.toHaveBeenCalled();
});

it.each([["administrador", "/admin"], ["alumno", "/"]])("el login de %s utiliza el destino autorizado %s", async (role, destination) => {
  const f = setup(role);
  const form = new FormData();
  form.set("email", "account@example.test"); form.set("password", "synthetic-password");
  form.set("rol", "administrador"); form.set("next", "https://other.example/");
  await expect(login({ success: false, message: null }, form)).resolves.toEqual({ success: true, message: null, destination });
  expect(f.sdk.auth.signInWithPassword).toHaveBeenCalledExactlyOnceWith({ email: "account@example.test", password: "synthetic-password" });
});

it("consulta estadísticas con RLS y solo proyecta datos mínimos del catálogo", async () => {
  const f = setup();
  const result = await getAdminDashboard();
  expect(result).toMatchObject({ status: "ok", data: { students: 3, total: 2, published: 1, unpublished: 1 } });
  expect(f.users.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
  expect(f.count.eq).toHaveBeenCalledWith("rol_id", studentRoleId);
  expect(f.exercises.select).toHaveBeenCalledExactlyOnceWith("id,titulo,publicado,tema:temas(nombre,categoria)");
  if (result.status === "ok") expect(result.data.exercises.map((exercise) => exercise.category)).toEqual(["numeros", "geometria"]);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|respuesta_correcta|rol_id|correo|usuario_id/);
  expect(f.sdk.from.mock.calls.flat()).not.toContain("soluciones_ejercicios");
});

it("no consulta estadísticas ni ejercicios para un alumno aunque falsifique metadatos", async () => {
  const f = setup("alumno");
  await expect(getAdminDashboard()).resolves.toEqual({ status: "forbidden" });
  expect(f.sdk.from).toHaveBeenCalledExactlyOnceWith("usuarios");
  expect(f.exercises.range).not.toHaveBeenCalled();
});

it("un administrador cambia exclusivamente publicado del UUID solicitado", async () => {
  const f = setup();
  await expect(setExercisePublication(exerciseId, false)).resolves.toEqual({ status: "ok", data: null });
  expect(f.exercises.update).toHaveBeenCalledExactlyOnceWith({ publicado: false });
  expect(f.exercises.eq.mock.calls).toEqual([["id", exerciseId], ["publicado", true]]);
});

it("un alumno no puede publicar mediante una llamada directa", async () => {
  const f = setup("alumno");
  await expect(setExercisePublication(exerciseId, false)).resolves.toEqual({ status: "forbidden" });
  expect(f.exercises.update).not.toHaveBeenCalled();
});

it("rechaza UUID y estados inválidos sin consultar Supabase", async () => {
  setup();
  await expect(setExercisePublication("invalid", false)).resolves.toEqual({ status: "invalid" });
  await expect(setExercisePublication(exerciseId, "true" as unknown as boolean)).resolves.toEqual({ status: "invalid" });
  expect(createClient).not.toHaveBeenCalled();
});

it("un reenvío al mismo estado es idempotente y un UUID inexistente se informa", async () => {
  const f = setup();
  f.exercises.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  await expect(setExercisePublication(exerciseId, false)).resolves.toEqual({ status: "ok", data: null });
  f.exercises.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(setExercisePublication(exerciseId, false)).resolves.toEqual({ status: "not_found" });
});

it("la Server Action comprueba el rol y solo revalida después de una actualización autorizada", async () => {
  const form = new FormData();
  form.set("exerciseId", exerciseId); form.set("published", "false"); form.set("rol", "administrador");
  const student = setup("alumno");
  expect((await changePublication({ success: false, message: null }, form)).success).toBe(false);
  expect(student.exercises.update).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
  setup();
  expect((await changePublication({ success: false, message: null }, form)).success).toBe(true);
  expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/admin");
});

it("los errores de Supabase no se filtran al panel ni al formulario", async () => {
  const f = setup();
  f.exercises.range.mockRejectedValue(new Error("PRIVATE DATABASE ERROR"));
  await expect(getAdminDashboard()).resolves.toEqual({ status: "error" });
  f.exercises.maybeSingle.mockRejectedValue(new Error("PRIVATE DATABASE ERROR"));
  const form = new FormData(); form.set("exerciseId", exerciseId); form.set("published", "false");
  const result = await changePublication({ success: false, message: null }, form);
  expect(result.success).toBe(false);
  expect(result.message).not.toContain("PRIVATE");
});

it.each([["sin sesión", true, "/login"], ["alumno", false, "/login?motivo=sin-acceso"]] as const)("/admin redirige a %s antes de consultar el catálogo", async (_name, noUser, destination) => {
  const f = setup("alumno", { noUser });
  await expect(AdminPage()).rejects.toThrow(`redirect:${destination}`);
  expect(f.exercises.range).not.toHaveBeenCalled();
  expect(f.count.eq).not.toHaveBeenCalled();
});
