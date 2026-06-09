# Nanocer render service (FastAPI → Render)

Stateless QR image generation. No database — it only turns `value + style` into a
styled PNG/SVG (with optional centre logo) or a ZIP batch. The web app calls it
for downloads/exports; live editor preview is done client-side, so this service
is off the latency-critical path (Render's free tier sleeps when idle).

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{"status":"ok"}` |
| POST | `/render` | `{value, style, format:"png"\|"svg"}` | image bytes |
| POST | `/batch` | `{items:[{filename,value,style}], format}` | `application/zip` |
| POST | `/brochure` | `{listing, floor_plans, photos, theme, agent, landing_url}` | `application/pdf` |

`style.logo_url` (a public Supabase Storage URL) is fetched and embedded for PNG.

## Brochure PDF

`/brochure` renders a listing into a print-ready PDF with [WeasyPrint](https://weasyprint.org/).
The web app assembles the payload (it already fetches the listing + floor plans),
so this service stays DB-free. Images are pre-fetched and embedded; a broken
image URL is skipped, not fatal. The endpoint imports WeasyPrint lazily and
returns **501** if it (or its system libs) is unavailable — `/render` and
`/batch` are unaffected.

WeasyPrint needs system libraries (Pango, Cairo, GDK-PixBuf, libffi):

- **Debian/Ubuntu (Render default):** `apt-get install -y libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libffi-dev libcairo2`
- **macOS:** `brew install pango gdk-pixbuf libffi`
- **Windows (local):** install the GTK runtime (see WeasyPrint docs).

On Render's native (non-Docker) Python runtime these libs may be unavailable; if
so, deploy the service via a Dockerfile that installs them, or leave `/brochure`
returning 501 (the web app surfaces a friendly error and the rest works).

## Run locally

```powershell
cd server
python -m venv .venv; .\.venv\Scripts\python -m pip install -r requirements.txt
$env:ALLOWED_ORIGIN = "*"
.\.venv\Scripts\python -m uvicorn app:app --reload --port 8000
```

Test: `curl -X POST localhost:8000/render -H "content-type: application/json" -d '{"value":"https://example.com","style":{"module_style":"rounded"}}' --output qr.png`

## Deploy to Render

Either use the repo-root [`render.yaml`](../render.yaml) Blueprint, or create a
**Web Service** manually:

- Root directory: `server`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- Env var `ALLOWED_ORIGIN` = your Vercel URL (e.g. `https://nanocer.vercel.app`)

Copy the resulting URL (e.g. `https://nanocer-render.onrender.com`) into the web
app's `NEXT_PUBLIC_RENDER_API_URL`.
