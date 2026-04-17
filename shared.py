"""
Shared state for the extension backend (V2).
Keep this free of endpoint logic.
"""

import json
import os
import secrets
import sqlite3
import urllib.request
from contextlib import contextmanager
from pathlib import Path

from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader

# ── Paths + config ─────────────────────────────────────────────────────────────

OUTPUT_DIR = Path("./screens").resolve()
DB_PATH    = Path("./wayback.db").resolve()

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CDP_URL = "http://localhost:9222"

# API key — set WAYBACK_API_KEY env var to keep the same key across restarts.
API_KEY = os.getenv("WAYBACK_API_KEY") or secrets.token_urlsafe(16)

# Public base URL — set by run.py when a Cloudflare tunnel is started,
# or manually via WAYBACK_PUBLIC_URL.
PUBLIC_URL = os.getenv("WAYBACK_PUBLIC_URL", "").rstrip("/")

# ── Authentication ─────────────────────────────────────────────────────────────

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(key: str = Depends(_api_key_header)):
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

# ── Database ───────────────────────────────────────────────────────────────────

@contextmanager
def get_db():
    """Yields a sqlite3 connection with WAL mode. Commits on success, rolls back on error."""
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id       TEXT PRIMARY KEY,
                status   TEXT NOT NULL,
                results  TEXT NOT NULL DEFAULT '[]',
                settings TEXT NOT NULL DEFAULT '{}',
                created  TEXT NOT NULL DEFAULT (datetime('now')),
                source   TEXT NOT NULL DEFAULT 'v2'
            )
        """)


def db_set_status(job_id: str, status: str):
    with get_db() as db:
        db.execute("UPDATE jobs SET status = ? WHERE id = ?", (status, job_id))


def db_set_done(job_id: str, results: list):
    with get_db() as db:
        db.execute(
            "UPDATE jobs SET status = 'done', results = ? WHERE id = ?",
            (json.dumps(results), job_id),
        )


def db_update_results(job_id: str, results: list):
    """Write partial results while status stays 'running' (progressive loading)."""
    with get_db() as db:
        db.execute(
            "UPDATE jobs SET results = ? WHERE id = ?",
            (json.dumps(results), job_id),
        )

# ── Chrome health check ────────────────────────────────────────────────────────

def is_chrome_alive() -> bool:
    try:
        urllib.request.urlopen(f"{CDP_URL}/json/version", timeout=2)
        return True
    except Exception:
        return False

# ── Path utilities ─────────────────────────────────────────────────────────────

def pdf_path(file_url: str) -> Path:
    """Resolve a /files/… URL to an absolute path inside OUTPUT_DIR."""
    return (OUTPUT_DIR / file_url.removeprefix("/files/")).resolve()
