import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ListingHub from "./ListingHub";
import type { FloorPlan, Listing, Portfolio, QrCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ListingPage({
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

  const [{ data: listing }, { data: codes }, { data: plans }, { data: portfolios }] =
    await Promise.all([
      supabase.from("listings").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("codes")
        .select("*")
        .eq("listing_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("floor_plans")
        .select("*")
        .eq("listing_id", id)
        .order("sort_order", { ascending: true }),
      supabase.from("portfolios").select("*").order("name", { ascending: true }),
    ]);
  if (!listing) notFound();

  return (
    <ListingHub
      listing={listing as Listing}
      initialCodes={(codes ?? []) as QrCode[]}
      initialFloorPlans={(plans ?? []) as FloorPlan[]}
      portfolios={(portfolios ?? []) as Portfolio[]}
      userId={user.id}
    />
  );
}
