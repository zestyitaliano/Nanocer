"""FastAPI redirect service for dynamic QR codes.

A dynamic QR encodes ``{PUBLIC_BASE_URL}/r/{short_code}``. When scanned, the
phone hits this server, which looks up the code's current ``destination`` and
issues a 302 redirect. Change the destination in the DB and every printed copy
of that QR instantly points somewhere new — that's the whole "dynamic" trick.

Run standalone for testing:
    .venv\\Scripts\\python -m qrgen.server
The desktop app starts this automatically in a background thread (see app.py).
"""
from __future__ import annotations

import threading

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, RedirectResponse

from . import config
from .db import Database


def create_app(db: Database | None = None) -> FastAPI:
    db = db or Database()
    app = FastAPI(title="QR Code Generator — Redirect Service")
    app.state.db = db

    @app.get("/health")
    def health():
        return {"status": "ok", "base_url": config.PUBLIC_BASE_URL}

    @app.get("/r/{short_code}")
    def redirect(short_code: str):
        qr = db.get_by_short_code(short_code)
        if qr is None or not qr.is_dynamic:
            return HTMLResponse(_not_found_html(short_code), status_code=404)
        if not qr.destination:
            return HTMLResponse(_blank_html(qr.title), status_code=200)
        db.increment_scan(short_code)
        return RedirectResponse(qr.destination, status_code=302)

    return app


def _not_found_html(code: str) -> str:
    return (
        "<html><body style='font-family:sans-serif;text-align:center;"
        "margin-top:15%'><h1>404</h1><p>No QR code matches "
        f"<code>{code}</code>.</p></body></html>"
    )


def _blank_html(title: str) -> str:
    return (
        "<html><body style='font-family:sans-serif;text-align:center;"
        f"margin-top:15%'><h1>{title or 'This code'}</h1>"
        "<p>No destination has been set yet.</p></body></html>"
    )


class ServerThread(threading.Thread):
    """Runs uvicorn in a daemon thread so the GUI owns the main thread."""

    def __init__(self, db: Database):
        super().__init__(daemon=True)
        self._db = db
        self._server = None

    def run(self) -> None:
        import uvicorn

        app = create_app(self._db)
        # log_config=None / access_log=False: when launched via pythonw.exe there
        # is no console, so uvicorn's default StreamHandlers would try to write to
        # a None stdout and crash this thread. Disabling logging setup avoids that.
        # Pin asyncio/h11/no-websockets so the frozen .exe doesn't depend on
        # uvicorn's optional C extensions (uvloop/httptools/websockets), which
        # complicate PyInstaller bundling. No functional difference for redirects.
        cfg = uvicorn.Config(
            app, host=config.SERVER_HOST, port=config.SERVER_PORT,
            log_config=None, access_log=False,
            loop="asyncio", http="h11", ws="none",
        )
        self._server = uvicorn.Server(cfg)
        self._server.run()

    def stop(self) -> None:
        if self._server is not None:
            self._server.should_exit = True


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(create_app(), host=config.SERVER_HOST, port=config.SERVER_PORT)
