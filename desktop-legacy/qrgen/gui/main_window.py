"""PySide6 desktop UI — the management console for all QR codes.

Layout: a list of saved codes on the left, an editor + live preview on the right.
The editor drives a per-code ``style`` dict and (for dynamic codes) the live
redirect destination. Saving a destination change repoints every printed copy of
that QR instantly because the image only ever encoded our stable redirect URL.
"""
from __future__ import annotations

import io
from pathlib import Path

from PySide6.QtCore import Qt, QSettings
from PySide6.QtGui import QImage, QPixmap, QAction
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QFormLayout, QListWidget,
    QListWidgetItem, QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox, QPushButton,
    QLabel, QFileDialog, QColorDialog, QMessageBox, QGroupBox, QRadioButton,
    QPlainTextEdit, QSplitter, QToolBar, QStatusBar, QApplication,
)

from .. import config
from ..db import Database, QRCode
from .. import qr_render
from .. import batch
from .stats_dialog import StatsDialog
from . import theme

_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")


def pil_to_pixmap(img) -> QPixmap:
    img = img.convert("RGBA")
    data = img.tobytes("raw", "RGBA")
    qimg = QImage(data, img.width, img.height, QImage.Format_RGBA8888)
    return QPixmap.fromImage(qimg.copy())


class MainWindow(QMainWindow):
    def __init__(self, db: Database):
        super().__init__()
        self.db = db
        self.current: QRCode | None = None
        self.settings = QSettings()
        self.setWindowTitle("QR Code Generator")
        self.resize(1080, 720)
        self.setAcceptDrops(True)  # drop an image anywhere to set the logo

        self._build_toolbar()
        self._build_body()
        self.setStatusBar(QStatusBar())
        self.statusBar().showMessage(
            f"Redirect server: {config.PUBLIC_BASE_URL}/r/<code>"
        )
        self.refresh_list()

    # --- construction --------------------------------------------------------
    def _build_toolbar(self) -> None:
        tb = QToolBar("Main")
        tb.setMovable(False)
        self.addToolBar(tb)
        acts = [
            ("New dynamic", self.new_dynamic),
            ("New static", self.new_static),
            ("Duplicate", self.duplicate_current),
            ("Delete", self.delete_current),
            (None, None),
            ("Stats", self.show_stats),
            (None, None),
            ("Import CSV", self.import_csv),
            ("Export all PNGs", self.export_all),
        ]
        for label, slot in acts:
            if label is None:
                tb.addSeparator()
                continue
            a = QAction(label, self)
            a.triggered.connect(slot)
            tb.addAction(a)

        # right-aligned dark-mode toggle
        spacer = QWidget()
        spacer.setSizePolicy(spacer.sizePolicy().horizontalPolicy().Expanding,
                             spacer.sizePolicy().verticalPolicy().Preferred)
        tb.addWidget(spacer)
        self.dark_action = QAction("Dark mode", self)
        self.dark_action.setCheckable(True)
        self.dark_action.setChecked(self.settings.value("dark", False, type=bool))
        self.dark_action.toggled.connect(self.toggle_theme)
        tb.addAction(self.dark_action)

    def _build_body(self) -> None:
        splitter = QSplitter(Qt.Horizontal)

        # Left: list of codes
        left = QWidget()
        ll = QVBoxLayout(left)
        ll.addWidget(QLabel("Your QR codes"))
        self.list = QListWidget()
        self.list.currentItemChanged.connect(self._on_select)
        ll.addWidget(self.list)
        splitter.addWidget(left)

        # Right: editor + preview
        right = QWidget()
        rl = QHBoxLayout(right)
        rl.addWidget(self._build_editor(), 3)
        rl.addWidget(self._build_preview(), 2)
        splitter.addWidget(right)

        splitter.setSizes([300, 780])
        self.setCentralWidget(splitter)

    def _build_editor(self) -> QWidget:
        box = QWidget()
        form = QFormLayout(box)

        self.title_edit = QLineEdit()
        form.addRow("Title", self.title_edit)

        # type
        type_box = QGroupBox("Type")
        tb = QHBoxLayout(type_box)
        self.rb_dynamic = QRadioButton("Dynamic (editable later)")
        self.rb_static = QRadioButton("Static (fixed)")
        self.rb_dynamic.setChecked(True)
        self.rb_dynamic.toggled.connect(self._on_type_toggle)
        tb.addWidget(self.rb_dynamic)
        tb.addWidget(self.rb_static)
        form.addRow(type_box)

        self.dest_edit = QLineEdit()
        self.dest_edit.setPlaceholderText("https://example.com/landing-page")
        form.addRow("Destination URL", self.dest_edit)

        self.content_edit = QPlainTextEdit()
        self.content_edit.setPlaceholderText("URL or any text to encode directly")
        self.content_edit.setFixedHeight(60)
        form.addRow("Static content", self.content_edit)

        self.encoded_label = QLabel("—")
        self.encoded_label.setWordWrap(True)
        self.encoded_label.setStyleSheet("color:#666;font-size:11px;")
        form.addRow("Encodes", self.encoded_label)

        # --- styling ---------------------------------------------------------
        style_box = QGroupBox("Styling")
        sf = QFormLayout(style_box)

        self.fill_btn = QPushButton("Foreground…")
        self.fill_btn.clicked.connect(lambda: self._pick_color("fill_color", self.fill_btn))
        sf.addRow("Foreground", self.fill_btn)

        self.back_btn = QPushButton("Background…")
        self.back_btn.clicked.connect(lambda: self._pick_color("back_color", self.back_btn))
        sf.addRow("Background", self.back_btn)

        self.module_combo = QComboBox()
        self.module_combo.addItems(
            ["square", "rounded", "circle", "gapped", "vertical", "horizontal"]
        )
        self.module_combo.currentTextChanged.connect(self._sync_and_preview)
        sf.addRow("Module shape", self.module_combo)

        self.ec_combo = QComboBox()
        self.ec_combo.addItems(["L", "M", "Q", "H"])
        self.ec_combo.setCurrentText("M")
        self.ec_combo.currentTextChanged.connect(self._sync_and_preview)
        sf.addRow("Error correction", self.ec_combo)

        self.box_spin = QSpinBox()
        self.box_spin.setRange(2, 40)
        self.box_spin.setValue(10)
        self.box_spin.valueChanged.connect(self._sync_and_preview)
        sf.addRow("Module px", self.box_spin)

        self.border_spin = QSpinBox()
        self.border_spin.setRange(0, 16)
        self.border_spin.setValue(4)
        self.border_spin.valueChanged.connect(self._sync_and_preview)
        sf.addRow("Quiet zone", self.border_spin)

        logo_row = QWidget()
        lr = QHBoxLayout(logo_row)
        lr.setContentsMargins(0, 0, 0, 0)
        self.logo_thumb = QLabel()
        self.logo_thumb.setFixedSize(34, 34)
        self.logo_thumb.setAlignment(Qt.AlignCenter)
        self.logo_thumb.setStyleSheet("border:1px solid #ccc;background:#fff;")
        self.logo_edit = QLineEdit()
        self.logo_edit.setPlaceholderText("(optional) logo image — or drag one in")
        self.logo_edit.textChanged.connect(self._on_logo_changed)
        logo_pick = QPushButton("…")
        logo_pick.setFixedWidth(30)
        logo_pick.clicked.connect(self._pick_logo)
        logo_clear = QPushButton("✕")
        logo_clear.setFixedWidth(30)
        logo_clear.clicked.connect(lambda: self.logo_edit.setText(""))
        lr.addWidget(self.logo_thumb)
        lr.addWidget(self.logo_edit)
        lr.addWidget(logo_pick)
        lr.addWidget(logo_clear)
        sf.addRow("Centre logo", logo_row)

        self.logo_scale = QDoubleSpinBox()
        self.logo_scale.setRange(0.05, 0.40)
        self.logo_scale.setSingleStep(0.02)
        self.logo_scale.setValue(0.22)
        self.logo_scale.valueChanged.connect(self._sync_and_preview)
        sf.addRow("Logo size", self.logo_scale)

        form.addRow(style_box)

        # --- actions ---------------------------------------------------------
        self.save_btn = QPushButton("Save changes")
        self.save_btn.clicked.connect(self.save_current)
        form.addRow(self.save_btn)

        export_row = QWidget()
        er = QHBoxLayout(export_row)
        er.setContentsMargins(0, 0, 0, 0)
        png_btn = QPushButton("Export PNG")
        png_btn.clicked.connect(lambda: self.export_one("png"))
        svg_btn = QPushButton("Export SVG")
        svg_btn.clicked.connect(lambda: self.export_one("svg"))
        er.addWidget(png_btn)
        er.addWidget(svg_btn)
        form.addRow(export_row)

        # live preview as fields change
        for w in (self.title_edit, self.dest_edit):
            w.textChanged.connect(self._update_encoded_label)
        self.content_edit.textChanged.connect(self._update_encoded_label)

        self._style = dict(qr_render.DEFAULT_STYLE)
        self._refresh_color_buttons()
        return box

    def _build_preview(self) -> QWidget:
        box = QGroupBox("Preview")
        v = QVBoxLayout(box)
        self.preview = QLabel("Select or create a code")
        self.preview.setAlignment(Qt.AlignCenter)
        self.preview.setMinimumSize(360, 360)
        self.preview.setStyleSheet("background:#fafafa;border:1px solid #ddd;")
        v.addWidget(self.preview)
        self.scan_label = QLabel("")
        self.scan_label.setAlignment(Qt.AlignCenter)
        v.addWidget(self.scan_label)
        return box

    # --- list handling -------------------------------------------------------
    def refresh_list(self) -> None:
        self.list.blockSignals(True)
        self.list.clear()
        for qr in self.db.list_all():
            tag = "🔗" if qr.is_dynamic else "▪"
            item = QListWidgetItem(f"{tag}  {qr.title or '(untitled)'}  · {qr.short_code}")
            item.setData(Qt.UserRole, qr.id)
            self.list.addItem(item)
        self.list.blockSignals(False)

    def _on_select(self, item: QListWidgetItem | None) -> None:
        if item is None:
            return
        qr = self.db.get(item.data(Qt.UserRole))
        if qr:
            self._load(qr)

    def _load(self, qr: QRCode) -> None:
        self.current = qr
        self.title_edit.setText(qr.title)
        self.rb_dynamic.setChecked(qr.is_dynamic)
        self.rb_static.setChecked(not qr.is_dynamic)
        self.dest_edit.setText(qr.destination)
        self.content_edit.setPlainText(qr.content)
        self._style = qr_render.merge_style(qr.style)
        self._apply_style_to_widgets()
        self.scan_label.setText(
            f"Scans: {qr.scan_count}" if qr.is_dynamic else "Static code"
        )
        self._on_type_toggle()
        self._update_encoded_label()

    # --- new / delete --------------------------------------------------------
    def new_dynamic(self) -> None:
        qr = self.db.create(QRCode(title="New dynamic code", is_dynamic=True,
                                   style=dict(qr_render.DEFAULT_STYLE)))
        self.refresh_list()
        self._select_id(qr.id)

    def new_static(self) -> None:
        qr = self.db.create(QRCode(title="New static code", is_dynamic=False,
                                   content="https://example.com",
                                   style=dict(qr_render.DEFAULT_STYLE)))
        self.refresh_list()
        self._select_id(qr.id)

    def delete_current(self) -> None:
        if not self.current:
            return
        if QMessageBox.question(self, "Delete",
                                f"Delete “{self.current.title}”?") == QMessageBox.Yes:
            self.db.delete(self.current.id)
            self.current = None
            self.refresh_list()
            self.preview.setText("Select or create a code")

    def duplicate_current(self) -> None:
        if not self.current:
            QMessageBox.information(self, "Duplicate", "Select a code to duplicate.")
            return
        src = self.current
        copy = QRCode(
            title=f"{src.title} (copy)" if src.title else "(copy)",
            is_dynamic=src.is_dynamic,
            destination=src.destination,
            content=src.content,
            style=dict(src.style),
        )  # new short_code is minted by db.create -> its own dynamic redirect
        copy = self.db.create(copy)
        self.refresh_list()
        self._select_id(copy.id)
        self.statusBar().showMessage("Duplicated (new short code assigned).", 3000)

    def show_stats(self) -> None:
        if not self.current:
            QMessageBox.information(self, "Stats", "Select a code to see its stats.")
            return
        fresh = self.db.get(self.current.id)  # reload for latest scan_count
        StatsDialog(self.db, fresh, self).exec()

    def toggle_theme(self, dark: bool) -> None:
        theme.apply_theme(QApplication.instance(), dark)
        self.settings.setValue("dark", dark)
        self._refresh_color_buttons()

    def _select_id(self, code_id: int) -> None:
        for i in range(self.list.count()):
            if self.list.item(i).data(Qt.UserRole) == code_id:
                self.list.setCurrentRow(i)
                return

    # --- styling helpers -----------------------------------------------------
    def _pick_color(self, key: str, btn: QPushButton) -> None:
        col = QColorDialog.getColor()
        if col.isValid():
            self._style[key] = col.name()
            self._refresh_color_buttons()
            self._preview()

    def _refresh_color_buttons(self) -> None:
        for key, btn, label in (
            ("fill_color", self.fill_btn, "Foreground"),
            ("back_color", self.back_btn, "Background"),
        ):
            c = self._style.get(key, "#000000")
            btn.setText(f"{label}  {c}")
            btn.setStyleSheet(f"background:{c}; color:{self._contrast(c)};")

    @staticmethod
    def _contrast(hexcol: str) -> str:
        r, g, b = qr_render._hex_to_rgb(hexcol)
        return "#000000" if (r * 299 + g * 587 + b * 114) / 1000 > 140 else "#FFFFFF"

    def _pick_logo(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Choose logo", "", "Images (*.png *.jpg *.jpeg *.webp *.bmp)")
        if path:
            self.logo_edit.setText(path)

    def _on_logo_changed(self) -> None:
        self._update_logo_thumb()
        self._sync_and_preview()

    def _update_logo_thumb(self) -> None:
        path = self.logo_edit.text().strip()
        if path and Path(path).is_file():
            pm = QPixmap(path)
            if not pm.isNull():
                self.logo_thumb.setPixmap(pm.scaled(
                    32, 32, Qt.KeepAspectRatio, Qt.SmoothTransformation))
                return
        self.logo_thumb.clear()

    # --- drag & drop a logo image ------------------------------------------
    def dragEnterEvent(self, event) -> None:  # noqa: N802 (Qt naming)
        if self._dropped_image_path(event):
            event.acceptProposedAction()

    def dropEvent(self, event) -> None:  # noqa: N802 (Qt naming)
        path = self._dropped_image_path(event)
        if path:
            self.logo_edit.setText(path)
            self.statusBar().showMessage(f"Logo set from drop: {path}", 4000)
            event.acceptProposedAction()

    @staticmethod
    def _dropped_image_path(event) -> str | None:
        md = event.mimeData()
        if not md.hasUrls():
            return None
        for url in md.urls():
            p = url.toLocalFile()
            if p.lower().endswith(_IMAGE_EXTS):
                return p
        return None

    def _apply_style_to_widgets(self) -> None:
        s = self._style
        self.module_combo.setCurrentText(s.get("module_style", "square"))
        self.ec_combo.setCurrentText(s.get("error_correction", "M"))
        self.box_spin.setValue(int(s.get("box_size", 10)))
        self.border_spin.setValue(int(s.get("border", 4)))
        self.logo_edit.setText(s.get("logo_path", "") or "")
        self.logo_scale.setValue(float(s.get("logo_scale", 0.22)))
        self._refresh_color_buttons()

    def _sync_style_from_widgets(self) -> None:
        self._style["module_style"] = self.module_combo.currentText()
        self._style["error_correction"] = self.ec_combo.currentText()
        self._style["box_size"] = self.box_spin.value()
        self._style["border"] = self.border_spin.value()
        self._style["logo_path"] = self.logo_edit.text().strip()
        self._style["logo_scale"] = self.logo_scale.value()

    def _sync_and_preview(self) -> None:
        self._sync_style_from_widgets()
        self._preview()

    # --- type toggle ---------------------------------------------------------
    def _on_type_toggle(self) -> None:
        dynamic = self.rb_dynamic.isChecked()
        self.dest_edit.setEnabled(dynamic)
        self.content_edit.setEnabled(not dynamic)
        self._update_encoded_label()

    def _update_encoded_label(self) -> None:
        if self.rb_dynamic.isChecked():
            code = self.current.short_code if self.current else "<code>"
            self.encoded_label.setText(config.redirect_url(code))
        else:
            self.encoded_label.setText(self.content_edit.toPlainText() or "—")
        self._preview()

    # --- preview / save ------------------------------------------------------
    def _current_encoded_value(self) -> str:
        if self.rb_dynamic.isChecked():
            return config.redirect_url(
                self.current.short_code if self.current else "preview")
        return self.content_edit.toPlainText() or "https://example.com"

    def _preview(self) -> None:
        try:
            img = qr_render.render(self._current_encoded_value(), self._style)
            pm = pil_to_pixmap(img).scaled(
                self.preview.width(), self.preview.height(),
                Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.preview.setPixmap(pm)
        except Exception as exc:  # noqa: BLE001 — surface render errors in UI
            self.preview.setText(f"Preview error:\n{exc}")

    def save_current(self) -> None:
        if not self.current:
            QMessageBox.information(self, "No code", "Create or select a code first.")
            return
        self._sync_style_from_widgets()
        self.current.title = self.title_edit.text()
        self.current.is_dynamic = self.rb_dynamic.isChecked()
        self.current.destination = self.dest_edit.text().strip()
        self.current.content = self.content_edit.toPlainText().strip()
        self.current.style = dict(self._style)
        self.db.update(self.current)
        self.refresh_list()
        self._select_id(self.current.id)
        self.statusBar().showMessage("Saved.", 3000)

    # --- export --------------------------------------------------------------
    def export_one(self, fmt: str) -> None:
        if not self.current:
            return
        self.save_current()
        default = config.EXPORTS_DIR / f"{self.current.short_code}.{fmt}"
        path, _ = QFileDialog.getSaveFileName(
            self, "Export", str(default), f"{fmt.upper()} (*.{fmt})")
        if not path:
            return
        value = self.current.encoded_value
        if fmt == "png":
            qr_render.save_png(value, path, self._style)
        else:
            qr_render.save_svg(value, path, self._style)
        self.statusBar().showMessage(f"Exported {path}", 4000)

    def import_csv(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Import CSV", "", "CSV (*.csv)")
        if not path:
            return
        created = batch.import_csv(self.db, path, dict(qr_render.DEFAULT_STYLE))
        self.refresh_list()
        QMessageBox.information(self, "Import", f"Created {len(created)} codes.")

    def export_all(self) -> None:
        out = QFileDialog.getExistingDirectory(
            self, "Export all to folder", str(config.EXPORTS_DIR))
        if not out:
            return
        codes = self.db.list_all()
        manifest = batch.export_pngs(codes, out)
        QMessageBox.information(
            self, "Export", f"Exported {len(codes)} PNGs.\nManifest: {manifest}")
