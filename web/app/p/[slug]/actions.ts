"use server";

// Lead capture for public property pages. Writes via the service-role admin
// client (no public insert policy on leads), and validates the listing's page
// is published before accepting.
import { createAdminClient } from "@/lib/supabase/admin";

export async function submitLead(input: {
  listingId: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  // Set by the floor-plan finder. Folded into the lead so the agent sees a
  // pre-segmented lead without needing a new column.
  recommendation?: string;
  quizSummary?: string;
  // Anti-spam: hp = honeypot (must stay empty); t = form render time (ms).
  hp?: string;
  t?: number;
}): Promise<{ ok: boolean; error?: string }> {
  // Bots fill the hidden honeypot, or submit near-instantly. Pretend success so
  // we don't reveal the trap, but drop the submission.
  if (input.hp && input.hp.trim()) return { ok: true };
  if (input.t && Date.now() - input.t < 2000) return { ok: true };

  if (!input.name?.trim() || !input.phone?.trim()) {
    return { ok: false, error: "Name and phone are required." };
  }
  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("id")
    .eq("id", input.listingId)
    .eq("page_enabled", true)
    .maybeSingle();
  if (!listing) return { ok: false, error: "This page is not available." };

  // Light flood cap: no more than 8 leads per listing per 5 minutes.
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", input.listingId)
    .gte("created_at", since);
  if ((count ?? 0) >= 8) {
    return {
      ok: false,
      error: "Too many submissions right now — please try again in a few minutes.",
    };
  }

  // Compose the stored message from any free-text message plus the quiz context.
  const parts = [
    input.recommendation?.trim()
      ? `Recommended: ${input.recommendation.trim()}`
      : null,
    input.quizSummary?.trim() || null,
    input.message?.trim() || null,
  ].filter(Boolean);

  const { error } = await admin.from("leads").insert({
    listing_id: input.listingId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    message: parts.length ? parts.join("\n") : null,
    source: input.quizSummary?.trim() ? "quiz" : "page",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
