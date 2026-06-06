"""Server-side QR rendering: colors, module shapes, centre logo embedding.

Adapted from the desktop app's qrgen/qr_render.py. The key difference: the centre
logo arrives as an already-fetched PIL image (downloaded from a Supabase public
URL by app.py) rather than read from a local file path.

Style keys (all optional; defaults applied):
    fill_color       "#000000"
    back_color       "#FFFFFF"
    module_style     square | rounded | circle | gapped | vertical | horizontal
    error_correction L | M | Q | H   (a logo forces H)
    box_size         int px per module (default 10)
    border           int quiet-zone modules (default 4)
    logo_scale       fraction of QR width the logo occupies (default 0.22)
    logo_url         public URL of a centre logo (fetched by app.py)
"""
from __future__ import annotations

import io
from typing import Any, Optional

import qrcode
from qrcode.constants import (
    ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H,
)
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import (
    SquareModuleDrawer, RoundedModuleDrawer, CircleModuleDrawer,
    GappedSquareModuleDrawer, VerticalBarsDrawer, HorizontalBarsDrawer,
)
from qrcode.image.styles.colormasks import SolidFillColorMask
from PIL import Image

_EC = {"L": ERROR_CORRECT_L, "M": ERROR_CORRECT_M,
       "Q": ERROR_CORRECT_Q, "H": ERROR_CORRECT_H}

_DRAWERS = {
    "square": SquareModuleDrawer,
    "rounded": RoundedModuleDrawer,
    "circle": CircleModuleDrawer,
    "gapped": GappedSquareModuleDrawer,
    "vertical": VerticalBarsDrawer,
    "horizontal": HorizontalBarsDrawer,
}

DEFAULT_STYLE: dict[str, Any] = {
    "fill_color": "#000000",
    "back_color": "#FFFFFF",
    "module_style": "square",
    "error_correction": "M",
    "box_size": 10,
    "border": 4,
    "logo_scale": 0.22,
}


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = (value or "#000000").lstrip("#")
    if len(value) == 3:
        value = "".join(c * 2 for c in value)
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def merge_style(style: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(DEFAULT_STYLE)
    if style:
        merged.update({k: v for k, v in style.items() if v is not None})
    return merged


def render(value: str, style: dict[str, Any] | None = None,
           logo: Optional[Image.Image] = None) -> Image.Image:
    s = merge_style(style)
    has_logo = logo is not None
    ec_key = "H" if has_logo else s["error_correction"]

    qr = qrcode.QRCode(
        error_correction=_EC.get(ec_key, ERROR_CORRECT_M),
        box_size=int(s["box_size"]),
        border=int(s["border"]),
    )
    qr.add_data(value)
    qr.make(fit=True)

    drawer_cls = _DRAWERS.get(s["module_style"], SquareModuleDrawer)
    color_mask = SolidFillColorMask(
        back_color=_hex_to_rgb(s["back_color"]),
        front_color=_hex_to_rgb(s["fill_color"]),
    )
    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=drawer_cls(),
        color_mask=color_mask,
    ).convert("RGBA")

    if has_logo:
        img = _paste_logo(img, logo, s)
    return img


def _paste_logo(base: Image.Image, logo: Image.Image, s: dict[str, Any]) -> Image.Image:
    logo = logo.convert("RGBA")
    qr_w, _ = base.size
    target = max(1, int(qr_w * float(s["logo_scale"])))
    logo.thumbnail((target, target), Image.LANCZOS)

    pad = int(target * 0.12)
    bg = Image.new("RGBA", (logo.width + pad * 2, logo.height + pad * 2),
                   _hex_to_rgb(s["back_color"]) + (255,))
    bg.paste(logo, (pad, pad), logo)

    pos = ((base.width - bg.width) // 2, (base.height - bg.height) // 2)
    out = base.copy()
    out.paste(bg, pos, bg)
    return out


def to_png_bytes(value: str, style: dict[str, Any] | None = None,
                 logo: Optional[Image.Image] = None) -> bytes:
    buf = io.BytesIO()
    render(value, style, logo).save(buf, format="PNG")
    return buf.getvalue()


def to_svg_bytes(value: str, style: dict[str, Any] | None = None) -> bytes:
    """Vector export (no raster styling/logo — SVG path geometry only)."""
    import qrcode.image.svg as svg

    s = merge_style(style)
    qr = qrcode.QRCode(
        error_correction=_EC.get(s["error_correction"], ERROR_CORRECT_M),
        box_size=int(s["box_size"]),
        border=int(s["border"]),
    )
    qr.add_data(value)
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(image_factory=svg.SvgPathImage).save(buf)
    return buf.getvalue()
