export type ExerciseTopic = {
  id: string;
  name: string;
  category: string;
  description: string;
};

export type ExerciseSummary = {
  id: string;
  title: string;
  topicName: string;
  difficulty: "facil" | "media" | "dificil";
  challenge: "inicial" | "intermedio" | "avanzado";
  estimatedSeconds: number | null;
};

export type ExerciseDetail = ExerciseSummary & {
  statement: string;
  instructions: string | null;
  responseType: "opcion_multiple" | "respuesta_abierta" | "calculo";
  choices: string[] | null;
  imageUrl: string | null;
  imageUnavailable: boolean;
};

export type ExercisePage = {
  exercises: ExerciseSummary[];
  page: number;
  hasNext: boolean;
};

export type ContentResult<T> =
  | { status: "ok"; data: T }
  | { status: "unauthenticated" | "forbidden" | "unavailable" | "invalid" | "not_found" | "course_unavailable" | "course_ambiguous" | "error" };
