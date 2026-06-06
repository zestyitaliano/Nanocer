# QR Code Generator

A Windows desktop tool for creating **dynamic** and **static** QR codes with
custom styling, centre logos, and batch import/export.

- **Dynamic codes** encode a stable redirect URL that you control. You can change
  where they point *at any time* without reprinting — ideal for posters, flyers,
  packaging, business cards.
- **Static codes** encode a URL or text directly. Simpler, but fixed forever.

### Features

- Styling: foreground/background colors, module shapes (square, rounded, circle,
  gapped, bars), error-correction level, quiet zone, and a centre **logo** with
  auto-bumped error correction.
- **Scan analytics** — per-code total scans, last-scanned time, and a 14-day
  bar chart (toolbar → **Stats**). Every redirect is logged with a timestamp.
- **Duplicate** any code (gets its own new short code), **drag-and-drop** a logo
  image onto the window, live logo thumbnail, and a **Dark mode** toggle that
  persists between launches.
- Batch CSV import and bulk PNG export (with a manifest); PNG/SVG export per code.

## How "dynamic" works

A printed QR image can never change. So a dynamic code encodes a short redirect
URL like `http://127.0.0.1:8765/r/abc1234`. A small local web server looks up the
code's current destination and forwards the scanner there. Edit the destination
in the app → every existing copy of that QR instantly points somewhere new.

```
[phone scans QR] → http://.../r/abc1234 → [redirect server] → your live destination
```

## Setup

Python 3.12 and the dependencies are already installed in `.venv`. To (re)install:

```powershell
.\.venv\Scripts\python -m pip install -r requirements.txt
```

## Run

```powershell
.\.venv\Scripts\python run.py
```

This starts the redirect server (background thread) and opens the desktop UI.

## Build a standalone .exe

```powershell
.\.venv\Scripts\python build_exe.py
```

Produces `dist\QRCodeGenerator\QRCodeGenerator.exe` — a one-folder bundle you can
zip and run on a Windows PC without Python installed. The `data\` folder (qr.db,
exports, logos) is created next to the .exe on first run.

## Going live (later)

Right now the redirect server runs on your PC, so dynamic codes only resolve
while it is reachable. To make dynamic codes work for the public:

1. Deploy `qrgen/server.py` to any host (Render, Fly.io, a VPS, etc.) pointed at
   the same `data/qr.db`.
2. Set the environment variable `QRGEN_PUBLIC_BASE_URL=https://your-domain`.

The encoded short-code path (`/r/<code>`) is identical locally and hosted, so any
codes you export with the live base URL keep working after deployment. See
[config.py](qrgen/config.py).

## Batch import

Import a CSV (header row required) to create many codes at once:

| column        | meaning                                              |
|---------------|------------------------------------------------------|
| `title`       | optional label                                       |
| `destination` | live target URL for dynamic codes                    |
| `content`     | literal payload for static codes                     |
| `type`        | optional `dynamic` / `static` (inferred if omitted)  |

See [sample_import.csv](sample_import.csv). Export all codes as PNGs +
`manifest.csv` from **Export all PNGs**.

## Project layout

```
run.py                 launcher (server thread + GUI)
qrgen/
  config.py            paths + the one place the base URL changes for hosting
  db.py                SQLite storage (codes table)
  shortcode.py         short-code generation
  qr_render.py         styling, colors, module shapes, logo embedding
  server.py            FastAPI redirect service (/r/<code>) + scan logging
  batch.py             CSV import + bulk PNG export
  gui/main_window.py   PySide6 desktop UI
  gui/stats_dialog.py  per-code scan analytics + bar chart
  gui/theme.py         light/dark palette
build_exe.py           PyInstaller build script
data/                  qr.db, exports/, logos/
```
