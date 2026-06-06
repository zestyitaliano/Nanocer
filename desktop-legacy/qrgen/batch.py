"""Batch import and export.

Import a CSV to create many codes at once; export all (or selected) codes as PNG
files plus a manifest CSV that maps each short code to its current destination.

Import CSV columns (header row required, case-insensitive):
    title        optional label
    destination  for dynamic codes: the live target URL
    content      for static codes: the literal payload (if set, code is static)
    type         optional "dynamic" | "static" (inferred if omitted)
"""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable

from .db import Database, QRCode
from . import qr_render
from . import config


def import_csv(db: Database, csv_path: str | Path,
               default_style: dict | None = None) -> list[QRCode]:
    created: list[QRCode] = []
    with open(csv_path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        fields = {(f or "").strip().lower(): f for f in (reader.fieldnames or [])}

        def col(row, key):
            src = fields.get(key)
            return (row.get(src, "") if src else "").strip()

        for row in reader:
            title = col(row, "title")
            destination = col(row, "destination")
            content = col(row, "content")
            ctype = col(row, "type").lower()

            if ctype == "static" or (not ctype and content and not destination):
                is_dynamic = False
            else:
                is_dynamic = True

            if is_dynamic and not destination and content:
                destination = content  # tolerate a single-column "url" sheet
            if not (destination or content):
                continue  # skip empty rows

            qr = QRCode(
                title=title,
                is_dynamic=is_dynamic,
                destination=destination,
                content=content if not is_dynamic else "",
                style=dict(default_style or {}),
            )
            created.append(db.create(qr))
    return created


def export_pngs(codes: Iterable[QRCode], out_dir: str | Path) -> Path:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = out_dir / "manifest.csv"
    with open(manifest, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow([
            "title", "short_code", "type", "encoded_url",
            "destination", "scan_count", "png_file",
        ])
        for qr in codes:
            fname = _safe_filename(qr)
            qr_render.save_png(qr.encoded_value, out_dir / fname, qr.style)
            writer.writerow([
                qr.title, qr.short_code,
                "dynamic" if qr.is_dynamic else "static",
                qr.encoded_value,
                qr.destination if qr.is_dynamic else qr.content,
                qr.scan_count, fname,
            ])
    return manifest


def _safe_filename(qr: QRCode) -> str:
    base = qr.title.strip() or qr.short_code
    safe = "".join(c if c.isalnum() or c in "-_ " else "_" for c in base).strip()
    safe = safe.replace(" ", "_") or qr.short_code
    return f"{safe}_{qr.short_code}.png"
