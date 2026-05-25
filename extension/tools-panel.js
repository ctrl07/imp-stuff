'use strict';

(function initToolsPanel() {
  // ── Shared ──────────────────────────────────────────────────────────────────

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

  // ── Tool 1: Page Links → urls.txt ───────────────────────────────────────────

  async function exportPageLinks() {
    setStatus('tp-links-status', 'Gathering links from the page…');
    try {
      const data = await chrome.runtime.sendMessage({ type: 'RUN_WEBSITE_INSPECTION' });
      const links = (data && data.links) ? data.links : [];
      setStatus('tp-links-status', '');
      if (!links.length) {
        showToast('No links found on this page — try a page with more content.', 'warning');
        return;
      }
      downloadBlob('urls.txt', links.join('\n'), 'text/plain');
      showToast(`${links.length} link${links.length !== 1 ? 's' : ''} saved to urls.txt`, 'success');
    } catch (err) {
      setStatus('tp-links-status', '');
      showToast('Something went wrong: ' + err.message, 'error');
    }
  }

  // ── Tool 2: Sitemap XML → urls.txt ──────────────────────────────────────────

  function parseSitemapXml(xmlStr) {
    const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
    const parseErr = doc.querySelector('parsererror');
    if (parseErr) throw new Error('Couldn\'t parse this as XML — double-check the sitemap source.');
    const locs = Array.from(doc.querySelectorAll('loc'))
      .map(el => el.textContent.trim())
      .filter(Boolean);
    return [...new Set(locs)];
  }

  function parseSitemap() {
    const xml = document.getElementById('tp-sitemap-input').value.trim();
    if (!xml) {
      showToast('Paste your sitemap XML into the field above first.', 'warning');
      return;
    }
    try {
      const urls = parseSitemapXml(xml);
      if (!urls.length) {
        showToast('No URLs found in this sitemap — make sure it contains <loc> elements.', 'warning');
        return;
      }
      downloadBlob('urls.txt', urls.join('\n'), 'text/plain');
      showToast(`${urls.length} URL${urls.length !== 1 ? 's' : ''} saved to urls.txt`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ── Tool 3: WordPress XML → posts.csv ───────────────────────────────────────

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
      showToast('Choose a WordPress export file (.xml) to get started.', 'warning');
      return;
    }
    setStatus('tp-wp-status', 'Reading your export file…');
    const reader = new FileReader();
    reader.onload = () => {
      setStatus('tp-wp-status', '');
      try {
        const rows = parseWpXml(reader.result);
        if (!rows.length) {
          showToast('No posts found in this file — make sure it\'s a WordPress XML export.', 'warning');
          return;
        }
        const headers = ['title', 'url', 'date', 'time', 'description', 'h1', 'category', 'tag', 'author', 'content'];
        downloadBlob('posts.csv', toCsv(rows, headers), 'text/csv');
        showToast(`${rows.length} post${rows.length !== 1 ? 's' : ''} saved to posts.csv`, 'success');
      } catch (err) {
        showToast('Something went wrong: ' + err.message, 'error');
      }
    };
    reader.onerror = () => { setStatus('tp-wp-status', ''); showToast('Couldn\'t open the file — make sure it\'s accessible and try again.', 'error'); };
    reader.readAsText(file);
  }

  // ── Tool 0: Anchor Tag Outliner ─────────────────────────────────────────────

  async function setLinkOutline(enabled) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    if (enabled) {
      try {
        const hostname = new URL(tab.url).hostname;
        if (hostname === 'cms.dealeron.com') {
          const { allowCmsOutline } = await chrome.storage.sync.get('allowCmsOutline');
          if (!allowCmsOutline) {
            document.getElementById('tp-outline-links').checked = false;
            setStatus('tp-outline-status', '');
            showToast('Link outliner is turned off for the CMS — enable it in Settings.', 'warning');
            return;
          }
        }
      } catch { /* non-http tabs (e.g. chrome://) — fall through to scripting error */ }
    }

    const { outlineColor = '#f5a623' } = await chrome.storage.sync.get('outlineColor');

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (enable, color) => {
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
            outline: 2px solid ${color} !important;
            outline-offset: 2px !important;
          }
          .tars-link-hint {
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            background: rgba(18, 18, 18, 0.93) !important;
            border: 1px solid ${color} !important;
            color: ${color} !important;
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
      args: [enabled, outlineColor],
    });
  }

  // ── Tool 0b: Image Alt Checker ──────────────────────────────────────────────

  function setAltCheck(enabled) {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab) return;

      if (enabled) {
        try {
          const hostname = new URL(tab.url).hostname;
          if (hostname === 'cms.dealeron.com') {
            const { allowCmsOutline } = await chrome.storage.sync.get('allowCmsOutline');
            if (!allowCmsOutline) {
              document.getElementById('tp-check-alts').checked = false;
              setStatus('tp-alt-status', '');
              showToast('Image alt checker is turned off for the CMS — enable it in Settings.', 'warning');
              return;
            }
          }
        } catch { /* non-http tabs — fall through */ }
      }

      const { altHasColor = '#4caf50', altNoColor = '#f44336' } =
        await chrome.storage.sync.get(['altHasColor', 'altNoColor']);

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (enable, hasColor, noColor) => {
          const STYLE_ID = 'tars-alt-check';

          document.querySelectorAll('.tars-alt-hint').forEach(el => el.remove());
          document.getElementById(STYLE_ID)?.remove();
          if (!enable) return;

          const style = document.createElement('style');
          style.id = STYLE_ID;
          style.textContent = `
            img.tars-has-alt {
              outline: 2px solid ${hasColor} !important;
              outline-offset: 2px !important;
            }
            img.tars-no-alt {
              outline: 2px solid ${noColor} !important;
              outline-offset: 2px !important;
            }
            .tars-alt-hint {
              display: inline-flex !important;
              align-items: center !important;
              gap: 2px !important;
              background: rgba(18, 18, 18, 0.93) !important;
              border: 1px solid currentColor !important;
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
            .tars-alt-hint.has-alt  { color: ${hasColor} !important; }
            .tars-alt-hint.no-alt   { color: ${noColor} !important; }
            .tars-alt-hint-text {
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              white-space: nowrap !important;
              max-width: 160px !important;
            }
            .tars-alt-hint-copy {
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
            .tars-alt-hint-copy:hover {
              background: #444 !important;
              color: #fff !important;
            }
          `;
          document.head.appendChild(style);

          document.querySelectorAll('img').forEach(img => {
            const alt = img.getAttribute('alt');
            const hasAlt = alt !== null && alt.trim() !== '';

            img.classList.add(hasAlt ? 'tars-has-alt' : 'tars-no-alt');

            const hint = document.createElement('span');
            hint.className = `tars-alt-hint ${hasAlt ? 'has-alt' : 'no-alt'}`;

            const text = document.createElement('span');
            text.className = 'tars-alt-hint-text';
            const label = hasAlt
              ? (alt.length > 38 ? alt.slice(0, 37) + '…' : alt)
              : 'missing alt';
            text.textContent = label;
            text.title = hasAlt ? alt : 'No alt attribute';

            hint.appendChild(text);

            if (hasAlt) {
              const btn = document.createElement('button');
              btn.className = 'tars-alt-hint-copy';
              btn.textContent = 'copy';
              btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(alt).then(() => {
                  btn.textContent = '✓';
                  setTimeout(() => { btn.textContent = 'copy'; }, 1200);
                });
              });
              hint.appendChild(btn);
            }

            img.insertAdjacentElement('afterend', hint);
          });
        },
        args: [enabled, altHasColor, altNoColor],
      });
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    const outlineCheckbox = document.getElementById('tp-outline-links');
    outlineCheckbox.addEventListener('change', () => {
      setLinkOutline(outlineCheckbox.checked);
      setStatus('tp-outline-status', outlineCheckbox.checked ? 'Active.' : '');
    });

    const altCheckbox = document.getElementById('tp-check-alts');
    altCheckbox.addEventListener('change', () => {
      setAltCheck(altCheckbox.checked);
      setStatus('tp-alt-status', altCheckbox.checked ? 'Active.' : '');
    });

    // Reset checkboxes if the active tab navigates away
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'loading') {
        if (outlineCheckbox.checked) {
          outlineCheckbox.checked = false;
          setStatus('tp-outline-status', '');
        }
        if (altCheckbox.checked) {
          altCheckbox.checked = false;
          setStatus('tp-alt-status', '');
        }
      }
    });

    document.getElementById('tp-export-links').addEventListener('click', exportPageLinks);
    document.getElementById('tp-parse-sitemap').addEventListener('click', parseSitemap);

    const wpFile  = document.getElementById('tp-wp-file');
    const wpBtn   = document.getElementById('tp-convert-wp');
    const wpLabel = document.getElementById('tp-wp-label');
    wpFile.addEventListener('change', () => {
      wpBtn.disabled = !wpFile.files.length;
      wpLabel.textContent = wpFile.files.length ? wpFile.files[0].name : 'Upload XML';
    });
    wpBtn.addEventListener('click', convertWp);
  });
})();
