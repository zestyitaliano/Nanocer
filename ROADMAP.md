# Nanocer — Product Roadmap

## Positioning

Nanocer is a **dynamic QR platform for real estate & signage**. The QR is just
the doorway — the value is in *where it leads, what you learn, and what it
triggers*. Anchor user: **agents, brokerages, and sign/print shops** who put
codes on yard signs, riders, flyers, window cards, and open-house collateral and
need to (a) point them anywhere, anytime, without reprinting, (b) capture leads,
and (c) see which signs actually perform.

Generic QR generation is commodity; the moat is the **destination + data +
workflow** built around the real-estate use case.

> Status: brainstorm captured 2026-06. Not yet started — design pass first.
> Quick-win = cheap on the current Vercel/Supabase stack and high leverage.

---

## 1. Smart / programmable redirects  ⭐ quick win
Extend the existing `/r/[code]` route (already resolves server-side) into a rules
engine. Same printed sign, different destination by context.

- **Scheduling**: go live / expire on dates; "open house Sat 1–4" link that flips
  before/after; auto-switch listing → "Just Sold" page.
- **Geo / device / language** routing (e.g., iOS vs Android app, EN/ES page).
- **A/B split** between two destinations + report the winner.
- **Lead routing**: round-robin or by area to the right agent.
- **Scan caps / password / one-time** (gated info sheets, limited offers).
- Real-estate hook: a rider code that you repoint as a listing moves through
  *coming soon → active → under contract → sold*, untouched in the field.

## 2. Own the destination — hosted pages  ⭐ biggest value/lock-in
Most agents don't have a good mobile page to point a sign at. Host it so they
never leave Nanocer.

- **Property landing pages**: photos, price, beds/baths, description, map, "book a
  showing," agent contact — mobile-first, branded.
- **Agent link-in-bio / digital business card (vCard)** for sign riders.
- **Lead-capture forms**: scan → name/email/phone → stored in Nanocer (data you
  own) + emailed/forwarded to the agent.
- Templates: open house sign-in sheet, flyer page, "text me about this home."
- This produces owned data, not just a redirect, and creates real stickiness.

## 3. Analytics that drive decisions  ⭐ quick win (foundation exists)
The redirect already logs scans + country. Build it out.

- Map view, device/OS, time-of-day heatmap, unique vs repeat scans.
- **Per-sign / per-listing performance**: which yard sign or flyer drives scans
  and leads. Compare listings/campaigns.
- **Conversion tracking** (scan → form submit → showing booked), paired with #2.
- Alerts ("your sign hit 100 scans") + weekly email summary + CSV/PDF report.
- UTM auto-tagging so it flows into the agent's/brokerage's existing analytics.

## 4. Real estate & signage vertical (the lens for everything above)
Use-case packaging and features specific to the audience.

- **Listing-centric model**: a "Listing" groups its codes (yard sign, rider,
  flyer, window card), its landing page, and its analytics in one place.
- Sign/rider **print-ready assets** with a clear "Scan for details / Scan to
  tour" frame; sizes for common sign formats.
- Brokerage **team workspaces**: agents, shared branding, roles; "transfer a
  listing's codes to another agent."
- MLS / listing-data import to auto-build property pages (later/bigger bet).
- "Just Sold" / lead-magnet flows; compliance-friendly contact capture.

## 5. Deployment & lifecycle  (the unglamorous value)
- **Print-ready exports**: vector/large-format, bleed/margins, CTA frames.
- **Bulk + unique codes from CSV**: one code per listing/sign/rider in a batch
  (serialized), generated in one pass.
- **Reorder / batch repoint**: change a whole batch's destinations at once; "the
  printed sign is wrong — fix it without reprinting" is the headline superpower —
  market it loudly.
- Replace/rotate codes; archive sold-listing codes without losing history.
- Public **API + webhooks** + Zapier so brokerage tools can create/repoint codes.

---

## Suggested near-term sequence (for later)
1. **Analytics depth (#3)** + **scheduling/rules basics (#1)** — cheap, build on
   existing redirect + scan data, immediately demoable.
2. **Hosted property landing page + lead form (#2)** — the value unlock.
3. **Listing grouping (#4)** to tie codes + page + analytics together.
4. **Bulk-unique + print-ready + batch repoint (#5)** for real-world rollout.

## Design decisions (resolved)
- **Listings replace Folders.** A *Listing* is the core container: it groups a
  property's codes, owns its hosted page, carries a status, and rolls up its
  analytics. Folders go away (the new dashboard sidebar lists Listings).
- **Hosted pages are fixed templates**, not a builder (ship fast; enough to start).
- Pricing: see proposal below.

## Data model — Listings (replaces folders)
Migrate `folders` → `listings`; rename `codes.folder_id` → `codes.listing_id`.

`listings` table (RLS owner-only, like folders today):
- `id, user_id, created_at, updated_at`
- `name` (label / address line)
- `status` — `coming_soon | active | under_contract | sold | other`
  (drives smart-redirect flips in §1)
- Property fields (all optional, so it also works as a generic container):
  `address, price, beds, baths, sqft, description`
- Hosted page: `slug` (public URL `/p/<slug>`), `template` (which template),
  `page_enabled bool`, `page_config jsonb` (photos, agent contact, CTA, theme)
- A listing's **scan analytics** = sum over its codes' `scan_events`.
- Lead capture: new `leads` table (`id, listing_id, name, email, phone, message,
  created_at`) written by the public page; owner-readable via RLS.

Generic (non-real-estate) users just make a Listing with a name and no property
fields — it behaves like today's folder.

## Landing-page templates (start with 3)
1. **Property page** — gallery, price, beds/baths/sqft, description, map, agent
   contact, "Request a tour / Text me" → lead form. The core.
2. **Agent card (vCard + link-in-bio)** — photo, name, brokerage, call/text/email,
   socials, "Save contact," current listings. For sign riders.
3. **Open house** — property + date/time, **sign-in form** (lead capture),
   directions. High-value, very real-estate-specific.
Later: "Just Listed / Just Sold" announcement, generic flyer page.

## Pricing proposal (react / adjust)
Infra break-even once commercial ≈ Vercel Pro $20 + Supabase Pro ~$25 = ~$45/mo,
so tiers must clear that with a modest base. Gate on *value*, not crippling.

- **Free** — lead funnel: up to 3 active listings, unlimited static codes, 30-day
  analytics, all 3 templates **with Nanocer branding**, no lead export.
- **Agent / Pro — ~$15/mo** (or ~$144/yr): ~25 listings, unlimited dynamic codes,
  full analytics history + reports, scheduling/rules (§1), lead capture + export,
  **remove branding**, print-ready exports.
- **Team / Brokerage — ~$59/mo** + per-seat: multiple agent seats, shared
  branding, roles, bulk unique codes + batch repoint (§5), API/webhooks, custom
  domain for pages, priority support.
- Add-ons later: extra seats, white-label for sign shops/resellers.

Billing via Stripe (future); start free + manual upgrades to validate demand.
