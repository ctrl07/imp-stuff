/* global wbBackendConfig, wbFetch */

let scResults = [];

function scInit() {
  const container = document.getElementById('page-scrape');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;margin-bottom:1rem">
      <small id="sc-status">Ready.</small>
    </div>

    <article>
      <header style="margin-bottom:0.75rem"><strong>Crawl &amp; Scrape</strong></header>
      <textarea id="sc-bulk-urls" placeholder="Seed URLs — one per line…" aria-label="Seed URLs" rows="4" spellcheck="false"
        style="display:block;width:100%;box-sizing:border-box;min-height:88px;padding:0.65rem 0.75rem;
               background:rgba(255,255,255,0.06);border:none;border-radius:0.65rem;color:#e2e8f0;
               font-family:monospace;font-size:0.82rem;line-height:1.5;resize:vertical"></textarea>

      <div style="display:flex;gap:0.75rem;margin-top:0.6rem;flex-wrap:wrap;align-items:center;font-size:0.82rem">
        <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer">
          <input type="checkbox" id="sc-extract-links" checked> Links
        </label>
        <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer">
          <input type="checkbox" id="sc-extract-text" checked> Text
        </label>
        <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer">
          Depth
          <input type="number" id="sc-max-depth" value="0" min="0" max="10" step="1"
            title="0 = seed URLs only; 1 = follow one level of links; etc."
            style="width:3.5rem;padding:0.2rem 0.35rem;font-size:0.82rem;background:rgba(255,255,255,0.06);
                   border:none;border-radius:0.35rem;color:#e2e8f0">
        </label>
        <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer">
          Wait
          <input type="number" id="sc-wait-ms" value="4000" min="0" step="500"
            style="width:4.5rem;padding:0.2rem 0.35rem;font-size:0.82rem;background:rgba(255,255,255,0.06);
                   border:none;border-radius:0.35rem;color:#e2e8f0"> ms
        </label>
        <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer">
          Parallel
          <input type="number" id="sc-concurrency" value="3" min="1" max="8" step="1"
            style="width:3rem;padding:0.2rem 0.35rem;font-size:0.82rem;background:rgba(255,255,255,0.06);
                   border:none;border-radius:0.35rem;color:#e2e8f0">
        </label>
      </div>

      <div style="margin-top:0.7rem">
        <button id="sc-submit-btn" type="button" class="secondary">Start crawl</button>
      </div>
    </article>

    <div id="sc-results-wrap" style="display:none;margin-top:0.5rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
        <strong id="sc-results-label">Results</strong>
        <button id="sc-copy-csv-btn" class="copy-all-btn" style="display:none">Copy CSV</button>
      </div>
      <div id="sc-results-table"></div>
    </div>
  `;

  document.getElementById('sc-submit-btn').addEventListener('click', scSubmit);
  document.getElementById('sc-copy-csv-btn').addEventListener('click', scCopyCsv);
}

function scSetStatus(msg) {
  const el = document.getElementById('sc-status');
  if (el) el.textContent = msg;
}

async function scSubmit() {
  const input = document.getElementById('sc-bulk-urls');
  const seedUrls = input?.value.split(/\r?\n/).map(u => u.trim()).filter(Boolean) || [];
  if (!seedUrls.length) { scSetStatus('Paste at least one seed URL.'); return; }

  const settings = {
    extract_links: document.getElementById('sc-extract-links')?.checked ?? true,
    extract_text:  document.getElementById('sc-extract-text')?.checked ?? true,
    wait_ms:       parseInt(document.getElementById('sc-wait-ms')?.value || '4000', 10),
    max_depth:     parseInt(document.getElementById('sc-max-depth')?.value || '0', 10),
    concurrency:   parseInt(document.getElementById('sc-concurrency')?.value || '3', 10),
  };

  scSetStatus('Submitting job…');
  scResults = [];
  scRenderTable();

  try {
    const res = await wbFetch('/v2/scrape', {
      method: 'POST',
      body: JSON.stringify({ urls: seedUrls, extract_links: settings.extract_links,
                             extract_text: settings.extract_text, wait_ms: settings.wait_ms,
                             max_depth: settings.max_depth }),
    });
    const { job_id } = await res.json();
    scSetStatus(`Claimed job ${job_id}. Starting crawl…`);
    await scCrawl(job_id, seedUrls, settings);
    scSetStatus(`Done — ${scResults.length} pages scraped.`);
  } catch (err) {
    scSetStatus(`Error: ${err.message}`);
  }
}

async function scCrawl(jobId, seedUrls, settings) {
  // Claim the job (moves status to running)
  await wbFetch(`/v2/jobs/${jobId}/claim`, { method: 'POST' });

  const { max_depth, concurrency, extract_links, extract_text, wait_ms } = settings;

  // BFS state
  const visited = new Set();
  // Normalise seed URLs into the visited set
  for (const u of seedUrls) {
    try { visited.add(scNormalise(u)); } catch {}
  }

  // Shared mutable queue — workers pull from it dynamically (enables crawl growth)
  const queue = seedUrls.map(u => ({ url: u, depth: 0 }));

  const keepalive = chrome.runtime.connect({ name: 'wb-keepalive' });
  const ping = setInterval(() => keepalive.postMessage('ping'), 20000);

  const scrapeOne = async ({ url, depth }) => {
    scSetStatus(`Scraping ${url} (depth ${depth}) — ${scResults.length} done, ~${queue.length} queued`);
    let entry;
    try {
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'WB_SCRAPE_URL', url, settings: { extract_links, extract_text, wait_ms } },
          r => { if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message)); resolve(r); }
        );
      });
      if (!resp?.ok) throw new Error(resp?.error || 'Scrape failed');
      entry = { url, title: resp.title, meta_description: resp.meta_description,
                h1: resp.h1, links: resp.links || [], text_preview: resp.text_preview, error: null };

      // Enqueue discovered same-origin links within depth limit
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
                queue.push({ url: lu.origin + lu.pathname, depth: depth + 1 });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      entry = { url, title: null, meta_description: null, h1: null,
                links: [], text_preview: null, error: String(err.message).slice(0, 200) };
    }

    scResults.push(entry);
    scRenderTable();

    try {
      await wbFetch(`/v2/jobs/${jobId}/scrape-result`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    } catch (e) { console.error('Failed to post scrape result:', e); }
  };

  try {
    // Concurrency pool: workers drain the shared queue, which may grow during crawl
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (queue.length) {
          const item = queue.shift();
          if (item) await scrapeOne(item);
        }
      })
    );

    // Signal backend the crawl is complete
    await wbFetch(`/v2/jobs/${jobId}/finish`, { method: 'POST' }).catch(() => {});
  } finally {
    clearInterval(ping);
    keepalive.disconnect();
  }
}

// Strip query string + fragment for deduplication
function scNormalise(url) {
  try { const u = new URL(url); return u.origin + u.pathname.replace(/\/+$/, '') || '/'; }
  catch { return url; }
}

function scRenderTable() {
  const wrap  = document.getElementById('sc-results-wrap');
  const table = document.getElementById('sc-results-table');
  const label = document.getElementById('sc-results-label');
  const csv   = document.getElementById('sc-copy-csv-btn');
  if (!wrap || !table) return;

  if (!scResults.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  if (label) label.textContent = `Results (${scResults.length})`;
  if (csv)   csv.style.display = '';

  const rows = scResults.map(r => {
    const status = r.error
      ? `<span style="color:#fda4af" title="${escHtml(r.error)}">✗</span>`
      : `<span style="color:#86efac">✓</span>`;
    return `<tr>
      <td style="word-break:break-all;font-size:0.78rem;max-width:120px">${escHtml(r.url)}</td>
      <td style="font-size:0.78rem">${escHtml(r.title || '—')}</td>
      <td style="font-size:0.78rem">${escHtml(r.h1 || '—')}</td>
      <td style="font-size:0.78rem;text-align:right">${r.links.length}</td>
      <td style="font-size:0.78rem;text-align:center">${status}</td>
    </tr>`;
  }).join('');

  table.innerHTML = `
    <div style="overflow-x:auto;max-height:400px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="color:#94a3b8;font-size:0.72rem;text-align:left;position:sticky;top:0;background:#1a1a2e">
          <th style="padding:0.25rem 0.3rem">URL</th>
          <th style="padding:0.25rem 0.3rem">Title</th>
          <th style="padding:0.25rem 0.3rem">H1</th>
          <th style="padding:0.25rem 0.3rem;text-align:right">Links</th>
          <th style="padding:0.25rem 0.3rem;text-align:center">✓</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function scCopyCsv() {
  const header = 'URL,Title,H1,Links,Meta Description,Text Preview,Error';
  const lines  = scResults.map(r =>
    [r.url, r.title, r.h1, r.links.length, r.meta_description, r.text_preview, r.error]
      .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  navigator.clipboard.writeText([header, ...lines].join('\n')).catch(() => {});
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
