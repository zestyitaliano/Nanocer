// Public property page (/p/<slug>). No auth — read via the service-role admin
// client, only when the listing's page is published. This is where a scanned
// dynamic code lands (once pointed here in Step 3).
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Listing, PageConfig } from "@/lib/types";
import LeadForm from "./LeadForm";

export const dynamic = "force-dynamic";

async function getListing(slug: string): Promise<Listing | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("listings")
    .select("*")
    .eq("slug", slug)
    .eq("page_enabled", true)
    .maybeSingle();
  return (data as Listing) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const l = await getListing(slug);
  if (!l) return { title: "Not found" };
  const title = l.address || l.name || "Property";
  return { title: `${title} · Nanocer` };
}

function facts(l: Listing): string {
  return [
    l.price != null ? `$${Number(l.price).toLocaleString()}` : null,
    l.beds != null ? `${l.beds} bd` : null,
    l.baths != null ? `${l.baths} ba` : null,
    l.sqft != null ? `${Number(l.sqft).toLocaleString()} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const l = await getListing(slug);
  if (!l) notFound();

  const cfg = (l.page_config ?? {}) as PageConfig;
  const accent = cfg.theme?.color || "#1a73e8";
  const title = l.address || l.name || "Property";
  const photos = cfg.photos ?? [];
  const agent = cfg.agent ?? {};
  const cta = cfg.cta;
  const mapHref = l.address
    ? `https://maps.google.com/?q=${encodeURIComponent(l.address)}`
    : null;

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[0]} alt={title} className="w-full aspect-[4/3] object-cover" />
        ) : (
          <div className="w-full aspect-[4/3] bg-neutral-100" />
        )}

        <div className="p-5 space-y-4">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-neutral-600">{facts(l)}</p>
          </div>

          {photos.length > 1 && (
            <div className="grid grid-cols-3 gap-1">
              {photos.slice(1, 7).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded" />
              ))}
            </div>
          )}

          {l.description && (
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">
              {l.description}
            </p>
          )}

          {mapHref && (
            <a href={mapHref} target="_blank" rel="noopener noreferrer" className="block text-sm" style={{ color: accent }}>
              📍 View on map
            </a>
          )}

          {(agent.name || agent.phone || agent.email) && (
            <div className="border-t pt-4 flex items-center gap-3">
              {agent.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agent.photo_url} alt={agent.name ?? "Agent"} className="w-12 h-12 rounded-full object-cover" />
              ) : null}
              <div className="text-sm">
                {agent.name && <div className="font-medium">{agent.name}</div>}
                {agent.phone && (
                  <a href={`tel:${agent.phone}`} className="text-neutral-600 block">
                    {agent.phone}
                  </a>
                )}
                {agent.email && (
                  <a href={`mailto:${agent.email}`} className="text-neutral-600 block">
                    {agent.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {cta?.type === "text" && cta.value && (
            <a href={`sms:${cta.value}`} className="block text-center text-white rounded-lg py-2.5 text-sm font-medium" style={{ background: accent }}>
              {cta.label || "Text me"}
            </a>
          )}
          {cta?.type === "link" && cta.value && (
            <a href={cta.value} target="_blank" rel="noopener noreferrer" className="block text-center text-white rounded-lg py-2.5 text-sm font-medium" style={{ background: accent }}>
              {cta.label || "Learn more"}
            </a>
          )}

          <div className="border-t pt-4">
            <h2 className="text-sm font-medium mb-2">Request a tour</h2>
            <LeadForm listingId={l.id} accent={accent} />
          </div>

          <p className="text-center text-[11px] text-neutral-400 pt-2">
            Powered by Nanocer
          </p>
        </div>
      </div>
    </main>
  );
}
