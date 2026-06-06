"""Central configuration and filesystem paths.

Everything that would change when we move the redirect service from "local only"
to real hosting lives here, so the migration is a one-line edit (PUBLIC_BASE_URL).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# --- Filesystem layout -------------------------------------------------------
# All user data lives under ./data so it is easy to back up. When running from
# source that's the project root; when frozen by PyInstaller __file__ points
# inside a temp extraction dir, so anchor on the .exe's folder instead.
if getattr(sys, "frozen", False):
    PROJECT_ROOT = Path(sys.executable).resolve().parent
else:
    PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
EXPORTS_DIR = DATA_DIR / "exports"
LOGOS_DIR = DATA_DIR / "logos"
DB_PATH = DATA_DIR / "qr.db"

for _d in (DATA_DIR, EXPORTS_DIR, LOGOS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# --- Redirect server ---------------------------------------------------------
# The local FastAPI server that resolves dynamic short codes -> destinations.
SERVER_HOST = os.environ.get("QRGEN_HOST", "127.0.0.1")
SERVER_PORT = int(os.environ.get("QRGEN_PORT", "8765"))

# The base URL that gets ENCODED into dynamic QR images. While running locally
# this points at the local server. To go live later, deploy server.py to a host
# and set QRGEN_PUBLIC_BASE_URL=https://your-domain — printed codes keep working
# because the short code path (/r/<code>) stays identical.
PUBLIC_BASE_URL = os.environ.get(
    "QRGEN_PUBLIC_BASE_URL", f"http://{SERVER_HOST}:{SERVER_PORT}"
).rstrip("/")

REDIRECT_PATH = "/r"  # dynamic codes encode  {PUBLIC_BASE_URL}{REDIRECT_PATH}/{code}


def redirect_url(short_code: str) -> str:
    """Full URL encoded into a dynamic QR image for the given short code."""
    return f"{PUBLIC_BASE_URL}{REDIRECT_PATH}/{short_code}"
