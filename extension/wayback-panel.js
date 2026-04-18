/* global wbDb */

let wbSelected = new Set();

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
        <button id="wb-send-bulk-btn" type="button" class="secondary">Capture all</button>
        <button id="wb-send-current-btn" type="button" class="secondary outline">Add current page</button>
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
  document.getElementById('wb-send-bulk-btn').addEventListener('click', wbSubmitBulk);
  document.getElementById('wb-send-current-btn').addEventListener('click', wbAddCurrent);
  document.getElementById('wb-download-btn').addEventListener('click', wbDownloadSelected);
  document.getElementById('wb-delete-sel-btn').addEventListener('click', wbDeleteSelected);
  document.getElementById('wb-clear-btn').addEventListener('click', wbClearAll);

  await wbRenderList();
}

function wbSetStatus(message) {
  const el = document.getElementById('wb-status');
  if (el) el.textContent = message;
}

async function wbAddCurrent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) { wbSetStatus('No active tab URL.'); return; }
  const input = document.getElementById('wb-bulk-urls');
  if (!input) return;
  const existing = input.value.trim();
  input.value = existing ? `${existing}\n${tab.url}` : tab.url;
  wbSetStatus('Added current page URL.');
}

async function wbSubmitBulk() {
  const input = document.getElementById('wb-bulk-urls');
  const urls = input?.value.split(/\r?\n/).map(u => u.trim()).filter(Boolean) || [];
  if (!urls.length) { wbSetStatus('Paste at least one URL first.'); return; }
  await wbRunCaptures(urls);
}

async function wbRunCaptures(urls) {
  const jobId = crypto.randomUUID();
  const captureSettings = {
    width: 1920, height: 1080,
    scrollInterval: 600, maxScrolls: null,
    delaySettle: 3000, customCss: '',
  };

  const bulkBtn    = document.getElementById('wb-send-bulk-btn');
  const currentBtn = document.getElementById('wb-send-current-btn');
  if (bulkBtn)    bulkBtn.disabled    = true;
  if (currentBtn) currentBtn.disabled = true;

  const keepalive = chrome.runtime.connect({ name: 'wb-keepalive' });
  const ping = setInterval(() => keepalive.postMessage('ping'), 20000);

  let done = 0;
  try {
    for (const url of urls) {
      wbSetStatus(`Capturing ${done + 1} / ${urls.length}: ${url}`);
      try {
        const capture = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: 'WB_EXECUTE_CAPTURE_URL', url, settings: captureSettings },
            r => {
              if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
              resolve(r);
            }
          );
        });
        if (!capture?.ok) throw new Error(capture?.error || 'Capture failed');
        const filename = wbCreateCaptureFilename(url, jobId);
        await wbSaveCaptureFromResponse(capture, url, url, filename);
        await wbRenderList();
      } catch (err) {
        console.warn('Capture failed for', url, err.message);
        wbSetStatus(`Failed: ${url} — ${String(err.message).slice(0, 100)}`);
      }
      done++;
    }
    wbSetStatus(`Done — ${done} of ${urls.length} captured.`);
  } finally {
    clearInterval(ping);
    keepalive.disconnect();
    if (bulkBtn)    bulkBtn.disabled    = false;
    if (currentBtn) currentBtn.disabled = false;
  }

  await wbRenderList();
}

async function wbCapture() {
  const btn = document.getElementById('wb-capture-btn');
  btn.disabled = true;
  wbSetStatus('Capturing…');

  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: 'WB_CAPTURE_TAB', settings: {} });
  } catch (e) {
    wbSetStatus(`Error: ${e.message}`);
    btn.disabled = false;
    return;
  }

  if (!response?.ok) {
    wbSetStatus(`Error: ${response?.error || 'Unknown error'}`);
    btn.disabled = false;
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url      = tab?.url   || 'unknown';
  const title    = tab?.title || url;
  const filename = wbCreateCaptureFilename(url);

  await wbSaveCaptureFromResponse(response, url, title, filename);
  wbSetStatus(`Captured — ${(response.size / 1024 / 1024).toFixed(1)} MB`);
  btn.disabled = false;
  await wbRenderList();
}

async function wbSaveCaptureFromResponse(response, url, title, filename) {
  const binary = atob(response.pdfBase64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

  await wbDb.add({
    url, title, filename,
    timestamp: new Date().toISOString(),
    pdfBlob,
    size: response.size || pdfBlob.size,
  });
}

function wbCreateCaptureFilename(url, jobId = '') {
  try {
    const parsed   = new URL(url);
    const host     = parsed.hostname.replace(/\./g, '-');
    const pathSlug = parsed.pathname
      .replace(/\/+/g, '-').replace(/(^-|-$)/g, '')
      .replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-')
      .toLowerCase();
    const slug   = pathSlug || 'page';
    const date   = new Date().toISOString().slice(0, 10);
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
      if (e.target.checked) wbSelected.add(c.id); else wbSelected.delete(c.id);
      wbUpdateActions();
    });
    row.querySelector('[data-action="open"]').addEventListener('click',     () => wbOpenCapture(c.id));
    row.querySelector('[data-action="download"]').addEventListener('click', () => wbDownloadCapture(c.id));
    row.querySelector('[data-action="delete"]').addEventListener('click',   async () => { await wbDb.delete(c.id); await wbRenderList(); });
    list.appendChild(row);
  }
}

function wbUpdateActions() {
  const el  = document.getElementById('wb-actions');
  const btn = document.getElementById('wb-download-btn');
  if (el)  el.style.display = wbSelected.size > 0 ? '' : 'none';
  if (btn) btn.textContent  = `Download selected (${wbSelected.size})`;
}

async function wbDownloadSelected() {
  const captures = await wbDb.getAll();
  for (const c of captures) {
    if (wbSelected.has(c.id)) await wbDownloadCapture(c.id);
  }
}

async function wbOpenCapture(id) {
  const capture = (await wbDb.getAll()).find(c => c.id === id);
  if (!capture) return;
  const url = URL.createObjectURL(capture.pdfBlob);
  try {
    window.open(url, '_blank');
    await new Promise(r => setTimeout(r, 0));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function wbDownloadCapture(id) {
  const capture = (await wbDb.getAll()).find(c => c.id === id);
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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.page-tab').forEach(tab => {
    if (tab.dataset.page === 'wayback') {
      tab.addEventListener('click', () => {
        if (!document.getElementById('wb-capture-btn')) wbInit();
      });
    }
  });
});
