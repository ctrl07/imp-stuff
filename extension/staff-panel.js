'use strict';

(function initStaffPanel() {
  const TEMPLATE_CSV = [
    'name,department,title,email,phone1,phone2,textme,hyperlink_label,hyperlink_url,open_in_new_tab,photo_filename,biography',
    'John Doe,Sales Department,Sales Manager,john@example.com,555-1234,,,LinkedIn,https://linkedin.com/in/johndoe,false,john_doe.png,"Experienced sales professional"',
    'Jane Smith,Service Department,Service Advisor,jane@example.com,555-5678,,555-5678,,,,,',
  ].join('\n');

  let employees = [];
  let currentIndex = 0;
  let isPaused = false;
  let isRunning = false;

  // --- CSV (handles quoted fields) ---
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result.map(v => v.replace(/^"|"$/g, '').trim());
  }

  function parseCSV(raw) {
    const lines = raw.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    return lines.slice(1).map((line, idx) => {
      const values = parseCSVLine(line);
      const emp = { id: idx, status: 'pending' };
      headers.forEach((h, i) => { emp[h] = values[i] || ''; });
      return emp;
    }).filter(e => e.name);
  }

  // --- UI helpers ---
  function badgeStyle(status) {
    const map = {
      pending: 'background:rgba(168,75,47,.15);color:#a84b2f',
      success: 'background:rgba(33,128,133,.15);color:#218085',
      error:   'background:rgba(192,21,47,.15);color:#c0152f',
    };
    return `padding:2px 8px;border-radius:10px;font-size:0.68rem;font-weight:500;${map[status] || map.pending}`;
  }

  function displayEmployees() {
    const list = el('staff-list');
    if (!list) return;
    list.innerHTML = employees.map(emp => `
      <div style="padding:6px 10px;border-bottom:1px solid var(--pico-muted-border-color);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:500;font-size:0.78rem">${emp.name}</div>
          <div style="font-size:0.7rem;color:var(--pico-muted-color)">${emp.department || ''}${emp.title ? ' \u2022 ' + emp.title : ''}</div>
        </div>
        <span id="staff-badge-${emp.id}" style="${badgeStyle('pending')}">pending</span>
      </div>
    `).join('');
  }

  function updateBadge(id, status) {
    const badge = document.getElementById(`staff-badge-${id}`);
    if (badge) { badge.style.cssText = badgeStyle(status); badge.textContent = status; }
    const emp = employees.find(e => e.id === id);
    if (emp) emp.status = status;
  }

  function updateProgress() {
    const fill = el('staff-progress-fill');
    const text = el('staff-progress-text');
    if (fill) fill.style.width = (employees.length ? (currentIndex / employees.length) * 100 : 0) + '%';
    if (text) text.textContent = `Processing: ${currentIndex} / ${employees.length}`;
  }

  function logMsg(msg, type) {
    const logEl = el('staff-log');
    if (!logEl) return;
    const colors = { success: '#218085', error: '#c0152f', info: 'var(--pico-muted-color)' };
    const line = document.createElement('div');
    line.style.color = colors[type] || colors.info;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setSection(id, visible) {
    const s = el(id);
    if (s) s.style.display = visible ? 'block' : 'none';
  }

  // --- Form filling via scripting.executeScript ---
  async function fillEmployee(tabId, emp) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (employee) => {
        function triggerEvents(node) {
          node.dispatchEvent(new Event('input',  { bubbles: true }));
          node.dispatchEvent(new Event('change', { bubbles: true }));
          node.dispatchEvent(new Event('blur',   { bubbles: true }));
          const sim = new Event('input', { bubbles: true });
          sim.simulated = true;
          node.dispatchEvent(sim);
        }
        function setVal(id, value) {
          if (!value) return;
          const node = document.getElementById(id);
          if (node) { node.value = value; triggerEvents(node); }
        }

        const sidebar = document.querySelector('.slideout-builder.open');
        if (!sidebar) return { error: 'Add Employee slideout is not open.' };

        setVal('employee-slideout-name',            employee.name);
        setVal('employee-slideout-title',           employee.title);
        setVal('employee-slideout-email',           employee.email);
        setVal('employee-slideout-phone1',          employee.phone1);
        setVal('employee-slideout-phone2',          employee.phone2);
        setVal('employee-slideout-textme',          employee.textme);
        setVal('employee-slideout-hyperlink-label', employee.hyperlink_label);
        setVal('employee-slideout-hyperlink-url',   employee.hyperlink_url);

        const photoVal = employee.photo_filename
          ? `#MISCPATH#${employee.photo_filename}`
          : (employee.photo || '');
        if (photoVal) setVal('employee-slideout-photo', photoVal);

        if (employee.biography) {
          const bio = document.getElementById('employee-slideout-biography');
          if (bio) { bio.value = employee.biography; triggerEvents(bio); }
        }

        const openNewTab = document.getElementById('employee-slideout-open-in-new-tab');
        if (openNewTab && employee.open_in_new_tab === 'true') {
          openNewTab.checked = true;
          triggerEvents(openNewTab);
        }

        return { ready: true };
      },
      args: [emp],
    });

    const step1 = results?.[0]?.result;
    if (!step1?.ready) return step1 || { error: 'Script returned no result.' };

    // Small pause then click confirm in a second injection
    await new Promise(r => setTimeout(r, 350));

    const results2 = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const btn = document.getElementById('employee-slideout-confirm');
        if (!btn) return { error: 'Confirm button not found.' };
        btn.click();
        return { ok: true };
      },
    });

    return results2?.[0]?.result || { error: 'Confirm script returned no result.' };
  }

  // --- Department boundary pause ---
  function waitForDepartmentConfirm(dept) {
    return new Promise(resolve => {
      const nameEl = el('staff-dept-name');
      if (nameEl) nameEl.textContent = dept;
      setSection('staff-dept-prompt', true);
      const continueBtn = el('staff-continue');
      if (continueBtn) continueBtn.style.display = 'inline-block';
      const pauseBtn = el('staff-pause');
      if (pauseBtn) pauseBtn.style.display = 'none';

      logMsg(`\u23F8 Select department "${dept}" in the form, then click Continue.`, 'info');

      function handler() {
        continueBtn.removeEventListener('click', handler);
        setSection('staff-dept-prompt', false);
        if (continueBtn) continueBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'inline-block';
        resolve();
      }
      if (continueBtn) continueBtn.addEventListener('click', handler);
      else resolve(); // safety fallback
    });
  }

  // --- Batch runner ---
  async function startImport() {
    if (isRunning || !employees.length) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { showToast('No active tab found', 'error'); return; }

    isRunning = true;
    isPaused = false;
    const runBtn = el('staff-run');
    if (runBtn) runBtn.disabled = true;
    const pauseBtn = el('staff-pause');
    if (pauseBtn) pauseBtn.style.display = 'inline-block';
    setSection('staff-progress-wrap', true);
    setSection('staff-log-section', true);

    logMsg('Starting import\u2026', 'info');

    let lastDept = null;

    for (let i = currentIndex; i < employees.length; i++) {
      if (isPaused) {
        logMsg('\u23F8 Import paused', 'info');
        isRunning = false;
        if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Resume'; }
        if (pauseBtn) pauseBtn.style.display = 'none';
        return;
      }

      // Pause at department boundary
      const dept = employees[i].department || '';
      if (dept && dept !== lastDept) {
        await waitForDepartmentConfirm(dept);
        lastDept = dept;
      }

      currentIndex = i;
      updateProgress();
      logMsg(`\u2192 ${employees[i].name}${dept ? ' (' + dept + ')' : ''}\u2026`, 'info');

      try {
        const res = await fillEmployee(tab.id, employees[i]);
        if (res?.ok) {
          updateBadge(employees[i].id, 'success');
          logMsg(`\u2713 Added: ${employees[i].name}`, 'success');
        } else {
          throw new Error(res?.error || 'Unknown error');
        }
      } catch (e) {
        updateBadge(employees[i].id, 'error');
        logMsg(`\u2717 Error: ${employees[i].name} \u2014 ${e.message}`, 'error');
      }

      const delay = parseInt(el('staff-delay-ms')?.value) || 1000;
      await new Promise(r => setTimeout(r, delay));
    }

    currentIndex = employees.length;
    updateProgress();
    logMsg('Import complete!', 'success');
    isRunning = false;
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Import Complete \u2713'; }
    if (pauseBtn) pauseBtn.style.display = 'none';
  }

  function resetAll() {
    currentIndex = 0; isPaused = false; isRunning = false;
    setSection('staff-dept-prompt', false);
    const continueBtn = el('staff-continue');
    if (continueBtn) continueBtn.style.display = 'none';
    employees.forEach(e => { e.status = 'pending'; updateBadge(e.id, 'pending'); });
    const fill = el('staff-progress-fill');
    if (fill) fill.style.width = '0%';
    const text = el('staff-progress-text');
    if (text) text.textContent = '';
    setSection('staff-progress-wrap', false);
    const logEl = el('staff-log');
    if (logEl) logEl.innerHTML = '';
    const runBtn = el('staff-run');
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Start Import'; }
    const pauseBtn = el('staff-pause');
    if (pauseBtn) pauseBtn.style.display = 'none';
    logMsg('Reset complete', 'info');
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'employee_template.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', () => {
    const fileInput = el('staff-file');
    if (!fileInput) return;

    el('staff-file-btn')?.addEventListener('click', () => fileInput.click());

    el('staff-delay-ms')?.addEventListener('input', function () {
      const label = el('staff-delay-val');
      if (label) label.textContent = this.value + ' ms';
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const nameLabel = el('staff-file-name');
      if (nameLabel) nameLabel.textContent = file.name;
      const reader = new FileReader();
      reader.onload = e => {
        employees = parseCSV(e.target.result);
        currentIndex = 0;
        if (!employees.length) {
          showToast('No valid rows found in CSV', 'warning');
          setSection('staff-employee-section', false);
          return;
        }
        displayEmployees();
        const runBtn = el('staff-run');
        if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Start Import'; }
        setSection('staff-progress-wrap', false);
        const logEl = el('staff-log');
        if (logEl) logEl.innerHTML = '';
        setSection('staff-employee-section', true);
        setSection('staff-log-section', true);
        logMsg(`Loaded ${employees.length} employee(s)`, 'info');
      };
      reader.onerror = () => showToast('Failed to read file', 'error');
      reader.readAsText(file);
    });

    el('staff-sample')?.addEventListener('click', downloadTemplate);
    el('staff-run')?.addEventListener('click', startImport);
    el('staff-pause')?.addEventListener('click', () => { isPaused = true; });
    el('staff-reset')?.addEventListener('click', resetAll);
  });
})();
