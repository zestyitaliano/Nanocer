# Supabase setup

Postgres (data), Auth (users), and Storage (logo images) for Nanocer.

## 1. Create the project

1. Go to <https://supabase.com> → **New project** (free plan).
2. Pick a name (e.g. `nanocer`), a strong DB password, and a region near you.
3. Wait for provisioning (~2 min).

## 2. Apply the schema

Easiest: open **SQL Editor** in the dashboard and run each file in order:

1. Paste the contents of [`migrations/0001_init.sql`](migrations/0001_init.sql) → **Run**.
2. Paste the contents of [`migrations/0002_storage.sql`](migrations/0002_storage.sql) → **Run**.

Both files are idempotent, so re-running them is safe.

(CLI alternative: `supabase link --project-ref <ref>` then `supabase db push`.)

## 3. Enable Auth

- **Authentication → Providers → Email** is on by default (email/password).
- For local/dev testing, **Authentication → Sign In / Providers → Email** →
  consider turning **"Confirm email" OFF** so test sign-ups work without SMTP.
  Turn it back on (or configure SMTP) before going live.
- Optional: enable **Google** OAuth later.

## 4. Grab the keys (for the web app env)

**Project Settings → API**:

| Value | Goes into env var | Exposure |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | public |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public (RLS-protected) |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **server-only — never expose to the browser** |

The service-role key is used only by the Vercel redirect route (`/r/[code]`) to
read a destination and log a scan via the `increment_scan` RPC. Keep it out of
any `NEXT_PUBLIC_*` variable.

## What the schema gives you

- `codes` — per-user QR codes (RLS: you only see your own).
- `scan_events` — one row per scan; readable by the code's owner. Writes happen
  **only** through the `increment_scan` RPC (clients can't forge scans).
- `increment_scan(short_code, user_agent, country)` — validates + logs + bumps
  the count + returns the destination in one call.
- `logos` storage bucket — public-read, per-user write folders (`logos/<uid>/`).
