import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getStudentAccess } from "@/lib/auth/student";
import { getExercise } from "./queries";
import type { ContentResult, ExerciseFeedback } from "./types";

export async function checkExerciseAnswer(
  exerciseId: string,
  selectedIndex: number,
  attemptId: string,
): Promise<ContentResult<ExerciseFeedback>> {
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3
    || typeof attemptId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) {
    return { status: "invalid" };
  }

  try {
    // Reuses session-bound identity, active-student authorization, curriculum and publication checks.
    // No privileged client is created for a denied or unavailable exercise.
    const exercise = await getExercise(exerciseId);
    if (exercise.status !== "ok") return exercise;
    const { choices, responseType } = exercise.data;
    if (responseType !== "opcion_multiple" || !choices || choices.length !== 4
      || choices.some((choice) => !choice.trim()) || new Set(choices).size !== 4) {
      return { status: "unavailable" };
    }

    const session = await createSessionClient();
    const access = await getStudentAccess(session);
    if (access.status !== "authorized") return { status: access.status };

    // The student's client cannot read solutions. Keep this stateless client confined to this module.
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret?.startsWith("sb_secret_")) return { status: "unavailable" };
    const { url } = getSupabaseConfig();
    const solutions = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) }) },
    });
    const { data, error } = await solutions.from("soluciones_ejercicios")
      .select("respuesta_correcta,desarrollo_paso_a_paso,ejercicio:ejercicios!inner(id)")
      .eq("ejercicio_id", exercise.data.id)
      // Recheck publication in the solution read itself, including if it changed since getExercise.
      .eq("ejercicio.publicado", true)
      .maybeSingle();
    if (error) return { status: "error" };
    if (!data) return { status: "unavailable" };

    const answer: unknown = data.respuesta_correcta;
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return { status: "unavailable" };
    const key = answer as Record<string, unknown>;
    if (key.version !== 1 || key.tipo !== "opcion_multiple" || typeof key.indice_correcto !== "number"
      || !Number.isInteger(key.indice_correcto) || key.indice_correcto < 0 || key.indice_correcto >= choices.length
      || typeof data.desarrollo_paso_a_paso !== "string" || !data.desarrollo_paso_a_paso.trim()) {
      return { status: "unavailable" };
    }

    const correct = selectedIndex === key.indice_correcto;
    const response = { version: 1, tipo: "opcion_multiple", indice_seleccionado: selectedIndex };
    // Identity and grade come exclusively from the server. PK(id) is the idempotency constraint.
    // No upsert/update: an existing attempt is immutable, including its creation timestamp.
    const { error: saveError } = await solutions.from("respuestas_estudiante").insert({
      id: attemptId, usuario_id: access.student.id, ejercicio_id: exercise.data.id,
      respuesta_json: response, es_correcta: correct, puntaje_obtenido: correct ? 1 : 0,
    });
    if (saveError) {
      if (saveError.code !== "23505") return { status: "error" };
      // A concurrent retry can collide with the first insert. Read only our own row through RLS.
      const { data: previous, error: readError } = await session.from("respuestas_estudiante")
        .select("ejercicio_id,respuesta_json,es_correcta")
        .eq("id", attemptId).eq("usuario_id", access.student.id).maybeSingle();
      if (readError) return { status: "error" };
      if (!previous || previous.ejercicio_id !== exercise.data.id || previous.es_correcta !== correct
        || previous.respuesta_json?.version !== 1 || previous.respuesta_json?.tipo !== "opcion_multiple"
        || previous.respuesta_json?.indice_seleccionado !== selectedIndex) return { status: "invalid" };
    }

    // Feedback is successful only after the attempt has been saved (or its identical retry verified).
    return { status: "ok", data: {
      attemptId,
      exerciseId: exercise.data.id,
      selectedIndex,
      correct,
      explanation: data.desarrollo_paso_a_paso,
    } };
  } catch {
    return { status: "error" };
  }
}
