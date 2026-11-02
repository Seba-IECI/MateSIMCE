import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), clearSessionCookies: vi.fn() }));
vi.mock("@/lib/auth/student", () => ({ getStudentAccess: vi.fn() }));

import { signup, type SignupState } from "@/app/login/signup-actions";
import { GET } from "@/app/auth/confirm/route";
import { getStudentAccess } from "@/lib/auth/student";
import { clearSessionCookies, createClient } from "@/lib/supabase/server";

const initial: SignupState = { status: "idle", message: null };
const authorized = { status: "authorized", student: { id: "test-student", name: "Nombre" } } as const;
const signUp = vi.fn();
const signOut = vi.fn();
const verifyOtp = vi.fn();

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: " Nombre ", email: " student@example.test ", password: "Synthetic-Password7!",
    confirmation: "Synthetic-Password7!", ...overrides,
  })) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createClient).mockResolvedValue({ auth: { signUp, signOut, verifyOtp } } as unknown as SupabaseClient);
  signUp.mockResolvedValue({ data: { user: { id: "test-student" }, session: null }, error: null });
  signOut.mockResolvedValue({ error: null });
  verifyOtp.mockResolvedValue({ error: null });
  vi.mocked(getStudentAccess).mockResolvedValue(authorized);
});

it.each([
  ["name", "   "], ["email", "invalid"], ["password", "short"], ["confirmation", "Different-Password8!"],
])("rechaza %s inválido antes de consultar Supabase", async (field, value) => {
  const result = await signup(initial, form({ [field]: value }));
  expect(result.status).toBe("error");
  expect(result.errors?.[field as keyof NonNullable<SignupState["errors"]>]).toBeTruthy();
  expect(createClient).not.toHaveBeenCalled();
});

it("envía solo nombre como metadato e ignora roles e identificadores manipulados", async () => {
  const result = await signup(initial, form({ rol: "administrador", rol_id: "forged", activo: "true", usuario_id: "other" }));
  expect(createClient).toHaveBeenCalledWith({ writableCookies: true });
  expect(signUp).toHaveBeenCalledExactlyOnceWith({
    email: "student@example.test", password: "Synthetic-Password7!", options: { data: { nombre: "Nombre" } },
  });
  expect(result.status).toBe("confirmation_required");
  expect(getStudentAccess).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toMatch(/Synthetic|test-student|access_token|refresh_token/);
});

it("autoriza una sesión inmediata solo después de comprobar el perfil de alumno", async () => {
  signUp.mockResolvedValue({ data: { user: { id: "test-student" }, session: { access_token: "PRIVATE" } }, error: null });
  await expect(signup(initial, form())).resolves.toEqual({ status: "authenticated", message: null });
  expect(getStudentAccess).toHaveBeenCalledOnce();
});

it.each(["forbidden", "unavailable", "unauthenticated"] as const)("cierra la sesión si el perfil es %s", async (status) => {
  signUp.mockResolvedValue({ data: { user: { id: "test-student" }, session: {} }, error: null });
  vi.mocked(getStudentAccess).mockResolvedValue({ status });
  expect((await signup(initial, form())).status).toBe("error");
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(clearSessionCookies).toHaveBeenCalledOnce();
});

it("mantiene el mismo aviso neutral ante una cuenta existente", async () => {
  const pending = await signup(initial, form());
  signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "user_already_exists" } });
  await expect(signup(initial, form())).resolves.toEqual(pending);
});

it("presenta el rechazo de la política real de contraseñas sin detalles internos", async () => {
  signUp.mockResolvedValue({ data: null, error: { code: "weak_password", message: "PRIVATE" } });
  const result = await signup(initial, form());
  expect(result.status).toBe("error");
  expect(result.errors?.password).toContain("política de seguridad");
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});

it("no anuncia éxito cuando falla el trigger o la conexión", async () => {
  signUp.mockResolvedValue({ data: null, error: { code: "unexpected_failure", message: "PRIVATE SQL" } });
  expect((await signup(initial, form())).status).toBe("error");
  signUp.mockRejectedValue(new Error("PRIVATE NETWORK"));
  const result = await signup(initial, form());
  expect(result.status).toBe("error");
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(clearSessionCookies).toHaveBeenCalledOnce();
});

it("confirma el correo y autoriza el perfil con cookies SSR y destino fijo", async () => {
  const response = await GET(new NextRequest("http://127.0.0.1:3100/auth/confirm?token_hash=synthetic-token&type=email&next=https://other.example/"));
  expect(verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: "synthetic-token", type: "email" });
  expect(createClient).toHaveBeenCalledWith({ writableCookies: true });
  expect(getStudentAccess).toHaveBeenCalledOnce();
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("/");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});

it("rechaza enlaces de otros flujos y no llama a Auth", async () => {
  const response = await GET(new NextRequest("http://127.0.0.1:3100/auth/confirm?token_hash=synthetic-token&type=recovery"));
  expect(response.headers.get("location")).toBe("/login?motivo=confirmacion-invalida");
  expect(createClient).not.toHaveBeenCalled();
});

it("un token expirado no abre el dashboard", async () => {
  verifyOtp.mockResolvedValue({ error: { message: "PRIVATE" } });
  const response = await GET(new NextRequest("http://127.0.0.1:3100/auth/confirm?token_hash=synthetic-token&type=email"));
  expect(response.headers.get("location")).toBe("/login?motivo=confirmacion-invalida");
  expect(getStudentAccess).not.toHaveBeenCalled();
});

it("un correo confirmado sin perfil autorizado pierde su sesión", async () => {
  vi.mocked(getStudentAccess).mockResolvedValue({ status: "forbidden" });
  const response = await GET(new NextRequest("http://127.0.0.1:3100/auth/confirm?token_hash=synthetic-token&type=email"));
  expect(response.headers.get("location")).toBe("/login?motivo=perfil-no-disponible");
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(clearSessionCookies).toHaveBeenCalledOnce();
});
