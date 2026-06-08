"use client";

// First-class floor plans (units) for a listing. Edits emit a normalized
// FloorPlan[] up via onChange; the component owns string drafts so typing tags /
// numbers isn't mangled mid-keystroke (same pattern as QuizEditor).
import { useState } from "react";
import type { CtaConfig, FloorPlan, PlanAvailability } from "@/lib/types";
import { uid } from "@/lib/quiz";

type CtaType = "none" | "text" | "link";

interface DraftPlan {
  id: string;
  name: string;
  beds: string;
  baths: string;
  sqft: string;
  price: string;
  price_max: string;
  price_unit: "unit" | "bed";
  availability: PlanAvailability;
  available_text: string;
  photo_url?: string;
  description: string;
  tags: string; // comma-separated, matched by the quiz
  ctaType: CtaType;
  ctaLabel: string;
  ctaValue: string;
}

const splitTags = (s: string) =>
  s.split(",").map((t) => t.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === "" ? null : Number(s));

function toDraft(p: FloorPlan): DraftPlan {
  return {
    id: p.id,
    name: p.name ?? "",
    beds: p.beds?.toString() ?? "",
    baths: p.baths?.toString() ?? "",
    sqft: p.sqft?.toString() ?? "",
    price: p.price?.toString() ?? "",
    price_max: p.price_max?.toString() ?? "",
    price_unit: p.price_unit ?? "unit",
    availability: p.availability ?? "available",
    available_text: p.available_text ?? "",
    photo_url: p.photo_url,
    description: p.description ?? "",
    tags: (p.tags ?? []).join(", "),
    ctaType: (p.cta?.type as CtaType) ?? "none",
    ctaLabel: p.cta?.label ?? "",
    ctaValue: p.cta?.value ?? "",
  };
}

function serialize(d: DraftPlan): FloorPlan {
  const cta: CtaConfig | undefined =
    d.ctaType === "none"
      ? undefined
      : {
          type: d.ctaType,
          label: d.ctaLabel.trim() || undefined,
          value: d.ctaValue.trim() || undefined,
        };
  return {
    id: d.id,
    name: d.name.trim(),
    beds: num(d.beds),
    baths: num(d.baths),
    sqft: num(d.sqft),
    price: num(d.price),
    price_max: num(d.price_max),
    price_unit: d.price_unit,
    availability: d.availability,
    available_text: d.available_text.trim() || undefined,
    photo_url: d.photo_url,
    description: d.description.trim() || undefined,
    tags: splitTags(d.tags),
    cta,
  };
}

export default function PlansEditor({
  initialPlans,
  onChange,
  upload,
}: {
  initialPlans: FloorPlan[];
  onChange: (plans: FloorPlan[]) => void;
  upload: (file: File) => Promise<string | null>;
}) {
  const [plans, setPlans] = useState<DraftPlan[]>(() => initialPlans.map(toDraft));
  const [busy, setBusy] = useState(false);

  function update(next: DraftPlan[]) {
    setPlans(next);
    onChange(next.map(serialize));
  }
  function patch(id: string, p: Partial<DraftPlan>) {
    update(plans.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  async function uploadPhoto(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const u = await upload(f);
    setBusy(false);
    if (u) patch(id, { photo_url: u });
    e.target.value = "";
  }

  return (
    <div className="border-t border-[var(--border)] pt-4 space-y-3">
      <div>
        <span className="text-sm font-semibold text-[var(--ink)]">Floor plans</span>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          The units in this community. They show on the property page and feed the
          floor-plan finder (match tags below).
        </p>
      </div>

      {plans.map((p, i) => (
        <div
          key={p.id}
          className="border border-[var(--border)] rounded-xl p-3 space-y-2 bg-neutral-50/70"
        >
          <div className="flex items-center gap-2">
            <input
              className="input flex-1"
              placeholder={`Plan ${i + 1} name (e.g. The Aspen — 2x2)`}
              value={p.name}
              onChange={(e) => patch(p.id, { name: e.target.value })}
            />
            <button
              onClick={() => update(plans.filter((x) => x.id !== p.id))}
              className="text-red-500 text-xs shrink-0"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["beds", "baths", "sqft"] as const).map((k) => (
              <input
                key={k}
                className="input"
                inputMode="numeric"
                placeholder={k}
                value={p[k]}
                onChange={(e) => patch(p.id, { [k]: e.target.value })}
              />
            ))}
          </div>

          {/* pricing */}
          <div className="flex gap-2 items-center">
            <input
              className="input flex-1"
              inputMode="numeric"
              placeholder="Price (from)"
              value={p.price}
              onChange={(e) => patch(p.id, { price: e.target.value })}
            />
            <span className="text-[var(--muted)] text-sm">–</span>
            <input
              className="input flex-1"
              inputMode="numeric"
              placeholder="Max (optional)"
              value={p.price_max}
              onChange={(e) => patch(p.id, { price_max: e.target.value })}
            />
            <select
              className="input"
              value={p.price_unit}
              onChange={(e) =>
                patch(p.id, { price_unit: e.target.value as "unit" | "bed" })
              }
            >
              <option value="unit">/unit</option>
              <option value="bed">/bed</option>
            </select>
          </div>

          {/* availability */}
          <div className="flex gap-2 items-center">
            <select
              className="input"
              value={p.availability}
              onChange={(e) =>
                patch(p.id, { availability: e.target.value as PlanAvailability })
              }
            >
              <option value="available">Available</option>
              <option value="waitlist">Waitlist</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <input
              className="input flex-1"
              placeholder="Availability note (e.g. Available Aug 2026)"
              value={p.available_text}
              onChange={(e) => patch(p.id, { available_text: e.target.value })}
            />
          </div>

          <textarea
            className="input w-full"
            rows={2}
            placeholder="Description (optional)"
            value={p.description}
            onChange={(e) => patch(p.id, { description: e.target.value })}
          />
          <input
            className="input w-full"
            placeholder="Match tags, comma-separated (e.g. 2bed, budget, furnished)"
            value={p.tags}
            onChange={(e) => patch(p.id, { tags: e.target.value })}
          />

          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--muted)] flex items-center gap-2">
              Photo:
              <input
                type="file"
                accept="image/*"
                className="text-xs"
                onChange={(e) => uploadPhoto(p.id, e)}
              />
            </label>
            {p.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_url} alt="" className="w-10 h-10 object-cover rounded border" />
            )}
          </div>

          {/* per-plan CTA (apply / waitlist / tour) */}
          <div className="flex gap-2 items-center">
            <select
              className="input"
              value={p.ctaType}
              onChange={(e) => patch(p.id, { ctaType: e.target.value as CtaType })}
            >
              <option value="none">No button</option>
              <option value="link">Apply / link</option>
              <option value="text">Text me</option>
            </select>
            {p.ctaType !== "none" && (
              <>
                <input
                  className="input w-28"
                  placeholder="Label"
                  value={p.ctaLabel}
                  onChange={(e) => patch(p.id, { ctaLabel: e.target.value })}
                />
                <input
                  className="input flex-1"
                  placeholder={p.ctaType === "text" ? "Phone number" : "https://…"}
                  value={p.ctaValue}
                  onChange={(e) => patch(p.id, { ctaValue: e.target.value })}
                />
              </>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={() =>
          update([
            ...plans,
            {
              id: uid("plan"),
              name: "",
              beds: "",
              baths: "",
              sqft: "",
              price: "",
              price_max: "",
              price_unit: "unit",
              availability: "available",
              available_text: "",
              description: "",
              tags: "",
              ctaType: "none",
              ctaLabel: "",
              ctaValue: "",
            },
          ])
        }
        className="text-sm brand-text font-medium"
      >
        + Add floor plan
      </button>
      {busy && <p className="text-xs text-[var(--muted)]">Uploading…</p>}
    </div>
  );
}
