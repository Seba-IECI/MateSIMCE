"use server";

import { randomUUID } from "node:crypto";
import { getExercise, listExercises, listTopics } from "@/lib/exercises/queries";
import { checkExerciseAnswer } from "@/lib/exercises/correction";
import { getPracticeDiagnosis } from "@/lib/exercises/progress";
import { getExerciseHint, getTutorFeedback } from "@/lib/exercises/tutor";
import type { ContentResult, PracticeExercise, TutorHelpKind } from "@/lib/exercises/types";

export async function getTopicsAction() {
  return listTopics();
}

export async function getExercisesAction(topicId: string, page: number) {
  return listExercises(topicId, page);
}

export async function getExerciseAction(exerciseId: string): Promise<ContentResult<PracticeExercise>> {
  const result = await getExercise(exerciseId);
  return result.status === "ok"
    ? { status: "ok", data: { ...result.data, attemptId: randomUUID() } }
    : result;
}

export async function checkExerciseAnswerAction(exerciseId: string, selectedIndex: number, attemptId: string) {
  return checkExerciseAnswer(exerciseId, selectedIndex, attemptId);
}

export async function getPracticeDiagnosisAction() {
  return getPracticeDiagnosis();
}

export async function getTutorFeedbackAction(attemptId: string, kind: TutorHelpKind) {
  return getTutorFeedback(attemptId, kind);
}

export async function getExerciseHintAction(exerciseId: string) {
  return getExerciseHint(exerciseId);
}
