import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditorView, { type ListingOption } from "./EditorView";
import type { FloorPlan, QrCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: code }, { data: listings }] = await Promise.all([
    supabase.from("codes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("listings")
      .select("id, name, address, slug, page_enabled")
      .order("created_at", { ascending: false }),
  ]);
  if (!code) notFound(); // RLS also hides other users' codes

  // The code's listing's floor plans (for the "specific floor plan" target).
  let floorPlans: FloorPlan[] = [];
  const listingId = (code as QrCode).listing_id;
  if (listingId) {
    const { data: plans } = await supabase
      .from("floor_plans")
      .select("*")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true });
    floorPlans = (plans ?? []) as FloorPlan[];
  }

  return (
    <EditorView
      code={code as QrCode}
      listings={(listings ?? []) as ListingOption[]}
      floorPlans={floorPlans}
      userId={user.id}
    />
  );
}
