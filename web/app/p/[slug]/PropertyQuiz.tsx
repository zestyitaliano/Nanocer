"use client";

// The "find your floor plan" finder shown on a public property page. A scanner
// answers a few questions; we score the answers against each plan's tags and
// show the best match(es), then capture a pre-segmented lead. Pure client-side
// matching — no round-trip until the lead is submitted.
import { useState } from "react";
import type { CtaConfig, FloorPlan, QuizConfig } from "@/lib/types";
import {
  recommendPlans,
  summarizeAnswers,
  tagsForAnswers,
} from "@/lib/quiz";
import LeadForm from "./LeadForm";

function planFacts(p: FloorPlan): string {
  return [
    p.price != null ? `$${Number(p.price).toLocaleString()}` : null,
    p.beds != null ? `${p.beds} bd` : null,
    p.baths != null ? `${p.baths} ba` : null,
    p.sqft != null ? `${Number(p.sqft).toLocaleString()} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PlanCta({ cta, accent }: { cta: CtaConfig; accent: string }) {
  if (!cta.value) return null;
  if (cta.type === "text") {
    return (
      <a
        href={`sms:${cta.value}`}
        className="block text-center text-white rounded-lg py-2 text-sm font-medium"
        style={{ background: accent }}
      >
        {cta.label || "Text me about this"}
      </a>
    );
  }
  if (cta.type === "link") {
    return (
      <a
        href={cta.value}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-white rounded-lg py-2 text-sm font-medium"
        style={{ background: accent }}
      >
        {cta.label || "Learn more"}
      </a>
    );
  }
  return null;
}

function PlanCard({ plan, accent }: { plan: FloorPlan; accent: string }) {
  return (
    <div className="border rounded-xl overflow-hidden">
      {plan.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={plan.photo_url} alt={plan.name} className="w-full aspect-[4/3] object-cover" />
      ) : null}
      <div className="p-3 space-y-2">
        <div>
          <div className="font-medium">{plan.name}</div>
          {planFacts(plan) && (
            <div className="text-sm text-neutral-600">{planFacts(plan)}</div>
          )}
        </div>
        {plan.description && (
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">
            {plan.description}
          </p>
        )}
        {plan.cta && <PlanCta cta={plan.cta} accent={accent} />}
      </div>
    </div>
  );
}

export default function PropertyQuiz({
  listingId,
  quiz,
  accent = "#1a73e8",
}: {
  listingId: string;
  quiz: QuizConfig;
  accent?: string;
}) {
  const questions = quiz.questions ?? [];
  const plans = quiz.plans ?? [];

  // "intro" -> step through questions -> "result"
  const [stage, setStage] = useState<"intro" | "quiz" | "result">("intro");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function choose(questionId: string, optionId: string) {
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    if (step + 1 < questions.length) {
      setStep(step + 1);
    } else {
      setStage("result");
    }
  }

  function restart() {
    setAnswers({});
    setStep(0);
    setStage("intro");
  }

  if (stage === "intro") {
    return (
      <section className="border rounded-xl p-4 bg-neutral-50 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">
            {quiz.title || "Find your floor plan"}
          </h2>
          {quiz.intro && (
            <p className="text-sm text-neutral-600 mt-1">{quiz.intro}</p>
          )}
        </div>
        <button
          onClick={() => setStage("quiz")}
          className="w-full text-white rounded-lg py-2.5 text-sm font-medium"
          style={{ background: accent }}
        >
          Get matched in {questions.length}{" "}
          {questions.length === 1 ? "question" : "questions"}
        </button>
      </section>
    );
  }

  if (stage === "quiz") {
    const q = questions[step];
    return (
      <section className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Question {step + 1} of {questions.length}
          </span>
          <button onClick={restart} className="text-xs text-neutral-400">
            Start over
          </button>
        </div>
        <h2 className="text-sm font-medium">{q.label}</h2>
        <div className="space-y-2">
          {q.options.map((o) => (
            <button
              key={o.id}
              onClick={() => choose(q.id, o.id)}
              className="w-full text-left border rounded-lg px-3 py-2.5 text-sm hover:border-neutral-400 transition"
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // result
  const selectedTags = tagsForAnswers(questions, answers);
  const ranked = recommendPlans(plans, selectedTags);
  const top = ranked.slice(0, 2);
  const quizSummary = summarizeAnswers(questions, answers);
  const recommendation = top.map((p) => p.name).join(", ");

  return (
    <section className="border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {top.length > 1 ? "Your best matches" : "Your best match"}
        </h2>
        <button onClick={restart} className="text-xs text-neutral-400">
          Start over
        </button>
      </div>

      <div className="space-y-3">
        {top.map((p) => (
          <PlanCard key={p.id} plan={p} accent={accent} />
        ))}
      </div>

      <div className="border-t pt-3">
        <h3 className="text-sm font-medium mb-2">
          Want details on {top.length > 1 ? "these" : "this"}? Send your info.
        </h3>
        <LeadForm
          listingId={listingId}
          accent={accent}
          label="Send me the details"
          recommendation={recommendation}
          quizSummary={quizSummary}
        />
      </div>
    </section>
  );
}
