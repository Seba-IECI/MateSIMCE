"use server";

import { runExam } from "@/lib/exams/service";

export async function resumeExamAction(attemptId: string | null = null) {
  return runExam("resume", attemptId);
}
export async function startExamAction() {
  return runExam("start");
}
export async function saveExamAnswerAction(attemptId: string, questionId: string, selectedIndex: number) {
  return runExam("save", attemptId, questionId, selectedIndex);
}
export async function finishExamAction(attemptId: string) {
  return runExam("finish", attemptId);
}
