"use server";

import { getExercise, listExercises, listTopics } from "@/lib/exercises/queries";
import { checkExerciseAnswer } from "@/lib/exercises/correction";

export async function getTopicsAction() {
  return listTopics();
}

export async function getExercisesAction(topicId: string, page: number) {
  return listExercises(topicId, page);
}

export async function getExerciseAction(exerciseId: string) {
  return getExercise(exerciseId);
}

export async function checkExerciseAnswerAction(exerciseId: string, selectedIndex: number) {
  return checkExerciseAnswer(exerciseId, selectedIndex);
}
