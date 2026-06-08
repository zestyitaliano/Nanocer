import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortfolioAnalytics from "./PortfolioAnalytics";
import type { Portfolio } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
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

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!portfolio) notFound();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, name, address")
    .eq("portfolio_id", id);
  const listingIds = (listings ?? []).map((l) => l.id);

  let codes: { listing_id: string; short_code: string; scan_count: number }[] = [];
  let scanEvents: { short_code: string; scanned_at: string; country: string | null; user_agent: string | null }[] = [];
  let leads: { listing_id: string; created_at: string }[] = [];

  if (listingIds.length) {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: c } = await supabase
      .from("codes")
      .select("listing_id, short_code, scan_count")
      .in("listing_id", listingIds);
    codes = c ?? [];
    const shortCodes = codes.map((x) => x.short_code);
    const [{ data: se }, { data: ld }] = await Promise.all([
      shortCodes.length
        ? supabase
            .from("scan_events")
            .select("short_code, scanned_at, country, user_agent")
            .in("short_code", shortCodes)
            .gte("scanned_at", since)
        : Promise.resolve({ data: [] }),
      supabase.from("leads").select("listing_id, created_at").in("listing_id", listingIds),
    ]);
    scanEvents = (se ?? []) as typeof scanEvents;
    leads = (ld ?? []) as typeof leads;
  }

  return (
    <PortfolioAnalytics
      portfolio={portfolio as Portfolio}
      listings={(listings ?? []) as { id: string; name: string; address: string | null }[]}
      codes={codes}
      scanEvents={scanEvents}
      leads={leads}
    />
  );
}
