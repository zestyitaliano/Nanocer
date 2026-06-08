"use client";

import { STATUS_LABEL, type Listing, type ListingStatus } from "@/lib/types";

export const STATUS_COLOR: Record<ListingStatus, string> = {
  coming_soon: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  under_contract: "bg-blue-100 text-blue-700",
  sold: "bg-neutral-200 text-neutral-600",
  other: "bg-neutral-100 text-neutral-500",
};

export default function ListingCard({
  listing,
  codeCount,
  scanSum,
  onOpen,
}: {
  listing: Listing;
  codeCount: number;
  scanSum: number;
  onOpen: () => void;
}) {
  const label = listing.name || listing.address || "(untitled)";
  const facts = [
    listing.price != null ? `$${Number(listing.price).toLocaleString()}` : null,
    listing.beds != null ? `${listing.beds} bd` : null,
    listing.baths != null ? `${listing.baths} ba` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      onClick={onOpen}
      className="text-left bg-white border rounded-xl p-4 hover:shadow-md transition flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm truncate">{label}</span>
        <span
          className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded ${STATUS_COLOR[listing.status]}`}
        >
          {STATUS_LABEL[listing.status]}
        </span>
      </div>
      {listing.name && listing.address && (
        <span className="text-xs text-neutral-500 truncate">{listing.address}</span>
      )}
      <span className="text-xs text-neutral-500">{facts || "—"}</span>
      <div className="mt-1 flex gap-3 text-[11px] text-neutral-400">
        <span>▣ {codeCount} codes</span>
        <span>📈 {scanSum} scans</span>
      </div>
    </button>
  );
}
