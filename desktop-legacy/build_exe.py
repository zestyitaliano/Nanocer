"""Build a standalone Windows .exe with PyInstaller.

    .venv\\Scripts\\python build_exe.py

Output: dist\\QRCodeGenerator\\QRCodeGenerator.exe (a one-folder bundle — faster to
start than one-file and easy to zip). Data (qr.db, exports, logos) is created
next to the .exe at first run, so the build stays read-only/redistributable.
"""
from __future__ import annotations

import PyInstaller.__main__

# NOTE: we deliberately do NOT pass --clean. Under OneDrive, --clean's rmtree of
# the build/ folder hits "Access is denied" on freshly-written .pyc files that
# OneDrive/AV is still syncing. PyInstaller overwrites in place fine without it.
PyInstaller.__main__.run([
    "run.py",
    "--name", "QRCodeGenerator",
    "--windowed",            # no console window (GUI app)
    "--noconfirm",
    # uvicorn imports its protocol/loop backends dynamically; pull them all in.
    "--collect-submodules", "uvicorn",
    "--collect-submodules", "anyio",
    "--hidden-import", "h11",
])
