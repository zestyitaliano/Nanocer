Deploying the QR redirect service to Render.com (Nanocer)

1. Create a Render account and connect this repository (or push this repo to GitHub).
2. In Render, create a new "Web Service" from this repo and branch `main`.
   - Environment: Python
   - Build command: pip install -r requirements-server.txt
   - Start command: uvicorn server_asgi:app --host 0.0.0.0 --port $PORT
3. Set the environment variable QRGEN_PUBLIC_BASE_URL to your Nanocer domain, e.g.
   https://qr.nanocer.com
   (Render -> Service -> Environment -> Add Variable).
4. Optionally add a custom domain in Render and follow their DNS/SSL steps.

Notes:
- This deploys only the redirect service. The app uses an on-disk SQLite DB at `data/qr.db`.
  On Render, the disk is ephemeral across deploys; for persistent storage consider
  using an external database or Render's persistent disk options.
- For testing without a custom domain, set QRGEN_PUBLIC_BASE_URL to the Render
  service's default URL (https://<service>.onrender.com). Then exports will
  encode that public base URL so QR codes resolve correctly from phones.
