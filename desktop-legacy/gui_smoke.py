"""Headless GUI smoke test: construct window, exercise new features."""
import sys, tempfile, pathlib
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import QCoreApplication
from qrgen.db import Database, QRCode
from qrgen import qr_render
from qrgen.gui.main_window import MainWindow
from qrgen.gui import theme
from qrgen.gui.stats_dialog import StatsDialog

QCoreApplication.setOrganizationName("QRGen")
QCoreApplication.setApplicationName("QRCodeGeneratorTest")
app = QApplication(sys.argv)

db = Database(pathlib.Path(tempfile.mkdtemp()) / "g.db")
qr = db.create(QRCode(title="Demo", is_dynamic=True, destination="https://example.com",
                      style=dict(qr_render.DEFAULT_STYLE)))
db.increment_scan(qr.short_code)
db.increment_scan(qr.short_code)

w = MainWindow(db)
w.list.setCurrentRow(0)
w._preview()
assert w.preview.pixmap() and not w.preview.pixmap().isNull()
print("[ok] window + preview")

# duplicate
before = len(db.list_all())
w.duplicate_current()
assert len(db.list_all()) == before + 1
assert db.list_all()[0].short_code != qr.short_code  # new code got its own slug
print("[ok] duplicate creates a new short code")

# dark theme toggle (no crash, palette swaps)
theme.apply_theme(app, True)
theme.apply_theme(app, False)
w.toggle_theme(True)
print("[ok] theme toggle")

# stats dialog constructs for a dynamic code with scans
w.list.setCurrentRow(w.list.count() - 1)  # select original
d = StatsDialog(db, db.get(qr.id))
print("[ok] stats dialog constructed")

# logo thumbnail path handling (nonexistent -> cleared, no crash)
w.logo_edit.setText("does_not_exist.png")
w._update_logo_thumb()
print("[ok] logo thumb handles missing file")

print("GUI SMOKE PASSED")
