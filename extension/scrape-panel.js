/* global wbBackendConfig, wbFetch, wbNormalizeApiBase */

// Scrape tab — submits URLs to POST /v2/scrape, claims, runs WB_SCRAPE_URL via CDP,
// posts structured results back. Reuses wbFetch/wbBackendConfig from wayback-panel.js.

let scResults = []; // [{url, title, meta_description, h1, links, text_preview, error}]

function scInit() {
  const container = document.getElementById('page-scrape');
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom:1rem">
      <small id="sc-status">Ready.</small>
    </div>

    <article>
      <header style="margin-bottom:0.75rem"><strong>Scrape URLs</strong></header>
      <textarea id="sc-bulk-urls" placeholder="Paste URLs — one per line…" aria-label="URLs to scrape" rows="5" spellcheck="false"
        style="display:block;width:100%;box-sizing:border-box;min-height:100px;padding:0.75rem 0.85rem;
               background:rgba(255,255,255,0.06);border:none;border-radius:0.65rem;color:#e2e8f0;
               font-family:monospace;font-size:0.82rem;line-height:1.5;resize:vertical"></textarea>
      <div style="display:flex;gap:0.5rem;margin-top:0.6rem;flex-wrap:wrap;align-items:center">
        <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;cursor:pointer">
          <input type="checkbox" id="sc-extract-links" checked> Extract links
        </label>
        <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;cursor:pointer">
          <input type="checkbox" id="sc-extract-text" checked> Text preview
        </label>
        <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.85rem;cursor:pointer">
          Wait <input type="number" id="sc-wait-ms" value="2000" min="0" step="500"
            style="width:5rem;padding:0.2rem 0.4rem;font-size:0.82rem;background:rgba(255,255,255,0.06);
                   border:none;border-radius:0.35rem;color:#e2e8f0"> ms
        </label>
      </div>
      <div style="margin-top:0.7rem">
        <button id="sc-submit-btn" type="button" class="secondary">Scrape URLs</button>
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
  const urls = input?.value.split(/\r?\n/).map(u => u.trim()).filter(Boolean) || [];
  if (!urls.length) { scSetStatus('Paste at least one URL first.'); return; }

  const extract_links = document.getElementById('sc-extract-links')?.checked ?? true;
  const extract_text  = document.getElementById('sc-extract-text')?.checked ?? true;
  const wait_ms       = parseInt(document.getElementById('sc-wait-ms')?.value || '2000', 10);

  scSetStatus('Submitting scrape job...');
  scResults = [];
  scRenderTable();

  try {
    const res = await wbFetch('/v2/scrape', {
      method: 'POST',
      body: JSON.stringify({ urls, extract_links, extract_text, wait_ms }),
    });
    const { job_id } = await res.json();
    scSetStatus(`Job queued: ${job_id}. Claiming...`);
    await scExecuteJob(job_id, { extract_links, extract_text, wait_ms });
    scSetStatus(`Done — ${scResults.length} URLs scraped.`);
  } catch (err) {
    scSetStatus(`Error: ${err.message}`);
  }
}

async function scExecuteJob(jobId, settings) {
  const claimRes = await wbFetch(`/v2/jobs/${jobId}/claim`, { method: 'POST' });
  const jobData  = await claimRes.json();
  const urls     = jobData.settings?.urls || [];

  const keepalive = chrome.runtime.connect({ name: 'wb-keepalive' });
  const ping = setInterval(() => keepalive.postMessage('ping'), 20000);

  try {
    for (const url of urls) {
      scSetStatus(`Scraping ${url}…`);
      let entry;
      try {
        const resp = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: 'WB_SCRAPE_URL', url, settings },
            response => {
              if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
              resolve(response);
            }
          );
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Scrape failed');
        entry = { url, title: resp.title, meta_description: resp.meta_description,
                  h1: resp.h1, links: resp.links || [], text_preview: resp.text_preview, error: null };
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
      } catch (postErr) {
        console.error('Failed to post scrape result:', postErr);
      }
    }
  } finally {
    clearInterval(ping);
    keepalive.disconnect();
  }
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
      ? `<span style="color:#fda4af" title="${escHtml(r.error)}">✗ Error</span>`
      : `<span style="color:#86efac">✓</span>`;
    return `<tr>
      <td style="word-break:break-all;font-size:0.8rem">${escHtml(r.url)}</td>
      <td style="font-size:0.8rem">${escHtml(r.title || '—')}</td>
      <td style="font-size:0.8rem">${escHtml(r.h1 || '—')}</td>
      <td style="font-size:0.8rem;text-align:right">${r.links.length}</td>
      <td style="font-size:0.8rem">${status}</td>
    </tr>`;
  }).join('');

  table.innerHTML = `
    <div style="overflow-x:auto;max-height:380px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
        <thead><tr style="color:#94a3b8;font-size:0.75rem;text-align:left">
          <th style="padding:0.3rem 0.4rem">URL</th>
          <th style="padding:0.3rem 0.4rem">Title</th>
          <th style="padding:0.3rem 0.4rem">H1</th>
          <th style="padding:0.3rem 0.4rem;text-align:right">Links</th>
          <th style="padding:0.3rem 0.4rem">Status</th>
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

// Lazy-init on first tab activation (mirrors wayback-panel.js pattern in panel.js)
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
