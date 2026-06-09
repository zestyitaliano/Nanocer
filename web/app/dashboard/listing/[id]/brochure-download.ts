// Client helper: assemble a brochure payload from the listing's in-memory state
// and POST it to the render service's /brochure endpoint, then trigger a file
// download. The render service is DB-free, so we send it everything it needs.
// Image URLs are run through transformUrl so (when image transforms are on) the
// service fetches smaller images and renders faster.

import { transformUrl } from "@/lib/image";
import type { FloorPlan, Listing } from "@/lib/types";

export interface BrochureArgs {
  listing: Listing;
  plans: FloorPlan[];
  photos: string[];
  agent: { name?: string; phone?: string; email?: string; photo_url?: string };
  themeColor?: string;
  landingUrl?: string;
}

function img(url?: string | null): string | undefined {
  if (!url) return undefined;
  return transformUrl(url, { width: 1600 });
}

export async function downloadBrochure(args: BrochureArgs): Promise<void> {
  const base = (process.env.NEXT_PUBLIC_RENDER_API_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("Render service URL is not configured.");

  const { listing } = args;
  const payload = {
    listing: {
      name: listing.name,
      address: listing.address,
      price: listing.price,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      description: listing.description,
    },
    floor_plans: args.plans.map((p) => ({
      name: p.name,
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      price: p.price,
      price_max: p.price_max,
      price_unit: p.price_unit,
      availability: p.availability,
      available_text: p.available_text,
      photos: (p.photos ?? []).map(img).filter(Boolean),
      photo_url: img(p.photo_url),
      description: p.description,
    })),
    photos: (args.photos ?? []).map(img).filter(Boolean),
    theme: { color: args.themeColor },
    agent: {
      name: args.agent?.name,
      phone: args.agent?.phone,
      email: args.agent?.email,
      photo_url: img(args.agent?.photo_url),
    },
    landing_url: args.landingUrl,
  };

  const res = await fetch(`${base}/brochure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      res.status === 501
        ? "Brochure generation isn't available on the render service yet."
        : `Brochure failed (${res.status}). ${detail}`,
    );
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(listing.name || "brochure").replace(/[^\w-]+/g, "-").toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
