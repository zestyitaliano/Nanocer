import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ListingHub from "./ListingHub";
import type { Listing, QrCode } from "@/lib/types";

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

  const [{ data: listing }, { data: codes }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("codes")
      .select("*")
      .eq("listing_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!listing) notFound();

  return (
    <ListingHub
      listing={listing as Listing}
      initialCodes={(codes ?? []) as QrCode[]}
      userId={user.id}
    />
  );
}
