"""
V2 Extension API — extension-driven capture.

Executes captures via chrome.debugger, and uploads PDFs back via POST /v2/jobs/{id}/result.

Mounted by app.py at /v2.
"""

import base64
import io
import json
import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import AnyHttpUrl, BaseModel
from pypdf import PdfReader, PdfWriter

from shared import (
    OUTPUT_DIR, PUBLIC_URL,
    get_db, require_api_key,
    db_set_done, db_update_results, db_set_status,
    is_chrome_alive, pdf_path,
)

router = APIRouter(prefix="/v2", tags=["Extension API"])

# ── Helpers ────────────────────────────────────────────────────────────────────

def _slugify(url: str) -> str:
    s = re.sub(r"https?://", "", url.lower())
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "page"


def _strip_trailing_blank_pages(pdf_bytes: bytes) -> bytes:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = list(reader.pages)
    while len(pages) > 1 and not pages[-1].extract_text().strip():
        pages.pop()
    if len(pages) == len(reader.pages):
        return pdf_bytes
    writer = PdfWriter()
    for p in pages:
        writer.add_page(p)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _create_job(job_id: str, settings: dict, source: str = "v2"):
    with get_db() as db:
        db.execute(
            "INSERT INTO jobs (id, status, settings, source) VALUES (?, ?, ?, ?)",
            (job_id, "queued", json.dumps(settings), source),
        )

# ── Models ─────────────────────────────────────────────────────────────────────

class V2CaptureRequest(BaseModel):
    urls: list[AnyHttpUrl]
    width: int = 1920
    height: int = 1080
    delay_settle: int = 3000
    scroll_interval: int = 600
    max_scrolls: Optional[int] = None
    custom_css: str = ""


class V2UrlResultRequest(BaseModel):
    url: str
    filename: Optional[str] = None
    pdf_data: Optional[str] = None  # base64-encoded PDF bytes
    error: Optional[str] = None


class V2ScrapeRequest(BaseModel):
    urls: list[AnyHttpUrl]
    extract_links: bool = True
    extract_text: bool = True
    wait_ms: int = 2000
    max_depth: int = 0  # 0 = no crawl, >0 = follow links N levels


class V2ScrapeResultRequest(BaseModel):
    url: str
    title: Optional[str] = None
    meta_description: Optional[str] = None
    h1: Optional[str] = None
    links: list[str] = []
    text_preview: Optional[str] = None
    error: Optional[str] = None

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"ok": True, "chrome": is_chrome_alive()}


@router.post("/capture", status_code=202, dependencies=[Depends(require_api_key)])
def capture(req: V2CaptureRequest):
    """Submit a capture job. Returns job_id immediately — extension claims and executes."""
    if not req.urls:
        raise HTTPException(422, "urls list cannot be empty")
    job_id = str(uuid.uuid4())
    _create_job(job_id, {
        "urls":            [str(u) for u in req.urls],
        "url_count":       len(req.urls),
        "width":           req.width,
        "height":          req.height,
        "delay_settle":    req.delay_settle,
        "scroll_interval": req.scroll_interval,
        "max_scrolls":     req.max_scrolls,
        "custom_css":      req.custom_css,
    })
    return {"job_id": job_id, "status": "queued"}


@router.post("/scrape", status_code=202, dependencies=[Depends(require_api_key)])
def scrape(req: V2ScrapeRequest):
    """Submit a scrape job. Extension claims and executes via CDP in the authenticated browser."""
    if not req.urls:
        raise HTTPException(422, "urls list cannot be empty")
    job_id = str(uuid.uuid4())
    _create_job(job_id, {
        "urls":          [str(u) for u in req.urls],
        "url_count":     len(req.urls),
        "extract_links": req.extract_links,
        "extract_text":  req.extract_text,
        "wait_ms":       req.wait_ms,
        "max_depth":     req.max_depth,
    }, source="scrape")
    return {"job_id": job_id, "status": "queued"}


@router.get("/jobs")
def list_jobs(limit: int = 50, offset: int = 0, status: Optional[str] = None):
    """List V2 jobs. Pass ?status=queued to poll for work (oldest first)."""
    with get_db() as db:
        if status:
            rows = db.execute(
                "SELECT id, status, created FROM jobs WHERE source = 'v2' AND status = ? "
                "ORDER BY created ASC LIMIT ? OFFSET ?",
                (status, limit, offset),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT id, status, created FROM jobs WHERE source = 'v2' "
                "ORDER BY created DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
    return [{"job_id": r["id"], "status": r["status"], "created": r["created"]} for r in rows]


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(404, "job not found")
    results = json.loads(row["results"])
    if PUBLIC_URL:
        for r in results:
            if r.get("file_url") and r["file_url"].startswith("/"):
                r["file_url"] = PUBLIC_URL + r["file_url"]
    return {"job_id": row["id"], "status": row["status"],
            "results": results, "created": row["created"]}


@router.post("/jobs/{job_id}/claim", dependencies=[Depends(require_api_key)])
def claim_job(job_id: str):
    """
    Atomically claim a queued job. Returns full job row including settings (with urls list).
    Returns 409 if already claimed by another worker.
    """
    with get_db() as db:
        affected = db.execute(
            "UPDATE jobs SET status = 'running' WHERE id = ? AND status = 'queued'",
            (job_id,)
        ).rowcount
        if affected == 0:
            row = db.execute("SELECT status FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if not row:
                raise HTTPException(404, "job not found")
            raise HTTPException(409, f"already claimed (status={row['status']})")
        row = db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    return {
        "job_id":   row["id"],
        "status":   row["status"],
        "settings": json.loads(row["settings"]),
        "created":  row["created"],
    }


@router.post("/jobs/{job_id}/result", dependencies=[Depends(require_api_key)])
def post_result(job_id: str, payload: V2UrlResultRequest):
    """
    Called by the extension once per captured URL. Decodes and saves the PDF,
    updates results[], and marks the job done when all URLs are accounted for.
    """
    with get_db() as db:
        row = db.execute(
            "SELECT status, results, settings FROM jobs WHERE id = ?", (job_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "job not found")
    if row["status"] not in ("running", "queued"):
        raise HTTPException(409, f"job is {row['status']}, cannot post result")

    settings  = json.loads(row["settings"])
    url_count = settings.get("url_count", 1)
    results   = json.loads(row["results"])

    filename = None
    file_url = None
    if payload.pdf_data:
        try:
            pdf_bytes = _strip_trailing_blank_pages(base64.b64decode(payload.pdf_data))
            filename = Path(payload.filename or f"{job_id[:8]}-{_slugify(payload.url)}.pdf").name
            if not filename.lower().endswith(".pdf"):
                filename += ".pdf"
            (OUTPUT_DIR / filename).write_bytes(pdf_bytes)
            file_url = f"/files/{filename}"
        except Exception as e:
            results.append({"url": payload.url, "file_url": None, "error": f"save failed: {e}"})
            if len(results) >= url_count:
                db_set_done(job_id, results)
            else:
                db_update_results(job_id, results)
            return {"ok": True, "filename": None, "file_url": None}

    results.append({"url": payload.url, "file_url": file_url, "error": payload.error})

    if len(results) >= url_count:
        db_set_done(job_id, results)
    else:
        db_update_results(job_id, results)

    return {"ok": True, "filename": filename, "file_url": file_url}


@router.post("/jobs/{job_id}/scrape-result", dependencies=[Depends(require_api_key)])
def post_scrape_result(job_id: str, payload: V2ScrapeResultRequest):
    """Called by the extension once per scraped URL. Updates results and auto-closes job when done."""
    with get_db() as db:
        row = db.execute(
            "SELECT status, results, settings FROM jobs WHERE id = ?", (job_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "job not found")
    if row["status"] not in ("running", "queued"):
        raise HTTPException(409, f"job is {row['status']}, cannot post result")

    settings  = json.loads(row["settings"])
    url_count = settings.get("url_count", 1)
    results   = json.loads(row["results"])

    results.append({
        "url":              payload.url,
        "title":            payload.title,
        "meta_description": payload.meta_description,
        "h1":               payload.h1,
        "links":            payload.links,
        "text_preview":     payload.text_preview,
        "error":            payload.error,
    })

    if len(results) >= url_count:
        db_set_done(job_id, results)
    else:
        db_update_results(job_id, results)

    return {"ok": True}


@router.delete("/jobs/{job_id}", status_code=204, dependencies=[Depends(require_api_key)])
def delete_job(job_id: str):
    """Cancel an active job, or delete a terminal job and its PDF files."""
    with get_db() as db:
        row = db.execute(
            "SELECT status, results FROM jobs WHERE id = ?", (job_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "job not found")

    if row["status"] in ("queued", "running"):
        db_set_status(job_id, "cancelled")
    else:
        for r in json.loads(row["results"]):
            if r.get("file_url"):
                pdf_path(r["file_url"]).unlink(missing_ok=True)
        with get_db() as db:
            db.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
