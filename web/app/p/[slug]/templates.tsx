// Non-property page templates rendered by /p/[slug] based on listing.template.
// Server components; lead capture reuses the client LeadForm (so spam protection
// + leads + analytics apply everywhere).
import type { Listing, PageConfig } from "@/lib/types";
import LeadForm from "./LeadForm";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen sm:py-6">
      <div className="max-w-md mx-auto bg-white min-h-screen sm:min-h-0 sm:rounded-3xl sm:shadow-[var(--shadow-md)] overflow-hidden">
        {children}
      </div>
    </main>
  );
}

function PoweredBy() {
  return (
    <p className="text-center text-[11px] text-[var(--muted)] pt-2 pb-5">
      Powered by Nanocer
    </p>
  );
}

function vcardHref(agent: NonNullable<PageConfig["agent"]>, title: string): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${agent.name || title}`,
    agent.phone ? `TEL;TYPE=CELL:${agent.phone}` : null,
    agent.email ? `EMAIL:${agent.email}` : null,
    "END:VCARD",
  ].filter(Boolean);
  return `data:text/vcard;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
}

export function AgentTemplate({
  listing,
  cfg,
  accent,
}: {
  listing: Listing;
  cfg: PageConfig;
  accent: string;
}) {
  const agent = cfg.agent ?? {};
  const title = agent.name || listing.name || listing.address || "Contact";
  const cta = cfg.cta;
  const btn =
    "block text-center text-white rounded-xl py-3 text-sm font-semibold shadow-sm";
  return (
    <Shell>
      <div className="p-6 flex flex-col items-center text-center gap-3">
        {agent.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agent.photo_url} alt={title} className="w-24 h-24 rounded-full object-cover shadow-sm" />
        ) : (
          <div className="w-24 h-24 rounded-full grid place-items-center text-2xl font-bold text-white" style={{ background: accent }}>
            {title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {listing.address && (
            <p className="text-sm text-[var(--muted)]">{listing.address}</p>
          )}
        </div>

        <div className="w-full space-y-2 mt-2">
          {agent.phone && (
            <a href={`tel:${agent.phone}`} className={btn} style={{ background: accent }}>
              📞 Call
            </a>
          )}
          {agent.phone && (
            <a href={`sms:${agent.phone}`} className={btn} style={{ background: accent }}>
              💬 Text
            </a>
          )}
          {agent.email && (
            <a href={`mailto:${agent.email}`} className="block text-center rounded-xl py-3 text-sm font-semibold border" style={{ borderColor: accent, color: accent }}>
              ✉️ Email
            </a>
          )}
          <a href={vcardHref(agent, title)} download="contact.vcf" className="block text-center rounded-xl py-3 text-sm font-semibold border" style={{ borderColor: accent, color: accent }}>
            Save contact
          </a>
          {cta?.value && cta.type === "link" && (
            <a href={cta.value} target="_blank" rel="noopener noreferrer" className={btn} style={{ background: accent }}>
              {cta.label || "Learn more"}
            </a>
          )}
        </div>
      </div>
      <PoweredBy />
    </Shell>
  );
}

export function OpenHouseTemplate({
  listing,
  cfg,
  accent,
}: {
  listing: Listing;
  cfg: PageConfig;
  accent: string;
}) {
  const title = listing.address || listing.name || "Open house";
  const photos = cfg.photos ?? [];
  const event = cfg.event ?? {};
  const mapHref = listing.address
    ? `https://maps.google.com/?q=${encodeURIComponent(listing.address)}`
    : null;
  const when = [event.date, event.time].filter(Boolean).join(" · ");
  return (
    <Shell>
      {photos[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photos[0]} alt={title} className="w-full aspect-[4/3] object-cover" />
      ) : null}
      <div className="p-5 space-y-4">
        <div>
          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 bg-orange-100 text-orange-800">
            Open house
          </span>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {when && <p className="text-[var(--muted)] mt-0.5">{when}</p>}
        </div>
        {event.note && (
          <p className="text-sm text-[var(--ink)]/80 whitespace-pre-wrap">{event.note}</p>
        )}
        {mapHref && (
          <a href={mapHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: accent }}>
            📍 Directions
          </a>
        )}
        <div className="border-t border-[var(--border)] pt-4">
          <h2 className="text-sm font-semibold mb-2">Sign in</h2>
          <LeadForm listingId={listing.id} accent={accent} label="Sign in" busyLabel="Signing in…" />
        </div>
      </div>
      <PoweredBy />
    </Shell>
  );
}

export function ComingSoonTemplate({
  listing,
  cfg,
  accent,
}: {
  listing: Listing;
  cfg: PageConfig;
  accent: string;
}) {
  const title = listing.address || listing.name || "Coming soon";
  const cs = cfg.coming_soon ?? {};
  const photos = cfg.photos ?? [];
  return (
    <Shell>
      {photos[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photos[0]} alt={title} className="w-full aspect-[4/3] object-cover" />
      ) : null}
      <div className="p-5 space-y-4">
        <div>
          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 bg-amber-100 text-amber-800">
            Coming soon
          </span>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {cs.expected && (
            <p className="text-[var(--muted)] mt-0.5">Expected: {cs.expected}</p>
          )}
        </div>
        {cs.blurb && (
          <p className="text-sm text-[var(--ink)]/80 whitespace-pre-wrap">{cs.blurb}</p>
        )}
        <div className="border-t border-[var(--border)] pt-4">
          <h2 className="text-sm font-semibold mb-2">Join the waitlist</h2>
          <LeadForm listingId={listing.id} accent={accent} label="Join the waitlist" busyLabel="Joining…" />
        </div>
      </div>
      <PoweredBy />
    </Shell>
  );
}
