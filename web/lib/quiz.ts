// Floor-plan-finder logic, shared by the public quiz and (potentially) tests.
// Matching is intentionally simple: every chosen answer contributes its `tags`,
// and each plan is scored by how many of its own tags were chosen. Highest
// score wins. This generalizes past beds/budget to lifestyle questions
// ("work from home?" -> a plan tagged "office") without any special-casing.
import type { FloorPlan, QuizConfig, QuizQuestion } from "./types";

// Short stable id for editor-created options/plans/questions. Not security
// sensitive — just needs to be unique within one listing's config.
export function uid(prefix = "q"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

const norm = (t: string) => t.trim().toLowerCase();

// Rank plans against the set of tags the scanner's answers contributed.
// Returns plans sorted best-first, keeping only those that match at least one
// tag. If nothing matches (or no tags were chosen), returns all plans in their
// authored order so the scanner is never shown an empty result.
export function recommendPlans(
  plans: FloorPlan[],
  selectedTags: string[],
): FloorPlan[] {
  const chosen = new Set(selectedTags.map(norm).filter(Boolean));
  if (chosen.size === 0) return [...plans];

  const scored = plans.map((plan, i) => {
    const tags = (plan.tags ?? []).map(norm);
    const score = tags.reduce((n, t) => n + (chosen.has(t) ? 1 : 0), 0);
    return { plan, score, i };
  });

  const anyMatch = scored.some((s) => s.score > 0);
  if (!anyMatch) return [...plans];

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((s) => s.plan);
}

// Collect the tags for a set of {questionId -> optionId} answers.
export function tagsForAnswers(
  questions: QuizQuestion[],
  answers: Record<string, string>,
): string[] {
  const tags: string[] = [];
  for (const q of questions) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (opt?.tags) tags.push(...opt.tags);
  }
  return tags;
}

// Human-readable "Question: Answer" summary, for storing on the captured lead.
export function summarizeAnswers(
  questions: QuizQuestion[],
  answers: Record<string, string>,
): string {
  return questions
    .map((q) => {
      const opt = q.options.find((o) => o.id === answers[q.id]);
      return opt ? `${q.label}: ${opt.label}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

// True when a quiz is configured well enough to show on the public page. Plans
// now live at page_config.plans, so the count is passed in (see getPlans()).
export function quizIsLive(
  quiz: QuizConfig | undefined,
  planCount: number,
): quiz is QuizConfig {
  return Boolean(
    quiz?.enabled && planCount >= 1 && (quiz.questions?.length ?? 0) >= 1,
  );
}
