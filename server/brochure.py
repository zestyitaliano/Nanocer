"""Brochure PDF builder.

Turns a listing payload (assembled by the web app — this service stays DB-free)
into a print-ready PDF: cover with hero + headline facts, a floor-plan grid, an
agent block, and a footer with the public landing URL. Pure HTML/CSS rendered by
WeasyPrint (no headless browser).

Images are pre-fetched and embedded as data URIs so WeasyPrint makes no network
calls of its own; a broken image is skipped rather than failing the whole PDF
(same posture as the QR /batch endpoint).
"""
from __future__ import annotations

import base64
import io
from html import escape
from typing import Any, Optional

import httpx

IMG_MAX_BYTES = 5 * 1024 * 1024  # 5 MB cap per fetched image
IMG_TIMEOUT = 10.0


def _money(n: Any) -> Optional[str]:
    try:
        return f"${round(float(n)):,}"
    except (TypeError, ValueError):
        return None


def _plan_price_label(plan: dict[str, Any]) -> Optional[str]:
    """Mirrors web/lib/listing.ts planPriceLabel."""
    lo = plan.get("price")
    hi = plan.get("price_max")
    if lo is None and hi is None:
        return None
    per = "/bed" if plan.get("price_unit") == "bed" else ""
    if lo is not None and hi is not None and hi > lo:
        return f"{_money(lo)}–{_money(hi)}{per}"
    base = lo if lo is not None else hi
    prefix = "" if plan.get("price_unit") == "bed" else "from "
    return f"{prefix}{_money(base)}{per}"


def _plan_facts(plan: dict[str, Any]) -> str:
    parts = []
    beds = plan.get("beds")
    baths = plan.get("baths")
    sqft = plan.get("sqft")
    if beds is not None:
        parts.append("Studio" if beds == 0 else f"{_num(beds)} bd")
    if baths is not None:
        parts.append(f"{_num(baths)} ba")
    if sqft is not None:
        parts.append(f"{_money_plain(sqft)} sqft")
    return " · ".join(parts)


def _num(n: Any) -> str:
    f = float(n)
    return str(int(f)) if f.is_integer() else str(f)


def _money_plain(n: Any) -> str:
    try:
        return f"{round(float(n)):,}"
    except (TypeError, ValueError):
        return str(n)


def _fetch_data_uri(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        with httpx.Client(timeout=IMG_TIMEOUT, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.content[:IMG_MAX_BYTES]
        ctype = resp.headers.get("content-type", "image/jpeg").split(";")[0]
        if not ctype.startswith("image/"):
            ctype = "image/jpeg"
        b64 = base64.b64encode(data).decode("ascii")
        return f"data:{ctype};base64,{b64}"
    except Exception:
        # A broken image URL should not fail the whole brochure.
        return None


def _img_tag(url: Optional[str], cls: str) -> str:
    uri = _fetch_data_uri(url)
    if not uri:
        return ""
    return f'<img class="{cls}" src="{uri}" />'


def build_html(payload: dict[str, Any]) -> str:
    listing = payload.get("listing", {}) or {}
    plans = payload.get("floor_plans", []) or []
    photos = payload.get("photos", []) or []
    theme = payload.get("theme", {}) or {}
    agent = payload.get("agent", {}) or {}
    landing_url = payload.get("landing_url") or ""

    accent = escape(str(theme.get("color") or "#eb5e28"))
    name = escape(str(listing.get("name") or "Property"))
    address = escape(str(listing.get("address") or ""))

    headline_facts = []
    if listing.get("price") is not None:
        headline_facts.append(_money(listing["price"]))
    if listing.get("beds") is not None:
        headline_facts.append(f"{_num(listing['beds'])} bd")
    if listing.get("baths") is not None:
        headline_facts.append(f"{_num(listing['baths'])} ba")
    if listing.get("sqft") is not None:
        headline_facts.append(f"{_money_plain(listing['sqft'])} sqft")
    facts_line = escape(" · ".join([f for f in headline_facts if f]))

    description = escape(str(listing.get("description") or "")).replace("\n", "<br/>")

    hero = _img_tag(photos[0] if photos else None, "hero")

    # Floor-plan cards.
    cards = []
    for plan in plans:
        photo = None
        p_photos = plan.get("photos") or []
        if p_photos:
            photo = p_photos[0]
        elif plan.get("photo_url"):
            photo = plan.get("photo_url")
        price = _plan_price_label(plan)
        facts = _plan_facts(plan)
        avail = plan.get("available_text") or {
            "available": "Available",
            "waitlist": "Waitlist",
            "unavailable": "Unavailable",
        }.get(plan.get("availability") or "", "")
        cards.append(
            f"""
            <div class="card">
              {_img_tag(photo, "card-img")}
              <div class="card-body">
                <div class="card-name">{escape(str(plan.get('name') or 'Floor plan'))}</div>
                {f'<div class="card-facts">{escape(facts)}</div>' if facts else ''}
                {f'<div class="card-price">{escape(price)}</div>' if price else ''}
                {f'<div class="card-avail">{escape(str(avail))}</div>' if avail else ''}
              </div>
            </div>"""
        )
    cards_html = "\n".join(cards)

    # Agent block.
    agent_html = ""
    if any(agent.get(k) for k in ("name", "phone", "email")):
        lines = []
        if agent.get("name"):
            lines.append(f'<div class="agent-name">{escape(str(agent["name"]))}</div>')
        contact = " · ".join(
            escape(str(agent[k])) for k in ("phone", "email") if agent.get(k)
        )
        if contact:
            lines.append(f'<div class="agent-contact">{contact}</div>')
        agent_html = f"""
          <div class="agent">
            {_img_tag(agent.get('photo_url'), 'agent-img')}
            <div>{''.join(lines)}</div>
          </div>"""

    footer = (
        f'<div class="footer">View online · {escape(landing_url)}</div>'
        if landing_url
        else ""
    )

    return f"""<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  @page {{ size: Letter; margin: 0; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; }}
  .page {{ padding: 48px 56px; }}
  .hero {{ width: 100%; height: 320px; object-fit: cover; border-radius: 12px; }}
  h1 {{ font-size: 30px; margin: 24px 0 4px; }}
  .address {{ color: #666; font-size: 15px; margin-bottom: 8px; }}
  .facts {{ color: {accent}; font-weight: 700; font-size: 17px; margin-bottom: 16px; }}
  .desc {{ font-size: 13px; line-height: 1.6; color: #333; }}
  h2 {{ font-size: 18px; margin: 28px 0 12px; border-bottom: 2px solid {accent}; padding-bottom: 6px; }}
  .grid {{ display: flex; flex-wrap: wrap; gap: 16px; }}
  .card {{ width: 220px; border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden; }}
  .card-img {{ width: 100%; height: 140px; object-fit: cover; }}
  .card-body {{ padding: 10px 12px; }}
  .card-name {{ font-weight: 700; font-size: 14px; }}
  .card-facts {{ color: #666; font-size: 12px; margin-top: 2px; }}
  .card-price {{ color: {accent}; font-weight: 700; font-size: 14px; margin-top: 4px; }}
  .card-avail {{ font-size: 11px; color: #555; margin-top: 2px; }}
  .agent {{ display: flex; align-items: center; gap: 12px; margin-top: 28px; padding: 16px;
            background: #f7f7f7; border-radius: 10px; }}
  .agent-img {{ width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }}
  .agent-name {{ font-weight: 700; }}
  .agent-contact {{ color: #666; font-size: 13px; }}
  .footer {{ margin-top: 32px; color: #999; font-size: 11px; text-align: center; }}
</style></head>
<body><div class="page">
  {hero}
  <h1>{name}</h1>
  {f'<div class="address">{address}</div>' if address else ''}
  {f'<div class="facts">{facts_line}</div>' if facts_line else ''}
  {f'<div class="desc">{description}</div>' if description else ''}
  {f'<h2>Floor plans</h2><div class="grid">{cards_html}</div>' if cards_html else ''}
  {agent_html}
  {footer}
</div></body></html>"""


def render_pdf(payload: dict[str, Any]) -> bytes:
    # Imported lazily: WeasyPrint pulls in heavy system libs, and keeping the
    # import here lets build_html be used/tested without them.
    from weasyprint import HTML

    html = build_html(payload)
    buf = io.BytesIO()
    HTML(string=html).write_pdf(buf)
    return buf.getvalue()
