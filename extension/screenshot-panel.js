'use strict';

(function initScreenshotPanel() {
  // State
  let running   = false;
  let cancelled = false;
  const captures = [];

  // Tab helpers

  function wbRemoveTab(tabId) {
    return chrome.tabs.remove(tabId).catch(() => {});
  }

  function wbWaitForTabLoad(tabId, timeoutMs = 120_000) {
    return new Promise((resolve, reject) => {
      chrome.tabs.get(tabId, tab => {
        if (!chrome.runtime.lastError && tab.status === 'complete') { resolve(); return; }
      });

      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, timeoutMs);

      function listener(id, info) {
        if (id === tabId && info.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  function urlToFilename(urlStr) {
    try {
      const u = new URL(urlStr);
      return (u.hostname + u.pathname)
        .replace(/\/+$/, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100) + '.png';
    } catch {
      return 'screenshot.png';
    }
  }

  // Wake up SW then send screenshot message

  async function doScreenshot(tabId, url) {
    const wakePort = chrome.runtime.connect({ name: 'wb-wakeup' });
    await new Promise(r => setTimeout(r, 100));

    const result = await new Promise(resolve => {
      chrome.runtime.sendMessage(
        { type: 'WB_SCREENSHOT_TABID', tabId, url },
        response => {
          const err = chrome.runtime.lastError;
          resolve(response || { ok: false, url, error: err?.message || 'No response from background' });
        }
      );
    });

    wakePort.disconnect();
    return result;
  }

  // Load batch delay from storage

  function loadBatchDelayMs() {
    return new Promise(resolve => {
      chrome.storage.sync.get({ screenshotBatchDelayMs: 500 }, ({ screenshotBatchDelayMs }) => {
        resolve(screenshotBatchDelayMs);
      });
    });
  }

  // UI helpers

  function setStatus(msg) { el('wb-status').textContent = msg; }

  function updateProgress(done, total) {
    el('wb-progress').textContent = total > 1 ? `${done} / ${total}` : '';
  }

  function successCount() { return captures.filter(c => c.ok !== false).length; }

  // Returns captures whose row checkbox is checked
  function selectedPool() {
    return captures.filter(c => c.ok !== false && c._rowEl?.querySelector('.wb-row-check')?.checked);
  }

  // Sync the "All" header checkbox state to match individual row checkboxes
  function syncSelectAll() {
    const checks  = Array.from(document.querySelectorAll('.wb-row-check'));
    const allOn   = checks.length > 0 && checks.every(cb => cb.checked);
    const someOn  = checks.some(cb => cb.checked);
    const hdr     = el('wb-select-all');
    hdr.checked       = allOn;
    hdr.indeterminate = !allOn && someOn;
  }

  function setRunning(on) {
    running = on;
    el('wb-start-btn').disabled        = on;
    el('wb-cancel-btn').classList.toggle('hidden', !on);
    const hasCaptures = successCount() > 0;
    el('wb-download-all-btn').disabled = on || !hasCaptures;
    el('wb-zip-btn').disabled          = on || !hasCaptures;
  }

  function addResultRow(capture) {
    captures.push(capture);
    const hasCaptures = successCount() > 0;
    el('wb-download-all-btn').disabled = !hasCaptures;
    el('wb-zip-btn').disabled          = !hasCaptures;

    const list = el('wb-results');
    const row  = document.createElement('div');
    row.className  = 'wb-result-row';
    capture._rowEl = row;

    if (capture.ok === false) {
      row.innerHTML = `
        <div class="wb-result-info">
          <div class="wb-result-url" title="${capture.url}">${capture.url}</div>
          <div style="font-size:0.75rem;color:var(--pico-del-color,#f44336)">Failed: ${capture.error || 'unknown error'}</div>
        </div>
      `;
      list.appendChild(row);
      return;
    }

    // Row checkbox — visible by default, checked by default
    const cb = document.createElement('input');
    cb.type      = 'checkbox';
    cb.checked   = true;
    cb.className = 'wb-row-check';
    cb.style.cssText = 'margin:0 0.4rem 0 0;align-self:center;flex-shrink:0';
    cb.addEventListener('change', syncSelectAll);

    const img = document.createElement('img');
    img.className = 'wb-thumb';
    img.src       = 'data:image/png;base64,' + capture.screenshotBase64;
    img.alt       = '';
    img.loading   = 'lazy';

    const info = document.createElement('div');
    info.className = 'wb-result-info';
    info.innerHTML = `<div class="wb-result-url" title="${capture.url}">${capture.url}</div>`;

    row.appendChild(cb);
    row.appendChild(img);
    row.appendChild(info);
    list.appendChild(row);

    syncSelectAll();
  }

  function downloadCapture(capture) {
    Object.assign(document.createElement('a'), {
      href:     'data:image/png;base64,' + capture.screenshotBase64,
      download: urlToFilename(capture.url),
    }).click();
  }

  function downloadSelected() {
    selectedPool().forEach((c, i) => setTimeout(() => downloadCapture(c), i * 150));
  }

  async function downloadZip() {
    const pool = selectedPool();
    if (!pool.length) return;

    el('wb-zip-btn').disabled = true;
    setStatus('Building ZIP…');

    const zip = new JSZip(); // eslint-disable-line no-undef
    for (const c of pool) {
      zip.file(urlToFilename(c.url), c.screenshotBase64, { base64: true });
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'screenshots.zip' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    setStatus('');
    el('wb-zip-btn').disabled = successCount() === 0;
  }

  // Core capture — single (active tab) or batch (URL list in a new window)

  async function runCapture() {
    const raw  = el('wb-url-input').value.trim();
    const urls = raw ? raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean) : [];
    const isBatch = urls.length > 0;

    setRunning(true);
    cancelled = false;
    el('wb-results').innerHTML = '';
    captures.length = 0;
    el('wb-select-all').checked       = true;
    el('wb-select-all').indeterminate = false;
    updateProgress(0, urls.length);

    if (!isBatch) {
      setStatus('Capturing current tab…');
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab found.');
        const url = tab.url || '';
        const result = await doScreenshot(tab.id, url);
        addResultRow({ ...result, url });
        setStatus(result.ok ? 'Done.' : '');
      } catch (err) {
        setStatus('Error: ' + String(err));
      }
      setRunning(false);
      return;
    }

    // Batch mode — isolated minimized window
    const batchDelayMs = await loadBatchDelayMs();

    let captureWinId = null;
    try {
      const win = await chrome.windows.create({ focused: false, state: 'minimized' });
      captureWinId = win.id;
    } catch {
      // Fallback: open tabs in current window
    }

    for (let i = 0; i < urls.length; i++) {
      if (cancelled) break;

      if (i > 0 && batchDelayMs > 0) {
        await new Promise(r => setTimeout(r, batchDelayMs));
      }

      const url = urls[i];
      setStatus(`Capturing ${i + 1} of ${urls.length}…`);
      updateProgress(i, urls.length);

      let tabId = null;
      try {
        const tabOpts = { url, active: false };
        if (captureWinId !== null) tabOpts.windowId = captureWinId;
        const tab = await chrome.tabs.create(tabOpts);
        tabId = tab.id;
        await wbWaitForTabLoad(tabId);
        const result = await doScreenshot(tabId, url);
        addResultRow({ ...result, url });
      } catch (err) {
        addResultRow({ ok: false, url, error: String(err) });
      } finally {
        if (tabId !== null) await wbRemoveTab(tabId);
      }
    }

    if (captureWinId !== null) {
      chrome.windows.remove(captureWinId).catch(() => {});
    }

    updateProgress(captures.length, urls.length);
    const ok = successCount();
    setStatus(cancelled
      ? `Cancelled. ${ok} screenshot(s) captured.`
      : `Done. ${ok} screenshot(s) captured.`
    );
    setRunning(false);
  }

  // Init

  document.addEventListener('DOMContentLoaded', () => {
    el('wb-start-btn').addEventListener('click', runCapture);

    el('wb-cancel-btn').addEventListener('click', () => {
      cancelled = true;
      setStatus('Cancelling…');
    });

    el('wb-download-all-btn').addEventListener('click', () => {
      if (successCount() === 0) return;
      downloadSelected();
    });

    el('wb-zip-btn').addEventListener('click', () => {
      if (successCount() === 0) return;
      downloadZip();
    });

    // "All" header checkbox — check or uncheck every row
    el('wb-select-all').addEventListener('change', () => {
      const checked = el('wb-select-all').checked;
      document.querySelectorAll('.wb-row-check').forEach(cb => { cb.checked = checked; });
    });
  });
})();
