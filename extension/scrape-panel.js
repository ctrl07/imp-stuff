let scResults  = [];
let scSelected = new Set();

function scInit() {
  const container = document.getElementById('page-scrape');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.9rem">
      <small id="sc-status" style="color:#94a3b8;font-size:0.85rem">Ready.</small>
    </div>

    <section class="copy-block">
      <strong>Seed URLs</strong>
      <textarea id="sc-bulk-urls" placeholder="Paste URLs — one per line…" aria-label="Seed URLs" spellcheck="false"
        class="tool-textarea" style="min-height:88px"></textarea>
    </section>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;font-size:0.82rem;margin-bottom:0.8rem">
      <div>
        <strong style="display:block;margin-bottom:0.3rem;font-size:0.9rem">Extract</strong>
        <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;margin-bottom:0.3rem">
          <input type="checkbox" id="sc-extract-title" checked> Title
        </label>
        <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;margin-bottom:0.3rem">
          <input type="checkbox" id="sc-extract-description" checked> Description
        </label>
        <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;margin-bottom:0.3rem">
          <input type="checkbox" id="sc-extract-h1" checked> H1
        </label>
        <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer">
          <input type="checkbox" id="sc-extract-links" checked> Links
        </label>
      </div>

      <div>
        <strong style="display:block;margin-bottom:0.3rem;font-size:0.9rem">Options</strong>
        <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;margin-bottom:0.3rem">
          Depth
          <input type="number" id="sc-max-depth" value="0" min="0" max="10" step="1"
            title="0 = seed URLs only; 1+ = follow links"
            style="width:3rem;padding:0.18rem 0.3rem;font-size:0.82rem;background:rgba(255,255,255,0.07);
                   border:none;border-radius:0.3rem;color:#e2e8f0">
        </label>
        <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;margin-bottom:0.3rem">
          Wait
          <input type="number" id="sc-wait-ms" value="4000" min="0" step="500"
            style="width:4rem;padding:0.18rem 0.3rem;font-size:0.82rem;background:rgba(255,255,255,0.07);
                   border:none;border-radius:0.3rem;color:#e2e8f0"> ms
        </label>
        <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer">
          Parallel
          <input type="number" id="sc-concurrency" value="3" min="1" max="8" step="1"
            style="width:3rem;padding:0.18rem 0.3rem;font-size:0.82rem;background:rgba(255,255,255,0.07);
                   border:none;border-radius:0.3rem;color:#e2e8f0">
        </label>
      </div>
    </div>

    <section class="copy-block">
      <strong>Custom Selectors</strong>
      <small style="display:block;margin-bottom:0.4rem;opacity:0.7">Optional. Extract additional content by CSS selectors (comma-separated):</small>
      <input id="sc-custom-selectors" type="text" placeholder="e.g., .product-name, #main-content"
        style="display:block;width:100%;box-sizing:border-box;padding:0.45rem 0.6rem;font-size:0.82rem;
               background:rgba(255,255,255,0.07);border:none;border-radius:0.4rem;color:#e2e8f0;margin-bottom:0.4rem">
    </section>

    <div style="display:flex;gap:0.4rem;margin-bottom:0.8rem">
      <button id="sc-submit-btn" type="button">Start crawl</button>
      <button id="sc-cancel-btn" type="button" style="display:none">Cancel</button>
    </div>

    <div id="sc-results-wrap" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap;gap:0.3rem;padding-bottom:0.5rem;border-bottom:1px solid rgba(255,255,255,0.08)">
        <strong id="sc-results-label">Results</strong>
        <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
          <button id="sc-select-all-btn" class="copy-all-btn">Select all</button>
          <button id="sc-copy-csv-btn" class="copy-all-btn" style="display:none">Export CSV</button>
          <button id="sc-copy-tsv-btn" class="copy-all-btn" style="display:none">Copy TSV</button>
          <button id="sc-copy-selected-csv-btn" class="copy-all-btn" style="display:none">Export selected</button>
        </div>
      </div>
      <div id="sc-results-table" style="max-height:350px;overflow-y:auto"></div>
    </div>
  `;

  document.getElementById('sc-submit-btn').addEventListener('click', scSubmit);
  document.getElementById('sc-cancel-btn').addEventListener('click', scCancel);
  document.getElementById('sc-copy-csv-btn').addEventListener('click', () => scExportCsv(false));
  document.getElementById('sc-copy-tsv-btn').addEventListener('click', () => scCopyTsv(false));
  document.getElementById('sc-copy-selected-csv-btn').addEventListener('click', () => scExportCsv(true));
  document.getElementById('sc-select-all-btn').addEventListener('click', scSelectAll);
}

let scCancelFlag = false;

function scSetStatus(msg) {
  const el = document.getElementById('sc-status');
  if (el) el.textContent = msg;
}

function scCancel() {
  scCancelFlag = true;
  scSetStatus('Cancelling…');
}

async function scSubmit() {
  const input    = document.getElementById('sc-bulk-urls');
  const seedUrls = input?.value.split(/\r?\n/).map(u => u.trim()).filter(Boolean) || [];
  if (!seedUrls.length) { scSetStatus('Paste at least one seed URL.'); return; }

  const customSelectors = document.getElementById('sc-custom-selectors')?.value
    ?.split(',')
    .map(s => s.trim())
    .filter(Boolean) || [];

  const settings = {
    extract_title: document.getElementById('sc-extract-title')?.checked ?? true,
    extract_description: document.getElementById('sc-extract-description')?.checked ?? true,
    extract_h1: document.getElementById('sc-extract-h1')?.checked ?? true,
    extract_links: document.getElementById('sc-extract-links')?.checked ?? true,
    custom_selectors: customSelectors,
    wait_ms:       parseInt(document.getElementById('sc-wait-ms')?.value || '4000', 10),
    max_depth:     parseInt(document.getElementById('sc-max-depth')?.value || '0', 10),
    concurrency:   parseInt(document.getElementById('sc-concurrency')?.value || '3', 10),
  };

  const submitBtn = document.getElementById('sc-submit-btn');
  const cancelBtn = document.getElementById('sc-cancel-btn');
  if (submitBtn) submitBtn.disabled = true;
  if (cancelBtn) cancelBtn.style.display = '';
  scCancelFlag = false;
  scResults  = [];
  scSelected = new Set();
  scRenderTable();

  // Crawl-check: single seed URL that matches the active tab → reuse it
  let reuseTabId = null;
  if (seedUrls.length === 1) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const norm = u => { try { const p = new URL(u); return p.origin + p.pathname.replace(/\/+$/, ''); } catch { return u; } };
        if (norm(tab.url) === norm(seedUrls[0])) reuseTabId = tab.id;
      }
    } catch (_) {}
  }

  try {
    scSetStatus('Starting crawl…');
    await scCrawl(seedUrls, settings, reuseTabId);
    scSetStatus(`Done — ${scResults.length} pages scraped.`);
  } catch (err) {
    scSetStatus(`Error: ${err.message}`);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

async function scCrawl(seedUrls, settings, reuseTabId = null) {
  const { max_depth, concurrency, extract_title, extract_description, extract_h1, extract_links, custom_selectors, wait_ms } = settings;

  const visited   = new Set();
  const inlinkMap = new Map(); // norm_url → Set<source_url>

  for (const u of seedUrls) {
    try { visited.add(scNormalise(u)); } catch {}
  }

  const queue = seedUrls.map(u => ({ url: u, depth: 0 }));

  const keepalive = chrome.runtime.connect({ name: 'wb-keepalive' });
  const ping = setInterval(() => keepalive.postMessage('ping'), 20000);

  const scrapeOne = async ({ url, depth }) => {
    if (scCancelFlag) return;
    scSetStatus(`Scraping ${url} — ${scResults.length} / ~${visited.size} discovered (depth ${depth})`);

    let entry;
    try {
      const msgReuseTabId = (depth === 0 && reuseTabId !== null) ? reuseTabId : null;
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'WB_SCRAPE_URL', url, settings: { extract_links, extract_text, wait_ms }, reuseTabId: msgReuseTabId },
          r => { if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message)); resolve(r); }
        );
      });
      if (!resp?.ok) throw new Error(resp?.error || 'Scrape failed');
      entry = {
        url,
        statusCode:       resp.statusCode || null,
        title:            resp.title,
        meta_description: resp.meta_description,
        h1:               resp.h1,
        links:            resp.links || [],
        text_preview:     resp.text_preview,
        inlinks:          [...(inlinkMap.get(scNormalise(url)) || [])],
        error:            null,
      };

      if (depth < max_depth && extract_links && entry.links.length) {
        let seedOrigin;
        try { seedOrigin = new URL(seedUrls[0]).origin; } catch { seedOrigin = null; }
        if (seedOrigin) {
          for (const link of entry.links) {
            try {
              const lu = new URL(link);
              if (lu.origin !== seedOrigin) continue;
              const norm = scNormalise(link);
              if (!visited.has(norm)) {
                visited.add(norm);
                if (!inlinkMap.has(norm)) inlinkMap.set(norm, new Set());
                inlinkMap.get(norm).add(url);
                queue.push({ url: scNormalise(lu.href), depth: depth + 1 });
              } else {
                // Record additional inlink even for already-visited URLs (if already in results)
                if (!inlinkMap.has(norm)) inlinkMap.set(norm, new Set());
                inlinkMap.get(norm).add(url);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      entry = {
        url, statusCode: null, title: null, meta_description: null, h1: null,
        links: [], text_preview: null,
        inlinks: [...(inlinkMap.get(scNormalise(url)) || [])],
        error: String(err.message).slice(0, 200),
      };
    }

    scResults.push(entry);
    scRenderTable();
  };

  try {
    let running = 0;
    await new Promise(resolve => {
      const tick = () => {
        while (queue.length > 0 && running < concurrency && !scCancelFlag) {
          const item = queue.shift();
          running++;
          scrapeOne(item).finally(() => {
            running--;
            if ((queue.length === 0 || scCancelFlag) && running === 0) resolve();
            else tick();
          });
        }
        if ((queue.length === 0 || scCancelFlag) && running === 0) resolve();
      };
      tick();
    });
  } finally {
    clearInterval(ping);
    keepalive.disconnect();
  }
}

function scNormalise(url) {
  try { const u = new URL(url); return u.origin + (u.pathname.replace(/\/+$/, '') || '/'); }
  catch { return url; }
}

function scSelectAll() {
  scSelected.clear();
  scResults.forEach((_, i) => scSelected.add(i));
  document.querySelectorAll('#sc-results-table input[type="checkbox"]').forEach(cb => { cb.checked = true; });
  scUpdateSelectionButtons();
}

function scUpdateSelectionButtons() {
  const selBtn = document.getElementById('sc-copy-selected-csv-btn');
  if (selBtn) selBtn.style.display = scSelected.size > 0 ? '' : 'none';
}

function scStatusBadge(code) {
  if (!code) return '<span style="color:#94a3b8">—</span>';
  const color = code < 300 ? '#86efac' : code < 400 ? '#fde68a' : '#fda4af';
  return `<span style="color:${color}">${code}</span>`;
}

function scRenderTable() {
  const wrap  = document.getElementById('sc-results-wrap');
  const table = document.getElementById('sc-results-table');
  const label = document.getElementById('sc-results-label');
  const csvBtn   = document.getElementById('sc-copy-csv-btn');
  const tsvBtn   = document.getElementById('sc-copy-tsv-btn');
  const selBtn   = document.getElementById('sc-copy-selected-csv-btn');
  if (!wrap || !table) return;

  if (!scResults.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  if (label) label.textContent = `Results (${scResults.length})`;
  if (csvBtn)   csvBtn.style.display = '';
  if (tsvBtn)   tsvBtn.style.display = '';
  if (selBtn)   selBtn.style.display = '';

  const rows = scResults.map((r, i) => {
    const status = r.error
      ? `<span style="color:#fda4af" title="${escHtml(r.error)}">✗</span>`
      : `<span style="color:#86efac">✓</span>`;
    const inlinkTip = r.inlinks.length
      ? r.inlinks.slice(0, 10).join('\n') + (r.inlinks.length > 10 ? `\n…+${r.inlinks.length - 10}` : '')
      : '';
    const checked = scSelected.has(i) ? 'checked' : '';
    return `<tr>
      <td style="padding:0.2rem 0.3rem;text-align:center">
        <input type="checkbox" data-idx="${i}" ${checked} style="margin:0">
      </td>
      <td style="word-break:break-all;font-size:0.78rem;max-width:120px">${escHtml(r.url)}</td>
      <td style="font-size:0.78rem;text-align:center">${scStatusBadge(r.statusCode)}</td>
      <td style="font-size:0.78rem">${escHtml(r.title || '—')}</td>
      <td style="font-size:0.78rem">${escHtml(r.h1 || '—')}</td>
      <td style="font-size:0.78rem;text-align:right">${r.links.length}</td>
      <td style="font-size:0.78rem;text-align:center" title="${escHtml(inlinkTip)}">${r.inlinks.length || '—'}</td>
      <td style="font-size:0.78rem;text-align:center">${status}</td>
    </tr>`;
  }).join('');

  table.innerHTML = `
    <div style="overflow-x:auto;max-height:400px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="color:#94a3b8;font-size:0.72rem;text-align:left;position:sticky;top:0;background:#1a1a2e">
          <th style="padding:0.25rem 0.3rem"><input type="checkbox" id="sc-check-all" title="Select all" style="margin:0"></th>
          <th style="padding:0.25rem 0.3rem">URL</th>
          <th style="padding:0.25rem 0.3rem;text-align:center">Status</th>
          <th style="padding:0.25rem 0.3rem">Title</th>
          <th style="padding:0.25rem 0.3rem">H1</th>
          <th style="padding:0.25rem 0.3rem;text-align:right">Out↗</th>
          <th style="padding:0.25rem 0.3rem;text-align:center">In↙</th>
          <th style="padding:0.25rem 0.3rem;text-align:center">✓</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Wire header checkbox
  const checkAll = table.querySelector('#sc-check-all');
  if (checkAll) {
    checkAll.checked = scSelected.size === scResults.length && scResults.length > 0;
    checkAll.addEventListener('change', e => {
      if (e.target.checked) {
        scSelected.clear();
        scResults.forEach((_, i) => scSelected.add(i));
      } else {
        scSelected.clear();
      }
      table.querySelectorAll('tbody input[type="checkbox"]').forEach(cb => { cb.checked = e.target.checked; });
      scUpdateSelectionButtons();
    });
  }

  // Wire row checkboxes
  table.querySelectorAll('tbody input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.idx, 10);
      if (e.target.checked) scSelected.add(idx); else scSelected.delete(idx);
      scUpdateSelectionButtons();
    });
  });
}

function scExportCsv(selectedOnly = false) {
  const header = 'URL,Title,Description,H1,Links,Error';
  const rows   = scResults
    .filter((_, i) => !selectedOnly || scSelected.has(i))
    .map(r => {
      const customData = r.custom_data ? Object.values(r.custom_data).join(' | ') : '';
      return [r.url, r.title, r.meta_description, r.h1, r.links.length, r.error || '']
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',') + (customData ? `,"${customData.replace(/"/g, '""')}"` : '');
    });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const filename = selectedOnly ? `scrape-results-selected-${date}.csv` : `scrape-results-${date}.csv`;

  chrome.downloads.download({ url, filename, saveAs: false }, id => {
    URL.revokeObjectURL(url);
    if (selectedOnly) {
      scSetStatus(`Exported ${scSelected.size} results`);
    } else {
      scSetStatus(`Exported ${scResults.length} results`);
    }
  });
}

function scCopyTsv(selectedOnly = false) {
  const header = 'URL\tTitle\tDescription\tH1\tLinks\tError';
  const rows   = scResults
    .filter((_, i) => !selectedOnly || scSelected.has(i))
    .map(r => {
      const customData = r.custom_data ? Object.values(r.custom_data).join(' | ') : '';
      const row = [r.url, r.title, r.meta_description, r.h1, r.links.length, r.error || '']
        .map(v => String(v ?? '').replace(/\t/g, ' ').replace(/\n/g, ' '))
        .join('\t');
      return customData ? row + '\t' + customData.replace(/\t/g, ' ').replace(/\n/g, ' ') : row;
    });
  navigator.clipboard.writeText([header, ...rows].join('\n'))
    .then(() => scSetStatus(selectedOnly ? 'Copied selected results (TSV)' : 'Copied all results (TSV)'))
    .catch(() => scSetStatus('Copy failed'));
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  const scrapeTab = document.querySelector('[data-page="scrape"]');
  if (scrapeTab) {
    scrapeTab.addEventListener('click', () => {
      const container = document.getElementById('page-scrape');
      if (container && !container.dataset.initialized) {
        scInit();
        container.dataset.initialized = '1';
      }
    });
  }
});
