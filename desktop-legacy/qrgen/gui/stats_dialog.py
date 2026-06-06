"""Per-code scan analytics: totals, last-scanned, and a 14-day bar chart.

The chart is hand-painted with QPainter so we don't pull in matplotlib/numpy —
keeps the eventual .exe small.
"""
from __future__ import annotations

from datetime import datetime

from PySide6.QtCore import Qt, QRectF
from PySide6.QtGui import QPainter, QColor, QPen, QFont
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QLabel, QWidget, QPushButton, QSizePolicy,
)

from ..db import Database, QRCode


def _fmt(ts: str | None) -> str:
    if not ts:
        return "never"
    try:
        dt = datetime.fromisoformat(ts)
        return dt.strftime("%Y-%m-%d %H:%M UTC")
    except ValueError:
        return ts


class BarChart(QWidget):
    """Simple vertical bar chart for a list of (label, value) points."""

    def __init__(self, series: list[tuple[str, int]]):
        super().__init__()
        self.series = series
        self.setMinimumHeight(180)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

    def paintEvent(self, event) -> None:  # noqa: N802 (Qt naming)
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()
        margin_l, margin_b, margin_t = 28, 22, 8
        plot_w = w - margin_l - 6
        plot_h = h - margin_b - margin_t
        peak = max((v for _, v in self.series), default=0)

        # axes
        p.setPen(QPen(QColor("#bbbbbb")))
        p.drawLine(margin_l, margin_t, margin_l, margin_t + plot_h)
        p.drawLine(margin_l, margin_t + plot_h, w - 6, margin_t + plot_h)

        if peak == 0:
            p.setPen(QColor("#999999"))
            p.drawText(self.rect(), Qt.AlignCenter, "No scans yet")
            return

        # y-axis peak label
        p.setFont(QFont("", 7))
        p.setPen(QColor("#888888"))
        p.drawText(0, margin_t + 8, str(peak))

        n = len(self.series)
        slot = plot_w / n
        bar_w = max(3.0, slot * 0.6)
        for i, (day, val) in enumerate(self.series):
            x = margin_l + i * slot + (slot - bar_w) / 2
            bar_h = (val / peak) * plot_h
            y = margin_t + plot_h - bar_h
            p.fillRect(QRectF(x, y, bar_w, bar_h), QColor("#1a73e8"))
            # label every few bars to avoid clutter (show day-of-month)
            if i % max(1, n // 7) == 0:
                p.setPen(QColor("#888888"))
                p.drawText(QRectF(margin_l + i * slot - slot / 2, margin_t + plot_h + 2,
                                  slot * 2, margin_b),
                           Qt.AlignCenter, day[5:])  # MM-DD
        p.end()


class StatsDialog(QDialog):
    def __init__(self, db: Database, qr: QRCode, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Stats — {qr.title or qr.short_code}")
        self.resize(460, 360)
        v = QVBoxLayout(self)

        if not qr.is_dynamic:
            v.addWidget(QLabel(
                "Static codes aren't tracked — they encode their content directly "
                "and never touch the redirect server."))
            close = QPushButton("Close")
            close.clicked.connect(self.accept)
            v.addWidget(close)
            return

        last = db.last_scanned(qr.short_code)
        series = db.scans_per_day(qr.short_code, days=14)
        recent = sum(v for _, v in series)

        head = QLabel(
            f"<b>Total scans:</b> {qr.scan_count}　"
            f"<b>Last 14 days:</b> {recent}<br>"
            f"<b>Last scanned:</b> {_fmt(last)}<br>"
            f"<b>Created:</b> {_fmt(qr.created_at)}"
        )
        head.setTextFormat(Qt.RichText)
        v.addWidget(head)

        v.addWidget(QLabel("Scans per day (last 14 days):"))
        v.addWidget(BarChart(series), 1)

        close = QPushButton("Close")
        close.clicked.connect(self.accept)
        v.addWidget(close)
