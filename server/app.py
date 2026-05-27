"""TARS local backend — FastAPI app."""

import base64
import csv
import io
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config as cfg
from . import jobs
from . import seo as seo_mod
from . import staff as staff_mod

VERSION = '0.1.0'


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def _check_token(authorization: Annotated[str, Header()] = ''):
    secret = cfg.backend_token()
    if secret and authorization != f'Bearer {secret}':
        raise HTTPException(status_code=403, detail='Invalid or missing token')


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title='TARS Backend', version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # guard with extension ID.
    allow_origin_regex=r'chrome-extension://.*',
    allow_origins=['http://localhost', 'http://127.0.0.1'],
    allow_methods=['GET', 'POST'],
    allow_headers=['*'],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get('/health')
async def health():
    return {'status': 'ok', 'version': VERSION}


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

@app.get('/jobs/{job_id}')
async def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    return jobs.to_dict(job)


# ---------------------------------------------------------------------------
# SEO parse-batch (extension supplies pre-fetched HTML pages)
# ---------------------------------------------------------------------------

class BatchPage(BaseModel):
    html:  str = ''
    url:   str
    error: str = ''  # pre-fetch error reported by extension


class FieldDef(BaseModel):
    key:      str
    selector: str
    attr:     str  = ''
    multiple: bool = False
    enabled:  bool = True


class SeoParseBatchRequest(BaseModel):
    pages:  list[BatchPage]
    fields: list[FieldDef] = []  # empty = default extraction


@app.post('/seo/parse-batch', dependencies=[Depends(_check_token)])
async def seo_parse_batch(req: SeoParseBatchRequest, background_tasks: BackgroundTasks):
    if not req.pages:
        raise HTTPException(status_code=400, detail='No pages provided')

    fields = [f.model_dump() for f in req.fields] or None
    job = jobs.create(total=len(req.pages))

    async def run():
        try:
            results = []
            for i, page in enumerate(req.pages):
                if page.error or not page.html:
                    results.append({
                        'url': page.url,
                        'error': page.error or 'No HTML received',
                    })
                else:
                    results.append(seo_mod.parse_one(page.html, page.url, fields))
                jobs.update(job.id, progress=i + 1, total=len(req.pages),
                            message=f'{i + 1}/{len(req.pages)} pages')

            # Build CSV from whatever keys are in the results
            if results:
                all_keys = list(dict.fromkeys(k for r in results for k in r))
                buf = io.StringIO()
                writer = csv.DictWriter(buf, fieldnames=all_keys, extrasaction='ignore')
                writer.writeheader()
                writer.writerows(results)
                csv_b64 = base64.b64encode(buf.getvalue().encode('utf-8-sig')).decode()
            else:
                csv_b64 = ''
            jobs.update(job.id, status='done', result={'results': results, 'csv_b64': csv_b64})
        except Exception as exc:
            jobs.update(job.id, status='error', error=str(exc))

    background_tasks.add_task(run)
    return {'job_id': job.id}


# ---------------------------------------------------------------------------
# Staff scrape
# ---------------------------------------------------------------------------

class StaffRequest(BaseModel):
    url: str


@app.post('/staff/scrape', dependencies=[Depends(_check_token)])
async def staff_scrape(req: StaffRequest, background_tasks: BackgroundTasks):
    if not req.url:
        raise HTTPException(status_code=400, detail='No URL provided')

    job = jobs.create(total=1)

    async def run():
        try:
            jobs.update(job.id, message='Fetching staff page…')
            data = await staff_mod.scrape(req.url)
            if data['error']:
                jobs.update(job.id, status='error', error=data['error'])
                return
            zip_b64 = base64.b64encode(data['zip']).decode() if data['zip'] else ''
            jobs.update(
                job.id,
                status='done',
                progress=1,
                result={
                    'staff':   data['staff'],
                    'count':   len(data['staff']),
                    'zip_b64': zip_b64,
                },
            )
        except staff_mod.httpx.HTTPStatusError as exc:
            jobs.update(job.id, status='error', error=f'HTTP {exc.response.status_code}')
        except Exception as exc:
            jobs.update(job.id, status='error', error=str(exc))

    background_tasks.add_task(run)
    return {'job_id': job.id}


# ---------------------------------------------------------------------------
# Staff parse (extension-supplied HTML)
# ---------------------------------------------------------------------------

class StaffParseRequest(BaseModel):
    html: str
    url: str


@app.post('/staff/parse', dependencies=[Depends(_check_token)])
async def staff_parse(req: StaffParseRequest, background_tasks: BackgroundTasks):
    if not req.html:
        raise HTTPException(status_code=400, detail='No HTML provided')

    job = jobs.create(total=1)

    async def run():
        try:
            jobs.update(job.id, message='Parsing staff from HTML…')
            data = await staff_mod.parse_and_package(req.html, req.url)
            if data['error']:
                jobs.update(job.id, status='error', error=data['error'])
                return
            zip_b64 = base64.b64encode(data['zip']).decode() if data['zip'] else ''
            jobs.update(
                job.id,
                status='done',
                progress=1,
                result={
                    'staff':   data['staff'],
                    'count':   len(data['staff']),
                    'zip_b64': zip_b64,
                },
            )
        except Exception as exc:
            jobs.update(job.id, status='error', error=str(exc))

    background_tasks.add_task(run)
    return {'job_id': job.id}
