"use server";

import { getStudentAccess } from "@/lib/auth/student";
import { clearSessionCookies, createClient } from "@/lib/supabase/server";

export type LoginState = {
  success: boolean;
  message: string | null;
  errors?: { email?: string; password?: string };
};

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const errors: NonNullable<LoginState["errors"]> = {};

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Ingresa un correo electrónico válido.";
  }
  // Login accepts existing passwords; it must not apply new-account rules.
  if (!password || password.length > 1024) {
    errors.password = "Ingresa tu contraseña.";
  }
  if (Object.keys(errors).length) return { success: false, message: null, errors };

  try {
    const supabase = await createClient({ writableCookies: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return {
        success: false,
        message: error.status === 429
          ? "Hay demasiados intentos. Espera unos minutos y vuelve a intentar."
          : "No pudimos iniciar sesión. Revisa tu correo y contraseña e inténtalo nuevamente.",
      };
    }

    const access = await getStudentAccess(supabase);
    if (access.status !== "authorized") {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } finally {
        await clearSessionCookies();
      }
      return {
        success: false,
        message: access.status === "unavailable"
          ? "No pudimos verificar tu acceso. Inténtalo nuevamente o contacta a tu docente."
          : "Esta cuenta no tiene acceso al espacio de estudiantes. Contacta a tu docente.",
      };
    }

    // Never serialize credentials, tokens or database records to the form.
    return { success: true, message: null };
  } catch {
    try {
      await clearSessionCookies();
    } catch {
      // A missing configuration must also produce a safe, generic form error.
    }
    return { success: false, message: "El servicio de acceso no está disponible. Inténtalo nuevamente." };
  }
}
