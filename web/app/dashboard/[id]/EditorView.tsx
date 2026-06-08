"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CodeEditor from "@/components/CodeEditor";
import type { QrCode } from "@/lib/types";

export type ListingOption = { id: string; name: string; address: string | null };

export default function EditorView({
  code,
  listings,
  userId,
}: {
  code: QrCode;
  listings: ListingOption[];
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
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={back} className="text-blue-600 text-sm font-medium">
          ← Back
        </button>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-medium truncate">
          {code.title || code.short_code}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-neutral-500">Listing</label>
          <select
            value={listingId ?? ""}
            onChange={(e) => changeListing(e.target.value)}
            className="border rounded-lg px-2 py-1 text-sm max-w-[220px]"
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

      <div className="max-w-5xl mx-auto p-5">
        <div className="bg-white border rounded-xl p-5">
          <CodeEditor
            code={code}
            userId={userId}
            onSaved={() => router.refresh()}
            onDeleted={back}
          />
        </div>
      </div>
    </main>
  );
}
