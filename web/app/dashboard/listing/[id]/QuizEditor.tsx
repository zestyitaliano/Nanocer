"use client";

// Editor for the floor-plan finder's QUESTIONS. Floor plans themselves are
// authored in PlansEditor (page_config.plans); here each answer carries "tags"
// that are matched against the plans' tags to pick a recommendation (lib/quiz.ts).
import { useState } from "react";
import type { FloorPlan, QuizConfig } from "@/lib/types";
import { uid } from "@/lib/quiz";

interface DraftOption {
  id: string;
  label: string;
  tags: string; // comma-separated
}
interface DraftQuestion {
  id: string;
  label: string;
  options: DraftOption[];
}
interface Draft {
  enabled: boolean;
  title: string;
  intro: string;
  questions: DraftQuestion[];
}

const splitTags = (s: string) =>
  s.split(",").map((t) => t.trim()).filter(Boolean);

function toDraft(quiz: QuizConfig): Draft {
  return {
    enabled: quiz.enabled ?? false,
    title: quiz.title ?? "",
    intro: quiz.intro ?? "",
    questions: (quiz.questions ?? []).map((q) => ({
      id: q.id,
      label: q.label,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        tags: (o.tags ?? []).join(", "),
      })),
    })),
  };
}

// Preserve any existing quiz.plans on the object we emit is intentionally NOT
// done — plans now live at page_config.plans. We emit questions only.
function serialize(d: Draft): QuizConfig {
  return {
    enabled: d.enabled,
    title: d.title.trim() || undefined,
    intro: d.intro.trim() || undefined,
    questions: d.questions.map((q) => ({
      id: q.id,
      label: q.label.trim(),
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label.trim(),
        tags: splitTags(o.tags),
      })),
    })),
  };
}

export default function QuizEditor({
  initialQuiz,
  plans,
  onChange,
}: {
  initialQuiz: QuizConfig;
  plans: FloorPlan[];
  onChange: (q: QuizConfig) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialQuiz));

  function update(next: Draft) {
    setDraft(next);
    onChange(serialize(next));
  }
  function patchQuestion(id: string, patch: Partial<DraftQuestion>) {
    update({
      ...draft,
      questions: draft.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q,
      ),
    });
  }

  const planTagHints = plans
    .filter((p) => p.name || (p.tags && p.tags.length))
    .map((p) => `${p.name || "(unnamed)"}: ${(p.tags ?? []).join(", ") || "—"}`);

  return (
    <div className="border-t border-[var(--border)] pt-4 space-y-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => update({ ...draft, enabled: e.target.checked })}
          className="accent-orange-600 w-4 h-4"
        />
        Floor-plan finder (questionnaire)
      </label>
      <p className="text-xs text-[var(--muted)] -mt-1">
        When on, the page shows a short quiz that recommends a floor plan from the
        answers, then captures the lead. Needs at least one plan (above) and one
        question.
      </p>

      {draft.enabled && (
        <>
          <div className="grid gap-2">
            <input
              className="input"
              placeholder="Title (e.g. Find your perfect floor plan)"
              value={draft.title}
              onChange={(e) => update({ ...draft, title: e.target.value })}
            />
            <input
              className="input"
              placeholder="Intro line (optional)"
              value={draft.intro}
              onChange={(e) => update({ ...draft, intro: e.target.value })}
            />
          </div>

          {planTagHints.length > 0 && (
            <div className="text-[11px] text-[var(--muted)] bg-orange-50 rounded-lg px-3 py-2">
              <span className="font-medium">Your plans &amp; tags</span> — use these
              tags in answers to steer the match:
              <ul className="mt-1 space-y-0.5">
                {planTagHints.map((h, i) => (
                  <li key={i}>• {h}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--muted)]">Questions</span>
            {draft.questions.map((q, qi) => (
              <div
                key={q.id}
                className="border border-[var(--border)] rounded-lg p-3 space-y-2 bg-neutral-50/70"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder={`Question ${qi + 1} (e.g. How many bedrooms?)`}
                    value={q.label}
                    onChange={(e) => patchQuestion(q.id, { label: e.target.value })}
                  />
                  <button
                    onClick={() =>
                      update({
                        ...draft,
                        questions: draft.questions.filter((x) => x.id !== q.id),
                      })
                    }
                    className="text-red-500 text-xs shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-1.5 pl-1">
                  {q.options.map((o) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <input
                        className="input flex-1"
                        placeholder="Answer label"
                        value={o.label}
                        onChange={(e) =>
                          patchQuestion(q.id, {
                            options: q.options.map((x) =>
                              x.id === o.id ? { ...x, label: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      <input
                        className="input flex-1"
                        placeholder="tags (e.g. 2bed)"
                        value={o.tags}
                        onChange={(e) =>
                          patchQuestion(q.id, {
                            options: q.options.map((x) =>
                              x.id === o.id ? { ...x, tags: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      <button
                        onClick={() =>
                          patchQuestion(q.id, {
                            options: q.options.filter((x) => x.id !== o.id),
                          })
                        }
                        className="text-red-400 text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      patchQuestion(q.id, {
                        options: [
                          ...q.options,
                          { id: uid("opt"), label: "", tags: "" },
                        ],
                      })
                    }
                    className="text-xs brand-text font-medium"
                  >
                    + Add answer
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                update({
                  ...draft,
                  questions: [
                    ...draft.questions,
                    {
                      id: uid("ques"),
                      label: "",
                      options: [{ id: uid("opt"), label: "", tags: "" }],
                    },
                  ],
                })
              }
              className="text-sm brand-text font-medium"
            >
              + Add question
            </button>
          </div>
        </>
      )}
    </div>
  );
}
