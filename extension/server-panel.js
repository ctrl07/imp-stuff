'use strict';

(function initServerPanel() {

  const BACKEND = 'http://localhost:8765';
  const POLL_MS  = 2000;

  // -------------------------------------------------------------------------
  // Built-in SEO presets
  // -------------------------------------------------------------------------

  const BUILTIN_PRESETS = [
    {
      label: 'Standard SEO',
      fields: [
        { key: 'title',       selector: 'title',                          attr: '',        multiple: false, enabled: true },
        { key: 'description', selector: 'meta[name="description"]',       attr: 'content', multiple: false, enabled: true },
        { key: 'h1',          selector: 'h1',                             attr: '',        multiple: false, enabled: true },
        { key: 'canonical',   selector: 'link[rel="canonical"]',          attr: 'href',    multiple: false, enabled: true },
        { key: 'robots',      selector: 'meta[name="robots"]',            attr: 'content', multiple: false, enabled: true },
      ],
    },
    {
      label: 'Blog Post',
      fields: [
        { key: 'title',       selector: 'title',                                   attr: '',        multiple: false, enabled: true },
        { key: 'description', selector: 'meta[name="description"]',                attr: 'content', multiple: false, enabled: true },
        { key: 'h1',          selector: 'h1',                                      attr: '',        multiple: false, enabled: true },
        { key: 'date',        selector: 'meta[property="article:published_time"]', attr: 'content', multiple: false, enabled: true },
        { key: 'category',    selector: 'meta[property="article:section"]',        attr: 'content', multiple: false, enabled: true },
        { key: 'tags',        selector: 'meta[property="article:tag"]',            attr: 'content', multiple: true,  enabled: true },
        { key: 'author',      selector: 'meta[name="author"]',                     attr: 'content', multiple: false, enabled: true },
      ],
    },
  ];

  let seoUserPresets  = [];  // loaded from chrome.storage.sync.seoPresets
  let staffUserPresets = [];  // loaded from chrome.storage.sync.staffPresets

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function setStatus(id, msg, isError) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = msg;
    node.style.color = isError ? 'var(--pico-del-color, #f44336)' : '';
  }

  function setDot(running) {
    const dot    = document.getElementById('sv-dot');
    const status = document.getElementById('sv-status');
    if (!dot) return;
    if (running) {
      dot.style.background = '#4caf50';
      status.textContent   = 'Backend running on :8765';
      status.style.color   = '';
    } else {
      dot.style.background = 'var(--pico-muted-color)';
      status.textContent   = 'Backend offline — run run.bat to start';
      status.style.color   = 'var(--pico-muted-color)';
    }
  }

  async function checkBackend() {
    try {
      const r = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(1500) });
      setDot(r.ok);
    } catch {
      setDot(false);
    }
  }

  async function pollJob(jobId, onProgress, onDone, onError) {
    while (true) {
      await new Promise(r => setTimeout(r, POLL_MS));
      try {
        const r    = await fetch(`${BACKEND}/jobs/${jobId}`);
        const data = await r.json();
        if (data.status === 'done')  { onDone(data.result);  return; }
        if (data.status === 'error') { onError(data.error);  return; }
        onProgress(data.progress, data.total, data.message);
      } catch (err) {
        onError(err.message);
        return;
      }
    }
  }

  function b64ToBlob(b64, mime) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: mime });
  }

  function downloadBlob(blob, filename) {
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(blob),
      download: filename,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadB64(b64, filename, mime = 'application/octet-stream') {
    downloadBlob(b64ToBlob(b64, mime), filename);
  }

  // Reusable labeled row
  function labelRow(label, value) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:0.5rem;padding:0.12rem 0;border-bottom:1px solid var(--pico-card-border-color)';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'color:var(--pico-muted-color);font-size:0.73rem;flex-shrink:0';
    lbl.textContent = label;
    const val = document.createElement('span');
    val.style.cssText = 'font-size:0.8rem;word-break:break-all;text-align:right';
    val.textContent = value;
    row.appendChild(lbl);
    row.appendChild(val);
    return row;
  }

  // -------------------------------------------------------------------------
  // Staff Extract — preset helpers
  // -------------------------------------------------------------------------

  const STAFF_SEL_IDS = ['card', 'name', 'title', 'phone', 'email', 'bio', 'image'];

  function renderStaffPresetDropdown() {
    const sel = document.getElementById('sv-staff-preset');
    sel.innerHTML = '';
    if (!staffUserPresets.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No presets saved';
      opt.disabled = true;
      opt.selected = true;
      sel.appendChild(opt);
    } else {
      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = '— select preset —';
      ph.disabled = true;
      ph.selected = true;
      sel.appendChild(ph);
      staffUserPresets.forEach((p, i) => {
        const opt = document.createElement('option');
        opt.value = `u:${i}`;
        opt.textContent = p.label;
        sel.appendChild(opt);
      });
    }
    updateStaffDeleteBtn();
  }

  function updateStaffDeleteBtn() {
    const sel = document.getElementById('sv-staff-preset');
    const del = document.getElementById('sv-staff-delete-btn');
    del.style.display = sel.value.startsWith('u:') ? '' : 'none';
  }

  function getActiveStaffSelectors() {
    const sels = {};
    STAFF_SEL_IDS.forEach(k => {
      sels[k] = document.getElementById(`sv-staff-sel-${k}`).value.trim();
    });
    return sels;
  }

  function setStaffSelectors(sels) {
    STAFF_SEL_IDS.forEach(k => {
      document.getElementById(`sv-staff-sel-${k}`).value = sels[k] || '';
    });
  }

  // -------------------------------------------------------------------------
  // Staff Extract — results renderer
  // -------------------------------------------------------------------------

  function renderStaffResults(container, result) {
    container.innerHTML = '';

    if (!result.staff || !result.staff.length) {
      container.textContent = 'No staff found.';
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:0.8rem;margin-bottom:0.4rem';
    summary.textContent = `Found ${result.count} staff member(s).`;
    container.appendChild(summary);

    const table = document.createElement('div');
    table.style.cssText = 'max-height:200px;overflow-y:auto;font-size:0.75rem;margin-bottom:0.5rem';
    result.staff.forEach(m => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:0.2rem 0;border-bottom:1px solid var(--pico-card-border-color)';
      row.textContent = [m.name, m.title, m.phone, m.email].filter(Boolean).join(' · ');
      row.title = m.bio || '';
      table.appendChild(row);
    });
    container.appendChild(table);

    if (result.zip_b64) {
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'outline secondary pico-btn-sm';
      dlBtn.textContent = 'Download ZIP (staff.csv + images)';
      dlBtn.addEventListener('click', () => downloadB64(result.zip_b64, 'staff.zip', 'application/zip'));
      container.appendChild(dlBtn);
    }
  }

  // -------------------------------------------------------------------------
  // SEO Bulk — preset system
  // -------------------------------------------------------------------------

  function getPresetByValue(val) {
    const [type, idx] = val.split(':');
    return type === 'b' ? BUILTIN_PRESETS[+idx] : seoUserPresets[+idx];
  }

  function renderSeoPresetDropdown() {
    const sel = document.getElementById('sv-seo-preset');
    const cur = sel.value;
    sel.innerHTML = '';
    BUILTIN_PRESETS.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = `b:${i}`;
      opt.textContent = p.label;
      sel.appendChild(opt);
    });
    seoUserPresets.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = `u:${i}`;
      opt.textContent = p.label;
      sel.appendChild(opt);
    });
    // restore selection if still valid
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
    updateDeleteBtn();
  }

  function updateDeleteBtn() {
    const sel = document.getElementById('sv-seo-preset');
    const del = document.getElementById('sv-seo-delete-btn');
    del.style.display = sel.value.startsWith('u:') ? '' : 'none';
  }

  const FIELD_ROW_CLASS = 'sv-field-row';

  function renderSeoFields(fields) {
    const container = document.getElementById('sv-seo-fields');
    container.innerHTML = '';

    // Column headers
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;gap:0.25rem;align-items:center;padding-bottom:0.2rem;margin-bottom:0.15rem;border-bottom:1px solid var(--pico-card-border-color)';
    hdr.innerHTML =
      '<span style="width:1.1rem;flex-shrink:0"></span>' +
      '<span style="width:5rem;font-size:0.67rem;color:var(--pico-muted-color)">Column</span>' +
      '<span style="flex:1;font-size:0.67rem;color:var(--pico-muted-color)">CSS selector</span>' +
      '<span style="width:3.5rem;font-size:0.67rem;color:var(--pico-muted-color)" title="HTML attribute to read; leave empty to use text content">Attr</span>' +
      '<span style="width:2.2rem;font-size:0.67rem;color:var(--pico-muted-color);text-align:center" title="Collect all matching elements and join with comma">Multi</span>' +
      '<span style="width:1.6rem;flex-shrink:0"></span>';
    container.appendChild(hdr);

    fields.forEach(f => container.appendChild(makeFieldRow(f)));
  }

  function makeFieldRow(f = {}) {
    const row = document.createElement('div');
    row.className = FIELD_ROW_CLASS;
    row.style.cssText = 'display:flex;gap:0.25rem;align-items:center;margin-bottom:0.2rem';

    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = f.enabled !== false;
    enabled.title = 'Include this field in the extract';
    enabled.style.cssText = 'flex-shrink:0;margin:0;width:1rem;height:1rem';

    const keyIn = document.createElement('input');
    keyIn.type = 'text';
    keyIn.value = f.key || '';
    keyIn.placeholder = 'column';
    keyIn.style.cssText = 'width:5rem;font-size:0.73rem;padding:0.18rem 0.3rem;height:auto';

    const selIn = document.createElement('input');
    selIn.type = 'text';
    selIn.value = f.selector || '';
    selIn.placeholder = 'e.g. meta[name="description"]';
    selIn.style.cssText = 'flex:1;min-width:0;font-size:0.73rem;padding:0.18rem 0.3rem;height:auto';

    const attrIn = document.createElement('input');
    attrIn.type = 'text';
    attrIn.value = f.attr || '';
    attrIn.placeholder = '(text)';
    attrIn.title = 'Attribute to read — leave blank to use element text content';
    attrIn.style.cssText = 'width:3.5rem;font-size:0.73rem;padding:0.18rem 0.3rem;height:auto';

    // Multi checkbox + label wrapper
    const multiWrap = document.createElement('label');
    multiWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0;width:2.2rem;flex-shrink:0;cursor:pointer';
    const multi = document.createElement('input');
    multi.type = 'checkbox';
    multi.checked = !!f.multiple;
    multi.title = 'Collect all matching elements and join with comma';
    multi.style.cssText = 'margin:0;width:1rem;height:1rem';
    multiWrap.appendChild(multi);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'outline secondary pico-btn-sm';
    del.textContent = '×';
    del.style.cssText = 'padding:0.15rem 0.4rem;font-size:0.75rem;flex-shrink:0;width:1.6rem';
    del.addEventListener('click', () => row.remove());

    row.appendChild(enabled);
    row.appendChild(keyIn);
    row.appendChild(selIn);
    row.appendChild(attrIn);
    row.appendChild(multiWrap);
    row.appendChild(del);
    return row;
  }

  function getActiveFields() {
    return [...document.querySelectorAll(`#sv-seo-fields .${FIELD_ROW_CLASS}`)].map(row => {
      const [enabled, keyIn, selIn, attrIn, multi] = row.querySelectorAll('input');
      return {
        key:      keyIn.value.trim(),
        selector: selIn.value.trim(),
        attr:     attrIn.value.trim(),
        multiple: multi.checked,
        enabled:  enabled.checked,
      };
    }).filter(f => f.key && f.selector);
  }

  function renderSeoResults(container, result) {
    container.innerHTML = '';
    if (!result.results || !result.results.length) return;

    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'outline secondary pico-btn-sm';
    dlBtn.textContent = `Download CSV (${result.results.length} rows)`;
    dlBtn.style.marginBottom = '0.4rem';
    dlBtn.addEventListener('click', () => {
      if (result.csv_b64) downloadB64(result.csv_b64, 'seo-bulk.csv', 'text/csv');
    });
    container.appendChild(dlBtn);

    // Preview first 5 rows — field-aware
    const preview = document.createElement('div');
    preview.style.cssText = 'max-height:180px;overflow-y:auto;font-size:0.73rem';
    result.results.slice(0, 5).forEach(r => {
      Object.entries(r).forEach(([k, v]) => {
        if (k === 'error' && !v) return;
        const display = String(v ?? '');
        preview.appendChild(labelRow(k, display.length > 80 ? display.slice(0, 80) + '…' : display || '—'));
      });
      const spacer = document.createElement('div');
      spacer.style.height = '0.3rem';
      preview.appendChild(spacer);
    });
    if (result.results.length > 5) {
      const more = document.createElement('div');
      more.style.cssText = 'color:var(--pico-muted-color);font-size:0.73rem;padding-top:0.2rem';
      more.textContent = `…and ${result.results.length - 5} more in the CSV.`;
      preview.appendChild(more);
    }
    container.appendChild(preview);
  }

  // -------------------------------------------------------------------------
  // Generic job runner
  // -------------------------------------------------------------------------

  async function runJob(endpoint, body, statusId, resultsId, renderFn, btnId) {
    const btn = document.getElementById(btnId);
    btn.disabled = true;
    setStatus(statusId, 'Starting…', false);
    document.getElementById(resultsId).innerHTML = '';

    try {
      const r = await fetch(`${BACKEND}${endpoint}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: r.statusText }));
        setStatus(statusId, `Error: ${err.detail || r.statusText}`, true);
        return;
      }
      const { job_id } = await r.json();

      await pollJob(
        job_id,
        (done, total, msg) => setStatus(statusId, msg || `${done}/${total}…`, false),
        result => {
          setStatus(statusId, 'Done.', false);
          renderFn(document.getElementById(resultsId), result);
        },
        err => setStatus(statusId, `Error: ${err}`, true),
      );
    } catch (err) {
      setStatus(statusId, `Error: ${err.message}`, true);
    } finally {
      btn.disabled = false;
    }
  }

  // Open a background Chrome tab, wait for load, return outerHTML, then close.
  async function fetchPageHtml(url) {
    const tab = await new Promise(resolve => chrome.tabs.create({ url, active: false }, resolve));
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Tab load timeout')), 30_000);
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          clearTimeout(t);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
    const [{ result: html }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    });
    chrome.tabs.remove(tab.id);
    return html;
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {

    // Poll backend health on tab open
    checkBackend();
    document.getElementById('tab-server')?.addEventListener('click', checkBackend);

    // -----------------------------------------------------------------------
    // Staff Extract — always via Chrome tab
    // -----------------------------------------------------------------------
    document.getElementById('sv-staff-btn').addEventListener('click', async () => {
      const url = document.getElementById('sv-staff-url').value.trim();
      if (!url) { showToast('Enter a staff page URL.', 'warning'); return; }
      const btn = document.getElementById('sv-staff-btn');
      btn.disabled = true;
      document.getElementById('sv-staff-results').innerHTML = '';
      setStatus('sv-staff-status', 'Opening tab…', false);
      try {
        const html = await fetchPageHtml(url);
        const selectors = getActiveStaffSelectors();
        await runJob('/staff/parse', { html, url, selectors },
          'sv-staff-status', 'sv-staff-results', renderStaffResults, 'sv-staff-btn');
      } catch (e) {
        setStatus('sv-staff-status', `Error: ${e.message}`, true);
        btn.disabled = false;
      }
    });

    // -----------------------------------------------------------------------
    // Staff Extract — preset system
    // -----------------------------------------------------------------------

    chrome.storage.sync.get(['staffPresets'], data => {
      staffUserPresets = data.staffPresets || [];
      renderStaffPresetDropdown();
    });

    document.getElementById('sv-staff-preset').addEventListener('change', () => {
      const val = document.getElementById('sv-staff-preset').value;
      if (!val.startsWith('u:')) return;
      const idx = parseInt(val.split(':')[1]);
      setStaffSelectors(staffUserPresets[idx].selectors);
      updateStaffDeleteBtn();
    });

    document.getElementById('sv-staff-save-btn').addEventListener('click', () => {
      document.getElementById('sv-staff-save-form').style.display = 'flex';
      document.getElementById('sv-staff-save-name').focus();
    });

    document.getElementById('sv-staff-save-cancel').addEventListener('click', () => {
      document.getElementById('sv-staff-save-form').style.display = 'none';
      document.getElementById('sv-staff-save-name').value = '';
    });

    function confirmSaveStaffPreset() {
      const name = document.getElementById('sv-staff-save-name').value.trim();
      if (!name) { showToast('Enter a preset name.', 'warning'); return; }
      staffUserPresets.push({ label: name, selectors: getActiveStaffSelectors() });
      chrome.storage.sync.set({ staffPresets: staffUserPresets });
      renderStaffPresetDropdown();
      const sel = document.getElementById('sv-staff-preset');
      sel.value = `u:${staffUserPresets.length - 1}`;
      updateStaffDeleteBtn();
      document.getElementById('sv-staff-save-form').style.display = 'none';
      document.getElementById('sv-staff-save-name').value = '';
      showToast(`Preset "${name}" saved.`, 'success');
    }

    document.getElementById('sv-staff-save-confirm').addEventListener('click', confirmSaveStaffPreset);
    document.getElementById('sv-staff-save-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmSaveStaffPreset();
      if (e.key === 'Escape') document.getElementById('sv-staff-save-cancel').click();
    });

    document.getElementById('sv-staff-delete-btn').addEventListener('click', () => {
      const val = document.getElementById('sv-staff-preset').value;
      if (!val.startsWith('u:')) return;
      const idx = parseInt(val.split(':')[1]);
      const name = staffUserPresets[idx]?.label || 'preset';
      staffUserPresets.splice(idx, 1);
      chrome.storage.sync.set({ staffPresets: staffUserPresets });
      renderStaffPresetDropdown();
      showToast(`"${name}" deleted.`, 'info');
    });

    // -----------------------------------------------------------------------
    // SEO Bulk — preset system
    // -----------------------------------------------------------------------

    chrome.storage.sync.get(['seoPresets'], data => {
      seoUserPresets = data.seoPresets || [];
      renderSeoPresetDropdown();
      renderSeoFields(BUILTIN_PRESETS[0].fields);
    });

    document.getElementById('sv-seo-preset').addEventListener('change', () => {
      const val = document.getElementById('sv-seo-preset').value;
      const preset = getPresetByValue(val);
      if (preset) renderSeoFields(preset.fields);
      updateDeleteBtn();
    });

    // Save button — show inline name form
    document.getElementById('sv-seo-save-btn').addEventListener('click', () => {
      document.getElementById('sv-seo-save-form').style.display = 'flex';
      document.getElementById('sv-seo-save-name').focus();
    });

    document.getElementById('sv-seo-save-cancel').addEventListener('click', () => {
      document.getElementById('sv-seo-save-form').style.display = 'none';
      document.getElementById('sv-seo-save-name').value = '';
    });

    function confirmSavePreset() {
      const name = document.getElementById('sv-seo-save-name').value.trim();
      if (!name) { showToast('Enter a preset name.', 'warning'); return; }
      seoUserPresets.push({ label: name, fields: getActiveFields() });
      chrome.storage.sync.set({ seoPresets: seoUserPresets });
      renderSeoPresetDropdown();
      // select the new preset
      const sel = document.getElementById('sv-seo-preset');
      sel.value = `u:${seoUserPresets.length - 1}`;
      updateDeleteBtn();
      document.getElementById('sv-seo-save-form').style.display = 'none';
      document.getElementById('sv-seo-save-name').value = '';
      showToast(`Preset "${name}" saved.`, 'success');
    }

    document.getElementById('sv-seo-save-confirm').addEventListener('click', confirmSavePreset);
    document.getElementById('sv-seo-save-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmSavePreset();
      if (e.key === 'Escape') document.getElementById('sv-seo-save-cancel').click();
    });

    // Delete user preset
    document.getElementById('sv-seo-delete-btn').addEventListener('click', () => {
      const val = document.getElementById('sv-seo-preset').value;
      if (!val.startsWith('u:')) return;
      const idx = parseInt(val.split(':')[1]);
      const name = seoUserPresets[idx]?.label || 'preset';
      seoUserPresets.splice(idx, 1);
      chrome.storage.sync.set({ seoPresets: seoUserPresets });
      renderSeoPresetDropdown();
      renderSeoFields(BUILTIN_PRESETS[0].fields);
      showToast(`"${name}" deleted.`, 'info');
    });

    // Add field row
    document.getElementById('sv-seo-add-field').addEventListener('click', () => {
      document.getElementById('sv-seo-fields').appendChild(makeFieldRow());
    });

    // Extract button — Chrome tabs + batch parse
    document.getElementById('sv-seo-btn').addEventListener('click', async () => {
      const raw  = document.getElementById('sv-seo-urls').value;
      const urls = raw.split('\n').map(s => s.trim()).filter(Boolean);
      if (!urls.length) { showToast('Enter at least one URL.', 'warning'); return; }
      const fields = getActiveFields();
      if (!fields.length) { showToast('Add at least one field.', 'warning'); return; }

      const btn = document.getElementById('sv-seo-btn');
      btn.disabled = true;
      document.getElementById('sv-seo-results').innerHTML = '';

      const pages = [];
      for (let i = 0; i < urls.length; i++) {
        setStatus('sv-seo-status', `Opening tab ${i + 1}/${urls.length}…`, false);
        try {
          const html = await fetchPageHtml(urls[i]);
          pages.push({ html, url: urls[i] });
        } catch (e) {
          pages.push({ html: '', url: urls[i], error: e.message });
        }
      }

      setStatus('sv-seo-status', 'Starting…', false);
      try {
        const r = await fetch(`${BACKEND}/seo/parse-batch`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ pages, fields }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({ detail: r.statusText }));
          setStatus('sv-seo-status', `Error: ${err.detail || r.statusText}`, true);
          return;
        }
        const { job_id } = await r.json();
        await pollJob(
          job_id,
          (done, total, msg) => setStatus('sv-seo-status', msg || `${done}/${total}…`, false),
          result => { setStatus('sv-seo-status', 'Done.', false); renderSeoResults(document.getElementById('sv-seo-results'), result); },
          err => setStatus('sv-seo-status', `Error: ${err}`, true),
        );
      } catch (err) {
        setStatus('sv-seo-status', `Error: ${err.message}`, true);
      } finally {
        btn.disabled = false;
      }
    });

  });
})();
