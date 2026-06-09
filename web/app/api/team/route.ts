// Team management for a portfolio's members (owner-only). The owner adds members
// by email, sets roles, and removes them. Uses the session client to authenticate
// + authorize ownership, and the service-role admin client to resolve emails
// (auth.users isn't reachable via PostgREST) and write membership rows.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: TeamRole[] = ["leasing_agent", "senior_staff", "property_manager"];

// Resolves ?portfolioId or ?listingId to a portfolio the requester OWNS.
// Returns null if not owned / not found.
async function ownedPortfolioId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  req: NextRequest,
): Promise<string | null> {
  const portfolioId = req.nextUrl.searchParams.get("portfolioId");
  const listingId = req.nextUrl.searchParams.get("listingId");
  if (portfolioId) {
    const { data } = await supabase.from("portfolios").select("id").eq("id", portfolioId).maybeSingle();
    return data ? portfolioId : null;
  }
  if (listingId) {
    // Owner-only listing read (RLS); fetch its portfolio.
    const { data } = await supabase
      .from("listings")
      .select("portfolio_id")
      .eq("id", listingId)
      .maybeSingle();
    return data?.portfolio_id ?? null;
  }
  return null;
}

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  return { supabase, user };
}

async function emailFor(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

export async function GET(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const portfolioId = await ownedPortfolioId(ctx.supabase, req);
  if (!portfolioId) return NextResponse.json({ members: [], portfolioId: null });

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("portfolio_members")
    .select("user_id, role, created_at")
    .eq("portfolio_id", portfolioId);

  const withEmail = await Promise.all(
    (members ?? []).map(async (m) => ({
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      email: await emailFor(admin, m.user_id as string),
    })),
  );
  return NextResponse.json({ portfolioId, members: withEmail });
}

export async function POST(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const portfolioId = await ownedPortfolioId(ctx.supabase, req);
  if (!portfolioId) return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const role = (ROLES.includes(body.role as TeamRole) ? body.role : "leasing_agent") as TeamRole;
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const admin = createAdminClient();
  // Resolve email -> existing auth user. (v1: scans users; fine for small orgs.)
  let match: { id: string } | null = null;
  for (let page = 1; page <= 20 && !match; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    const found = users.find((u) => u.email?.toLowerCase() === email);
    if (found) match = { id: found.id };
    if (users.length < 200) break; // last page
  }
  if (!match) {
    return NextResponse.json(
      { error: "No Nanocer user with that email. They must sign up first." },
      { status: 404 },
    );
  }

  const { error } = await admin
    .from("portfolio_members")
    .upsert({ portfolio_id: portfolioId, user_id: match.id, role }, { onConflict: "portfolio_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const portfolioId = await ownedPortfolioId(ctx.supabase, req);
  if (!portfolioId) return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { userId?: string; role?: string };
  if (!body.userId || !ROLES.includes(body.role as TeamRole)) {
    return NextResponse.json({ error: "userId and a valid role are required." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("portfolio_members")
    .update({ role: body.role })
    .eq("portfolio_id", portfolioId)
    .eq("user_id", body.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const portfolioId = await ownedPortfolioId(ctx.supabase, req);
  if (!portfolioId) return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin
    .from("portfolio_members")
    .delete()
    .eq("portfolio_id", portfolioId)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
