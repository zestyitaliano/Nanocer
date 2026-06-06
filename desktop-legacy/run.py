"""Launcher: start the redirect server (background thread) + the desktop GUI.

    .venv\\Scripts\\python run.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Resolve the app's base dir (frozen-aware: next to the .exe when packaged, else
# the project root) and make sure data/ exists before anything writes to it.
if getattr(sys, "frozen", False):
    _BASE = Path(sys.executable).resolve().parent
else:
    _BASE = Path(__file__).resolve().parent
_DATA = _BASE / "data"
_DATA.mkdir(parents=True, exist_ok=True)

# Under pythonw.exe / a windowed .exe there is no console, so sys.stdout/stderr
# are None; any library that writes to them would raise. Route them to a log file
# (in the now-guaranteed data dir) so the app stays alive.
if sys.stdout is None or sys.stderr is None:
    _log = open(_DATA / "app.log", "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stdout or _log
    sys.stderr = sys.stderr or _log

from PySide6.QtWidgets import QApplication

from qrgen.db import Database
from qrgen.server import ServerThread
from qrgen.gui.main_window import MainWindow


def main() -> int:
    db = Database()

    server = ServerThread(db)
    server.start()  # daemon thread; resolves /r/<code> redirects for dynamic QRs

    app = QApplication(sys.argv)
    app.setOrganizationName("QRGen")
    app.setApplicationName("QRCodeGenerator")

    from PySide6.QtCore import QSettings
    from qrgen.gui import theme
    theme.apply_theme(app, QSettings().value("dark", False, type=bool))

    win = MainWindow(db)
    win.show()
    try:
        return app.exec()
    finally:
        server.stop()
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
