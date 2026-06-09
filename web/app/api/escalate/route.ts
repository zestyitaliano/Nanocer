// Escalation sweep. Invoked on a schedule (Supabase pg_cron + pg_net, or Vercel
// Cron) with the CRON_SECRET. Finds uncontacted leads past their portfolio's SLA
// window that haven't been escalated yet, emails senior staff, and stamps
// escalated_at/escalated_to so each lead fires at most once.
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEscalation } from "@/lib/notify/lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SLA_MINUTES = 240;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  const provided =
    (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "") ||
    request.headers.get("x-cron-secret") ||
    request.nextUrl.searchParams.get("token") ||
    "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function runSweep() {
  const admin = createAdminClient();

  // Candidate leads: uncontacted, not yet escalated. We filter by per-portfolio
  // SLA in JS so each lead uses its own listing's window.
  const { data: leads, error } = await admin
    .from("leads")
    .select("id, listing_id, created_at, status, escalated_at")
    .eq("status", "uncontacted")
    .is("escalated_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const now = Date.now();
  let escalated = 0;
  let considered = 0;

  for (const lead of leads ?? []) {
    considered++;
    // Look up the listing's portfolio SLA (default when none).
    const { data: listing } = await admin
      .from("listings")
      .select("portfolio_id")
      .eq("id", lead.listing_id)
      .maybeSingle();
    let sla = DEFAULT_SLA_MINUTES;
    if (listing?.portfolio_id) {
      const { data: pf } = await admin
        .from("portfolios")
        .select("escalation_sla_minutes")
        .eq("id", listing.portfolio_id)
        .maybeSingle();
      if (pf?.escalation_sla_minutes != null) sla = pf.escalation_sla_minutes;
    }

    const ageMin = (now - new Date(lead.created_at).getTime()) / 60000;
    if (ageMin < sla) continue;

    const { escalatedTo } = await notifyEscalation(lead.listing_id, lead.id);
    // Stamp regardless of email success so we don't re-fire every sweep; the
    // is-null guard above prevents double-sends.
    await admin
      .from("leads")
      .update({ escalated_at: new Date().toISOString(), escalated_to: escalatedTo })
      .eq("id", lead.id)
      .is("escalated_at", null);
    escalated++;
  }

  return { considered, escalated };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await runSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "escalation failed" },
      { status: 500 },
    );
  }
}

// Allow GET too (some cron providers only issue GET).
export async function GET(request: NextRequest) {
  return POST(request);
}
