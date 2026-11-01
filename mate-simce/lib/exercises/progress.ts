import "server-only";

import { getStudentAccess } from "@/lib/auth/student";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCourse } from "./queries";
import type { ContentResult } from "./types";

const axes = {
  numeros: "Números",
  algebra_y_funciones: "Álgebra y funciones",
  geometria: "Geometría",
  estadistica_y_probabilidades: "Estadística y probabilidades",
} as const;

export type PracticeAttempt = {
  category: keyof typeof axes;
  correct: boolean;
};

export type AxisDiagnosis = {
  category: keyof typeof axes;
  name: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
  recommendation: string;
};

// Input is a normalized list of distinct, persisted attempts owned by the authenticated student.
// This function performs no database access and does not infer official achievement levels.
export function summarizePractice(attempts: readonly PracticeAttempt[]): AxisDiagnosis[] {
  return (Object.keys(axes) as Array<keyof typeof axes>).map((category) => {
    const records = attempts.filter((attempt) => attempt.category === category);
    const correct = records.filter((attempt) => attempt.correct).length;
    const count = records.length;
    const accuracy = count === 0 ? null : Math.round(correct / count * 100);
    let recommendation: string;
    if (count === 0) {
      recommendation = "Responde ejercicios de este eje para comenzar.";
    } else if (count < 3) {
      recommendation = correct < count
        ? "Revisa las explicaciones de tus errores y practica otros ejercicios; aún hay pocos intentos."
        : "Continúa con otros ejercicios; aún hay pocos intentos para describir tu desempeño.";
    } else if (correct / count < 0.6) {
      recommendation = "Refuerza este eje: repasa las explicaciones y vuelve a practicar los contenidos que te costaron.";
    } else if (correct / count < 0.8) {
      recommendation = "Revisa los errores de este eje y practica otros ejercicios para afianzar el contenido.";
    } else {
      recommendation = "Buen resultado en esta práctica. Continúa con otros ejercicios del eje.";
    }
    return { category, name: axes[category], attempts: count, correct, accuracy, recommendation };
  });
}

export async function getPracticeDiagnosis(): Promise<ContentResult<AxisDiagnosis[]>> {
  try {
    const session = await createClient();
    const access = await getStudentAccess(session);
    if (access.status !== "authorized") return { status: access.status };
    const course = await getCurrentCourse();
    if (course.status !== "ok") return course;
    const attempts: PracticeAttempt[] = [];
    const seen = new Set<string>();
    const size = 500;
    // Page through all graded practice rows; do not silently truncate at Supabase's default row limit.
    for (let offset = 0; ; offset += size) {
      const { data, error } = await session.from("respuestas_estudiante")
        .select("id,es_correcta,ejercicio:ejercicios!inner(tema:temas!inner(categoria,curso:cursos!inner(id)))")
        .eq("usuario_id", access.student.id).not("es_correcta", "is", null)
        .eq("ejercicio.tema.curso_id", course.data.id).eq("ejercicio.tema.activo", true)
        .eq("ejercicio.tema.curso.activo", true).eq("ejercicio.tema.curso.nivel", "2_medio")
        .order("respondido_en").order("id").range(offset, offset + size - 1);
      if (error || !Array.isArray(data)) return { status: "error" };
      for (const row of data) {
        // Embedded to-one relations are objects; no raw response JSON or user identifiers leave this module.
        const exercise = row.ejercicio as unknown as { tema?: { categoria?: string } } | null;
        const category = exercise?.tema?.categoria;
        if (typeof row.id !== "string" || typeof row.es_correcta !== "boolean"
          || !category || !Object.hasOwn(axes, category)) return { status: "error" };
        if (!seen.has(row.id)) {
          seen.add(row.id);
          attempts.push({ category: category as PracticeAttempt["category"], correct: row.es_correcta });
        }
      }
      if (data.length < size) break;
    }
    return { status: "ok", data: summarizePractice(attempts) };
  } catch {
    return { status: "error" };
  }
}
