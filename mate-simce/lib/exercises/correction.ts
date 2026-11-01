import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getExercise } from "./queries";
import type { ContentResult, ExerciseFeedback } from "./types";

export async function checkExerciseAnswer(
  exerciseId: string,
  selectedIndex: number,
): Promise<ContentResult<ExerciseFeedback>> {
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
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

    // Only feedback for this submitted choice leaves the server, never the solution row or answer index.
    return { status: "ok", data: {
      exerciseId: exercise.data.id,
      selectedIndex,
      correct: selectedIndex === key.indice_correcto,
      explanation: data.desarrollo_paso_a_paso,
    } };
  } catch {
    return { status: "error" };
  }
}
