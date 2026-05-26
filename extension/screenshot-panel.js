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

  async function doScreenshot(tabId, url, includeMeta) {
    const wakePort = chrome.runtime.connect({ name: 'wb-wakeup' });
    await new Promise(r => setTimeout(r, 100));

    const result = await new Promise(resolve => {
      chrome.runtime.sendMessage(
        { type: 'WB_SCREENSHOT_TABID', tabId, url, includeMeta },
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

  function setRunning(on) {
    running = on;
    el('wb-start-btn').disabled = on;
    el('wb-cancel-btn').classList.toggle('hidden', !on);
    el('wb-download-all-btn').disabled = captures.filter(c => c.ok !== false).length === 0;
  }

  function addResultRow(capture) {
    captures.push(capture);
    el('wb-download-all-btn').disabled = captures.filter(c => c.ok !== false).length === 0;

    const list = el('wb-results');
    const row  = document.createElement('div');
    row.className = 'wb-result-row';

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

    const img = document.createElement('img');
    img.className = 'wb-thumb';
    img.src       = 'data:image/png;base64,' + capture.screenshotBase64;
    img.alt       = '';
    img.loading   = 'lazy';

    const info = document.createElement('div');
    info.className = 'wb-result-info';

    let metaHtml = '';
    if (capture.metadata) {
      const { title, description, h1 } = capture.metadata;
      metaHtml = `
        <div class="wb-meta">
          ${title       ? `<div><span class="wb-meta-label">Title</span> ${title}</div>` : ''}
          ${h1          ? `<div><span class="wb-meta-label">H1</span> ${h1}</div>` : ''}
          ${description ? `<div><span class="wb-meta-label">Desc</span> ${description}</div>` : ''}
        </div>
      `;
    }

    info.innerHTML = `
      <div class="wb-result-url" title="${capture.url}">${capture.url}</div>
      ${metaHtml}
    `;

    const dlBtn = document.createElement('button');
    dlBtn.type        = 'button';
    dlBtn.className   = 'outline secondary pico-btn-sm wb-dl-btn';
    dlBtn.textContent = 'Download';
    dlBtn.addEventListener('click', () => downloadCapture(capture));

    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(dlBtn);
    list.appendChild(row);
  }

  function downloadCapture(capture) {
    Object.assign(document.createElement('a'), {
      href:     'data:image/png;base64,' + capture.screenshotBase64,
      download: capture.filename,
    }).click();
  }

  function downloadAll() {
    captures.filter(c => c.ok !== false).forEach((c, i) => {
      setTimeout(() => downloadCapture(c), i * 150);
    });
  }

  // Core capture — single (active tab) or batch (URL list in a new window)

  async function runCapture() {
    const raw = el('wb-url-input').value.trim();
    const urls = raw ? raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean) : [];
    const includeMeta = el('wb-include-meta').checked;
    const isBatch = urls.length > 0;

    setRunning(true);
    cancelled = false;
    el('wb-results').innerHTML = '';
    captures.length = 0;
    updateProgress(0, urls.length);

    if (!isBatch) {
      // Single mode: capture active tab
      setStatus('Capturing current tab…');
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab found.');
        const url = tab.url || '';
        const result = await doScreenshot(tab.id, url, includeMeta);
        addResultRow({ ...result, url, filename: urlToFilename(url) });
        setStatus(result.ok ? 'Done.' : '');
      } catch (err) {
        setStatus('Error: ' + String(err));
      }
      setRunning(false);
      return;
    }

    // Batch mode: open a dedicated capture window so captures don't pollute the current window
    const batchDelayMs = await loadBatchDelayMs();

    let captureWinId = null;
    try {
      const win = await chrome.windows.create({ focused: false, state: 'minimized' });
      captureWinId = win.id;
    } catch {
      // Fallback: no dedicated window — tabs will open in current window
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
        const result = await doScreenshot(tabId, url, includeMeta);
        addResultRow({ ...result, url, filename: urlToFilename(url) });
      } catch (err) {
        addResultRow({ ok: false, url, error: String(err) });
      } finally {
        if (tabId !== null) await wbRemoveTab(tabId);
      }
    }

    // Clean up the capture window
    if (captureWinId !== null) {
      chrome.windows.remove(captureWinId).catch(() => {});
    }

    updateProgress(captures.length, urls.length);
    const ok = captures.filter(c => c.ok !== false).length;
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
      if (captures.filter(c => c.ok !== false).length === 0) return;
      downloadAll();
    });
  });
})();
