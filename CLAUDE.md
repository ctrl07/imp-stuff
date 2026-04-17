# Wayback Extension Backend — Project Knowledge Base

## Purpose

Pluggable backend for the "Imp Stuff" Chrome extension. The extension has three job types today:

- **Capture (Wayback tab)** — full-page PDF via `chrome.debugger` (CDP); stored in IndexedDB
- **Scrape (Scrape tab)** — DOM extraction (title, H1, links, text) via `chrome.scripting.executeScript`; no CDP, no banner
- **Inspect (Inspector tab)** — live page analysis (provider detection, analytics, phones); no backend needed

The backend tracks job state and receives lightweight result metadata. PDFs never leave the browser.

---

## Repository layout

```
ext-backend/
├── app.py               # FastAPI entry point — CORS, lifespan, /health, /files static mount, mounts ext_router
├── ext_api.py           # APIRouter(prefix="/v2") — all V2 endpoints
├── shared.py            # Paths, config, DB helpers (WAL mode), auth — no endpoints
├── run.py               # Launcher — Windows ProactorEventLoop + Cloudflare tunnel (port 8081)
├── pyproject.toml       # Dependencies: fastapi, uvicorn, pypdf, pycloudflared
├── extension/           # Chrome extension ("Imp Stuff") — load unpacked from chrome://extensions
│   ├── manifest.json    # MV3; permissions: webRequest, tabs, contextMenus, storage, sidePanel,
│   │                    #   commands, debugger, scripting, alarms, unlimitedStorage, downloads
│   │                    #   host_permissions: <all_urls>
│   ├── background.js    # Service worker — message handlers, CDP capture helpers, scripting scrape
│   ├── panel.html       # Side panel shell — Inspector / URL Tools / Wayback / Scrape tabs
│   ├── panel.js         # Inspector UI + URL Tools tab + sitemap crawler + initTabs()
│   ├── content.js       # Injected at document_start; responds to SNAPSHOT and INSERT_TEXT
│   ├── rules.js         # URL routing/category pattern rules (dealer pages) — URL Tools tab
│   ├── url-tool.js      # Pure pipeline functions (ut_cleanUrls, ut_classifyAll, etc.)
│   ├── wayback-db.js    # IndexedDB wrapper (store: captures)
│   ├── wayback-panel.js # Wayback tab UI; global API config + backend health dot
│   ├── scrape-panel.js  # Scrape tab UI; BFS crawler, concurrency pool, results table
│   └── pico.min.css     # Base CSS (Pico v2 dark theme)
├── wayback.db           # SQLite job history (created at runtime, gitignored)
└── screens/             # Server-side PDFs (created at runtime, gitignored; rarely populated)
```

---

## Running

```bash
uv run python run.py
```

Server starts on **port 8081**. `WAYBACK_API_KEY` env var pins the key across restarts; if unset, a random key is printed on every startup.

Load the extension: `chrome://extensions` → Developer mode → Load unpacked → select `extension/`  
Open side panel: **Ctrl+Shift+S**

To silence the CDP debugging banner for capture jobs, launch Chrome with:
```
chrome.exe --silent-debugger-extension-api
```

---

## API Endpoints

All V2 endpoints are under `/v2`. Auth = `X-API-Key` header.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Liveness check |
| `GET` | `/v2/health` | — | Same (V2 alias) |
| `POST` | `/v2/capture` | ✅ | Submit PDF capture job → `{job_id, status: queued}` |
| `POST` | `/v2/scrape` | ✅ | Submit scrape/crawl job → `{job_id, status: queued}` |
| `GET` | `/v2/jobs` | — | List jobs (`?status=queued` oldest-first for polling) |
| `GET` | `/v2/jobs/{job_id}` | — | Job status + results |
| `POST` | `/v2/jobs/{job_id}/claim` | ✅ | Atomically claim a queued job (409 if already claimed) |
| `POST` | `/v2/jobs/{job_id}/result` | ✅ | Post one capture result `{url, filename, error}` |
| `POST` | `/v2/jobs/{job_id}/scrape-result` | ✅ | Post one scrape result `{url, title, h1, links, text_preview, error}` |
| `POST` | `/v2/jobs/{job_id}/finish` | ✅ | Mark crawl job done (used when total URL count is unknown upfront) |
| `DELETE` | `/v2/jobs/{job_id}` | ✅ | Cancel or delete job + any server-side PDFs |
| `GET` | `/files/{filename}` | — | Serve PDFs from `screens/` |

---

## Job flow (all types)

```
POST /v2/{capture|scrape}  →  job_id (queued)
POST /v2/jobs/{id}/claim   →  settings + url list (running)
POST /v2/jobs/{id}/result  →  per-URL result (auto-closes when url_count reached)
   OR
POST /v2/jobs/{id}/finish  →  explicit close (crawl mode, unknown count)
```

`source` column in DB: `'v2'` for capture, `'scrape'` for scrape/crawl.

---

## How PDF capture works

### Standalone mode (no backend)
1. User clicks **Capture this page**
2. `wayback-panel.js` → `{ type: 'WB_CAPTURE_TAB' }` → service worker
3. `background.js` attaches `chrome.debugger` to active tab
4. CDP: `setDeviceMetricsOverride` → scroll loop → settle delay → CSS injection → `Page.printToPDF`
5. `pdfBase64` returned; panel converts → Blob → IndexedDB

### Backend bulk mode
1. Paste URLs → **Submit bulk job** → `POST /v2/capture` → `job_id`
2. Panel opens `chrome.runtime.connect('wb-keepalive')` port (pings every 20 s to keep SW alive)
3. Claim job → receive settings + URL list
4. For each URL: `WB_EXECUTE_CAPTURE_URL` → SW opens background tab, captures, closes tab
5. `wbCreateCaptureFilename` generates filename locally; posts `{url, filename}` to `/result` (no PDF bytes)
6. PDF saved to IndexedDB; backend records metadata only
7. Keepalive port disconnected in `finally`

### Background tab visibility fix (CDP capture only)
Background tabs have `document.hidden = true`, breaking lazy loaders.
`wbCaptureTab()` after `Emulation.setEmulatedMedia`:
- `Emulation.setFocusEmulationEnabled` → tab behaves as focused
- `Runtime.evaluate` overrides `document.hidden` / `document.visibilityState`

---

## How scraping works

Scraping uses `chrome.scripting.executeScript` — **no CDP, no debugger attachment, no banner**.

### Per-URL flow (`wbScrapeUrl`)
1. `wbCreateTab(url)` — background tab
2. `wbWaitForTabLoad(tabId)` — Chrome API, no CDP
3. `setTimeout(wait_ms)` — JS settle
4. `chrome.scripting.executeScript` — runs extraction function in page context:
   - Overrides `document.hidden`/`visibilityState` inline (no CDP emulation needed)
   - Returns `{title, meta_description, h1, links[], text_preview}`
5. `wbRemoveTab(tabId)` — close tab

**Why not CDP for scraping:** CDP (`chrome.debugger`) requires `debugger.attach()` which triggers the "debugging this browser" banner. `scripting.executeScript` runs in the same authenticated Chrome session (cookies intact) with zero overhead and no banner.

### BFS site crawler (`scrape-panel.js`)
- Seed URLs → claim job → shared mutable queue `[{url, depth}]`
- N concurrent workers drain queue; each scrape result may enqueue new same-origin links (up to `max_depth`)
- URL deduplication: normalise to `origin + pathname` (strip query/fragment)
- Keepalive port held during crawl; `POST /v2/jobs/{id}/finish` called when queue empties

### Concurrency note
Multiple tabs open simultaneously during crawl. Default concurrency = 3.
`scripting.executeScript` does not conflict across tabs (unlike single-tab CDP session approaches).

---

## Extension file responsibilities

| File | Role |
|------|------|
| `manifest.json` | MV3; `debugger` for capture, `scripting` for scrape |
| `background.js` | Message handlers: `RUN_WEBSITE_INSPECTION`, `WB_CAPTURE_TAB`, `WB_EXECUTE_CAPTURE_URL`, `WB_SCRAPE_URL`; CDP helpers (`wbAttach/Detach/Send`); tab helpers (`wbCreateTab/RemoveTab/WaitForTabLoad`); `wbCaptureTab()`, `wbCaptureUrl()`, `wbScrapeUrl()` |
| `panel.html` | Shell; tab nav (`data-page`); global API config panel; loads all scripts |
| `panel.js` | Inspector UI; URL Tools tab; `initTabs()` |
| `content.js` | `SNAPSHOT` (page data) + `INSERT_TEXT` (context menu) |
| `rules.js` | Dealer URL pattern rules — URL Tools tab |
| `url-tool.js` | URL classification pipeline — URL Tools tab |
| `wayback-db.js` | IndexedDB `captures` store |
| `wayback-panel.js` | Wayback tab + global API config wiring (URL, key, health dot) |
| `scrape-panel.js` | Scrape tab; BFS crawl loop; concurrency pool; results table + CSV export |

### Global API config (header)
`wbBackendConfig = { apiBase, apiKey }` lives in `wayback-panel.js` and is shared globally.
`wbFetch()` is the single HTTP helper used by both `wayback-panel.js` and `scrape-panel.js`.
Config persisted in `chrome.storage.sync`. Health dot in header shows green/red.

### IndexedDB schema
Store: `captures`. Record: `{ id (auto), url, title, filename, timestamp, pdfBlob, size }`.

### Filename format
`[jobId[:8]-]wayback-{hostname}-{path-slug}-{date}.pdf`

---

## Database

SQLite (`wayback.db`), WAL mode. Single `jobs` table:

```sql
CREATE TABLE IF NOT EXISTS jobs (
    id       TEXT PRIMARY KEY,
    status   TEXT NOT NULL,              -- queued | running | done | cancelled | error
    results  TEXT NOT NULL DEFAULT '[]', -- JSON array; schema varies by source
    settings TEXT NOT NULL DEFAULT '{}', -- JSON: job params (snake_case)
    created  TEXT NOT NULL DEFAULT (datetime('now')),
    source   TEXT NOT NULL DEFAULT 'v2'  -- 'v2' = capture | 'scrape' = scrape/crawl
)
```

Capture results: `[{url, file_url, error}]`  
Scrape results: `[{url, title, meta_description, h1, links, text_preview, error}]`

---

## Pluggable job pattern

Each new job type follows:
1. `POST /v2/{type}` → `_create_job(job_id, settings_dict, source='{type}')`
2. Extension claims via shared `POST /v2/jobs/{id}/claim`
3. Extension posts results to `/v2/jobs/{id}/{type}-result`
4. Backend auto-closes when `len(results) >= url_count`, or extension calls `POST /v2/jobs/{id}/finish`
5. New panel tab = new `{type}-panel.js` file

---

## Known limitations

- [ ] **Read endpoint auth** — `/v2/jobs`, `/v2/jobs/{id}` are open (no key required)
- [ ] **Rate limiting** — no throttle on job submission endpoints
- [ ] **`screens/` cleanup** — no TTL or size cap on server-side PDFs
- [ ] **Service worker revival** — if SW is killed mid-crawl (keepalive failure), job stays `running` forever; no recovery endpoint
- [ ] **Crawl politeness** — no `robots.txt` check, no crawl delay between requests
