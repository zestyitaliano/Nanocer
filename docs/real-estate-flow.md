# Nanocer — Real-estate flow & wireframes (sketch)

Anchor object: **Listing** (a property) replaces Folders. A Listing groups its
codes, owns a hosted page, carries a status, and rolls up its analytics.

> Low-fidelity sketch to react to — not final UI.

## Two user journeys

**Agent (owner)**
```
Create Listing (address + status)
  → fill details (price/beds/baths/photos)
  → property page auto-built from a template
  → add codes (yard sign, rider, flyer) — all point to the page by default
  → download print-ready codes → signs go up
  → scans + leads roll in → watch per-code analytics
  → mark Sold → codes auto-flip to a "Just Sold" page, still capturing leads
```

**Buyer (scanner)**
```
Sees yard sign → scans QR → /r/<code> → property page (/p/<slug>)
  → browses photos/price/map → taps "Request a tour"
  → submits name/phone → lead stored + agent notified
```

## Navigation map
```
/dashboard                         Listings home (cards by status)
  /dashboard/listing/[id]          Listing hub — tabs:
        Overview | Codes | Page | Leads | Analytics
     /dashboard/listing/[id]/code/[codeId]   single-code editor

/p/[slug]      public property page (what the buyer sees)
/r/[code]      redirect → resolves to /p/<slug> or a custom URL, per status
```

---

## Screen 1 — Listings home (replaces current dashboard)
```
┌────────────────────────────────────────────────────────────────┐
│ Nanocer     [ search… ]                 [ + New Listing ]  user ▾│
├───────────┬────────────────────────────────────────────────────┤
│ STATUS     │  Listings (12)                        [grid][list]  │
│ All     12 │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│ Active   7 │  │ [photo] │  │ [photo] │  │ [photo] │             │
│ Coming   2 │  │123 Main │  │45 Oak   │  │9 Elm St │             │
│ Pending  1 │  │● Active │  │● Coming │  │● Sold   │             │
│ Sold     2 │  │$450k 3/2│  │$610k 4/3│  │$390k 2/1│             │
│            │  │▣3 📈128 │  │▣2 📈12  │  │▣4 📈540 │             │
│ General    │  └─────────┘  └─────────┘  └─────────┘             │
└───────────┴────────────────────────────────────────────────────┘
  Sidebar filters by status. "General" = non-property containers.
  Card click → Listing hub.
```

## Screen 2 — Listing hub (Overview tab)
```
┌────────────────────────────────────────────────────────────────┐
│ ← Listings   123 Main St            Status: [ ● Active ▾ ]   ⋯  │
├────────────────────────────────────────────────────────────────┤
│ [Overview]  Codes   Page   Leads   Analytics                    │
├────────────────────────────────────────────────────────────────┤
│  ┌─ hero photo ─┐   123 Main St, Springfield                    │
│  │              │   $450,000 · 3 bd · 2 ba · 1,800 sqft         │
│  │              │   Page: nanocer.com/p/123-main  [Open] [Copy] │
│  └──────────────┘   [ Edit details ]                            │
│                                                                  │
│  Quick stats:  128 scans · 96 unique · 9 leads · live since 5/3 │
└────────────────────────────────────────────────────────────────┘
```

## Screen 2b — Codes tab
```
│ CODES (3)                                       [ + Add code ]   │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ [qr] Yard sign   → property page     312 scans      [⋯]  │   │
│ │ [qr] Rider       → property page      88 scans      [⋯]  │   │
│ │ [qr] Flyer       → custom URL        140 scans      [⋯]  │   │
│ └──────────────────────────────────────────────────────────┘   │
│  ⋯ : Edit & style · Download (print-ready) · Schedule/rule       │
│  Default: every code points to this listing's page.              │
```

## Screen 2c — Page tab (fixed template, fill content) + live preview
```
│ PAGE   Template:[ Property ▾ ]      [ ● Enabled ]                │
│  Photos    [+ upload] [img][img][img]        ┌ mobile preview ┐  │
│  Headline  123 Main St                       │  [ photo ]     │  │
│  Price/bed/bath  (from details)              │ 123 Main St    │  │
│  Description […………………………]                    │ $450k 3bd 2ba │  │
│  Agent  [name][phone][email][photo]          │ [gallery ▸]    │  │
│  CTA   (•) Request a tour ( ) Text ( ) Link  │ [Request tour] │  │
│  Theme  [color] [logo]                       └────────────────┘  │
```

## Screen 2d — Leads tab
```
│ LEADS (9)                                        [ Export CSV ]  │
│  Name       Contact              Source      When                │
│  Jane D.    jane@x.com 555-1234  Yard sign   2h ago              │
│  Mike R.    555-9876             Open house  1d ago              │
│  …                                                               │
```

## Screen 2e — Analytics tab
```
│ ANALYTICS                              [7d] [14d] [30d] [All]    │
│  Scans 128 · Unique 96 · Leads 9 · Conversion 7%                │
│  Per day:  ▂▃▅▇▆▃▂▁▁▂▅▇▇▆                                        │
│  By code:  Yard 312 · Rider 88 · Flyer 140                      │
│  By device: iOS 70% · Android 28% · other 2%                    │
│  By area:  [ mini map of scan locations ]                       │
```

## Screen 3 — Public property page  /p/<slug>  (mobile)
```
        ┌──────────────────┐
        │   [ photo ]       │
        │ 123 Main St       │
        │ $450,000          │
        │ 3 bd · 2 ba       │
        │ [ ◂ gallery ▸ ]   │
        │ Description……     │
        │ [    map    ]     │
        │ ── Your agent ──  │
        │ Pat Agent         │
        │ 📞 Text me        │
        │ [ Request a tour ]│ ← opens lead form
        │ · powered by …    │ (branding removed on paid)
        └──────────────────┘
```

## Lead form (sheet on the public page)
```
   Request a tour — 123 Main St
   [ Name              ]
   [ Phone             ]
   [ Email (optional)  ]
   [ Preferred time    ]
   [        Send       ]   → leads table + email/notify agent
```

## Create-Listing (quick, 1 modal)
```
   New Listing
   Address  [ 123 Main St, Springfield      ]
   Status   [ Coming soon ▾ ]
   Price [______]  Beds [__]  Baths [__]
   [ Create ]  → builds a default property page + lands on the hub,
                 prompting "Add your first code (yard sign)?"
```

## Status → redirect behavior (ties §1 to the listing)
```
Code's default target = this listing's page (/p/<slug>).
By status:
  coming_soon / active      → property page
  under_contract            → property page + "Under Contract" banner
  sold                      → "Just Sold" page (optional: link to agent's
                              other active listings) — still captures leads
Per-code override: point a specific code at a custom URL or schedule a flip
(e.g., open-house code only live Sat 1–4).
```

## How existing pieces map in
- `QrPreview` / `QrThumb` / `buildOptions` → code thumbnails + print-ready export
  (already client-side; add bleed/CTA frame for print).
- `CodeEditor` → the single-code editor (now reached from the Codes tab).
- `/r/[code]` redirect → gains the status/rule resolution.
- `scan_events` → powers the Analytics tab (extend with device/area).
- Folders UI → becomes the Listings home + status sidebar.

## Build order when we start
1. `folders → listings` migration (+ status, property fields, slug) and rename
   `codes.folder_id → listing_id`; Listings home + hub shell.
2. Property page template + public `/p/[slug]` + `leads` table + lead form.
3. Wire `/r/[code]` to resolve via the listing/status; per-code override.
4. Analytics tab; print-ready export; "Just Sold" flow.
```
