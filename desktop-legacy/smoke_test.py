"""Headless smoke test for the core (no GUI). Run:
    .venv\\Scripts\\python smoke_test.py
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from qrgen.db import Database, QRCode
from qrgen import qr_render, config, batch
from qrgen.server import create_app


def main() -> None:
    tmp = Path(tempfile.mkdtemp())
    db = Database(tmp / "test.db")

    # 1. create a dynamic code
    qr = db.create(QRCode(title="Test", is_dynamic=True,
                          destination="https://example.com/v1",
                          style=dict(qr_render.DEFAULT_STYLE)))
    assert qr.short_code and qr.id
    assert qr.encoded_value == config.redirect_url(qr.short_code)
    print(f"[ok] created dynamic code {qr.short_code} -> {qr.destination}")

    # 2. render PNG + SVG
    png = qr_render.save_png(qr.encoded_value, tmp / "a.png", qr.style)
    svg = qr_render.save_svg(qr.encoded_value, tmp / "a.svg", qr.style)
    assert png.stat().st_size > 0 and svg.stat().st_size > 0
    print(f"[ok] rendered PNG ({png.stat().st_size} B) + SVG")

    # styled render with rounded modules + colors
    styled = dict(qr_render.DEFAULT_STYLE)
    styled.update(module_style="rounded", fill_color="#1a73e8", back_color="#ffffff")
    qr_render.save_png(qr.encoded_value, tmp / "styled.png", styled)
    print("[ok] styled render (rounded + color)")

    # 3. redirect server resolves + follows destination changes
    app = create_app(db)
    client = TestClient(app)
    r = client.get(f"/r/{qr.short_code}", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"] == "https://example.com/v1"
    print("[ok] redirect 302 -> v1")

    db.set_destination(qr.id, "https://example.com/v2")
    r = client.get(f"/r/{qr.short_code}", follow_redirects=False)
    assert r.headers["location"] == "https://example.com/v2"
    print("[ok] destination change reflected live -> v2 (this is the dynamic magic)")

    r = client.get("/r/nonexistent", follow_redirects=False)
    assert r.status_code == 404
    print("[ok] unknown code -> 404")

    # scan counter incremented
    assert db.get(qr.id).scan_count == 2
    print("[ok] scan_count tracked")

    # analytics: per-day series + last-scanned
    assert db.last_scanned(qr.short_code) is not None
    series = db.scans_per_day(qr.short_code, days=14)
    assert len(series) == 14
    assert sum(n for _, n in series) == 2  # both scans land on today (UTC)
    print(f"[ok] analytics: last_scanned set, per-day series sums to "
          f"{sum(n for _, n in series)} over {len(series)} days")

    # 4. batch import + export
    csv_path = tmp / "in.csv"
    csv_path.write_text(
        "title,destination,type\n"
        "Promo,https://example.com/promo,dynamic\n"
        "Flyer,hello world,static\n",
        encoding="utf-8",
    )
    created = batch.import_csv(db, csv_path, dict(qr_render.DEFAULT_STYLE))
    assert len(created) == 2
    manifest = batch.export_pngs(db.list_all(), tmp / "out")
    assert manifest.is_file()
    pngs = list((tmp / "out").glob("*.png"))
    print(f"[ok] batch import 2, export {len(pngs)} PNGs + manifest")

    print("\nALL SMOKE TESTS PASSED")
    db.close()


if __name__ == "__main__":
    main()
