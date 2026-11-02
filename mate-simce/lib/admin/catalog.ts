import "server-only";

import { getAdminAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";

export type AdminExercise = { id: string; title: string; topicName: string; category: string | null; published: boolean };
export type AdminDashboard = {
  students: number;
  total: number;
  published: number;
  unpublished: number;
  exercises: AdminExercise[];
};
type Failure = "unauthenticated" | "forbidden" | "unavailable" | "error" | "invalid" | "not_found";
type Result<T> = { status: "ok"; data: T } | { status: Failure };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAdminDashboard(): Promise<Result<AdminDashboard>> {
  try {
    const session = await createClient();
    const access = await getAdminAccess(session);
    if (access.status !== "authorized") return { status: access.status };
    if (access.role !== "administrador") return { status: "forbidden" };

    const { data: role, error: roleError } = await session.from("roles").select("id")
      .eq("nombre", "alumno").maybeSingle();
    if (roleError || !role) return { status: "error" };
    // Count profiles, including inactive students; no personal records are downloaded.
    const { count, error: countError } = await session.from("usuarios")
      .select("id", { count: "exact", head: true }).eq("rol_id", role.id);
    if (countError || count === null) return { status: "error" };

    const exercises: AdminExercise[] = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await session.from("ejercicios")
        .select("id,titulo,publicado,tema:temas(nombre,categoria)").order("id").range(offset, offset + size - 1);
      if (error || !Array.isArray(data)) return { status: "error" };
      for (const item of data) {
        const topic = item.tema as unknown as { nombre?: unknown; categoria?: unknown } | null;
        if (typeof item.id !== "string" || typeof item.titulo !== "string" || typeof item.publicado !== "boolean") {
          return { status: "error" };
        }
        // Explicit projection: never forward database rows or solution fields to the UI.
        exercises.push({ id: item.id, title: item.titulo, published: item.publicado,
          category: typeof topic?.categoria === "string" ? topic.categoria : null,
          topicName: typeof topic?.nombre === "string" ? topic.nombre : "Tema no disponible" });
      }
      if (data.length < size) break;
    }
    exercises.sort((a, b) => a.title.localeCompare(b.title, "es"));
    const published = exercises.filter((exercise) => exercise.published).length;
    return { status: "ok", data: {
      students: count, total: exercises.length, published, unpublished: exercises.length - published, exercises,
    } };
  } catch {
    return { status: "error" };
  }
}

export async function setExercisePublication(exerciseId: string, published: boolean): Promise<Result<null>> {
  if (typeof exerciseId !== "string" || !uuid.test(exerciseId) || typeof published !== "boolean") {
    return { status: "invalid" };
  }
  try {
    // Every mutation rechecks verified identity, active profile and administrator role.
    const session = await createClient();
    const access = await getAdminAccess(session);
    if (access.status !== "authorized") return { status: access.status };
    if (access.role !== "administrador") return { status: "forbidden" };

    // Use session-bound RLS throughout; update only the requested publication flag.
    const { data, error } = await session.from("ejercicios").update({ publicado: published })
      .eq("id", exerciseId).eq("publicado", !published).select("id,publicado").maybeSingle();
    if (error) return { status: "error" };
    if (data) return data.id === exerciseId && data.publicado === published
      ? { status: "ok", data: null } : { status: "error" };

    // A repeated request for an already-applied state is a harmless success.
    const existing = await session.from("ejercicios").select("id,publicado").eq("id", exerciseId).maybeSingle();
    if (existing.error) return { status: "error" };
    if (!existing.data) return { status: "not_found" };
    return existing.data.publicado === published ? { status: "ok", data: null } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}
