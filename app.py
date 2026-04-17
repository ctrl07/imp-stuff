"""Wayback Extension API
Run with:  python run.py
Docs at:   http://127.0.0.1:8081/docs
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from shared import init_db, get_db, is_chrome_alive, API_KEY, OUTPUT_DIR
from ext_api import router as ext_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with get_db() as db:
        db.execute(
            "UPDATE jobs SET status = 'error' WHERE status IN ('running', 'queued')"
        )
    if not os.getenv("WAYBACK_API_KEY"):
        print(f"\n  API key (set WAYBACK_API_KEY env var to persist): {API_KEY}\n")
    yield


app = FastAPI(title="Wayback Extension API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ext_router)
app.mount("/files", StaticFiles(directory=OUTPUT_DIR), name="files")


# Extension calls /health (not /v2/health) for the status badge
@app.get("/health")
def health():
    return {"ok": True, "chrome": is_chrome_alive()}
