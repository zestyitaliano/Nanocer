"""SQLite persistence layer.

One table, ``codes``, holds every QR the user creates. Two flavours:

* dynamic (``is_dynamic=1``): the QR encodes a stable redirect URL we control;
  ``destination`` is editable at any time and the printed code follows along.
* static  (``is_dynamic=0``): the QR encodes ``content`` directly (plain URL or
  text). No server involved, but it can never be changed after printing.

``style`` is a JSON blob so we can evolve styling options without migrations.
"""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from . import config
from . import shortcode

SCHEMA = """
CREATE TABLE IF NOT EXISTS codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code  TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    is_dynamic  INTEGER NOT NULL DEFAULT 1,
    destination TEXT NOT NULL DEFAULT '',  -- dynamic: live redirect target
    content     TEXT NOT NULL DEFAULT '',  -- static: raw encoded payload
    style       TEXT NOT NULL DEFAULT '{}',
    scan_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- One row per scan, for time-series analytics. scan_count on codes is kept as a
-- denormalised fast total; this table powers "scans over time" / last-scanned.
CREATE TABLE IF NOT EXISTS scan_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code  TEXT NOT NULL,
    scanned_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scan_events_code
    ON scan_events (short_code, scanned_at);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class QRCode:
    id: Optional[int] = None
    short_code: str = ""
    title: str = ""
    is_dynamic: bool = True
    destination: str = ""
    content: str = ""
    style: dict[str, Any] = field(default_factory=dict)
    scan_count: int = 0
    created_at: str = ""
    updated_at: str = ""

    @property
    def encoded_value(self) -> str:
        """The string actually rendered into the QR image."""
        if self.is_dynamic:
            return config.redirect_url(self.short_code)
        return self.content

    @classmethod
    def _from_row(cls, row: sqlite3.Row) -> "QRCode":
        return cls(
            id=row["id"],
            short_code=row["short_code"],
            title=row["title"],
            is_dynamic=bool(row["is_dynamic"]),
            destination=row["destination"],
            content=row["content"],
            style=json.loads(row["style"] or "{}"),
            scan_count=row["scan_count"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


class Database:
    def __init__(self, path: str | None = None):
        self.path = str(path or config.DB_PATH)
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    # --- creation ------------------------------------------------------------
    def create(self, qr: QRCode) -> QRCode:
        if qr.is_dynamic and not qr.short_code:
            qr.short_code = self._unique_short_code()
        elif not qr.short_code:
            qr.short_code = shortcode.new_code()
        qr.created_at = qr.updated_at = _now()
        cur = self._conn.execute(
            """INSERT INTO codes
               (short_code, title, is_dynamic, destination, content, style,
                scan_count, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                qr.short_code, qr.title, int(qr.is_dynamic), qr.destination,
                qr.content, json.dumps(qr.style), qr.scan_count,
                qr.created_at, qr.updated_at,
            ),
        )
        self._conn.commit()
        qr.id = cur.lastrowid
        return qr

    def _unique_short_code(self) -> str:
        while True:
            code = shortcode.new_code()
            row = self._conn.execute(
                "SELECT 1 FROM codes WHERE short_code=?", (code,)
            ).fetchone()
            if not row:
                return code

    # --- reads ---------------------------------------------------------------
    def list_all(self) -> list[QRCode]:
        rows = self._conn.execute(
            "SELECT * FROM codes ORDER BY created_at DESC"
        ).fetchall()
        return [QRCode._from_row(r) for r in rows]

    def get(self, code_id: int) -> Optional[QRCode]:
        row = self._conn.execute(
            "SELECT * FROM codes WHERE id=?", (code_id,)
        ).fetchone()
        return QRCode._from_row(row) if row else None

    def get_by_short_code(self, short_code: str) -> Optional[QRCode]:
        row = self._conn.execute(
            "SELECT * FROM codes WHERE short_code=?", (short_code,)
        ).fetchone()
        return QRCode._from_row(row) if row else None

    # --- updates -------------------------------------------------------------
    def update(self, qr: QRCode) -> QRCode:
        qr.updated_at = _now()
        self._conn.execute(
            """UPDATE codes SET title=?, is_dynamic=?, destination=?, content=?,
               style=?, updated_at=? WHERE id=?""",
            (
                qr.title, int(qr.is_dynamic), qr.destination, qr.content,
                json.dumps(qr.style), qr.updated_at, qr.id,
            ),
        )
        self._conn.commit()
        return qr

    def set_destination(self, code_id: int, destination: str) -> None:
        """The headline dynamic-QR operation: repoint a code's live target."""
        self._conn.execute(
            "UPDATE codes SET destination=?, updated_at=? WHERE id=?",
            (destination, _now(), code_id),
        )
        self._conn.commit()

    def increment_scan(self, short_code: str) -> None:
        ts = _now()
        self._conn.execute(
            "UPDATE codes SET scan_count = scan_count + 1 WHERE short_code=?",
            (short_code,),
        )
        self._conn.execute(
            "INSERT INTO scan_events (short_code, scanned_at) VALUES (?, ?)",
            (short_code, ts),
        )
        self._conn.commit()

    # --- analytics -----------------------------------------------------------
    def last_scanned(self, short_code: str) -> Optional[str]:
        row = self._conn.execute(
            "SELECT MAX(scanned_at) AS m FROM scan_events WHERE short_code=?",
            (short_code,),
        ).fetchone()
        return row["m"] if row and row["m"] else None

    def scans_per_day(self, short_code: str, days: int = 14) -> list[tuple[str, int]]:
        """Return [(YYYY-MM-DD, count), ...] for the last ``days`` days (UTC),
        including zero-scan days so the chart has a continuous axis."""
        rows = self._conn.execute(
            """SELECT substr(scanned_at, 1, 10) AS day, COUNT(*) AS n
               FROM scan_events WHERE short_code=?
               GROUP BY day""",
            (short_code,),
        ).fetchall()
        counts = {r["day"]: r["n"] for r in rows}
        today = datetime.now(timezone.utc).date()
        series: list[tuple[str, int]] = []
        for i in range(days - 1, -1, -1):
            day = (today - timedelta(days=i)).isoformat()
            series.append((day, counts.get(day, 0)))
        return series

    def delete(self, code_id: int) -> None:
        qr = self.get(code_id)
        self._conn.execute("DELETE FROM codes WHERE id=?", (code_id,))
        if qr:
            self._conn.execute(
                "DELETE FROM scan_events WHERE short_code=?", (qr.short_code,))
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()
