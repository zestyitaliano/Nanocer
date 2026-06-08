"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CodeEditor from "@/components/CodeEditor";
import type { FloorPlan, QrCode } from "@/lib/types";

export type ListingOption = {
  id: string;
  name: string;
  address: string | null;
  slug: string | null;
  page_enabled: boolean;
};

export default function EditorView({
  code,
  listings,
  floorPlans,
  userId,
}: {
  code: QrCode;
  listings: ListingOption[];
  floorPlans: FloorPlan[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [listingId, setListingId] = useState<string | null>(code.listing_id);

  function back() {
    if (listingId) router.push(`/dashboard/listing/${listingId}`);
    else router.push("/dashboard");
    router.refresh();
  }

  async function changeListing(v: string) {
    const lid = v === "" ? null : v;
    setListingId(lid);
    const { error } = await supabase
      .from("codes")
      .update({ listing_id: lid })
      .eq("id", code.id);
    if (error) alert(error.message);
  }

  return (
    <main className="min-h-screen">
      <header className="bg-white/70 backdrop-blur border-b border-[var(--border)] px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={back} className="btn btn-secondary btn-sm">
          ← Back
        </button>
        <span className="text-sm font-semibold truncate">
          {code.title || code.short_code}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-[var(--muted)] hidden sm:inline">Listing</label>
          <select
            value={listingId ?? ""}
            onChange={(e) => changeListing(e.target.value)}
            className="input py-1.5 text-sm max-w-[220px]"
          >
            <option value="">Unassigned (General)</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name || l.address || "(untitled)"}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="card p-5 sm:p-6">
          <CodeEditor
            code={code}
            userId={userId}
            listing={listings.find((l) => l.id === listingId) ?? null}
            floorPlans={floorPlans}
            onSaved={() => router.refresh()}
            onDeleted={back}
          />
        </div>
      </div>
    </main>
  );
}
