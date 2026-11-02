import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentAccess =
  | { status: "authorized"; student: { id: string; name: string } }
  | { status: "unauthenticated" | "forbidden" | "unavailable" };

export type AccountAccess =
  | { status: "authorized"; role: "alumno" | "administrador"; user: { id: string; name: string } }
  | { status: "unauthenticated" | "forbidden" | "unavailable" };

async function checkAccess(supabase: SupabaseClient, roles: Array<"alumno" | "administrador">): Promise<AccountAccess> {
  try {
    // getUser verifies identity with Auth; never authorize from getSession().
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { status: "unauthenticated" };

    const { data: profile, error: profileError } = await supabase
      .from("usuarios")
      .select("id, nombre, activo")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) return { status: "unavailable" };
    if (!profile || profile.id !== user.id || profile.activo !== true) {
      return { status: "forbidden" };
    }

    // The role comes only from the audited RPC, never form data or Auth metadata.
    for (const role of roles) {
      const { data: permitted, error: roleError } = await supabase.rpc("usuario_tiene_rol", {
        roles_permitidos: [role],
      });
      if (roleError) return { status: "unavailable" };
      if (permitted === true) return {
        status: "authorized", role,
        user: {
          id: user.id,
          name: typeof profile.nombre === "string"
            ? profile.nombre.trim().slice(0, 100) || (role === "alumno" ? "Estudiante" : "Administrador")
            : role === "alumno" ? "Estudiante" : "Administrador",
        },
      };
    }
    return { status: "forbidden" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function getStudentAccess(supabase: SupabaseClient): Promise<StudentAccess> {
  const access = await checkAccess(supabase, ["alumno"]);
  return access.status === "authorized" ? { status: "authorized", student: access.user } : access;
}

export async function getAdminAccess(supabase: SupabaseClient): Promise<AccountAccess> {
  return checkAccess(supabase, ["administrador"]);
}

export async function getLoginAccess(supabase: SupabaseClient): Promise<AccountAccess> {
  return checkAccess(supabase, ["alumno", "administrador"]);
}
