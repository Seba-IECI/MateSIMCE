import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getStudentAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";
import type { ContentResult, ExerciseDetail, ExercisePage, ExerciseSummary, ExerciseTopic } from "./types";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pageSize = 12;
const summaryColumns = "id,titulo,dificultad,nivel_desafio,tiempo_estimado_segundos,tema:temas!inner(nombre,curso:cursos!inner(id))";
const detailColumns = "id,titulo,enunciado,instrucciones,tipo_respuesta,opciones,dificultad,nivel_desafio,tiempo_estimado_segundos,imagen_url,tema:temas!inner(nombre,curso:cursos!inner(id))";

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid content");
  return value as Row;
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid content");
  return value;
}

function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error("Invalid content");
  return value.map(row);
}

function summary(item: Row): ExerciseSummary {
  const difficulty = item.dificultad;
  const challenge = item.nivel_desafio;
  if (difficulty !== "facil" && difficulty !== "media" && difficulty !== "dificil") throw new Error("Invalid content");
  if (challenge !== "inicial" && challenge !== "intermedio" && challenge !== "avanzado") throw new Error("Invalid content");
  return {
    id: text(item.id),
    title: text(item.titulo),
    topicName: text(row(item.tema).nombre),
    difficulty,
    challenge,
    estimatedSeconds: typeof item.tiempo_estimado_segundos === "number" && item.tiempo_estimado_segundos > 0
      ? item.tiempo_estimado_segundos : null,
  };
}

function trustedImage(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const image = new URL(value);
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return image.protocol === "https:" && image.origin === project.origin
      && image.pathname.startsWith("/storage/v1/object/public/") && !image.username && !image.password
      ? image.href : null;
  } catch {
    return null;
  }
}

// A session-bound read on every invocation. No shared result cache or privileged key.
async function read<T>(
  query: (supabase: SupabaseClient, courseId: string) => PromiseLike<{ data: unknown; error: unknown }>,
  project: (data: unknown) => T,
): Promise<ContentResult<T>> {
  try {
    const supabase = await createClient();
    const access = await getStudentAccess(supabase);
    if (access.status !== "authorized") return { status: access.status };
    // Resolve the curriculum on the server; user-editable profile fields are not authority.
    // The schema allows multiple names per level: detect ambiguity, never pick the first.
    const { data: courses, error: courseError } = await supabase.from("cursos").select("id")
      .eq("activo", true).eq("nivel", "2_medio").limit(2);
    if (courseError) return { status: "error" };
    const matches = rows(courses);
    if (matches.length === 0) return { status: "course_unavailable" };
    if (matches.length !== 1) return { status: "course_ambiguous" };
    const { data, error } = await query(supabase, text(matches[0].id));
    if (error) return { status: "error" };
    if (data === null) return { status: "not_found" };
    return { status: "ok", data: project(data) };
  } catch {
    return { status: "error" };
  }
}

export async function listTopics(): Promise<ContentResult<ExerciseTopic[]>> {
  return read(
    (supabase, courseId) => supabase.from("temas").select("id,nombre,categoria,descripcion,curso:cursos!inner(id)")
      .eq("curso_id", courseId).eq("activo", true).eq("curso.activo", true).eq("curso.nivel", "2_medio")
      .order("orden").order("id"),
    (data) => rows(data).map((item) => ({
      id: text(item.id), name: text(item.nombre), category: text(item.categoria), description: text(item.descripcion),
    })),
  );
}

export async function getCurrentCourse(): Promise<ContentResult<{
  id: string; name: string; level: string; description: string;
}>> {
  return read(
    (supabase, courseId) => supabase.from("cursos").select("id,nombre,nivel,descripcion")
      .eq("id", courseId).eq("activo", true).eq("nivel", "2_medio").maybeSingle(),
    (data) => {
      const item = row(data);
      return { id: text(item.id), name: text(item.nombre), level: text(item.nivel), description: text(item.descripcion) };
    },
  );
}

export async function listExercises(topicId: string, page = 1): Promise<ContentResult<ExercisePage>> {
  if (typeof topicId !== "string" || !uuid.test(topicId) || !Number.isInteger(page) || page < 1 || page > 1000) {
    return { status: "invalid" };
  }
  const offset = (page - 1) * pageSize;
  return read(
    (supabase, courseId) => supabase.from("ejercicios").select(summaryColumns)
      .eq("tema_id", topicId).eq("publicado", true).eq("tema.activo", true).eq("tema.curso.activo", true)
      .eq("tema.curso_id", courseId).eq("tema.curso.nivel", "2_medio")
      .order("titulo").order("id").range(offset, offset + pageSize),
    (data) => {
      const items = rows(data);
      return { exercises: items.slice(0, pageSize).map(summary), page, hasNext: items.length > pageSize && page < 1000 };
    },
  );
}

export async function getExercise(exerciseId: string): Promise<ContentResult<ExerciseDetail>> {
  if (typeof exerciseId !== "string" || !uuid.test(exerciseId)) return { status: "invalid" };
  return read(
    (supabase, courseId) => supabase.from("ejercicios").select(detailColumns)
      .eq("id", exerciseId).eq("publicado", true).eq("tema.activo", true).eq("tema.curso.activo", true)
      .eq("tema.curso_id", courseId).eq("tema.curso.nivel", "2_medio")
      .maybeSingle(),
    (data) => {
      const item = row(data);
      const responseType = item.tipo_respuesta;
      if (responseType !== "opcion_multiple" && responseType !== "respuesta_abierta" && responseType !== "calculo") {
        throw new Error("Invalid content");
      }
      const imageUrl = trustedImage(item.imagen_url);
      // Never serialize raw JSONB: unknown option objects may contain answer keys.
      const choices = responseType === "opcion_multiple" && Array.isArray(item.opciones)
        && item.opciones.length > 0 && item.opciones.every((option) => typeof option === "string")
        ? item.opciones.map((option: string) => option) : null;
      return {
        ...summary(item),
        statement: text(item.enunciado),
        instructions: typeof item.instrucciones === "string" ? item.instrucciones : null,
        responseType, choices, imageUrl,
        imageUnavailable: typeof item.imagen_url === "string" && item.imagen_url.length > 0 && !imageUrl,
      };
    },
  );
}
