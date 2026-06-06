"""Optional one-shot import of desktop QR codes (SQLite) into Supabase.

Usage (PowerShell):
    $env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
    $env:TARGET_USER_ID = "<uuid of the signed-up account to own these codes>"
    python scripts/migrate_sqlite_to_supabase.py --db data/qr.db

Find TARGET_USER_ID in Supabase → Authentication → Users (copy the user's UID)
after you've signed up once in the web app.

Notes:
- Local centre-logo files cannot be migrated (they lived on your old PC); the
  logo is stripped from each code's style. Re-upload logos in the web app.
- Only requires `httpx` (already in the project venv). Talks to Supabase's REST
  (PostgREST) API with the service-role key, which bypasses RLS for the import.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys

import httpx


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="data/qr.db", help="path to the SQLite qr.db")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    user_id = os.environ.get("TARGET_USER_ID")
    if not (url and key and user_id):
        print("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TARGET_USER_ID.")
        return 2

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM codes").fetchall()
    conn.close()

    payload = []
    for r in rows:
        style = json.loads(r["style"] or "{}")
        style.pop("logo_path", None)   # local file — not portable
        style.pop("logo_url", None)
        payload.append({
            "user_id": user_id,
            "short_code": r["short_code"],
            "title": r["title"],
            "is_dynamic": bool(r["is_dynamic"]),
            "destination": r["destination"],
            "content": r["content"],
            "style": style,
            "scan_count": r["scan_count"],
        })

    if not payload:
        print("No codes found to migrate.")
        return 0

    resp = httpx.post(
        f"{url.rstrip('/')}/rest/v1/codes",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal,resolution=ignore-duplicates",
        },
        json=payload,
        timeout=30.0,
    )
    if resp.status_code >= 300:
        print(f"Import failed ({resp.status_code}): {resp.text}")
        return 1
    print(f"Imported {len(payload)} codes for user {user_id}.")
    print("Note: re-upload any centre logos in the web app.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
