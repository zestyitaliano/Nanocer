import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardHome from "./DashboardHome";
import type { Listing, Portfolio } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: listings }, { data: codes }, { data: leads }, { data: portfolios }] =
    await Promise.all([
      supabase.from("listings").select("*").order("created_at", { ascending: false }),
      supabase.from("codes").select("id, listing_id, scan_count"),
      supabase.from("leads").select("listing_id"),
      supabase.from("portfolios").select("*").order("name", { ascending: true }),
    ]);

  return (
    <DashboardHome
      initialListings={(listings ?? []) as Listing[]}
      initialCodes={codes ?? []}
      initialLeads={(leads ?? []) as { listing_id: string }[]}
      initialPortfolios={(portfolios ?? []) as Portfolio[]}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  );
}
