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

export type PracticeExercise = ExerciseDetail & { attemptId: string };

export type ExerciseFeedback = {
  attemptId: string;
  exerciseId: string;
  selectedIndex: number;
  correct: boolean;
  explanation: string;
};

export type TutorHelpKind = "hint" | "error" | "procedure";

// Provider-independent response. The private mathematical context stays on the server.
export type TutorFeedback = {
  attemptId: string;
  exerciseId: string;
  kind: TutorHelpKind;
  title: string;
  text: string;
};

export type ContentResult<T> =
  | { status: "ok"; data: T }
  | { status: "unauthenticated" | "forbidden" | "unavailable" | "invalid" | "not_found" | "course_unavailable" | "course_ambiguous" | "error" };
