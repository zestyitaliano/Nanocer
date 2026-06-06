# Nanocer

Dynamic & static QR codes as a web app: sign up, create QR codes, style them with
logos, change a dynamic code's destination at any time (no reprint), see scan
analytics, and batch-export — all on free-tier cloud infrastructure.

## Architecture

| Concern | Service | Notes |
|---|---|---|
| Frontend + redirects | **Vercel** (Next.js) | UI, auth pages, and the latency-critical `/r/<code>` redirect |
| Database, Auth, Storage | **Supabase** | Postgres (`codes`, `scan_events`) with RLS, Auth, `logos` bucket |
| QR image generation | **Render** (FastAPI) | Stateless PNG/SVG + logo + ZIP rendering, reuses the Python pipeline |

```
phone scan ─► Vercel /r/[code] ─► Supabase (service role: read dest + log scan) ─► 302 redirect
browser    ─► Vercel app (Next.js) ─► Supabase (anon key + RLS)  &  Render (exports)
```

Why redirects live on Vercel: Render's free tier sleeps after 15 min (~50s cold
start), which is unacceptable for scans. Render only does image generation, which
tolerates an occasional cold start. Live editor preview is client-side (instant).

## Repository layout

```
web/             Next.js app (Vercel) — UI, auth, dashboard, /r/[code] redirect
server/          FastAPI render service (Render) — /render, /batch
supabase/        SQL migrations: schema, RLS, storage policies, RPC
scripts/         one-off utilities (e.g. SQLite → Supabase import)
desktop-legacy/  the original PySide6 desktop app (archived, not deployed)
```

## Getting started

See [`web/README.md`](web/README.md), [`server/README.md`](server/README.md), and
[`supabase/README.md`](supabase/README.md) for per-service setup, plus
[`DEPLOY.md`](DEPLOY.md) for the click-by-click deploy guide. Each service has an
`.env.example` listing the variables it needs.

## Free-tier notes

- **Vercel Hobby** is for non-commercial use. A paid plan is required if Nanocer
  becomes commercial.
- **Render free** web services sleep when idle; the first export after a quiet
  period may take ~50s. Redirects are unaffected (they run on Vercel).
- **Supabase free**: 500 MB DB / 1 GB storage; the project pauses after 7 days of
  inactivity (resumable from the dashboard).
