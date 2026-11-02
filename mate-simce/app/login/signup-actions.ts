"use server";

import { getStudentAccess } from "@/lib/auth/student";
import { clearSessionCookies, createClient } from "@/lib/supabase/server";

export type SignupState = {
  status: "idle" | "error" | "confirmation_required" | "authenticated";
  message: string | null;
  errors?: { name?: string; email?: string; password?: string; confirmation?: string };
};

// Also used for existing accounts: do not disclose whether an email is registered.
const confirmationMessage = "Revisa tu correo. Si el registro puede completarse, recibirás un enlace para confirmar tu dirección. Después podrás iniciar sesión. Si ya tienes cuenta, utiliza Iniciar sesión.";
const failureMessage = "No pudimos completar el registro. Inténtalo nuevamente o contacta a tu docente.";

export async function signup(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const name = field("name").trim();
  const email = field("email").trim();
  const password = field("password");
  const confirmation = field("confirmation");
  const errors: NonNullable<SignupState["errors"]> = {};

  if (!name || name.length > 100) errors.name = "Ingresa tu nombre (máximo 100 caracteres).";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Ingresa un correo electrónico válido.";
  }
  // Local minimum for new MateSIMCE accounts; Auth enforces its configured policy too.
  if (password.length < 8 || password.length > 1024) {
    errors.password = "Utiliza una contraseña de al menos 8 caracteres (máximo 1024).";
  }
  if (!confirmation || confirmation !== password) errors.confirmation = "Las contraseñas deben coincidir.";
  if (Object.keys(errors).length) return { status: "error", message: null, errors };

  try {
    const supabase = await createClient({ writableCookies: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Allowlist only display data. The audited trigger chooses alumno from public.roles.
      options: { data: { nombre: name } },
    });

    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") {
        return { status: "confirmation_required", message: confirmationMessage };
      }
      if (error.code === "weak_password") {
        return { status: "error", message: null, errors: {
          password: "La contraseña no cumple la política de seguridad del servicio. Usa una contraseña más larga con mayúsculas, minúsculas, números y símbolos.",
        } };
      }
      return { status: "error", message: error.status === 429
        ? "Hay demasiados intentos. Espera unos minutos y vuelve a intentar."
        : failureMessage };
    }

    if (!data.user) return { status: "error", message: failureMessage };
    if (!data.session) {
      // No authenticated profile can be checked yet. Never claim provisioning succeeded.
      return { status: "confirmation_required", message: confirmationMessage };
    }

    const access = await getStudentAccess(supabase);
    if (access.status !== "authorized") {
      try { await supabase.auth.signOut({ scope: "local" }); }
      finally { await clearSessionCookies(); }
      return { status: "error", message: "No pudimos habilitar tu perfil de estudiante. Contacta a tu docente antes de volver a registrarte." };
    }
    return { status: "authenticated", message: null };
  } catch {
    try { await clearSessionCookies(); } catch { /* Configuration failures also fail closed. */ }
    return { status: "error", message: failureMessage };
  }
}
