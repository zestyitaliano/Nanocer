"use client";

import { STATUS_LABEL, type Listing, type ListingStatus } from "@/lib/types";

export const STATUS_COLOR: Record<ListingStatus, string> = {
  other: "bg-neutral-100 text-neutral-500",
  active: "bg-emerald-100 text-emerald-700",
  leased_up: "bg-rose-100 text-rose-700",
};

// Tolerate any legacy status value (e.g. an old coming_soon/under_contract row).
export const statusColor = (s: string) =>
  (STATUS_COLOR as Record<string, string>)[s] ?? STATUS_COLOR.other;
export const statusLabelOf = (s: string) =>
  (STATUS_LABEL as Record<string, string>)[s] ?? "No Status";

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
      className="card card-hover text-left p-5 flex flex-col gap-2.5 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm truncate">{label}</span>
        <span className={`chip shrink-0 ${statusColor(listing.status)}`}>
          {statusLabelOf(listing.status)}
        </span>
      </div>
      {listing.name && listing.address && (
        <span className="text-xs text-[var(--muted)] truncate">{listing.address}</span>
      )}
      <span className="text-sm text-[var(--ink)] font-medium">{facts || "—"}</span>
      <div className="mt-2 pt-3 border-t border-[var(--border)] flex gap-4 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1">▣ {codeCount} codes</span>
        <span className="flex items-center gap-1">📈 {scanSum} scans</span>
      </div>
    </button>
  );
}
