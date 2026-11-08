"use server";

import { headers } from "next/headers";
import { getLoginAccess } from "@/lib/auth/student";
import { clearSessionCookies, createClient } from "@/lib/supabase/server";

export type RecoveryState = {
  status: "idle" | "error" | "sent" | "updated";
  message: string | null;
  errors?: { email?: string; password?: string; confirmation?: string };
};

const neutralMessage = "Si existe una cuenta asociada a este correo, recibirás instrucciones para recuperar tu contraseña";

export async function requestPasswordReset(_previous: RecoveryState, form: FormData): Promise<RecoveryState> {
  const raw = form.get("email");
  const email = typeof raw === "string" ? raw.trim() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: null, errors: { email: "Ingresa un correo electrónico válido." } };
  }
  try {
    // Destinos propios: nunca usar un redirectTo enviado por el formulario ni un Host arbitrario.
    const origin = (await headers()).get("origin");
    if (!origin || !(origin === "https://matesimce-2026.vercel.app" || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin))) {
      return { status: "error", message: "Solicita la recuperación desde el sitio de MateSIMCE." };
    }
    const supabase = await createClient({ writableCookies: true });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
    // Diagnóstico exclusivamente de servidor: códigos fijos, sin datos de la cuenta ni errores completos.
    if (error) {
      const reason = error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit"
        ? "rate_limited"
        : error.code === "email_address_not_authorized" ? "recipient_not_authorized"
        : error.code === "email_provider_disabled" ? "email_provider_disabled"
        : "provider_rejected";
      console.warn("[auth:recovery]", reason);
    } else {
      // Auth puede aceptar la solicitud sin enviar correo si la cuenta no existe.
      console.info("[auth:recovery]", "accepted_by_auth");
    }
    // No distinguir cuentas inexistentes, bloqueadas o limitadas por el proveedor.
    // Esta respuesta no acredita entrega del correo; SMTP se comprueba por separado.
    return { status: "sent", message: neutralMessage };
  } catch {
    console.warn("[auth:recovery]", "request_failed");
    return { status: "error", message: "No pudimos contactar al servicio de recuperación. Inténtalo nuevamente." };
  }
}

export async function updatePassword(expectedUserId: string, _previous: RecoveryState, form: FormData): Promise<RecoveryState> {
  const password = form.get("password");
  const confirmation = form.get("confirmation");
  const errors: NonNullable<RecoveryState["errors"]> = {};
  if (typeof password !== "string" || password.length < 8 || password.length > 1024) {
    errors.password = "Utiliza una contraseña de al menos 8 caracteres (máximo 1024).";
  }
  if (typeof confirmation !== "string" || !confirmation || confirmation !== password) errors.confirmation = "Las contraseñas deben coincidir.";
  if (Object.keys(errors).length) return { status: "error", message: null, errors };

  try {
    const supabase = await createClient({ writableCookies: true });
    // La identidad y el perfil se verifican otra vez; nunca se actualiza por ID administrativo.
    const access = await getLoginAccess(supabase);
    if (access.status !== "authorized" || access.user.id !== expectedUserId) {
      return { status: "error", message: "El enlace o la sesión ya no están disponibles. Solicita un nuevo correo de recuperación." };
    }
    const { data, error } = await supabase.auth.updateUser({ password: password as string });
    if (error) return { status: "error", message: error.code === "weak_password"
      ? "La contraseña no cumple la política del servicio. Usa una contraseña más larga con mayúsculas, minúsculas, números y símbolos."
      : "No pudimos actualizar la contraseña. Usa una distinta de la anterior o solicita un nuevo enlace." };
    if (data.user?.id !== access.user.id) return { status: "error", message: "No pudimos confirmar la actualización. Solicita un nuevo enlace." };
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* Se eliminan igualmente las cookies locales. */ }
    await clearSessionCookies();
    return { status: "updated", message: "Tu contraseña se actualizó correctamente. Vuelve a iniciar sesión." };
  } catch {
    return { status: "error", message: "No pudimos completar la operación. Inténtalo nuevamente o solicita un nuevo enlace." };
  }
}
