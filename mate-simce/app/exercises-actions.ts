"use server";

import { getExercise, listExercises, listTopics } from "@/lib/exercises/queries";

export async function getTopicsAction() {
  return listTopics();
}

export async function getExercisesAction(topicId: string, page: number) {
  return listExercises(topicId, page);
}

export async function getExerciseAction(exerciseId: string) {
  return getExercise(exerciseId);
}
