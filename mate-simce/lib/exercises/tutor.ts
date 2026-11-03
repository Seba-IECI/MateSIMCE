import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getStudentAccess } from "@/lib/auth/student";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getExercise } from "./queries";
import type { ContentResult, TutorFeedback, TutorHelpKind } from "./types";

export async function getTutorFeedback(attemptId: string, kind: TutorHelpKind): Promise<ContentResult<TutorFeedback>> {
  if (typeof attemptId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)
    || !["hint", "error", "procedure"].includes(kind)) return { status: "invalid" };

  try {
    const session = await createSessionClient();
    const access = await getStudentAccess(session);
    if (access.status !== "authorized") return { status: access.status };

    // Read through the student's RLS and explicit ownership filter. Ungraded and exam rows cannot unlock help.
    const { data: attempt, error: attemptError } = await session.from("respuestas_estudiante")
      .select("ejercicio_id,respuesta_json,es_correcta")
      .eq("id", attemptId).eq("usuario_id", access.student.id)
      .not("es_correcta", "is", null).not("ejercicio_id", "is", null).maybeSingle();
    if (attemptError) return { status: "error" };
    if (!attempt || typeof attempt.ejercicio_id !== "string") return { status: "not_found" };
    const response: unknown = attempt.respuesta_json;
    if (!response || typeof response !== "object" || Array.isArray(response)) return { status: "unavailable" };
    const submitted = response as Record<string, unknown>;
    const selectedIndex = submitted.indice_seleccionado;
    if (submitted.version !== 1 || submitted.tipo !== "opcion_multiple" || typeof selectedIndex !== "number"
      || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3
      || typeof attempt.es_correcta !== "boolean") return { status: "unavailable" };

    // Reuse the existing authorization, active II medio curriculum and published-exercise query.
    const exercise = await getExercise(attempt.ejercicio_id);
    if (exercise.status !== "ok") return exercise;
    const { choices, responseType } = exercise.data;
    if (exercise.data.id !== attempt.ejercicio_id || responseType !== "opcion_multiple" || !choices || choices.length !== 4
      || choices.some((choice) => !choice.trim()) || new Set(choices).size !== 4) return { status: "unavailable" };

    // Same stateless, server-only access pattern as correction; created only after ownership and publication checks.
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret?.startsWith("sb_secret_")) return { status: "unavailable" };
    const { url } = getSupabaseConfig();
    const solutions = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) }) },
    });
    const { data, error } = await solutions.from("soluciones_ejercicios")
      .select("respuesta_correcta,desarrollo_paso_a_paso,ejercicio:ejercicios!inner(id)")
      .eq("ejercicio_id", exercise.data.id).eq("ejercicio.publicado", true).maybeSingle();
    if (error) return { status: "error" };
    if (!data) return { status: "unavailable" };
    const answer: unknown = data.respuesta_correcta;
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return { status: "unavailable" };
    const key = answer as Record<string, unknown>;
    if (key.version !== 1 || key.tipo !== "opcion_multiple" || typeof key.indice_correcto !== "number"
      || !Number.isInteger(key.indice_correcto) || key.indice_correcto < 0 || key.indice_correcto >= choices.length
      || typeof data.desarrollo_paso_a_paso !== "string" || !data.desarrollo_paso_a_paso.trim()) return { status: "unavailable" };
    // If content changed after grading, do not contradict or rewrite the recorded result.
    if (attempt.es_correcta !== (selectedIndex === key.indice_correcto)) return { status: "unavailable" };

    let title: string;
    let text: string;
    if (kind === "hint") {
      title = "Una pista para revisar tu respuesta";
      // A conservative reading strategy: no answer-key excerpts, inferred misconceptions or invented calculations.
      text = `En «${exercise.data.title}», del tema ${exercise.data.topicName}, identifica primero qué te pide determinar el enunciado y cuáles son los datos que necesitas. Antes de volver a calcular, escribe qué relación u operación conecta esos datos con lo solicitado. Luego contrasta tu alternativa con esa relación.`;
      if (exercise.data.instructions) text += `\n\nRecuerda la instrucción del ejercicio: ${exercise.data.instructions}`;
    } else if (kind === "error") {
      title = attempt.es_correcta ? "Comprende por qué acertaste" : "Revisa tu respuesta";
      text = `Seleccionaste: ${choices[selectedIndex]}\n\n` + (attempt.es_correcta
        ? "Tu respuesta coincide con la solución verificada. Revisa el procedimiento para afianzar cómo se obtiene el resultado."
        : "Tu alternativa no coincide con la solución verificada. Como no registramos tus pasos de resolución, no podemos determinar el error específico. Compara tu procedimiento con el desarrollo revisado:")
        + `\n\n${data.desarrollo_paso_a_paso}`;
    } else {
      title = "Procedimiento verificado";
      text = data.desarrollo_paso_a_paso;
    }
    // Only this exercise's requested feedback is returned. No key, raw record, user ID or credentials.
    return { status: "ok", data: { attemptId, exerciseId: exercise.data.id, kind, title, text } };
  } catch {
    return { status: "error" };
  }
}
