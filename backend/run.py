"""
Use this to start the extension API instead of calling uvicorn directly.
Sets the correct Windows event loop and optionally starts a Cloudflare tunnel.

Run with:  uv run python run.py

For remote access, pycloudflared is included as a dependency.
A public HTTPS URL will be printed at startup — paste it into the extension's backend URL field.
Set WAYBACK_PUBLIC_URL env var to use a fixed URL instead of auto-tunnelling.
"""

import asyncio
import os
import sys

if sys.platform == "win32":
    # Must happen before uvicorn is imported or starts its event loop.
    loop = asyncio.ProactorEventLoop()
    asyncio.set_event_loop(loop)

# Start a Cloudflare tunnel if no URL is already set.
if not os.getenv("WAYBACK_PUBLIC_URL"):
    try:
        from pycloudflared import try_cloudflare
        tunnel = try_cloudflare(port=8081, verbose=False)
        public_url = tunnel.tunnel
        os.environ["WAYBACK_PUBLIC_URL"] = public_url
        print(f"\n  Public URL (paste into extension backend URL field): {public_url}\n")
    except ImportError:
        pass
    except Exception as e:
        print(f"  [cloudflare] Could not start tunnel: {e}")

import uvicorn

uvicorn.run("app:app", host="127.0.0.1", port=8081, reload=False)
