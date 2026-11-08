import { isValidElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";

// Adaptador aislado de hooks: ejecuta callbacks reales sin navegador ni Supabase.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, first: true, effects: [] as Array<() => void> }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useState(initial: unknown) {
    const i = hooks.cursor++;
    if (!(i in hooks.values)) hooks.values[i] = typeof initial === "function" ? initial() : initial;
    return [hooks.values[i], (value: unknown) => { hooks.values[i] = typeof value === "function" ? value(hooks.values[i]) : value; }];
  },
  useRef(value: unknown) { const i = hooks.cursor++; return hooks.values[i] ??= { current: value }; },
  useEffect(effect: () => void) { if (hooks.first) hooks.effects.push(effect); },
  startTransition(callback: () => void) { callback(); },
}));
vi.mock("@/app/exam-actions", () => ({ resumeExamAction: vi.fn(), finishExamAction: vi.fn(), startExamAction: vi.fn(),
  saveExamAnswerAction: vi.fn(), getExamHintAction: vi.fn(), getExamTutorFeedbackAction: vi.fn() }));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/exercises/exercise-browser", () => ({ MathText: "span" }));

import { ExamBrowser } from "@/components/exercises/exam-browser";
import { resumeExamAction, finishExamAction } from "@/app/exam-actions";
import { examAxes, type ExamAttempt, type ExamResponse } from "@/lib/exams/types";

function attempt(completed = false): ExamAttempt {
  const questions = Object.keys(examAxes).flatMap((category, axis) => Array.from({ length: 3 }, (_, i) => ({
    id: `${axis}-${i}`, number: axis * 3 + i + 1, category: category as keyof typeof examAxes,
    statement: "Pregunta sintética", choices: ["1", "2", "3", "4"], selectedIndex: axis === 0 && i === 0 ? 0 : null,
    correctIndex: 0, explanation: "Desarrollo sintético: $1=1$.",
  })));
  const base = { id: "synthetic-attempt", startedAt: "2026-11-07T12:00:00Z", finishedAt: null, questions };
  return completed ? { ...base, state: "completado", finishedAt: "2026-11-07T12:10:00Z",
    result: { total: 12, answered: 1, correct: 1, incorrect: 0, unanswered: 11, accuracy: 8, axes: [], interpretation: "Resultado sintético" } }
    : { ...base, state: "en_curso" };
}
type Node = { props: { children?: unknown; onClick?: () => void; [key: string]: unknown } };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement(value)) return [];
  const node = value as Node; return [node, ...nodes(node.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join("");
  if (isValidElement(value)) return text((value as Node).props.children);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function render() {
  hooks.cursor = 0; const tree = ExamBrowser({ onHome: vi.fn() });
  if (hooks.first) { hooks.first = false; hooks.effects.forEach((effect) => effect()); }
  return tree;
}
function button(id: string) { return nodes(render()).find((node) => node.props["data-cy"] === id)!; }
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  vi.resetAllMocks(); hooks.values = []; hooks.effects = []; hooks.first = true;
  vi.mocked(resumeExamAction).mockResolvedValue({ status: "ok", data: attempt() });
});

it("finalizar desde la pregunta 12 conserva la posición si falla y vuelve a la 1 solo tras el éxito", async () => {
  render(); await flush(); button("exam-continue").props.onClick?.(); await flush();
  nodes(render()).filter((node) => node.props["data-cy"] === "exam-question-nav")[11].props.onClick?.();
  button("exam-finish").props.onClick?.();
  let finish: (result: ExamResponse) => void = () => {};
  vi.mocked(finishExamAction).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  button("exam-confirm").props.onClick?.();
  expect(text(button("exam-question"))).toContain("Pregunta 12 de 12");
  finish({ status: "error" }); await flush();
  expect(text(button("exam-question"))).toContain("Pregunta 12 de 12");
  button("exam-confirm").props.onClick?.();
  finish({ status: "ok", data: attempt(true) }); await flush();
  expect(text(button("exam-question"))).toContain("Pregunta 1 de 12");
  expect(text(button("exam-results"))).toMatch(/Respondidas\s*1/);
  expect(nodes(render()).filter((node) => node.props["data-cy"] === "exam-choice")[0].props.checked).toBe(true);
});

it("reabrir un ensayo completado inicia su revisión en la pregunta 1", async () => {
  vi.mocked(resumeExamAction).mockResolvedValue({ status: "ok", data: attempt(true) });
  render(); await flush();
  nodes(render()).find((node) => text(node.props.children) === "Ver últimos resultados")!.props.onClick?.();
  expect(text(button("exam-question"))).toContain("Pregunta 1 de 12");
  nodes(render()).filter((node) => node.props["data-cy"] === "exam-question-nav")[11].props.onClick?.();
  nodes(render()).find((node) => text(node.props.children) === "Preparar otro ensayo")!.props.onClick?.();
  nodes(render()).find((node) => text(node.props.children) === "Ver últimos resultados")!.props.onClick?.();
  expect(text(button("exam-question"))).toContain("Pregunta 1 de 12");
});
