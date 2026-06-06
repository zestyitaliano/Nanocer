"""QR image rendering: colors, module shapes, and centre logo embedding.

Built on the ``qrcode`` library's styled-image pipeline. A ``style`` dict (stored
per code in the DB) drives every visual option, so the GUI just edits a dict and
batch export reuses the exact same renderer.

Style keys (all optional, sensible defaults applied):
    fill_color       "#000000"   foreground module color
    back_color       "#FFFFFF"   background color
    module_style     "square" | "rounded" | "circle" | "gapped" | "vertical" | "horizontal"
    error_correction "L" | "M" | "Q" | "H"   (logos force >= H)
    box_size         int pixels per module (default 10)
    border           int quiet-zone modules (default 4)
    logo_path        path to an image to embed in the centre (optional)
    logo_scale       fraction of QR width the logo occupies (default 0.22)
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

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

_EC = {
    "L": ERROR_CORRECT_L, "M": ERROR_CORRECT_M,
    "Q": ERROR_CORRECT_Q, "H": ERROR_CORRECT_H,
}

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
    "logo_path": "",
    "logo_scale": 0.22,
}


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    if len(value) == 3:
        value = "".join(c * 2 for c in value)
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def merge_style(style: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(DEFAULT_STYLE)
    if style:
        merged.update({k: v for k, v in style.items() if v is not None})
    return merged


def render(value: str, style: dict[str, Any] | None = None) -> Image.Image:
    """Render ``value`` into a styled PIL image."""
    s = merge_style(style)
    has_logo = bool(s.get("logo_path")) and Path(s["logo_path"]).is_file()

    # A centre logo punches a hole in the data, so force the highest error
    # correction (H = ~30% recoverable) whenever a logo is present.
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

    kwargs: dict[str, Any] = {
        "image_factory": StyledPilImage,
        "module_drawer": drawer_cls(),
        "color_mask": color_mask,
    }
    if has_logo:
        kwargs["embeded_image_path"] = s["logo_path"]  # (library spelling)

    img = qr.make_image(**kwargs).convert("RGBA")

    # The library sizes embedded logos generously; re-scale to logo_scale so the
    # user controls how much of the code the logo covers.
    if has_logo:
        img = _resize_logo(img, value, s)
    return img


def _resize_logo(base: Image.Image, value: str, s: dict[str, Any]) -> Image.Image:
    """Re-render with a hand-placed logo at the requested scale."""
    logo = Image.open(s["logo_path"]).convert("RGBA")
    qr_w, qr_h = base.size
    target = max(1, int(qr_w * float(s["logo_scale"])))
    logo.thumbnail((target, target), Image.LANCZOS)

    # White rounded pad behind the logo improves scan reliability.
    pad = int(target * 0.12)
    bg = Image.new("RGBA", (logo.width + pad * 2, logo.height + pad * 2),
                   _hex_to_rgb(s["back_color"]) + (255,))
    bg.paste(logo, (pad, pad), logo)

    pos = ((qr_w - bg.width) // 2, (qr_h - bg.height) // 2)
    out = base.copy()
    out.paste(bg, pos, bg)
    return out


def save_png(value: str, path: str | Path, style: dict[str, Any] | None = None) -> Path:
    img = render(value, style)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG")
    return path


def save_svg(value: str, path: str | Path, style: dict[str, Any] | None = None) -> Path:
    """Vector export. SVG uses the path factory (no raster styling/logo)."""
    import qrcode.image.svg as svg

    s = merge_style(style)
    qr = qrcode.QRCode(
        error_correction=_EC.get(s["error_correction"], ERROR_CORRECT_M),
        box_size=int(s["box_size"]),
        border=int(s["border"]),
    )
    qr.add_data(value)
    qr.make(fit=True)
    img = qr.make_image(image_factory=svg.SvgPathImage)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(path))
    return path
