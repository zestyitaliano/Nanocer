# Deploying Nanocer (free tier)

Three services, all free: **Supabase** (data/auth/storage), **Render** (QR image
generation), **Vercel** (web app + redirects). Do them in this order — each step
produces values the next one needs.

The code is already on GitHub at `github.com/zestyitaliano/Nanocer` (branch
`main`). Vercel and Render deploy straight from there.

---

## 1. Supabase

1. <https://supabase.com> → **New project** (free). Name it `nanocer`, set a DB
   password, pick a region. Wait ~2 min.
2. **SQL Editor** → paste & **Run** [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   then [`supabase/migrations/0002_storage.sql`](supabase/migrations/0002_storage.sql).
3. **Authentication → Providers → Email**: on by default. For first testing,
   turn **Confirm email OFF** (Authentication → Sign In / Providers) so sign-ups
   work without email setup. Re-enable before real launch.
4. **Project Settings → API** — copy these three (used in step 3):
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret!)

## 2. Render (QR render service)

1. <https://render.com> → **New → Web Service** → connect the `Nanocer` repo.
2. Render detects [`render.yaml`](render.yaml). If asked, set:
   - Root directory: `server`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - Plan: **Free**
3. Add env var `ALLOWED_ORIGIN` — set it to your Vercel URL once you have it
   (step 3). For now use `*`; tighten it afterwards.
4. Deploy. Copy the service URL, e.g. `https://nanocer-render.onrender.com`
   → this becomes `NEXT_PUBLIC_RENDER_API_URL`. Verify `…/health` returns
   `{"status":"ok"}`.

## 3. Vercel (web app + redirects)

1. <https://vercel.com> → **Add New → Project** → import the `Nanocer` repo.
2. **Root Directory: `web`** (important — the Next.js app lives there).
3. **Environment Variables** — add all five:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (secret) |
   | `NEXT_PUBLIC_RENDER_API_URL` | your Render URL (no trailing slash) |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel URL, e.g. `https://nanocer.vercel.app` |

   > `NEXT_PUBLIC_SITE_URL` is encoded into every dynamic QR (`/r/<code>`), so it
   > must be the final public domain. After the first deploy you'll know the
   > Vercel URL — set it, then redeploy. If you add a custom domain later, update
   > this and re-export any codes generated before the change.

4. **Deploy.**
5. Back in **Render**, set `ALLOWED_ORIGIN` to the Vercel URL and redeploy so
   browser export/batch calls pass CORS.
6. In **Supabase → Authentication → URL Configuration**, set **Site URL** to the
   Vercel URL and add it to **Redirect URLs**.

---

## 4. End-to-end smoke test

1. Open the Vercel URL → **Get started** → **Sign up** → you land on the dashboard.
2. **+ Dynamic** → set a Destination URL → **Save changes**.
3. Open the encoded link shown under the preview (`…/r/<code>`) in a new tab — it
   should redirect to your destination. Scan it with a phone too.
4. Change the Destination → **Save** → reload the `…/r/<code>` link → it now goes
   to the new target (no reprint). The dashboard scan count + 14-day chart update.
5. Add a **logo** (uploads to Supabase Storage) → **Export PNG** (served by
   Render, may take ~50s on the first call after Render has been idle).
6. **RLS check:** sign up a second account → it sees none of the first account's
   codes, but the public `/r/<code>` link still works.

## Notes

- **Render cold starts** only affect image export/batch (~50s after idle), never
  scans (those run on Vercel).
- **Supabase** pauses after 7 days of inactivity — resume from its dashboard.
- **Vercel Hobby** is non-commercial; upgrade to Pro if Nanocer becomes a paid
  product.
- Optional: import existing desktop codes with
  [`scripts/migrate_sqlite_to_supabase.py`](scripts/migrate_sqlite_to_supabase.py).
