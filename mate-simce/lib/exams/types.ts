export const examAxes = {
  numeros: "Números",
  algebra_y_funciones: "Álgebra y funciones",
  geometria: "Geometría",
  estadistica_y_probabilidades: "Estadística y probabilidades",
} as const;

export type ExamAxis = keyof typeof examAxes;
export type ExamQuestion = {
  id: string;
  number: number;
  category: ExamAxis;
  statement: string;
  choices: string[];
  selectedIndex: number | null;
};
export type ReviewedExamQuestion = ExamQuestion & { correctIndex: number; explanation: string };
export type ExamCounts = {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
};
export type ExamResult = ExamCounts & {
  axes: Array<ExamCounts & { category: ExamAxis; name: string }>;
  interpretation: string;
};
type Attempt = { id: string; startedAt: string; finishedAt: string | null };
export type ExamAttempt =
  | (Attempt & { state: "en_curso"; questions: ExamQuestion[] })
  | (Attempt & { state: "completado"; questions: ReviewedExamQuestion[]; result: ExamResult });
export type ExamResponse =
  | { status: "ok"; data: ExamAttempt | null }
  | { status: "unauthenticated" | "forbidden" | "unavailable" | "invalid" | "not_found" | "content_unavailable" | "configuration_required" | "error" };

export type ExamTutorFeedback = {
  attemptId: string;
  questionId: string;
  text: string;
  source: "verified" | "gemini";
  notice?: string;
};
export type ExamTutorResponse = Exclude<ExamResponse, { status: "ok" }> | { status: "ok"; data: ExamTutorFeedback };
export type ExamHintResponse = Exclude<ExamResponse, { status: "ok" }>
  | { status: "ok"; data: { attemptId: string; questionId: string; text: string } };
