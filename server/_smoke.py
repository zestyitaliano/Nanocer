"""Quick local test of the render service (run from server/)."""
import io, zipfile
from fastapi.testclient import TestClient
from PIL import Image
import app as server_app

c = TestClient(server_app.app)

# health
assert c.get("/health").json()["status"] == "ok"
print("[ok] health")

# png render, styled
r = c.post("/render", json={"value": "https://example.com/abc",
                            "style": {"module_style": "rounded",
                                      "fill_color": "#1a73e8"}, "format": "png"})
assert r.status_code == 200 and r.headers["content-type"] == "image/png"
img = Image.open(io.BytesIO(r.content)); assert img.size[0] > 0
print(f"[ok] png render {img.size}, {len(r.content)} bytes")

# svg render
r = c.post("/render", json={"value": "hello", "format": "svg"})
assert r.status_code == 200 and "svg" in r.headers["content-type"]
print(f"[ok] svg render {len(r.content)} bytes")

# batch zip
r = c.post("/batch", json={"items": [
    {"filename": "a", "value": "https://a.com", "style": {}},
    {"filename": "b", "value": "https://b.com", "style": {"module_style": "circle"}},
], "format": "png"})
assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
zf = zipfile.ZipFile(io.BytesIO(r.content)); names = zf.namelist()
assert names == ["a.png", "b.png"], names
print(f"[ok] batch zip -> {names}")

print("SERVER SMOKE PASSED")
