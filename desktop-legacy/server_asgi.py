from qrgen.server import create_app

# Minimal ASGI entrypoint for hosting providers (e.g., Render)
# Exposes a top-level `app` object that uvicorn can import.
app = create_app()
