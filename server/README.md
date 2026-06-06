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

`style.logo_url` (a public Supabase Storage URL) is fetched and embedded for PNG.

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
