'use strict';

// ── Shared ────────────────────────────────────────────────────────────────────

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function setStatus(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// ── Tool 1: Page Links → urls.txt ─────────────────────────────────────────────

async function exportPageLinks() {
  setStatus('tp-links-status', 'Fetching…');
  try {
    const data = await chrome.runtime.sendMessage({ type: 'RUN_WEBSITE_INSPECTION' });
    const links = (data && data.links) ? data.links : [];
    if (!links.length) {
      setStatus('tp-links-status', 'No links found on this page.');
      return;
    }
    downloadBlob('urls.txt', links.join('\n'), 'text/plain');
    setStatus('tp-links-status', `Downloaded ${links.length} link${links.length !== 1 ? 's' : ''}.`);
  } catch (err) {
    setStatus('tp-links-status', 'Error: ' + err.message);
  }
}

// ── Tool 2: Sitemap XML → urls.txt ────────────────────────────────────────────

function parseSitemapXml(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) throw new Error('Invalid XML.');
  const locs = Array.from(doc.querySelectorAll('loc'))
    .map(el => el.textContent.trim())
    .filter(Boolean);
  return [...new Set(locs)];
}

function parseSitemap() {
  const xml = document.getElementById('tp-sitemap-input').value.trim();
  if (!xml) {
    setStatus('tp-sitemap-status', 'Paste sitemap XML first.');
    return;
  }
  try {
    const urls = parseSitemapXml(xml);
    if (!urls.length) {
      setStatus('tp-sitemap-status', 'No <loc> elements found.');
      return;
    }
    downloadBlob('urls.txt', urls.join('\n'), 'text/plain');
    setStatus('tp-sitemap-status', `Downloaded ${urls.length} URL${urls.length !== 1 ? 's' : ''}.`);
  } catch (err) {
    setStatus('tp-sitemap-status', err.message);
  }
}

// ── Tool 3: WordPress XML → posts.csv ─────────────────────────────────────────

function wpText(item, tag) {
  const el = item.getElementsByTagName(tag)[0];
  return el ? el.textContent : '';
}

function stripHtml(html) {
  return new DOMParser()
    .parseFromString(html, 'text/html')
    .body.textContent.trim();
}

function extractH1(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.querySelector('h1') || {}).textContent || '';
}

function csvCell(val) {
  return '"' + String(val).replace(/"/g, '""') + '"';
}

function toCsv(rows, headers) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => csvCell(row[h] ?? '')).join(','));
  }
  return lines.join('\r\n');
}

function parseWpXml(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) throw new Error('Invalid XML.');

  return Array.from(doc.querySelectorAll('item')).map(item => {
    const postDate = wpText(item, 'wp:post_date');
    const [date = '', time = ''] = postDate.split(' ');
    const contentHtml = wpText(item, 'content:encoded');
    const excerptHtml = wpText(item, 'excerpt:encoded');

    const categories = Array.from(item.querySelectorAll('category[domain="category"]'))
      .map(el => el.textContent.trim())
      .join(', ');
    const tags = Array.from(item.querySelectorAll('category[domain="post_tag"]'))
      .map(el => el.textContent.trim())
      .join(', ');

    return {
      title:       wpText(item, 'title'),
      url:         wpText(item, 'link'),
      date,
      time,
      description: stripHtml(excerptHtml),
      h1:          extractH1(contentHtml),
      category:    categories,
      tag:         tags,
      author:      wpText(item, 'dc:creator'),
      content:     stripHtml(contentHtml),
    };
  });
}

function convertWp() {
  const file = document.getElementById('tp-wp-file').files[0];
  if (!file) {
    setStatus('tp-wp-status', 'Select a file first.');
    return;
  }
  setStatus('tp-wp-status', 'Parsing…');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseWpXml(reader.result);
      if (!rows.length) {
        setStatus('tp-wp-status', 'No <item> elements found.');
        return;
      }
      const headers = ['title', 'url', 'date', 'time', 'description', 'h1', 'category', 'tag', 'author', 'content'];
      downloadBlob('posts.csv', toCsv(rows, headers), 'text/csv');
      setStatus('tp-wp-status', `Downloaded ${rows.length} post${rows.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      setStatus('tp-wp-status', 'Error: ' + err.message);
    }
  };
  reader.onerror = () => setStatus('tp-wp-status', 'Could not read file.');
  reader.readAsText(file);
}

// ── Tool 0: Anchor Tag Outliner ────────────────────────────────────────────────

function setLinkOutline(enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (enable) => {
        const STYLE_ID = 'tars-link-outline';

        // Always clean up first
        document.querySelectorAll('.tars-link-hint').forEach(el => el.remove());
        document.getElementById(STYLE_ID)?.remove();
        if (!enable) return;

        // Styles for outline + hint chips
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          a[href] {
            outline: 2px solid #f5a623 !important;
            outline-offset: 2px !important;
          }
          .tars-link-hint {
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            background: rgba(18, 18, 18, 0.93) !important;
            border: 1px solid #f5a623 !important;
            color: #f5a623 !important;
            font-size: 10px !important;
            font-family: monospace !important;
            line-height: 1.4 !important;
            padding: 1px 3px 1px 4px !important;
            border-radius: 3px !important;
            vertical-align: middle !important;
            max-width: 220px !important;
            margin-left: 3px !important;
            pointer-events: auto !important;
            z-index: 999999 !important;
            position: relative !important;
          }
          .tars-link-hint-text {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            max-width: 160px !important;
          }
          .tars-link-hint-copy {
            display: inline-block !important;
            background: #2a2a2a !important;
            color: #999 !important;
            border: none !important;
            border-radius: 2px !important;
            font-size: 9px !important;
            font-family: monospace !important;
            padding: 0 4px !important;
            line-height: 1.7 !important;
            cursor: pointer !important;
            flex-shrink: 0 !important;
          }
          .tars-link-hint-copy:hover {
            background: #444 !important;
            color: #fff !important;
          }
        `;
        document.head.appendChild(style);

        // Inject a hint chip after every link
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href');
          if (!href || href.startsWith('javascript:') || href === '#') return;

          const hint = document.createElement('span');
          hint.className = 'tars-link-hint';

          const text = document.createElement('span');
          text.className = 'tars-link-hint-text';
          text.textContent = href.length > 38 ? href.slice(0, 37) + '…' : href;
          text.title = href;

          const btn = document.createElement('button');
          btn.className = 'tars-link-hint-copy';
          btn.textContent = 'copy';
          btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            navigator.clipboard.writeText(href).then(() => {
              btn.textContent = '✓';
              setTimeout(() => { btn.textContent = 'copy'; }, 1200);
            });
          });

          hint.appendChild(text);
          hint.appendChild(btn);
          a.insertAdjacentElement('afterend', hint);
        });
      },
      args: [enabled],
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const outlineCheckbox = document.getElementById('tp-outline-links');
  outlineCheckbox.addEventListener('change', () => {
    setLinkOutline(outlineCheckbox.checked);
    setStatus('tp-outline-status', outlineCheckbox.checked ? 'Links outlined on page.' : '');
  });

  // Reset checkbox if the active tab navigates away
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' && outlineCheckbox.checked) {
      outlineCheckbox.checked = false;
      setStatus('tp-outline-status', '');
    }
  });

  document.getElementById('tp-export-links').addEventListener('click', exportPageLinks);
  document.getElementById('tp-parse-sitemap').addEventListener('click', parseSitemap);

  const wpFile  = document.getElementById('tp-wp-file');
  const wpBtn   = document.getElementById('tp-convert-wp');
  const wpLabel = document.getElementById('tp-wp-label');
  wpFile.addEventListener('change', () => {
    wpBtn.disabled = !wpFile.files.length;
    wpLabel.textContent = wpFile.files.length ? wpFile.files[0].name : 'Choose file';
  });
  wpBtn.addEventListener('click', convertWp);
});
