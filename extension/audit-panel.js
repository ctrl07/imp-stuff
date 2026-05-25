'use strict';

(function initAuditPanel() {

  // ── State ─────────────────────────────────────────────────────────────────

  let urls          = [];
  let current       = 0;
  let results       = [];
  let activeTabId   = null;
  let waitingForLoad = false;

  const FIELDS = [
    { key: 'title',       label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'h1',          label: 'H1' },
    { key: 'category',    label: 'Category' },
    { key: 'tags',        label: 'Tags' },
    { key: 'date',        label: 'Date' },
  ];

  // Always-shown fields; blog fields shown only when non-empty
  const BLOG_FIELDS = new Set(['category', 'tags', 'date']);

  // ── Extraction (injected into the active page) ────────────────────────────

  function extractAuditData() {
    function getMeta(name) {
      return (
        document.querySelector(`meta[name="${name}"]`)?.content ||
        document.querySelector(`meta[property="${name}"]`)?.content ||
        ''
      );
    }
    function getAllMeta(name) {
      return Array.from(document.querySelectorAll(`meta[property="${name}"]`))
        .map(el => el.content).join(', ');
    }

    let date     = getMeta('article:published_time');
    let category = getMeta('article:section');
    let tags     = getAllMeta('article:tag') || getMeta('article:tag');

    // JSON-LD fallback
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const ld = JSON.parse(script.textContent);
        const objs = Array.isArray(ld) ? ld : [ld];
        for (const obj of objs) {
          if (!date && obj.datePublished) date = obj.datePublished;
          if (!category && obj.articleSection) {
            category = Array.isArray(obj.articleSection)
              ? obj.articleSection.join(', ')
              : obj.articleSection;
          }
          if (!tags && obj.keywords) {
            tags = Array.isArray(obj.keywords)
              ? obj.keywords.join(', ')
              : obj.keywords;
          }
        }
      } catch { /* malformed LD+JSON — skip */ }
    }

    return {
      url:         location.href,
      title:       document.title,
      description: getMeta('description'),
      h1:          document.querySelector('h1')?.textContent?.trim() || '',
      date,
      category,
      tags,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: filename,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function csvCell(val) {
    return '"' + String(val ?? '').replace(/"/g, '""') + '"';
  }

  function buildCsv(rows) {
    const headers = ['url', 'title', 'description', 'h1', 'category', 'tags', 'date'];
    const lines = [headers.map(csvCell).join(',')];
    for (const row of rows) {
      lines.push(headers.map(h => csvCell(row[h] ?? '')).join(','));
    }
    return lines.join('\r\n');
  }

  function setStatus(msg) {
    const el = document.getElementById('au-status');
    if (el) el.textContent = msg;
  }

  function updateSavedCount() {
    const el = document.getElementById('au-saved-count');
    if (el) el.textContent = results.length ? `${results.length} saved` : '';
    const dlBtn = document.getElementById('au-download-btn');
    if (dlBtn) dlBtn.disabled = results.length === 0;
  }

  // ── Field rendering ───────────────────────────────────────────────────────

  function renderFields(data) {
    const container = document.getElementById('au-fields');
    container.innerHTML = '';

    setStatus('');

    for (const { key, label } of FIELDS) {
      const value = data[key] ?? '';
      if (BLOG_FIELDS.has(key) && !value) continue; // hide empty blog fields

      const row = document.createElement('div');
      row.className = 'au-field-row';
      row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.id = `au-cb-${key}`;
      cb.style.cssText = 'flex-shrink:0;margin:0';

      const lbl = document.createElement('label');
      lbl.htmlFor = `au-cb-${key}`;
      lbl.textContent = label;
      lbl.style.cssText = `
        flex-shrink:0;
        min-width:5.5rem;
        font-size:var(--small-font-size);
        color:var(--pico-muted-color);
        cursor:pointer;
        user-select:none;
      `;

      const input = document.createElement('input');
      input.type = 'text';
      input.id = `au-val-${key}`;
      input.value = value;
      input.style.cssText = 'flex:1;margin:0;padding:0.25rem 0.5rem;font-size:0.78rem;min-width:0';

      row.appendChild(cb);
      row.appendChild(lbl);
      row.appendChild(input);
      container.appendChild(row);
    }

    document.getElementById('au-save-btn').disabled = false;
    document.getElementById('au-skip-btn').disabled = false;
  }

  function clearFields() {
    const container = document.getElementById('au-fields');
    if (container) container.innerHTML = '';
    const saveBtn = document.getElementById('au-save-btn');
    const skipBtn = document.getElementById('au-skip-btn');
    if (saveBtn) saveBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function goTo(index) {
    if (index >= urls.length) {
      showDone();
      return;
    }
    current = index;
    const url = urls[current];

    document.getElementById('au-progress').textContent =
      `Page ${current + 1} of ${urls.length}`;
    document.getElementById('au-current-url').textContent = url;
    clearFields();
    setStatus('Navigating…');
    waitingForLoad = false;

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) {
        setStatus('No active tab found.');
        return;
      }
      activeTabId = tab.id;
      waitingForLoad = true;
      chrome.tabs.update(tab.id, { url });
    });
  }

  function extractFromTab() {
    waitingForLoad = false;
    setStatus('Extracting…');
    chrome.scripting.executeScript(
      { target: { tabId: activeTabId }, func: extractAuditData },
      results => {
        if (chrome.runtime.lastError || !results?.[0]?.result) {
          setStatus('Can\'t extract from this page — click Skip to continue.');
          document.getElementById('au-save-btn').disabled = true;
          document.getElementById('au-skip-btn').disabled = false;
          return;
        }
        renderFields(results[0].result);
        setStatus('');
      }
    );
  }

  // ── Save / Skip ───────────────────────────────────────────────────────────

  function saveAndNext() {
    const row = { url: urls[current] };
    for (const { key } of FIELDS) {
      const cb = document.getElementById(`au-cb-${key}`);
      const input = document.getElementById(`au-val-${key}`);
      if (cb && input && cb.checked) {
        row[key] = input.value;
      }
    }
    results.push(row);
    updateSavedCount();
    goTo(current + 1);
  }

  function skip() {
    goTo(current + 1);
  }

  // ── Done state ────────────────────────────────────────────────────────────

  function showDone() {
    clearFields();
    document.getElementById('au-progress').textContent = 'Audit complete';
    document.getElementById('au-current-url').textContent = '';
    setStatus(`All ${urls.length} page${urls.length !== 1 ? 's' : ''} processed.`);
    document.getElementById('au-save-btn').disabled = true;
    document.getElementById('au-skip-btn').disabled = true;
    updateSavedCount();

    // Add start-over link
    const status = document.getElementById('au-status');
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'outline secondary pico-btn-sm';
    restart.textContent = 'Start over';
    restart.style.marginTop = '0.5rem';
    restart.addEventListener('click', resetToSetup);
    status.after(restart);
  }

  // ── Setup / Reset ─────────────────────────────────────────────────────────

  function resetToSetup() {
    urls = [];
    current = 0;
    results = [];
    activeTabId = null;
    waitingForLoad = false;

    document.getElementById('au-url-input').value = '';
    document.getElementById('au-setup').classList.remove('hidden');
    document.getElementById('au-audit').classList.add('hidden');

    // Remove start-over button if present
    document.getElementById('au-audit').querySelectorAll('button.outline.secondary:not(#au-save-btn):not(#au-skip-btn):not(#au-download-btn)')
      .forEach(btn => btn.remove());
  }

  function startAudit() {
    const raw = document.getElementById('au-url-input').value.trim();
    if (!raw) {
      showToast('Paste at least one URL to begin.', 'warning');
      return;
    }
    urls = raw.split(/\s+/).map(u => u.trim()).filter(Boolean);
    if (!urls.length) {
      showToast('No valid URLs found.', 'warning');
      return;
    }
    current = 0;
    results = [];
    updateSavedCount();

    document.getElementById('au-setup').classList.add('hidden');
    document.getElementById('au-audit').classList.remove('hidden');
    goTo(0);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('au-start-btn').addEventListener('click', startAudit);
    document.getElementById('au-save-btn').addEventListener('click', saveAndNext);
    document.getElementById('au-skip-btn').addEventListener('click', skip);
    document.getElementById('au-download-btn').addEventListener('click', () => {
      if (!results.length) return;
      downloadBlob('audit.csv', buildCsv(results), 'text/csv');
      showToast(`${results.length} row${results.length !== 1 ? 's' : ''} saved to audit.csv`, 'success');
    });

    // Listen for tab load to trigger extraction
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (tabId !== activeTabId || !waitingForLoad) return;
      if (changeInfo.status === 'complete') {
        extractFromTab();
      }
    });
  });

})();
