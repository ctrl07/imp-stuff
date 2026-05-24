'use strict';

function parseCsvPairs(text) {
  const lines = text.split(/\r?\n/);
  const pairs = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split on first comma only
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) continue;

    const live    = trimmed.slice(0, commaIdx).trim().replace(/^"|"$/g, '');
    const staging = trimmed.slice(commaIdx + 1).trim().replace(/^"|"$/g, '');

    // Validate both are URLs
    try {
      new URL(live);
      new URL(staging);
    } catch {
      continue; // skip invalid or header rows
    }

    pairs.push({ live, staging });
  }

  return pairs;
}

function shortLabel(urlStr) {
  try {
    const u = new URL(urlStr);
    const path = u.pathname.replace(/\/$/, '') || '/';
    const label = u.hostname + path;
    return label.length > 42 ? label.slice(0, 40) + '…' : label;
  } catch {
    return urlStr.slice(0, 42);
  }
}

function renderPairs(pairs) {
  const list = document.getElementById('cp-list');
  list.innerHTML = '';

  for (const { live, staging } of pairs) {
    const row = document.createElement('div');
    row.className = 'cp-row';

    const label = document.createElement('span');
    label.className = 'cp-label';
    label.textContent = shortLabel(live);
    label.title = live;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'outline secondary pico-btn-sm';
    btn.textContent = 'Open';
    btn.addEventListener('click', () => {
      chrome.windows.create({ url: [live, staging], focused: true });
    });

    row.appendChild(label);
    row.appendChild(btn);
    list.appendChild(row);
  }
}

function setStatus(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('cp-file');
  const fileLabel = document.getElementById('cp-file-label');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileLabel.textContent = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const pairs = parseCsvPairs(reader.result);
        if (!pairs.length) {
          setStatus('cp-status', 'No valid URL pairs found.');
          return;
        }
        renderPairs(pairs);
        setStatus('cp-status', `${pairs.length} pair${pairs.length !== 1 ? 's' : ''} loaded.`);
      } catch (err) {
        setStatus('cp-status', 'Error: ' + err.message);
      }
    };
    reader.onerror = () => setStatus('cp-status', 'Could not read file.');
    reader.readAsText(file);
  });
});
