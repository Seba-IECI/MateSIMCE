import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), clearSessionCookies: vi.fn() }));
vi.mock("@/lib/auth/student", () => ({ getLoginAccess: vi.fn(), getStudentAccess: vi.fn() }));

import { headers } from "next/headers";
import { requestPasswordReset, updatePassword, type RecoveryState } from "@/app/login/recovery-actions";
import { GET } from "@/app/auth/confirm/route";
import { getLoginAccess } from "@/lib/auth/student";
import { clearSessionCookies, createClient } from "@/lib/supabase/server";

const initial: RecoveryState = { status: "idle", message: null };
const resetPasswordForEmail = vi.fn(), updateUser = vi.fn(), verifyOtp = vi.fn(), signOut = vi.fn(), exchangeCodeForSession = vi.fn();
const identity = { id: "test-user", name: "Cuenta sintética" };
function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ email: " student@example.test ", password: "Synthetic-Password7!", confirmation: "Synthetic-Password7!", ...fields })) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.mocked(headers).mockResolvedValue(new Headers({ origin: "https://matesimce-2026.vercel.app" }) as Awaited<ReturnType<typeof headers>>);
  vi.mocked(createClient).mockResolvedValue({ auth: { resetPasswordForEmail, updateUser, verifyOtp, signOut, exchangeCodeForSession } } as unknown as SupabaseClient);
  vi.mocked(getLoginAccess).mockResolvedValue({ status: "authorized", role: "alumno", user: identity });
  resetPasswordForEmail.mockResolvedValue({ error: null });
  updateUser.mockResolvedValue({ data: { user: identity }, error: null });
  verifyOtp.mockResolvedValue({ data: { user: identity, session: {} }, error: null });
  exchangeCodeForSession.mockResolvedValue({ data: { user: identity, session: {}, redirectType: "recovery" }, error: null });
});
afterEach(() => vi.restoreAllMocks());

it("solicita recuperación con SSR y destino permitido, ignorando redirecciones del formulario", async () => {
  const result = await requestPasswordReset(initial, form({ redirectTo: "https://other.example" }));
  expect(result).toEqual({ status: "sent", message: "Si existe una cuenta asociada a este correo, recibirás instrucciones para recuperar tu contraseña" });
  expect(resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith("student@example.test", { redirectTo: "https://matesimce-2026.vercel.app/auth/confirm" });
  expect(createClient).toHaveBeenCalledWith({ writableCookies: true });
  expect(console.info).toHaveBeenCalledExactlyOnceWith("[auth:recovery]", "accepted_by_auth");
});

it.each(["user_not_found", "over_email_send_rate_limit", "unexpected_failure"])("no enumera cuentas ni filtra errores del proveedor (%s)", async (code) => {
  const normal = await requestPasswordReset(initial, form());
  resetPasswordForEmail.mockResolvedValue({ error: { code, message: "PRIVATE" } });
  expect(await requestPasswordReset(initial, form({ email: "not-registered@example.test" }))).toEqual(normal);
});

it.each([
  ["over_email_send_rate_limit", "rate_limited"],
  ["over_request_rate_limit", "rate_limited"],
  ["email_address_not_authorized", "recipient_not_authorized"],
  ["email_provider_disabled", "email_provider_disabled"],
  ["unexpected_failure", "provider_rejected"],
])("diagnostica %s solo con un código fijo de servidor", async (code, reason) => {
  resetPasswordForEmail.mockResolvedValue({ error: { code, message: "PRIVATE student@example.test token=synthetic-secret" } });
  expect((await requestPasswordReset(initial, form())).status).toBe("sent");
  expect(console.warn).toHaveBeenCalledExactlyOnceWith("[auth:recovery]", reason);
  expect(console.info).not.toHaveBeenCalled();
});

it("identifica HTTP 429 aunque no haya un código Auth conocido", async () => {
  resetPasswordForEmail.mockResolvedValue({ error: { status: 429, code: "unknown", message: "PRIVATE" } });
  expect((await requestPasswordReset(initial, form())).status).toBe("sent");
  expect(console.warn).toHaveBeenCalledExactlyOnceWith("[auth:recovery]", "rate_limited");
});

it("no registra detalles arbitrarios del proveedor ni de excepciones de red", async () => {
  resetPasswordForEmail.mockResolvedValue({ error: { code: "PRIVATE student@example.test", message: "PRIVATE token=synthetic-secret" } });
  await requestPasswordReset(initial, form());
  expect(console.warn).toHaveBeenCalledExactlyOnceWith("[auth:recovery]", "provider_rejected");
  vi.mocked(console.warn).mockClear();
  resetPasswordForEmail.mockRejectedValue(new Error("PRIVATE student@example.test token=synthetic-secret"));
  expect((await requestPasswordReset(initial, form())).status).toBe("error");
  expect(console.warn).toHaveBeenCalledExactlyOnceWith("[auth:recovery]", "request_failed");
});

it("rechaza correos y orígenes inválidos antes de crear el cliente", async () => {
  expect((await requestPasswordReset(initial, form({ email: "invalid" }))).errors?.email).toBeTruthy();
  vi.mocked(headers).mockResolvedValue(new Headers({ origin: "https://other.example" }) as Awaited<ReturnType<typeof headers>>);
  expect((await requestPasswordReset(initial, form())).status).toBe("error");
  expect(createClient).not.toHaveBeenCalled();
});

it("verifica únicamente recovery y redirige sin conservar tokens ni next", async () => {
  const response = await GET(new NextRequest("https://matesimce-2026.vercel.app/auth/confirm?type=recovery&token_hash=synthetic-token&next=https://other.example"));
  expect(verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: "synthetic-token", type: "recovery" });
  expect(response.headers.get("location")).toBe("/reset-password");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});

it("los dos enlaces de la plantilla de correo llegan al flujo recovery compatible con SSR", async () => {
  const template = readFileSync(new URL("../../supabase/templates/reset-password.html", import.meta.url), "utf8");
  const links = Array.from(template.matchAll(/href="([^"]+)"/g), ([, href]) => href);
  expect(links).toHaveLength(2);
  expect(new Set(links).size).toBe(1);
  expect(template).not.toContain(".ConfirmationURL");
  const url = links[0]
    .replace("{{ .RedirectTo }}", "https://matesimce-2026.vercel.app/auth/confirm")
    .replace("{{ .TokenHash }}", "synthetic-token")
    .replaceAll("&amp;", "&");
  const response = await GET(new NextRequest(url));
  expect(verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: "synthetic-token", type: "recovery" });
  expect(response.headers.get("location")).toBe("/reset-password");
});

it.each(["otp_expired", "otp_disabled"])("un enlace inválido o caducado no abre el formulario (%s)", async (code) => {
  verifyOtp.mockResolvedValue({ error: { code, message: "PRIVATE" } });
  const response = await GET(new NextRequest("https://matesimce-2026.vercel.app/auth/confirm?type=recovery&token_hash=synthetic-token"));
  expect(response.headers.get("location")).toBe("/login?modo=recuperar&motivo=recuperacion-invalida");
  expect(getLoginAccess).not.toHaveBeenCalled();
});

it.each(["", "&type=recovery"])("intercambia el código del correo predeterminado con PKCE y destino fijo (%s)", async (suffix) => {
  const response = await GET(new NextRequest(`https://matesimce-2026.vercel.app/auth/confirm?code=synthetic-code${suffix}&next=https://other.example`));
  expect(exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("synthetic-code");
  expect(verifyOtp).not.toHaveBeenCalled();
  expect(getLoginAccess).toHaveBeenCalledOnce();
  expect(response.headers.get("location")).toBe("/reset-password");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("location")).not.toContain("synthetic-code");
});

it("el SDK SSR instalado conserva el verificador de recuperación entre la solicitud y el callback", async () => {
  // SDK y cookies reales en memoria; todo HTTP se sustituye y usa datos sintéticos.
  const jar = new Map<string, string>();
  let challenge: string | undefined;
  const authFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body));
    if (url.origin !== "https://project.example.test") throw new Error("Unexpected origin");
    if (url.pathname === "/auth/v1/recover") {
      challenge = body.code_challenge;
      expect(body.code_challenge_method).toBe("s256");
      return Response.json({});
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce") {
      expect(body.auth_code).toBe("synthetic-code");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.code_verifier));
      expect(Buffer.from(digest).toString("base64url")).toBe(challenge);
      return Response.json({
        access_token: "synthetic-access-token", refresh_token: "synthetic-refresh-token",
        expires_in: 3600, token_type: "bearer",
        user: { ...identity, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
      });
    }
    throw new Error("Unexpected Auth request");
  });
  const client = () => createServerClient("https://project.example.test", "synthetic-public-key", {
    global: { fetch: authFetch },
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (values) => { for (const { name, value } of values) { if (value) jar.set(name, value); else jar.delete(name); } },
    },
  });
  vi.mocked(createClient).mockResolvedValueOnce(client());
  expect((await requestPasswordReset(initial, form())).status).toBe("sent");
  expect(challenge).toBeTruthy();
  expect(jar.size).toBeGreaterThan(0);
  vi.mocked(createClient).mockResolvedValueOnce(client());
  const response = await GET(new NextRequest("https://matesimce-2026.vercel.app/auth/confirm?code=synthetic-code"));
  expect(response.headers.get("location")).toBe("/reset-password");
  expect(authFetch).toHaveBeenCalledTimes(2);
  expect(getLoginAccess).toHaveBeenCalledOnce();
});

it.each(["flow_state_expired", "pkce_verifier_mismatch", "flow_state_not_found", "bad_code_verifier"])("rechaza PKCE caducado, reutilizado o sin el verificador correspondiente (%s)", async (code) => {
  exchangeCodeForSession.mockResolvedValue({ data: { user: null, session: null, redirectType: null }, error: { code, message: "PRIVATE" } });
  const response = await GET(new NextRequest("https://matesimce-2026.vercel.app/auth/confirm?code=synthetic-code"));
  expect(response.headers.get("location")).toBe("/login?modo=recuperar&motivo=recuperacion-invalida");
  expect(getLoginAccess).not.toHaveBeenCalled();
});

it.each([null, "signup", "magiclink"])("no convierte un código de otro flujo en recuperación con un type manipulado (%s)", async (redirectType) => {
  exchangeCodeForSession.mockResolvedValue({ data: { user: identity, session: {}, redirectType }, error: null });
  const response = await GET(new NextRequest("https://matesimce-2026.vercel.app/auth/confirm?code=synthetic-code&type=recovery"));
  expect(response.headers.get("location")).toContain("recuperacion-invalida");
  expect(getLoginAccess).not.toHaveBeenCalled();
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(clearSessionCookies).toHaveBeenCalledOnce();
});

it.each([
  { session: null, user: identity }, { session: {}, user: { id: "another-user" } },
])("no habilita recuperación PKCE con sesión incompleta o identidad diferente (%#)", async (data) => {
  exchangeCodeForSession.mockResolvedValue({ data: { ...data, redirectType: "recovery" }, error: null });
  const response = await GET(new NextRequest("https://matesimce-2026.vercel.app/auth/confirm?code=synthetic-code"));
  expect(response.headers.get("location")).toContain("recuperacion-invalida");
  expect(clearSessionCookies).toHaveBeenCalledOnce();
});

it.each(["unauthenticated", "forbidden", "unavailable"] as const)("PKCE conserva la denegación del acceso %s", async (status) => {
  vi.mocked(getLoginAccess).mockResolvedValue({ status });
  const response = await GET(new NextRequest("https://matesimce-2026.vercel.app/auth/confirm?code=synthetic-code"));
  expect(response.headers.get("location")).toContain("recuperacion-invalida");
  expect(clearSessionCookies).toHaveBeenCalledOnce();
});

it.each([
  "type=recovery", "type=recovery&code=", `code=${"a".repeat(2049)}`,
  "code=synthetic-code&token_hash=synthetic-token&type=recovery", "code=synthetic-code&type=magiclink",
])("rechaza formatos ausentes, ambiguos o inválidos antes de llamar a Auth (%#)", async (query) => {
  await GET(new NextRequest(`https://matesimce-2026.vercel.app/auth/confirm?${query}`));
  expect(createClient).not.toHaveBeenCalled();
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
  expect(verifyOtp).not.toHaveBeenCalled();
});

it.each([
  { session: null, user: identity }, { session: {}, user: { id: "another-user" } },
])("no habilita una sesión incompleta o distinta de la identidad verificada (%#)", async (data) => {
  verifyOtp.mockResolvedValue({ data, error: null });
  const response = await GET(new NextRequest("https://matesimce-2026.vercel.app/auth/confirm?type=recovery&token_hash=synthetic-token"));
  expect(response.headers.get("location")).toContain("recuperacion-invalida");
  expect(clearSessionCookies).toHaveBeenCalledOnce();
});

it.each(["unauthenticated", "forbidden", "unavailable"] as const)("no habilita recuperación para acceso %s", async (status) => {
  vi.mocked(getLoginAccess).mockResolvedValue({ status });
  expect((await updatePassword(identity.id, initial, form())).status).toBe("error");
  expect(updateUser).not.toHaveBeenCalled();
  const response = await GET(new NextRequest("https://matesimce-2026.vercel.app/auth/confirm?type=recovery&token_hash=synthetic-token"));
  expect(response.headers.get("location")).toContain("recuperacion-invalida");
  expect(clearSessionCookies).toHaveBeenCalled();
});

it.each([["password", "short"], ["confirmation", "Different-Password8!"]])("valida %s en servidor antes de contactar Auth", async (field, value) => {
  expect((await updatePassword(identity.id, initial, form({ [field]: value }))).status).toBe("error");
  expect(createClient).not.toHaveBeenCalled();
});

it("solo cambia la contraseña de la sesión vinculada al formulario y cierra el acceso local", async () => {
  const result = await updatePassword(identity.id, initial, form({ user_id: "other-user", role: "administrador" }));
  expect(result.status).toBe("updated");
  expect(updateUser).toHaveBeenCalledExactlyOnceWith({ password: "Synthetic-Password7!" });
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(clearSessionCookies).toHaveBeenCalledOnce();
  expect(JSON.stringify(result)).not.toContain("Synthetic-Password");
});

it("no actualiza otra cuenta si cambia la sesión después de abrir el formulario", async () => {
  expect((await updatePassword("another-user", initial, form())).status).toBe("error");
  expect(updateUser).not.toHaveBeenCalled();
});

it("confirma una actualización exitosa y limpia cookies aunque falle el cierre remoto", async () => {
  signOut.mockRejectedValue(new Error("PRIVATE"));
  expect((await updatePassword(identity.id, initial, form())).status).toBe("updated");
  expect(clearSessionCookies).toHaveBeenCalledOnce();
});

it("respeta la política de contraseña de Supabase sin publicar detalles", async () => {
  updateUser.mockResolvedValue({ data: {}, error: { code: "weak_password", message: "PRIVATE" } });
  const result = await updatePassword(identity.id, initial, form());
  expect(result.status).toBe("error"); expect(result.message).toContain("política");
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});
