// Public property page (/p/<slug>). No auth — read via the service-role admin
// client, only when the listing's page is published. This is where a scanned
// dynamic code lands (once pointed here in Step 3).
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FloorPlan, Listing, PageConfig } from "@/lib/types";
import { quizIsLive } from "@/lib/quiz";
import {
  getPlans,
  planPriceLabel,
  summaryRange,
  AVAILABILITY_BADGE,
} from "@/lib/listing";
import LeadForm from "./LeadForm";
import PropertyQuiz from "./PropertyQuiz";

function PlanCard({ plan, accent }: { plan: FloorPlan; accent: string }) {
  const price = planPriceLabel(plan);
  const specs = [
    plan.beds != null ? `${plan.beds <= 0 ? "Studio" : `${plan.beds} bd`}` : null,
    plan.baths != null ? `${plan.baths} ba` : null,
    plan.sqft != null ? `${Number(plan.sqft).toLocaleString()} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const badge = AVAILABILITY_BADGE[plan.availability ?? "available"];
  const cta = plan.cta;
  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
      {plan.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={plan.photo_url} alt={plan.name} className="w-full aspect-[4/3] object-cover" />
      ) : null}
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{plan.name}</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
            {badge.text}
          </span>
        </div>
        {specs && <div className="text-sm text-[var(--muted)]">{specs}</div>}
        {price && (
          <div className="text-sm font-semibold" style={{ color: accent }}>
            {price}
          </div>
        )}
        {plan.available_text && (
          <div className="text-xs text-[var(--muted)]">{plan.available_text}</div>
        )}
        {plan.description && (
          <p className="text-sm text-[var(--ink)]/80 whitespace-pre-wrap">
            {plan.description}
          </p>
        )}
        {cta?.value && cta.type === "link" ? (
          <a
            href={cta.value}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-white rounded-xl py-2 text-sm font-semibold shadow-sm mt-1"
            style={{ background: accent }}
          >
            {cta.label || "Apply"}
          </a>
        ) : cta?.value && cta.type === "text" ? (
          <a
            href={`sms:${cta.value}`}
            className="block text-center text-white rounded-xl py-2 text-sm font-semibold shadow-sm mt-1"
            style={{ background: accent }}
          >
            {cta.label || "Text me"}
          </a>
        ) : (
          <a
            href="#lead"
            className="block text-center rounded-xl py-2 text-sm font-semibold mt-1 border"
            style={{ borderColor: accent, color: accent }}
          >
            Request info
          </a>
        )}
      </div>
    </div>
  );
}

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
  if (!l) return { title: "Not found", robots: { index: false } };
  const title = l.address || l.name || "Property";
  const cfg = (l.page_config ?? {}) as PageConfig;
  const photos = cfg.photos ?? [];
  const description =
    (l.description ?? "").trim().slice(0, 160) ||
    `View details, floor plans, and availability for ${title}.`;
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://nanocer.com").replace(
    /\/$/,
    "",
  );
  const url = `${base}/p/${l.slug}`;
  return {
    title: `${title} · Nanocer`,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: photos[0] ? [{ url: photos[0] }] : undefined,
    },
  };
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
  const plans = getPlans(cfg);
  const showQuiz = quizIsLive(cfg.quiz, plans.length);
  const mapHref = l.address
    ? `https://maps.google.com/?q=${encodeURIComponent(l.address)}`
    : null;
  const statusBanner: { text: string; cls: string } | null =
    l.status === "under_contract"
      ? { text: "Under contract", cls: "bg-amber-100 text-amber-800" }
      : l.status === "sold"
        ? { text: "No longer available", cls: "bg-neutral-200 text-neutral-700" }
        : l.status === "coming_soon"
          ? { text: "Coming soon", cls: "bg-blue-100 text-blue-800" }
          : null;

  return (
    <main className="min-h-screen sm:py-6">
      <div className="max-w-md mx-auto bg-white min-h-screen sm:min-h-0 sm:rounded-3xl sm:shadow-[var(--shadow-md)] overflow-hidden">
        {photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[0]} alt={title} className="w-full aspect-[4/3] object-cover" />
        ) : (
          <div className="w-full aspect-[4/3] bg-neutral-100" />
        )}

        <div className="p-5 space-y-4">
          <div>
            {statusBanner && (
              <span
                className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 ${statusBanner.cls}`}
              >
                {statusBanner.text}
              </span>
            )}
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-[var(--muted)] mt-0.5">
              {plans.length ? summaryRange(plans) : facts(l)}
            </p>
          </div>

          {photos.length > 1 && (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.slice(1, 7).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          )}

          {l.description && (
            <p className="text-sm text-[var(--ink)]/80 whitespace-pre-wrap leading-relaxed">
              {l.description}
            </p>
          )}

          {mapHref && (
            <a href={mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: accent }}>
              📍 View on map
            </a>
          )}

          {plans.length > 0 && (
            <div className="border-t border-[var(--border)] pt-4 space-y-3">
              <h2 className="text-sm font-semibold">
                Floor plans ({plans.length})
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {plans.map((p) => (
                  <PlanCard key={p.id} plan={p} accent={accent} />
                ))}
              </div>
            </div>
          )}

          {(agent.name || agent.phone || agent.email) && (
            <div className="border-t border-[var(--border)] pt-4 flex items-center gap-3">
              {agent.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agent.photo_url} alt={agent.name ?? "Agent"} className="w-12 h-12 rounded-full object-cover" />
              ) : null}
              <div className="text-sm">
                {agent.name && <div className="font-semibold">{agent.name}</div>}
                {agent.phone && (
                  <a href={`tel:${agent.phone}`} className="text-[var(--muted)] block">
                    {agent.phone}
                  </a>
                )}
                {agent.email && (
                  <a href={`mailto:${agent.email}`} className="text-[var(--muted)] block">
                    {agent.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {cta?.type === "text" && cta.value && (
            <a href={`sms:${cta.value}`} className="block text-center text-white rounded-xl py-3 text-sm font-semibold shadow-sm" style={{ background: accent }}>
              {cta.label || "Text me"}
            </a>
          )}
          {cta?.type === "link" && cta.value && (
            <a href={cta.value} target="_blank" rel="noopener noreferrer" className="block text-center text-white rounded-xl py-3 text-sm font-semibold shadow-sm" style={{ background: accent }}>
              {cta.label || "Learn more"}
            </a>
          )}

          <div id="lead" className="border-t border-[var(--border)] pt-4 scroll-mt-4">
            {showQuiz ? (
              <PropertyQuiz
                listingId={l.id}
                quiz={cfg.quiz!}
                plans={plans}
                accent={accent}
              />
            ) : (
              <>
                <h2 className="text-sm font-semibold mb-2">Request a tour</h2>
                <LeadForm listingId={l.id} accent={accent} />
              </>
            )}
          </div>

          <p className="text-center text-[11px] text-[var(--muted)] pt-2">
            Powered by Nanocer
          </p>
        </div>
      </div>
    </main>
  );
}
