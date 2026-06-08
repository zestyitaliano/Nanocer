"use client";

// Editor for a listing's floor-plan finder. The agent defines a few plans and a
// few questions; each answer carries "tags" that are matched against the plans'
// tags to pick a recommendation (see lib/quiz.ts). Edits are emitted up via
// onChange as a normalized QuizConfig; this component owns its own draft so that
// typing tags ("2bed, budget") isn't mangled by re-serialization mid-keystroke.
import { useState } from "react";
import type { CtaConfig, QuizConfig } from "@/lib/types";
import { uid } from "@/lib/quiz";

type CtaType = "none" | "text" | "link";

interface DraftPlan {
  id: string;
  name: string;
  beds: string;
  baths: string;
  sqft: string;
  price: string;
  photo_url?: string;
  description: string;
  tags: string; // comma-separated
  ctaType: CtaType;
  ctaLabel: string;
  ctaValue: string;
}

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
  plans: DraftPlan[];
  questions: DraftQuestion[];
}

const splitTags = (s: string) =>
  s.split(",").map((t) => t.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === "" ? null : Number(s));

function toDraft(quiz: QuizConfig): Draft {
  return {
    enabled: quiz.enabled ?? false,
    title: quiz.title ?? "",
    intro: quiz.intro ?? "",
    plans: (quiz.plans ?? []).map((p) => ({
      id: p.id,
      name: p.name ?? "",
      beds: p.beds?.toString() ?? "",
      baths: p.baths?.toString() ?? "",
      sqft: p.sqft?.toString() ?? "",
      price: p.price?.toString() ?? "",
      photo_url: p.photo_url,
      description: p.description ?? "",
      tags: (p.tags ?? []).join(", "),
      ctaType: (p.cta?.type as CtaType) ?? "none",
      ctaLabel: p.cta?.label ?? "",
      ctaValue: p.cta?.value ?? "",
    })),
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

function serialize(d: Draft): QuizConfig {
  return {
    enabled: d.enabled,
    title: d.title.trim() || undefined,
    intro: d.intro.trim() || undefined,
    plans: d.plans.map((p) => {
      const cta: CtaConfig | undefined =
        p.ctaType === "none"
          ? undefined
          : {
              type: p.ctaType,
              label: p.ctaLabel.trim() || undefined,
              value: p.ctaValue.trim() || undefined,
            };
      return {
        id: p.id,
        name: p.name.trim(),
        beds: num(p.beds),
        baths: num(p.baths),
        sqft: num(p.sqft),
        price: num(p.price),
        photo_url: p.photo_url,
        description: p.description.trim() || undefined,
        tags: splitTags(p.tags),
        cta,
      };
    }),
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

const inputCls = "input";

export default function QuizEditor({
  initialQuiz,
  onChange,
  upload,
}: {
  initialQuiz: QuizConfig;
  onChange: (q: QuizConfig) => void;
  upload: (file: File) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialQuiz));
  const [busy, setBusy] = useState(false);

  // Single mutation path: set local draft AND emit the normalized config up.
  function update(next: Draft) {
    setDraft(next);
    onChange(serialize(next));
  }

  function patchPlan(id: string, patch: Partial<DraftPlan>) {
    update({
      ...draft,
      plans: draft.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }
  function patchQuestion(id: string, patch: Partial<DraftQuestion>) {
    update({
      ...draft,
      questions: draft.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q,
      ),
    });
  }

  async function uploadPlanPhoto(
    planId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const u = await upload(f);
    setBusy(false);
    if (u) patchPlan(planId, { photo_url: u });
    e.target.value = "";
  }

  return (
    <div className="border-t border-[var(--border)] pt-4 space-y-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => update({ ...draft, enabled: e.target.checked })}
          className="accent-violet-600 w-4 h-4"
        />
        Floor-plan finder (questionnaire)
      </label>
      <p className="text-xs text-[var(--muted)] -mt-1">
        When on, the page shows a short quiz that recommends a plan based on the
        answers, then captures the lead. Needs at least one plan and one
        question to go live.
      </p>

      {draft.enabled && (
        <>
          <div className="grid gap-2">
            <input
              className={inputCls}
              placeholder="Title (e.g. Find your perfect floor plan)"
              value={draft.title}
              onChange={(e) => update({ ...draft, title: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Intro line (optional)"
              value={draft.intro}
              onChange={(e) => update({ ...draft, intro: e.target.value })}
            />
          </div>

          {/* Plans -------------------------------------------------------- */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--muted)]">
              Floor plans
            </span>
            {draft.plans.map((p, i) => (
              <div key={p.id} className="border border-[var(--border)] rounded-xl p-3 space-y-2 bg-neutral-50/70">
                <div className="flex items-center gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder={`Plan ${i + 1} name (e.g. The Aspen — 2 bed)`}
                    value={p.name}
                    onChange={(e) => patchPlan(p.id, { name: e.target.value })}
                  />
                  <button
                    onClick={() =>
                      update({
                        ...draft,
                        plans: draft.plans.filter((x) => x.id !== p.id),
                      })
                    }
                    className="text-red-500 text-xs shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(["price", "beds", "baths", "sqft"] as const).map((k) => (
                    <input
                      key={k}
                      className={inputCls}
                      inputMode="numeric"
                      placeholder={k}
                      value={p[k]}
                      onChange={(e) => patchPlan(p.id, { [k]: e.target.value })}
                    />
                  ))}
                </div>
                <textarea
                  className={`${inputCls} w-full`}
                  rows={2}
                  placeholder="Description (optional)"
                  value={p.description}
                  onChange={(e) =>
                    patchPlan(p.id, { description: e.target.value })
                  }
                />
                <input
                  className={`${inputCls} w-full`}
                  placeholder="Match tags, comma-separated (e.g. 2bed, budget, ground-floor)"
                  value={p.tags}
                  onChange={(e) => patchPlan(p.id, { tags: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--muted)] flex items-center gap-2">
                    Photo:
                    <input
                      type="file"
                      accept="image/*"
                      className="text-xs"
                      onChange={(e) => uploadPlanPhoto(p.id, e)}
                    />
                  </label>
                  {p.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo_url}
                      alt=""
                      className="w-10 h-10 object-cover rounded border"
                    />
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    className={inputCls}
                    value={p.ctaType}
                    onChange={(e) =>
                      patchPlan(p.id, { ctaType: e.target.value as CtaType })
                    }
                  >
                    <option value="none">No button</option>
                    <option value="text">Text me</option>
                    <option value="link">External link</option>
                  </select>
                  {p.ctaType !== "none" && (
                    <input
                      className={`${inputCls} flex-1`}
                      placeholder={
                        p.ctaType === "text" ? "Phone number" : "https://…"
                      }
                      value={p.ctaValue}
                      onChange={(e) =>
                        patchPlan(p.id, { ctaValue: e.target.value })
                      }
                    />
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                update({
                  ...draft,
                  plans: [
                    ...draft.plans,
                    {
                      id: uid("plan"),
                      name: "",
                      beds: "",
                      baths: "",
                      sqft: "",
                      price: "",
                      description: "",
                      tags: "",
                      ctaType: "none",
                      ctaLabel: "",
                      ctaValue: "",
                    },
                  ],
                })
              }
              className="text-sm brand-text font-medium"
            >
              + Add floor plan
            </button>
          </div>

          {/* Questions ---------------------------------------------------- */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--muted)]">
              Questions
            </span>
            {draft.questions.map((q, qi) => (
              <div key={q.id} className="border border-[var(--border)] rounded-xl p-3 space-y-2 bg-neutral-50/70">
                <div className="flex items-center gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder={`Question ${qi + 1} (e.g. How many bedrooms?)`}
                    value={q.label}
                    onChange={(e) =>
                      patchQuestion(q.id, { label: e.target.value })
                    }
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
                        className={`${inputCls} flex-1`}
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
                        className={`${inputCls} flex-1`}
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

          {busy && <p className="text-xs text-[var(--muted)]">Uploading…</p>}
        </>
      )}
    </div>
  );
}
