/* global wbDb */

const WB_STORAGE_KEYS = {
  apiBase: 'wbApiBase',
  apiKey:  'wbApiKey',
};

let wbSelected = new Set(); // Set<id>
let wbBackendConfig = { apiBase: '', apiKey: '' };

async function wbInit() {
  const container = document.getElementById('page-wayback');
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom:1rem">
      <small id="wb-status">Ready.</small>
      <button id="wb-capture-btn" type="button" style="margin:0; width:auto">Capture this page</button>
    </div>

    <article>
      <header style="margin-bottom:0.75rem"><strong>Bulk capture</strong></header>
      <textarea id="wb-bulk-urls" placeholder="Paste URLs — one per line…" aria-label="Bulk URLs" rows="4" spellcheck="false"></textarea>
      <div role="group">
        <button id="wb-send-bulk-btn" type="button" class="secondary">Submit bulk job</button>
        <button id="wb-send-current-backend-btn" type="button" class="secondary outline">Send current page</button>
      </div>
    </article>

    <div id="wb-list" style="margin-bottom:0.75rem"></div>
    <div role="group" id="wb-actions" style="display:none; margin-bottom:0.5rem">
      <button id="wb-download-btn" type="button" class="secondary">Download selected</button>
      <button id="wb-delete-sel-btn" type="button" class="secondary outline">Delete selected</button>
    </div>
    <button id="wb-clear-btn" type="button" class="secondary outline" style="width:100%; margin:0">Delete all</button>
  `;

  document.getElementById('wb-capture-btn').addEventListener('click', wbCapture);
  document.getElementById('wb-send-bulk-btn').addEventListener('click', wbSubmitBulkToBackend);
  document.getElementById('wb-send-current-backend-btn').addEventListener('click', wbSubmitCurrentToBackend);
  document.getElementById('wb-download-btn').addEventListener('click', wbDownloadSelected);
  document.getElementById('wb-delete-sel-btn').addEventListener('click', wbDeleteSelected);
  document.getElementById('wb-clear-btn').addEventListener('click', wbClearAll);

  await wbRenderList();
}

async function wbLoadBackendConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get([WB_STORAGE_KEYS.apiBase, WB_STORAGE_KEYS.apiKey], data => {
      wbBackendConfig.apiBase = data[WB_STORAGE_KEYS.apiBase] || '';
      wbBackendConfig.apiKey  = data[WB_STORAGE_KEYS.apiKey]  || '';
      const apiBaseInput = document.getElementById('api-base-input');
      const apiKeyInput  = document.getElementById('api-key-input');
      if (apiBaseInput) apiBaseInput.value = wbBackendConfig.apiBase;
      if (apiKeyInput)  apiKeyInput.value  = wbBackendConfig.apiKey;
      resolve();
    });
  });
}

async function wbSaveBackendConfig() {
  wbBackendConfig.apiBase = document.getElementById('api-base-input')?.value.trim() || '';
  wbBackendConfig.apiKey  = document.getElementById('api-key-input')?.value.trim() || '';
  await new Promise(resolve => chrome.storage.sync.set({
    [WB_STORAGE_KEYS.apiBase]: wbBackendConfig.apiBase,
    [WB_STORAGE_KEYS.apiKey]: wbBackendConfig.apiKey,
  }, resolve));
  await wbUpdateBackendStatus();
}

function wbSetStatus(message) {
  const status = document.getElementById('wb-status');
  if (status) status.textContent = message;
}

function wbSetBackendStatus(message, healthy = false) {
  const dot  = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  if (dot)  { dot.style.background = healthy ? '#86efac' : '#fda4af'; dot.title = message; }
  if (text) { text.textContent = message; text.style.color = healthy ? '#86efac' : '#fda4af'; }
}

function wbNormalizeApiBase(base) {
  return base.replace(/\/+$/g, '');
}

async function wbFetch(path, opts = {}) {
  const apiBase = wbNormalizeApiBase(wbBackendConfig.apiBase || '');
  if (!apiBase) throw new Error('Backend API base URL is not configured.');
  const url = apiBase + path;
  const headers = opts.headers || {};
  if (wbBackendConfig.apiKey) headers['X-API-Key'] = wbBackendConfig.apiKey;
  if (opts.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
  }
  return res;
}

async function wbUpdateBackendStatus() {
  const apiBase = wbBackendConfig.apiBase.trim();
  if (!apiBase) {
    wbSetBackendStatus('Not configured', false);
    return;
  }
  try {
    await wbFetch('/health');
    wbSetBackendStatus(`OK: ${apiBase}`, true);
  } catch (err) {
    wbSetBackendStatus(`Error: ${err.message}`, false);
  }
}

async function wbTestBackend() {
  wbSetBackendStatus('Testing…', false);
  await wbUpdateBackendStatus();
}

async function wbSubmitCurrentToBackend() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    wbSetStatus('No active tab URL available.');
    return;
  }
  await wbSubmitToBackend([tab.url]);
}

async function wbSubmitBulkToBackend() {
  const input = document.getElementById('wb-bulk-urls');
  const urls = input?.value.split(/\r?\n/).map(u => u.trim()).filter(Boolean) || [];
  if (!urls.length) {
    wbSetStatus('Paste at least one URL first.');
    return;
  }
  await wbSubmitToBackend(urls);
}

async function wbSubmitToBackend(urls) {
  wbSetStatus('Submitting job to local backend...');
  try {
    const res = await wbFetch('/v2/capture', {
      method: 'POST',
      body: JSON.stringify({ urls }),
    });
    const data = await res.json().catch(() => { throw new Error('Invalid response from backend'); });
    wbSetStatus(`Capturing ${urls.length} URL(s)…`);
    await wbExecuteV2Job(data.job_id);
    wbSetStatus(`Job complete: ${data.job_id}`);
    await wbRenderList();
  } catch (error) {
    wbSetStatus(`Backend submit failed: ${error.message}`);
  }
}

async function wbExecuteV2Job(jobId) {
  const claimRes = await wbFetch(`/v2/jobs/${jobId}/claim`, { method: 'POST' });
  const jobData = await claimRes.json().catch(() => { throw new Error('Invalid claim response'); });
  const raw = jobData.settings || {};
  const urls = raw.urls || [];

  // Backend stores settings in snake_case; wbCaptureTab destructures camelCase.
  const captureSettings = {
    width:          raw.width           ?? 1920,
    height:         raw.height          ?? 1080,
    scrollInterval: raw.scroll_interval ?? 600,
    maxScrolls:     raw.max_scrolls     ?? null,
    delaySettle:    raw.delay_settle    ?? 3000,
    customCss:      raw.custom_css      ?? '',
  };

  // Hold a port connection to prevent the MV3 service worker from being killed
  // mid-capture. Ping every 20 s to keep the channel active.
  const keepalive = chrome.runtime.connect({ name: 'wb-keepalive' });
  const keepalivePing = setInterval(() => keepalive.postMessage('ping'), 20000);

  try {
    for (const url of urls) {
      wbSetStatus(`Capturing ${url} ...`);
      try {
        const capture = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: 'WB_EXECUTE_CAPTURE_URL', url, settings: captureSettings },
            response => {
              if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
              resolve(response);
            }
          );
        });
        if (!capture || !capture.ok) {
          throw new Error(capture?.error || 'Capture failed');
        }
        // Generate filename locally — don't upload the PDF blob through the tunnel.
        // The PDF is already stored in IndexedDB; the backend just needs the metadata.
        const filename = wbCreateCaptureFilename(url, jobId);
        await wbPostV2Result(jobId, { url, filename });
        await wbSaveCaptureFromResponse(capture, url, url, filename);
        await wbRenderList();
      } catch (captureErr) {
        // Truncate the error message so a large HTML error page (e.g. Cloudflare 524)
        // doesn't itself cause another timeout on the report POST.
        const errMsg = String(captureErr.message).slice(0, 200);
        try {
          await wbPostV2Result(jobId, { url, error: errMsg });
        } catch (reportErr) {
          console.error('Failed to report capture error:', reportErr);
        }
      }
    }
  } finally {
    clearInterval(keepalivePing);
    keepalive.disconnect();
  }

  await wbRenderList();
}

async function wbPostV2Result(jobId, payload) {
  const res = await wbFetch(`/v2/jobs/${jobId}/result`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await res.json();
}

async function wbCapture() {
  const btn    = document.getElementById('wb-capture-btn');
  const status = document.getElementById('wb-status');
  btn.disabled = true;
  status.textContent = 'Capturing…';

  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: 'WB_CAPTURE_TAB', settings: {} });
  } catch (e) {
    status.textContent = `Error: ${e.message}`;
    btn.disabled = false;
    return;
  }

  if (!response || !response.ok) {
    status.textContent = `Error: ${response?.error || 'Unknown error'}`;
    btn.disabled = false;
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || 'unknown';
  const title = tab?.title || url;
  const filename = wbCreateCaptureFilename(url);

  await wbSaveCaptureFromResponse(response, url, title, filename);

  status.textContent = `Captured — ${(response.size / 1024 / 1024).toFixed(1)} MB`;
  btn.disabled = false;
  await wbRenderList();
}

async function wbSaveCaptureFromResponse(response, url, title, filename) {
  const binary = atob(response.pdfBase64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

  await wbDb.add({
    url,
    title,
    filename,
    timestamp: new Date().toISOString(),
    pdfBlob,
    size: response.size || pdfBlob.size,
  });
}

function wbCreateCaptureFilename(url, jobId = '') {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/\./g, '-');
    const pathSlug = parsed.pathname
      .replace(/\/+/g, '-')
      .replace(/(^-|-$)/g, '')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    const slug = pathSlug || 'page';
    const date = new Date().toISOString().slice(0, 10);
    const prefix = jobId ? `${jobId.slice(0, 8)}-` : '';
    return `${prefix}wayback-${host}-${slug}-${date}.pdf`;
  } catch {
    const prefix = jobId ? `${jobId.slice(0, 8)}-` : '';
    return `${prefix}wayback-${new Date().toISOString().slice(0, 10)}.pdf`;
  }
}

async function wbRenderList() {
  const captures = await wbDb.getAll();
  const list = document.getElementById('wb-list');
  if (!list) return;
  wbSelected.clear();
  wbUpdateActions();

  if (!captures.length) {
    list.innerHTML = '<small style="color:var(--pico-muted-color)">No captures yet.</small>';
    return;
  }

  list.innerHTML = '';
  for (const c of captures) {
    const sizeMb  = (c.size / 1024 / 1024).toFixed(1);
    const dateStr = new Date(c.timestamp).toLocaleString();
    const label   = c.filename || wbCreateCaptureFilename(c.url);
    const row = document.createElement('article');
    row.style.cssText = 'padding:0.6rem 0.75rem; margin-bottom:0.4rem';
    row.innerHTML = `
      <div style="display:grid; grid-template-columns:auto 1fr auto; gap:0.5rem; align-items:start">
        <input type="checkbox" data-id="${c.id}" aria-label="Select" style="margin:0.15rem 0 0">
        <div style="min-width:0">
          <div style="font-size:0.82rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escHtml(c.title)}</div>
          <small style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:0.65">${escHtml(label)}</small>
          <small style="opacity:0.45">${dateStr} · ${sizeMb} MB</small>
        </div>
        <div style="display:flex; gap:0.2rem; flex-shrink:0">
          <button type="button" class="secondary outline" data-action="open"     title="Open"     style="padding:0.2rem 0.45rem; margin:0; font-size:0.72rem">↗</button>
          <button type="button" class="secondary outline" data-action="download" title="Download" style="padding:0.2rem 0.45rem; margin:0; font-size:0.72rem">↓</button>
          <button type="button" class="secondary outline" data-action="delete"   title="Delete"   style="padding:0.2rem 0.45rem; margin:0; font-size:0.72rem">✕</button>
        </div>
      </div>
    `;
    row.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) wbSelected.add(c.id);
      else wbSelected.delete(c.id);
      wbUpdateActions();
    });
    row.querySelector('[data-action="open"]').addEventListener('click', () => wbOpenCapture(c.id));
    row.querySelector('[data-action="download"]').addEventListener('click', () => wbDownloadCapture(c.id));
    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      await wbDb.delete(c.id);
      await wbRenderList();
    });
    list.appendChild(row);
  }
}

function wbUpdateActions() {
  const el = document.getElementById('wb-actions');
  if (el) el.style.display = wbSelected.size > 0 ? '' : 'none';
  const btn = document.getElementById('wb-download-btn');
  if (btn) btn.textContent = `Download selected (${wbSelected.size})`;
}

async function wbDownloadSelected() {
  const captures = await wbDb.getAll();
  for (const c of captures) {
    if (!wbSelected.has(c.id)) continue;
    await wbDownloadCapture(c.id);
  }
}

async function wbOpenCapture(id) {
  const captures = await wbDb.getAll();
  const capture = captures.find(c => c.id === id);
  if (!capture) return;
  const url = URL.createObjectURL(capture.pdfBlob);
  try {
    window.open(url, '_blank');
    // Revoke after a tick — the tab has the URL, we no longer need the reference
    await new Promise(r => setTimeout(r, 0));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function wbDownloadCapture(id) {
  const captures = await wbDb.getAll();
  const capture = captures.find(c => c.id === id);
  if (!capture) return;
  const url = URL.createObjectURL(capture.pdfBlob);
  try {
    const filename = capture.filename || wbCreateCaptureFilename(capture.url);
    await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs: false }, downloadId => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(downloadId);
      });
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function wbDeleteSelected() {
  for (const id of wbSelected) await wbDb.delete(id);
  await wbRenderList();
}

async function wbClearAll() {
  await wbDb.clear();
  await wbRenderList();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
  // Global API config panel
  const configBtn = document.getElementById('api-config-btn');
  const configPanel = document.getElementById('api-config-panel');
  if (configBtn && configPanel) {
    configBtn.addEventListener('click', () => {
      configPanel.style.display = configPanel.style.display === 'none' ? '' : 'none';
    });
    document.getElementById('api-save-btn')?.addEventListener('click', wbSaveBackendConfig);
    document.getElementById('api-test-btn')?.addEventListener('click', wbTestBackend);
  }

  // Load config + probe backend immediately on open
  wbLoadBackendConfig().then(() => wbUpdateBackendStatus());

  // Lazy-init Wayback tab
  document.querySelectorAll('.page-tab').forEach(tab => {
    if (tab.dataset.page === 'wayback') {
      tab.addEventListener('click', () => {
        if (!document.getElementById('wb-capture-btn')) wbInit();
      });
    }
  });
});
