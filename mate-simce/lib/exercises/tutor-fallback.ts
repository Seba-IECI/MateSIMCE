import "server-only";

import { differsOnlyBySumSign, type generateTutorHelp } from "@/lib/ai/gemini";
import { publicExerciseHint } from "./hints";

type FallbackReason = Extract<Awaited<ReturnType<typeof generateTutorHelp>>, { source: "verified" }>["reason"];

export function tutorFallbackNotice(reason: FallbackReason): string {
  const notices: Record<FallbackReason, string> = {
    disabled: "La generación con IA está desactivada.",
    configuration: "La generación con IA no está disponible por su configuración.",
    limited: "La generación con IA no está disponible temporalmente por un límite de solicitudes.",
    quota: "La generación con IA no está disponible temporalmente por un límite de solicitudes.",
    timeout: "La generación superó el tiempo de espera.",
    busy: "El servicio de IA sigue temporalmente ocupado después de un reintento.",
    unavailable: "La generación con IA no está disponible en este momento.",
    invalid: "La explicación generada no superó los controles de contenido o formato.",
  };
  return `${notices[reason]} Mostramos el apoyo basado en el contenido revisado.`;
}

// Solo después de autorizar un intento corregido de práctica o un ensayo finalizado.
// Compara datos registrados; no evalúa expresiones ni inventa pasos de resolución.
export function verifiedTutorExplanation(context: {
  topic: string; statement: string; selectedChoice: string | null;
  correctChoice: string; correct: boolean; procedure: string;
}): string {
  const { topic, statement, selectedChoice, correctChoice, correct, procedure } = context;
  const response = selectedChoice === null ? "No registraste una respuesta en esta pregunta."
    : `Seleccionaste: ${selectedChoice}\n\n` + (correct
      ? "Tu respuesta coincide con la solución verificada."
      : "Tu alternativa no coincide con la solución verificada. Como no registramos tus pasos de resolución, no podemos determinar el error específico.");
  const comparison = !correct && selectedChoice !== null && differsOnlyBySumSign(selectedChoice, correctChoice)
    ? "La diferencia observable es un signo de suma/resta; los demás términos coinciden. Revisa ese signo según la relación descrita en el enunciado y el desarrollo."
    : publicExerciseHint(statement, topic);
  // El desarrollo original se conserva íntegro, incluidos sus delimitadores LaTeX.
  return `${response}\n\nSolución verificada: ${correctChoice}\n\nOrientación (${topic}): ${comparison}\n\nDesarrollo verificado:\n\n${procedure}`;
}
