'use strict';

(function initAuditPanel() {
  // ── State ───────────────────────────────────────────────────────────────────

  let mode          = 'single'; // 'single' | 'dual'
  let urls          = [];       // single mode: string[]
  let urlPairs      = [];       // dual mode: {url1, url2}[]
  let current       = 0;
  let results       = [];
  let activeTabId   = null;     // single mode tab
  let tabId1        = null;     // dual mode tab 1
  let tabId2        = null;     // dual mode tab 2
  let waitingForLoad = false;
  let dualLoadCount = 0;        // counts how many of the 2 dual tabs have loaded
  let simpleCompare = false;

  // ── Field definitions ───────────────────────────────────────────────────────

  const FIELDS = [
    { key: 'title',       label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'h1',          label: 'H1' },
    { key: 'category',    label: 'Category' },
    { key: 'tags',        label: 'Tags' },
    { key: 'date',        label: 'Date' },
  ];
  const BLOG_FIELDS = new Set(['category', 'tags', 'date']);

  // ── Extraction function (injected into page) ────────────────────────────────

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
            tags = Array.isArray(obj.keywords) ? obj.keywords.join(', ') : obj.keywords;
          }
        }
      } catch { /* skip */ }
    }

    return {
      url:         location.href,
      title:       document.title,
      description: getMeta('description'),
      h1:          document.querySelector('h1')?.textContent?.trim() || '',
      category,
      tags,
      date,
    };
  }

  // ── CSV parsing ─────────────────────────────────────────────────────────────

  function parseCsvInput(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const pairs = [];
    let hasDual = false;

    for (const line of lines) {
      const commaIdx = line.indexOf(',');
      if (commaIdx === -1) {
        const url = line.replace(/^"|"$/g, '');
        try { new URL(url); pairs.push({ url1: url, url2: null }); } catch { /* skip */ }
      } else {
        const url1 = line.slice(0, commaIdx).trim().replace(/^"|"$/g, '');
        const url2 = line.slice(commaIdx + 1).trim().replace(/^"|"$/g, '');
        try {
          new URL(url1);
          new URL(url2);
          pairs.push({ url1, url2 });
          hasDual = true;
        } catch { /* skip invalid rows */ }
      }
    }

    // Only treat as dual if ALL valid rows have both URLs
    const isDual = hasDual && pairs.length > 0 && pairs.every(p => p.url2 !== null);
    return { isDual, pairs };
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────

  function setStatus(msg) {
    el('au-status').textContent = msg;
  }

  function updateSavedCount() {
    el('au-saved-count').textContent = results.length ? `${results.length} saved` : '';
    el('au-download-btn').disabled = results.length === 0;
  }

  // ── Single-mode: render field rows ──────────────────────────────────────────

  function renderFields(data) {
    const container = el('au-fields');
    container.style.cssText = '';
    container.innerHTML = '';

    for (const { key, label } of FIELDS) {
      const val = data[key] || '';
      if (BLOG_FIELDS.has(key) && !val) continue;

      const row = document.createElement('label');
      row.className = 'toggle-label';
      row.style.cssText = 'align-items:flex-start;margin-bottom:0.45rem;gap:0.5rem';
      row.innerHTML = `
        <input type="checkbox" data-field="${key}" checked style="margin-top:0.25rem;flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.75rem;color:var(--pico-muted-color);margin-bottom:0.15rem">${label}</div>
          <input type="text" data-value="${key}"
            value="${val.replace(/"/g, '&quot;')}"
            style="width:100%;margin:0;padding:0.2rem 0.4rem;font-size:0.8rem">
        </div>
      `;
      container.appendChild(row);
    }

    // Notes — always shown
    const notesWrap = document.createElement('div');
    notesWrap.style.cssText = 'margin-top:0.5rem';
    notesWrap.innerHTML = `
      <div style="font-size:0.75rem;color:var(--pico-muted-color);margin-bottom:0.25rem">Notes</div>
      <textarea id="au-notes" class="tool-textarea"
        style="min-height:58px" placeholder="Optional notes…" spellcheck="false"></textarea>
    `;
    container.appendChild(notesWrap);
    setStatus('');
  }

  // ── Dual-mode: render two columns of field rows ─────────────────────────────

  function makeFieldColumn(data, suffix) {
    const col = document.createElement('div');
    col.style.cssText = 'min-width:0';

    const urlLabel = document.createElement('div');
    urlLabel.style.cssText = 'font-size:0.72rem;color:var(--pico-muted-color);word-break:break-all;margin-bottom:0.5rem';
    urlLabel.textContent = data.url;
    col.appendChild(urlLabel);

    for (const { key, label } of FIELDS) {
      const val = data[key] || '';
      if (BLOG_FIELDS.has(key) && !val) continue;

      const row = document.createElement('label');
      row.className = 'toggle-label';
      row.style.cssText = 'align-items:flex-start;margin-bottom:0.4rem;gap:0.4rem';
      row.innerHTML = `
        <input type="checkbox" data-field="${key}-${suffix}" checked style="margin-top:0.25rem;flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.72rem;color:var(--pico-muted-color);margin-bottom:0.1rem">${label}</div>
          <input type="text" data-value="${key}-${suffix}"
            value="${val.replace(/"/g, '&quot;')}"
            style="width:100%;margin:0;padding:0.18rem 0.35rem;font-size:0.78rem">
        </div>
      `;
      col.appendChild(row);
    }

    // Notes per column
    const notesWrap = document.createElement('div');
    notesWrap.style.cssText = 'margin-top:0.4rem';
    notesWrap.innerHTML = `
      <div style="font-size:0.72rem;color:var(--pico-muted-color);margin-bottom:0.2rem">Notes</div>
      <textarea id="au-notes-${suffix}" class="tool-textarea"
        style="min-height:50px;font-size:0.78rem" placeholder="Optional notes…" spellcheck="false"></textarea>
    `;
    col.appendChild(notesWrap);
    return col;
  }

  function renderFieldsDual(data1, data2) {
    const container = el('au-fields');
    container.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.6rem';
    container.innerHTML = '';
    container.appendChild(makeFieldColumn(data1, '1'));
    container.appendChild(makeFieldColumn(data2, '2'));
    setStatus('');
  }

  // ── Collect checked field values ────────────────────────────────────────────

  function collectFields(suffix) {
    const result = {};
    const container = el('au-fields');
    container.querySelectorAll('[data-field]').forEach(cb => {
      const key = cb.dataset.field;
      if (suffix && !key.endsWith('-' + suffix)) return;
      if (!cb.checked) return;
      const plainKey = suffix ? key.replace(/-[12]$/, '') : key;
      const input = container.querySelector(`[data-value="${key}"]`);
      result[plainKey] = input ? input.value : '';
    });
    return result;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function updateProgress() {
    const total = mode === 'dual' ? urlPairs.length : urls.length;
    el('au-progress').textContent = `Page ${current + 1} of ${total}`;
  }

  function goToSingle(index) {
    current = index;
    if (index >= urls.length) { showDone(); return; }

    updateProgress();
    el('au-current-url').textContent = urls[index];
    el('au-fields').innerHTML = '';
    el('au-fields').style.cssText = '';
    setStatus('Navigating…');
    waitingForLoad = true;

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      activeTabId = tabs[0]?.id;
      if (!activeTabId) { setStatus('No active tab found.'); return; }
      chrome.tabs.update(activeTabId, { url: urls[index] });
    });
  }

  function goToDual(index) {
    current = index;
    if (index >= urlPairs.length) { showDone(); return; }

    updateProgress();
    const pair = urlPairs[index];
    el('au-current-url').textContent = `${pair.url1}  ↔  ${pair.url2}`;
    el('au-fields').innerHTML = '';
    el('au-fields').style.cssText = '';
    setStatus('Opening tabs…');

    dualLoadCount = 0;
    tabId1 = null;
    tabId2 = null;
    waitingForLoad = true;

    chrome.windows.create({ url: [pair.url1, pair.url2] }, win => {
      tabId1 = win.tabs[0].id;
      tabId2 = win.tabs[1].id;
    });
  }

  function goTo(index) {
    if (mode === 'dual') goToDual(index);
    else goToSingle(index);
  }

  // ── Tab load listener ───────────────────────────────────────────────────────

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!waitingForLoad || changeInfo.status !== 'complete') return;

    if (mode === 'single' && tabId === activeTabId) {
      waitingForLoad = false;
      extractFromTab(tabId, data => renderFields(data));
      return;
    }

    if (mode === 'dual' && (tabId === tabId1 || tabId === tabId2)) {
      dualLoadCount++;
      if (dualLoadCount === 2) {
        waitingForLoad = false;
        setStatus('Extracting…');
        extractFromBothTabs();
      }
    }
  });

  // ── Extraction ──────────────────────────────────────────────────────────────

  function extractFromTab(tabId, cb) {
    setStatus('Extracting…');
    chrome.scripting.executeScript(
      { target: { tabId }, func: extractAuditData },
      results => {
        if (chrome.runtime.lastError || !results?.[0]?.result) {
          setStatus('Could not extract from this page. Use Skip to continue.');
          return;
        }
        cb(results[0].result);
      }
    );
  }

  function extractFromBothTabs() {
    chrome.scripting.executeScript(
      { target: { tabId: tabId1 }, func: extractAuditData },
      res1 => {
        if (chrome.runtime.lastError || !res1?.[0]?.result) {
          setStatus('Could not extract from tab 1. Use Skip to continue.');
          return;
        }
        chrome.scripting.executeScript(
          { target: { tabId: tabId2 }, func: extractAuditData },
          res2 => {
            if (chrome.runtime.lastError || !res2?.[0]?.result) {
              setStatus('Could not extract from tab 2. Use Skip to continue.');
              return;
            }
            renderFieldsDual(res1[0].result, res2[0].result);
          }
        );
      }
    );
  }

  // ── Save & Next / Skip ──────────────────────────────────────────────────────

  function saveAndNext() {
    if (mode === 'dual') {
      const f1   = collectFields('1');
      const f2   = collectFields('2');
      const pair = urlPairs[current];
      results.push({
        url1: pair.url1,         url2: pair.url2,
        title1:       f1.title       || '', description1: f1.description || '',
        h1_1:         f1.h1          || '', category1:    f1.category    || '',
        tags1:        f1.tags        || '', date1:        f1.date        || '',
        notes1:       el('au-notes-1')?.value || '',
        title2:       f2.title       || '', description2: f2.description || '',
        h1_2:         f2.h1          || '', category2:    f2.category    || '',
        tags2:        f2.tags        || '', date2:        f2.date        || '',
        notes2:       el('au-notes-2')?.value || '',
      });
    } else {
      const f = collectFields('');
      results.push({
        url:         urls[current],
        title:       f.title       || '',
        description: f.description || '',
        h1:          f.h1          || '',
        category:    f.category    || '',
        tags:        f.tags        || '',
        date:        f.date        || '',
        notes:       el('au-notes')?.value || '',
      });
    }
    updateSavedCount();
    goTo(current + 1);
  }

  function skip() {
    goTo(current + 1);
  }

  // ── Done state ──────────────────────────────────────────────────────────────

  function showDone() {
    waitingForLoad = false;
    el('au-progress').textContent    = 'All done!';
    el('au-current-url').textContent = '';
    el('au-fields').innerHTML        = '';
    el('au-fields').style.cssText    = '';
    setStatus(`Audit complete. ${results.length} page${results.length !== 1 ? 's' : ''} saved.`);
    el('au-save-btn').disabled = true;
    el('au-skip-btn').disabled = true;
    updateSavedCount();

    const restart = document.createElement('button');
    restart.type      = 'button';
    restart.className = 'outline secondary pico-btn-sm';
    restart.textContent = 'Start over';
    restart.addEventListener('click', resetToSetup);
    el('au-fields').appendChild(restart);
  }

  function resetToSetup() {
    urls = []; urlPairs = []; current = 0; results = [];
    activeTabId = null; tabId1 = null; tabId2 = null;
    waitingForLoad = false; dualLoadCount = 0;
    mode = 'single'; simpleCompare = false;

    el('au-url-input').value         = '';
    el('au-save-btn').disabled       = false;
    el('au-skip-btn').disabled       = false;
    el('au-save-btn').classList.remove('hidden');
    el('au-skip-btn').classList.remove('hidden');
    el('au-download-btn').disabled   = true;
    el('au-saved-count').textContent = '';
    el('au-fields').innerHTML        = '';
    el('au-fields').style.cssText    = '';
    el('au-status').textContent      = '';
    el('au-simple-compare-row').classList.add('hidden');
    el('au-simple-compare').checked  = false;
    el('au-audit').classList.add('hidden');
    el('au-setup').classList.remove('hidden');
  }

  // ── Simple comparison list (open tabs only, no extraction) ──────────────────

  function renderSimpleCompareList() {
    const container = el('au-fields');
    container.style.cssText = '';
    container.innerHTML = '';

    el('au-save-btn').classList.add('hidden');
    el('au-skip-btn').classList.add('hidden');
    el('au-progress').textContent    = `${urlPairs.length} pair${urlPairs.length !== 1 ? 's' : ''}`;
    el('au-current-url').textContent = '';
    setStatus('Click Open to view each pair in a new window.');

    urlPairs.forEach((pair, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem';

      const label = document.createElement('span');
      label.style.cssText = 'flex:1;font-size:0.78rem;color:var(--pico-muted-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      try {
        const p1 = new URL(pair.url1).pathname;
        const p2 = new URL(pair.url2).pathname;
        label.title = `${pair.url1}  ↔  ${pair.url2}`;
        label.textContent = `${p1}  ↔  ${p2}`;
      } catch {
        label.textContent = `Pair ${i + 1}`;
      }

      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'outline secondary pico-btn-sm';
      btn.textContent = 'Open';
      btn.addEventListener('click', () => chrome.windows.create({ url: [pair.url1, pair.url2] }));

      row.appendChild(label);
      row.appendChild(btn);
      container.appendChild(row);
    });

    // Start over button at bottom
    const restart = document.createElement('button');
    restart.type      = 'button';
    restart.className = 'outline secondary pico-btn-sm';
    restart.style.cssText = 'margin-top:0.5rem';
    restart.textContent = 'Start over';
    restart.addEventListener('click', resetToSetup);
    container.appendChild(restart);
  }

  // ── CSV builder ─────────────────────────────────────────────────────────────

  function csvCell(val) {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }

  function buildCsv(rows) {
    if (rows.length === 0) return '';
    const headers = mode === 'dual'
      ? ['url1','url2','title1','description1','h1_1','category1','tags1','date1','notes1',
         'title2','description2','h1_2','category2','tags2','date2','notes2']
      : ['url','title','description','h1','category','tags','date','notes'];
    const lines = [headers.join(',')];
    for (const row of rows) lines.push(headers.map(h => csvCell(row[h])).join(','));
    return lines.join('\r\n');
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: filename,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Start audit ─────────────────────────────────────────────────────────────

  function startAudit() {
    const raw = el('au-url-input').value.trim();
    if (!raw) { showToast('Paste at least one URL first.', 'warning'); return; }

    simpleCompare = el('au-simple-compare').checked;
    const { isDual, pairs } = parseCsvInput(raw);

    if (isDual) {
      mode     = 'dual';
      urlPairs = pairs;
    } else {
      mode = 'single';
      urls = pairs.map(p => p.url1).filter(Boolean);
      if (urls.length === 0) { showToast('No valid URLs found.', 'warning'); return; }
    }

    results = [];
    current = 0;

    el('au-setup').classList.add('hidden');
    el('au-audit').classList.remove('hidden');
    el('au-save-btn').classList.remove('hidden');
    el('au-skip-btn').classList.remove('hidden');
    el('au-save-btn').disabled       = false;
    el('au-skip-btn').disabled       = false;
    el('au-download-btn').disabled   = true;
    el('au-saved-count').textContent = '';

    if (isDual && simpleCompare) {
      renderSimpleCompareList();
      return;
    }

    goTo(0);
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    el('au-start-btn').addEventListener('click', startAudit);
    el('au-save-btn').addEventListener('click', saveAndNext);
    el('au-skip-btn').addEventListener('click', skip);
    el('au-download-btn').addEventListener('click', () => {
      downloadBlob('audit.csv', buildCsv(results), 'text/csv');
    });

    el('au-csv-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const { isDual, pairs } = parseCsvInput(ev.target.result);
        if (isDual) {
          el('au-url-input').value = pairs.map(p => `${p.url1},${p.url2}`).join('\n');
          el('au-simple-compare-row').classList.remove('hidden');
        } else {
          el('au-url-input').value = pairs.map(p => p.url1).join('\n');
          el('au-simple-compare-row').classList.add('hidden');
          el('au-simple-compare').checked = false;
        }
      };
      reader.readAsText(file);
      e.target.value = ''; // allow re-loading same file
    });
  });
})();
