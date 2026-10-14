import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentAccess =
  | { status: "authorized"; student: { id: string; name: string } }
  | { status: "unauthenticated" | "forbidden" | "unavailable" };

export async function getStudentAccess(supabase: SupabaseClient): Promise<StudentAccess> {
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

    // Reuse the audited RPC: it checks auth.uid(), usuario.activo and rol.activo.
    const { data: isStudent, error: roleError } = await supabase.rpc("usuario_tiene_rol", {
      roles_permitidos: ["alumno"],
    });

    if (roleError) return { status: "unavailable" };
    if (isStudent !== true) return { status: "forbidden" };

    return {
      status: "authorized",
      student: {
        id: user.id,
        name: typeof profile.nombre === "string"
          ? profile.nombre.trim().slice(0, 100) || "Estudiante"
          : "Estudiante",
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}
