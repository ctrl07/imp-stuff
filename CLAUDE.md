# Wayback Extension Backend — Project Knowledge Base

## Purpose

Single-user V2 backend for the "Imp Stuff" Chrome extension Wayback tab.
Decoupled from the V1 server-capture pipeline (`../backend-ref/`).

The extension executes captures client-side via `chrome.debugger` (CDP).
PDFs are stored in the extension's IndexedDB. The backend tracks job state
and receives lightweight result metadata (URL + filename, no PDF bytes).

---

## Repository layout

```
ext-backend/
├── app.py               # FastAPI entry point — CORS, lifespan, /health, /files static mount, mounts ext_router
├── ext_api.py           # APIRouter(prefix="/v2") — all V2 endpoints
├── shared.py            # Paths, config, DB helpers (WAL mode), auth — no endpoints
├── run.py               # Launcher — Windows ProactorEventLoop + Cloudflare tunnel (port 8081)
├── pyproject.toml       # Dependencies: fastapi, uvicorn, pypdf, pycloudflared (no pychrome)
├── extension/           # Chrome extension ("Imp Stuff") — load unpacked from chrome://extensions
│   ├── manifest.json    # MV3; permissions: webRequest, tabs, contextMenus, storage, sidePanel, commands, debugger, alarms, unlimitedStorage, downloads
│   ├── background.js    # Service worker — WB_CAPTURE_TAB, WB_EXECUTE_CAPTURE_URL, RUN_WEBSITE_INSPECTION; keepalive port listener
│   ├── panel.html       # Side panel shell — Inspector / URL Tools / Wayback tabs
│   ├── panel.js         # Inspector UI + URL Tools tab + sitemap crawler + tab switching
│   ├── content.js       # Injected at document_start; responds to SNAPSHOT and INSERT_TEXT messages
│   ├── rules.js         # URL routing/category pattern rules for dealer pages (SRP/VDP/specials by provider); used by URL Tools tab
│   ├── url-tool.js      # Pure pipeline functions (ut_cleanUrls, ut_classifyAll, ut_matchRedirects, etc.); depends on rules.js
│   ├── wayback-db.js    # IndexedDB wrapper (store: captures)
│   ├── wayback-panel.js # Wayback tab UI controller
│   └── pico.min.css     # Base CSS (Pico v2 dark theme)
├── wayback.db           # SQLite job history (created at runtime, gitignored)
└── screens/             # Captured PDFs if uploaded server-side (created at runtime, gitignored)
```

---

## Running

```bash
uv run python run.py
```

Server starts on **port 8081**. API key printed on every startup when `WAYBACK_API_KEY` env var is not set — set it to persist the same key across restarts.

Load the extension: `chrome://extensions` → Developer mode → Load unpacked → select `extension/`  
Open side panel: **Ctrl+Shift+S**  
Set backend URL to `http://127.0.0.1:8081` in the Wayback tab's Backend API section.

---

## API Endpoints

All V2 endpoints are under `/v2`. The root `/health` is also exposed (extension calls this for the status badge).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Liveness + Chrome reachability |
| `GET` | `/v2/health` | — | Same as above (V2 alias) |
| `POST` | `/v2/capture` | ✅ | Submit job → `{job_id, status}` (202); extension claims and executes |
| `GET` | `/v2/jobs?status=queued` | — | List jobs; `?status=queued` returns oldest first |
| `GET` | `/v2/jobs/{job_id}` | — | Job status + results |
| `POST` | `/v2/jobs/{job_id}/claim` | ✅ | Atomically claim a queued job (409 if already claimed) |
| `POST` | `/v2/jobs/{job_id}/result` | ✅ | Post one URL result (URL + filename metadata, no PDF bytes); returns `{ok, filename, file_url}` |
| `DELETE` | `/v2/jobs/{job_id}` | ✅ | Cancel active or delete terminal job + any server-side PDFs |
| `GET` | `/files/{filename}` | — | Serve PDFs from `screens/` (only populated if `pdf_data` is explicitly sent) |

### Authentication

Write endpoints require `X-API-Key` header. Key read from `WAYBACK_API_KEY` env var; generated and printed on every startup if unset.

---

## How extension capture works

### Standalone mode (no backend)
1. User clicks **Capture this page** in the Wayback tab
2. `wayback-panel.js` sends `{ type: 'WB_CAPTURE_TAB' }` to the service worker
3. `background.js` attaches `chrome.debugger` to the active tab
4. CDP: `setDeviceMetricsOverride` → scroll loop → settle delay → CSS injection → measure height → `Page.printToPDF`
5. Service worker returns `pdfBase64` (raw string — `atob()` unavailable in MV3 service workers)
6. Panel converts base64 → Blob using `atob()` (available in panel page context)
7. Stored in IndexedDB via `wayback-db.js`

### Backend mode (requires this server)
1. User pastes URLs → **Submit bulk job** → `POST /v2/capture` → `job_id`
2. Panel opens a `chrome.runtime.connect('wb-keepalive')` port to keep the service worker alive
3. Panel claims via `POST /v2/jobs/{job_id}/claim` → receives settings + URL list
4. For each URL: `{ type: 'WB_EXECUTE_CAPTURE_URL', url, settings }` → service worker opens background tab, captures, closes tab
5. Panel generates filename locally (`wbCreateCaptureFilename`), posts `{ url, filename }` to `POST /v2/jobs/{job_id}/result` (no PDF bytes — avoids Cloudflare tunnel timeouts on large files)
6. PDF stored in IndexedDB locally; job result recorded on server with filename metadata
7. Keepalive port disconnected after all URLs are processed

### Background tab scrolling fix
Background tabs have `document.hidden = true`, breaking `IntersectionObserver`-based lazy loading.
Fix in `wbCaptureTab()` after `Emulation.setEmulatedMedia`:
- `Emulation.setFocusEmulationEnabled` → treats tab as focused
- `Runtime.evaluate` overrides `document.hidden` / `document.visibilityState` to `false`/`'visible'`

### MV3 service worker keepalive
Between URL captures the service worker can be killed by Chrome. During a bulk job, the panel holds a persistent `chrome.runtime.connect({ name: 'wb-keepalive' })` port and pings it every 20 s. `background.js` registers an `onConnect` listener for this port. The port is disconnected in a `finally` block after the job completes.

---

## Extension file responsibilities

| File | Role |
|------|------|
| `manifest.json` | MV3; all permissions listed above |
| `background.js` | Service worker; message handlers for `RUN_WEBSITE_INSPECTION`, `WB_CAPTURE_TAB`, `WB_EXECUTE_CAPTURE_URL`; `wbCaptureTab()`, `wbCaptureUrl()`, CDP helpers; context menu registration (`MENU_STRUCTURE`, `TEXT_TEMPLATES`); provider detection (`PROVIDERS`, `detectProvider`); network origin tracking; keepalive port listener |
| `panel.html` | Shell; tab buttons (`data-page`); loads all scripts |
| `panel.js` | Inspector UI rendering (provider, analytics, phones, links, scripts, slugs); full URL Tools tab (clean/classify, redirect matching, sitemap crawler); `initTabs()` tab switching |
| `content.js` | Injected at `document_start`; responds to `SNAPSHOT` (page data extraction) and `INSERT_TEXT` (context menu text insertion) messages |
| `rules.js` | URL routing/category pattern rules for dealer pages (SRP/VDP/specials paths by provider); used by URL Tools tab via `RULES` global |
| `url-tool.js` | Pure pipeline functions (`ut_cleanUrls`, `ut_classifyAll`, `ut_matchRedirects`, etc.); depends on `rules.js` being loaded first |
| `wayback-db.js` | `wbDb` IIFE — `add`, `getAll`, `delete`, `clear` over IndexedDB |
| `wayback-panel.js` | Lazy-inits on first Wayback tab click; backend config, bulk capture (with keepalive + settings normalization), capture list |

### IndexedDB schema (`wayback-db.js`)
Store: `captures`. Each record: `{ id (auto), url, title, filename, timestamp, pdfBlob, size }`.

### Filename format (`wbCreateCaptureFilename`)
`[jobId[:8]-]wayback-{hostname}-{path-slug}-{date}.pdf`
- Hostname dots → hyphens; path slugified
- Job ID prefix added in backend mode to prevent collisions across jobs for the same URL

---

## Database

SQLite (`wayback.db`), created automatically, running in WAL mode for safe concurrent access. Single `jobs` table:

```sql
CREATE TABLE IF NOT EXISTS jobs (
    id       TEXT PRIMARY KEY,
    status   TEXT NOT NULL,              -- queued | running | done | cancelled | error
    results  TEXT NOT NULL DEFAULT '[]', -- JSON: [{url, filename, file_url, error}]
    settings TEXT NOT NULL DEFAULT '{}', -- JSON: capture params (snake_case keys)
    created  TEXT NOT NULL DEFAULT (datetime('now')),
    source   TEXT NOT NULL DEFAULT 'v2'  -- always 'v2' in this project
)
```

No migrations needed — fresh DB on first run with all columns present.

---

## Known limitations

- [ ] **Concurrency** — URLs captured sequentially by the extension; parallel jobs from multiple extension instances could conflict
- [ ] **pyproject.toml version pins** — dependencies have `>=` lower bounds but are not locked (no lockfile)
- [ ] **Read endpoint auth** — `/v2/jobs`, `/v2/jobs/{id}` are open; anyone with the tunnel URL can read job history
- [ ] **Rate limiting** — no throttle on `POST /v2/capture`
- [ ] **`screens/` cleanup** — no TTL or size cap on server-side PDFs (only populated if a client explicitly sends `pdf_data`)
