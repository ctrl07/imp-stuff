'use strict';

(function initTimeTrackerPanel() {

  const TASK_PRESETS = [
    { name: 'Add SEO',                                           pts: 0.5 },
    { name: 'Archive Site',                                      pts: 0.5 },
    { name: 'BAM Banners Request',                               pts: 0.5 },
    { name: 'Content Migration - Blog Step 1: Case Creation',    pts: 0.5 },
    { name: 'Homepage Banner Review',                            pts: 0.5 },
    { name: 'Onboarding Task',                                   pts: 0.5 },
    { name: 'Order Custom Content',                              pts: 0.5 },
    { name: 'SRP Edits',                                         pts: 0.5 },
    { name: 'Portal Access Request',                             pts: 0.5 },
    { name: 'Prior Reporting',                                   pts: 0.5 },
    { name: 'Migrate Staff',                                     pts: 0.5 },
    { name: 'Order Call Tracking',                               pts: 0.5 },
    { name: 'BGS - Features & Integrations Migration',           pts: 0.5 },
    { name: 'TPI Migration - Step 1',                            pts: 0.5 },
    { name: 'Internal Audit',                                    pts: 0.5 },
    { name: 'Check SEO',                                         pts: 0.5 },
    { name: 'Migrate Over SEO',                                  pts: 0.5 },
    { name: 'Add Favicon',                                       pts: 0.5 },
    { name: 'Specialist Work Review',                            pts: 1   },
    { name: 'Setup Task',                                        pts: 1   },
    { name: 'Content Migration \u2013 Custom Page Case Creation',pts: 1   },
    { name: 'Content Migration - SRP case creation',             pts: 1   },
    { name: 'Dealer Edits',                                      pts: 1   },
    { name: 'Post Launch Clean-Up',                              pts: 1   },
    { name: 'Website Edits',                                     pts: 1   },
    { name: 'Content Migration \u2013 MRP Case Creation',        pts: 1   },
    { name: 'Migrate Title Tags and Meta Description',           pts: 1   },
    { name: 'Create Dealer Locator',                             pts: 1   },
    { name: 'Create Specials',                                   pts: 1   },
    { name: 'Content Migration - Blog Step 2: Review',           pts: 1.5 },
    { name: 'URL Redirects',                                     pts: 1.5 },
    { name: 'Create Spanish Translations',                       pts: 1.5 },
    { name: 'Website Audit',                                     pts: 1.5 },
    { name: 'Manual Blog Migration',                             pts: 1.5 },
    { name: 'Manual Archive',                                    pts: 1.5 },
  ];

  let entries = [];

  // Helpers

  function csvCell(val) {
    const s = String(val ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: filename,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function totalPts() {
    return entries.reduce((sum, e) => sum + Number(e.pts), 0);
  }

  function saveEntries() {
    chrome.storage.local.set({ timeTrackerEntries: entries });
  }

  function updateTotal() {
    const total = totalPts();
    el('tt-total').textContent = `${total % 1 === 0 ? total : total.toFixed(1)} pts`;
  }

  function updateButtons() {
    const hasEntries = entries.length > 0;
    el('tt-export-btn').disabled = !hasEntries;
    el('tt-clear-btn').disabled  = !hasEntries;
  }

  function renderList() {
    const list = el('tt-list');
    list.innerHTML = '';

    if (entries.length === 0) {
      list.innerHTML = '<div style="color:var(--pico-muted-color);padding:0.3rem 0">No tasks logged yet.</div>';
      updateTotal();
      updateButtons();
      return;
    }

    // Newest first
    [...entries].reverse().forEach((entry, reversedIdx) => {
      const realIdx = entries.length - 1 - reversedIdx;
      const dt = new Date(entry.timestamp);
      const dateStr = dt.toLocaleDateString();
      const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:baseline;gap:0.4rem;padding:0.2rem 0;border-bottom:1px solid var(--pico-card-border-color)';

      const taskSpan = document.createElement('span');
      taskSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      taskSpan.title = entry.name;
      taskSpan.textContent = entry.name;

      const ptsSpan = document.createElement('span');
      ptsSpan.style.cssText = 'flex-shrink:0;color:var(--pico-muted-color);font-size:0.75rem';
      ptsSpan.textContent = `${entry.pts} pts`;

      const dateSpan = document.createElement('span');
      dateSpan.style.cssText = 'flex-shrink:0;color:var(--pico-muted-color);font-size:0.75rem';
      dateSpan.textContent = `${dateStr} ${timeStr}`;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'outline secondary pico-btn-sm';
      delBtn.textContent = '×';
      delBtn.style.cssText = 'padding:0.1rem 0.35rem;flex-shrink:0';
      delBtn.title = 'Remove entry';
      delBtn.addEventListener('click', () => {
        entries.splice(realIdx, 1);
        saveEntries();
        renderList();
      });

      row.appendChild(taskSpan);
      row.appendChild(ptsSpan);
      row.appendChild(dateSpan);
      row.appendChild(delBtn);
      list.appendChild(row);
    });

    updateTotal();
    updateButtons();
  }

  // Init

  document.addEventListener('DOMContentLoaded', () => {

    // Populate preset select
    const select = el('tt-preset-select');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select Task';
    select.appendChild(placeholder);

    TASK_PRESETS.forEach(preset => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify(preset);
      opt.textContent = `${preset.name} (${preset.pts})`;
      select.appendChild(opt);
    });

    // Load persisted entries
    chrome.storage.local.get('timeTrackerEntries', ({ timeTrackerEntries }) => {
      entries = timeTrackerEntries || [];
      renderList();
    });

    // Preset selection auto-fills name + points
    select.addEventListener('change', () => {
      if (!select.value) return;
      const preset = JSON.parse(select.value);
      el('tt-task-input').value   = preset.name;
      el('tt-points-input').value = preset.pts;
    });

    // Log button
    el('tt-log-btn').addEventListener('click', () => {
      const name = el('tt-task-input').value.trim();
      const pts  = parseFloat(el('tt-points-input').value);

      if (!name) { showToast('Enter a task name.', 'warning'); return; }
      if (isNaN(pts) || pts < 0) { showToast('Enter a valid points value.', 'warning'); return; }

      entries.push({ name, pts, timestamp: new Date().toISOString() });
      saveEntries();
      renderList();

      // Reset form
      el('tt-task-input').value   = '';
      el('tt-points-input').value = '';
      select.value = '';

      showToast(`"${name}" logged (+${pts} pts)`, 'success');
    });

    // Export CSV
    el('tt-export-btn').addEventListener('click', () => {
      if (!entries.length) return;
      const header = ['task', 'points', 'date', 'time'].join(',');
      const rows = entries.map(e => {
        const dt = new Date(e.timestamp);
        return [
          csvCell(e.name),
          csvCell(e.pts),
          csvCell(dt.toLocaleDateString()),
          csvCell(dt.toLocaleTimeString()),
        ].join(',');
      });
      downloadBlob('tasks.csv', [header, ...rows].join('\r\n'), 'text/csv');
      showToast(`${entries.length} task(s) exported.`, 'success');
    });

    // Clear all
    el('tt-clear-btn').addEventListener('click', () => {
      if (!entries.length) return;
      if (!confirm('Clear all logged tasks?')) return;
      entries = [];
      chrome.storage.local.remove('timeTrackerEntries');
      renderList();
      showToast('All tasks cleared.', 'success');
    });
  });
})();
