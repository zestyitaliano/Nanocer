"""Nanocer render service (Render.com, free tier).

Stateless FastAPI app that turns a value + style into a styled QR image. No
database — the web app owns all data; this service only renders. Endpoints:

    GET  /health
    POST /render   {value, style, format: "png"|"svg"}        -> image bytes
    POST /batch    {items: [{filename, value, style}], format} -> application/zip
    POST /brochure {listing, floor_plans, photos, theme, ...}  -> application/pdf

Centre logos are passed as `style.logo_url` (a public Supabase Storage URL); the
service fetches the image and embeds it. CORS is locked to ALLOWED_ORIGIN.
"""
from __future__ import annotations

import io
import os
import zipfile
from typing import Any, Literal, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from PIL import Image
from pydantic import BaseModel, Field

import qr_render

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
BROCHURE_MAX_PLANS = 60  # generous cap to bound render time
LOGO_MAX_BYTES = 5 * 1024 * 1024  # 5 MB cap on fetched logos

app = FastAPI(title="Nanocer Render Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN] if ALLOWED_ORIGIN != "*" else ["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class RenderRequest(BaseModel):
    value: str = Field(..., min_length=1, max_length=4096)
    style: dict[str, Any] = Field(default_factory=dict)
    format: Literal["png", "svg"] = "png"


class BatchItem(BaseModel):
    filename: str
    value: str = Field(..., min_length=1, max_length=4096)
    style: dict[str, Any] = Field(default_factory=dict)


class BatchRequest(BaseModel):
    items: list[BatchItem] = Field(..., max_length=500)
    format: Literal["png", "svg"] = "png"


class BrochureRequest(BaseModel):
    listing: dict[str, Any] = Field(default_factory=dict)
    floor_plans: list[dict[str, Any]] = Field(default_factory=list)
    photos: list[str] = Field(default_factory=list)
    theme: dict[str, Any] = Field(default_factory=dict)
    agent: dict[str, Any] = Field(default_factory=dict)
    landing_url: Optional[str] = None


def _fetch_logo(style: dict[str, Any]) -> Optional[Image.Image]:
    url = style.get("logo_url")
    if not url:
        return None
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.content[:LOGO_MAX_BYTES]
        return Image.open(io.BytesIO(data))
    except Exception:
        # A broken logo URL should not fail the whole render.
        return None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/render")
def render(req: RenderRequest):
    try:
        if req.format == "svg":
            data = qr_render.to_svg_bytes(req.value, req.style)
            return Response(content=data, media_type="image/svg+xml")
        logo = _fetch_logo(req.style)
        data = qr_render.to_png_bytes(req.value, req.style, logo)
        return Response(content=data, media_type="image/png")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"render failed: {exc}")


@app.post("/batch")
def batch(req: BatchRequest):
    buf = io.BytesIO()
    ext = req.format
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, item in enumerate(req.items):
            try:
                if ext == "svg":
                    data = qr_render.to_svg_bytes(item.value, item.style)
                else:
                    logo = _fetch_logo(item.style)
                    data = qr_render.to_png_bytes(item.value, item.style, logo)
            except Exception:
                continue  # skip a bad item rather than fail the whole ZIP
            name = item.filename or f"qr_{i + 1}"
            if not name.lower().endswith(f".{ext}"):
                name = f"{name}.{ext}"
            zf.writestr(name, data)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="nanocer_qr_codes.zip"'},
    )


def _slugify_filename(name: str) -> str:
    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in name).strip("-")
    return (safe or "brochure").lower()[:60]


@app.post("/brochure")
def brochure(req: BrochureRequest):
    import brochure as brochure_mod

    payload = req.model_dump()
    payload["floor_plans"] = payload.get("floor_plans", [])[:BROCHURE_MAX_PLANS]
    try:
        data = brochure_mod.render_pdf(payload)
    except (ImportError, OSError) as exc:
        # WeasyPrint or its system libs (pango/cairo/…) aren't available here.
        # /render and /batch are unaffected. See server/README "Brochure PDF".
        raise HTTPException(status_code=501, detail=f"brochure unavailable: {exc}")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"brochure failed: {exc}")

    fname = _slugify_filename(str(req.listing.get("name") or "brochure"))
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}.pdf"'},
    )
