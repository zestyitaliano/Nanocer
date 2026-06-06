"""Short-code generation for dynamic QR codes.

Codes are URL-safe, lowercase, and avoid ambiguous characters (0/o/1/l/i) so they
stay readable if anyone ever has to type one. 7 chars over a 27-char alphabet is
~10 billion combinations — collisions are vanishingly unlikely but we still check
against the DB at creation time.
"""
from __future__ import annotations

import secrets

ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0 o 1 l i
DEFAULT_LENGTH = 7


def new_code(length: int = DEFAULT_LENGTH) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))
