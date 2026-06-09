// Display helpers for floor plans (units). Plans are fetched from the
// floor_plans table and passed in as FloorPlan[].
import type { FloorPlan } from "./types";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

// "from $1,295", "$1,295–$1,650", or "$899/bed" for student lease-by-the-bed.
export function planPriceLabel(plan: FloorPlan): string | null {
  const lo = plan.price ?? null;
  const hi = plan.price_max ?? null;
  if (lo == null && hi == null) return null;
  const per = plan.price_unit === "bed" ? "/bed" : "";
  if (lo != null && hi != null && hi > lo) {
    return `${money(lo)}–${money(hi)}${per}`;
  }
  const base = lo ?? hi!;
  return `${plan.price_unit === "bed" ? "" : "from "}${money(base)}${per}`;
}

function bedLabel(beds: number): string {
  return beds <= 0 ? "Studio" : `${beds} BR`;
}

// Header summary across plans: beds range + lowest "from" price.
export function summaryRange(plans: FloorPlan[]): string {
  if (!plans.length) return "";
  const beds = plans
    .map((p) => p.beds)
    .filter((b): b is number => b != null);
  const prices = plans
    .map((p) => p.price)
    .filter((p): p is number => p != null);

  const parts: string[] = [];
  if (beds.length) {
    const min = Math.min(...beds);
    const max = Math.max(...beds);
    parts.push(min === max ? bedLabel(min) : `${bedLabel(min)}–${bedLabel(max)}`);
  }
  parts.push(`${plans.length} floor plan${plans.length === 1 ? "" : "s"}`);
  if (prices.length) parts.push(`from ${money(Math.min(...prices))}`);
  return parts.join(" · ");
}

// Short "Synced 2h ago" label for a sync-owned plan, or null for manual plans.
export function syncedLabel(plan: FloorPlan): string | null {
  if (plan.source !== "sync") return null;
  if (!plan.last_synced_at) return "Synced";
  const mins = Math.round((Date.now() - new Date(plan.last_synced_at).getTime()) / 60000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Synced ${hrs}h ago`;
  return `Synced ${Math.round(hrs / 24)}d ago`;
}

export const AVAILABILITY_BADGE: Record<
  NonNullable<FloorPlan["availability"]>,
  { text: string; cls: string }
> = {
  available: { text: "Available", cls: "bg-emerald-100 text-emerald-800" },
  waitlist: { text: "Waitlist", cls: "bg-amber-100 text-amber-800" },
  unavailable: { text: "Unavailable", cls: "bg-neutral-200 text-neutral-600" },
};
