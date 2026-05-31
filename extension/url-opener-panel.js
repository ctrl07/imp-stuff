'use strict';

(function initUrlOpenerPanel() {
  // Edit this array to add, remove, or reorder destinations
  // Use {id} as the placeholder for the dealer ID.
  // Entries without {id} (e.g. BAM) are always openable regardless of input.
  const URL_TEMPLATES = [
    { label: 'Site Content',  url: 'https://cms.dealeron.com/dash/dist/cms/#/{id}/siteContent' },
    { label: 'SEO',           url: 'https://cms.dealeron.com/dash/dist/cms/#/{id}/EditAllSeo' },
    { label: 'Banners',       url: 'https://cms.dealeron.com/dash/dist/cms/#/{id}/homepageBanners' },
    { label: 'Blogs',         url: 'https://cms.dealeron.com/dash/dist/cms/#/{id}/manageBlogs' },
    { label: 'Redirects',     url: 'https://cms.dealeron.com/dash/dist/cms/#/{id}/urlRedirects' },
    { label: 'Dealer Info',   url: 'https://cms.dealeron.com/dash/dist/dealerInfo/#/dealer/{id}/tab/general' },
    { label: 'Staff',         url: 'https://staff.dealeron.com/#/{id}/staff-directory-legacy' },
    { label: 'Specials',      url: 'https://specials.dealeron.com/#/specials/dealer/{id}/view/New' },
    { label: 'Gallery',       url: 'https://gallery.dealeron.com/#/{id}' },
    { label: 'Integrations',  url: 'https://tpi.dealeron.com/#/{id}/thirdPartyIntegrations' },
    { label: 'OEM Settings',  url: 'https://oemsettings.dealeron.com/#/{id}/settings' },
    { label: 'Google Ads',    url: 'https://gmanbaa.dealeron.us/#/{id}/google-account-manager' },
    { label: 'Admin Tools',   url: 'https://clientconfig.dealeron.com/#/{id}/adminTools' },
    { label: 'BAM',           url: 'https://bam.dealeron.com/#/' },
  ];
  

  let customTemplates  = [];
  let showDownloadUrls = true;

  function openUrl(template, id) {
    const url = template.url.replace('{id}', encodeURIComponent(id));
    chrome.tabs.create({ url, active: true });
  }

  function needsId(template) {
    return template.url.includes('{id}');
  }

  // Button factory

  function makeTemplateBtn(template, input) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'outline secondary pico-btn-sm tmpl-btn';
    btn.textContent = template.label;
    btn.dataset.needsId = needsId(template) ? '1' : '0';
    btn.disabled = needsId(template) && !input.value.trim();
    btn.addEventListener('click', () => {
      const id = input.value.trim();
      if (needsId(template) && !id) return;
      openUrl(template, id);
    });
    return btn;
  }

  // Render

  function renderAllButtons(input) {
    const container = document.getElementById('uo-buttons');
    container.innerHTML = '';

    // Built-in template buttons
    URL_TEMPLATES.forEach(template => {
      container.appendChild(makeTemplateBtn(template, input));
    });

    // Custom template buttons with delete (×)
    customTemplates.forEach((template, index) => {
      const wrap = document.createElement('span');
      wrap.style.cssText = 'display:inline-flex;align-items:stretch';

      const btn = makeTemplateBtn(template, input);
      btn.style.borderRadius = '0.35rem 0 0 0.35rem';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'outline secondary pico-btn-sm';
      del.textContent = '×';
      del.title = `Remove "${template.label}"`;
      del.style.cssText = [
        'padding:0.22rem 0.45rem',
        'margin-left:-1px',
        'border-radius:0 0.35rem 0.35rem 0',
        'color:var(--pico-muted-color)',
      ].join(';');
      del.addEventListener('click', () => {
        customTemplates.splice(index, 1);
        chrome.storage.sync.set({ customTemplates });
        renderAllButtons(input);
      });

      wrap.appendChild(btn);
      wrap.appendChild(del);
      container.appendChild(wrap);
    });

    // Download URLs button (visibility controlled by setting)
    if (showDownloadUrls) {
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'outline secondary pico-btn-sm';
      dlBtn.textContent = 'Download URLs';
      dlBtn.addEventListener('click', downloadSiteContentCsv);
      container.appendChild(dlBtn);
    }

    // + button to open the add-custom form
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'outline secondary pico-btn-sm';
    addBtn.textContent = '+';
    addBtn.title = 'Add custom button';
    addBtn.addEventListener('click', () => {
      const form = document.getElementById('uo-add-form');
      const isHidden = form.classList.toggle('hidden');
      if (!isHidden) document.getElementById('uo-add-label').focus();
    });
    container.appendChild(addBtn);
  }

  function syncButtons(input) {
    const hasId = input.value.trim().length > 0;
    document.querySelectorAll('#uo-buttons .tmpl-btn').forEach(btn => {
      btn.disabled = btn.dataset.needsId === '1' && !hasId;
    });
  }

  // Site Content CSV export

  function downloadSiteContentCsv() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const rows = document.querySelectorAll('#mainTable tbody tr');
          const out = [['Page Title', 'Slug']];

          rows.forEach(row => {
            const select = row.querySelector('select[id^="pageStatus-"]');
            if (select && parseInt(select.value, 10) === 0) return;

            const titleEl = row.querySelector('strong') || row.querySelector('b');
            const slugEl  = [...row.querySelectorAll('em')].find(e => e.style.float === 'right');

            if (!titleEl) return;

            const title = titleEl.textContent.trim();
            const slug  = slugEl ? slugEl.textContent.trim() : '';
            const esc   = s => `"${s.replace(/"/g, '""')}"`;

            out.push([esc(title), esc(slug)]);
          });

          const csv = out.map(r => r.join(',')).join('\n');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          a.download = 'sitecontent.csv';
          a.click();
          URL.revokeObjectURL(a.href);
        },
      });
    });
  }

  // Init

  async function refreshDealerBadge() {
    const badge = el('uo-dealer-badge');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith('http')) { badge.style.display = 'none'; return; }
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const s = document.getElementById('dealeron_website_metadata');
          if (!s) return null;
          try { return JSON.parse(s.textContent).dealerId ?? null; } catch { return null; }
        },
      });
      if (result) {
        badge.textContent = `#${result}`;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    } catch {
      badge.style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshDealerBadge();

    chrome.tabs.onActivated.addListener(() => refreshDealerBadge());
    chrome.tabs.onUpdated.addListener((tabId, info) => {
      if (info.status === 'complete') refreshDealerBadge();
    });

    document.querySelector('[data-page="url-opener"]')
      ?.addEventListener('click', () => refreshDealerBadge());

    document.getElementById('st-open-busted').addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab || !tab.url || !tab.url.startsWith('http')) return;
        const url = new URL(tab.url);
        url.searchParams.set('_cb', Math.random().toString(36).slice(2, 8));
        chrome.tabs.create({ url: url.toString(), active: true });
      });
    });

    const input = document.getElementById('uo-id-input');

    // Load initial state from storage then render
    chrome.storage.sync.get(['customTemplates', 'showDownloadUrls'], data => {
      customTemplates  = data.customTemplates || [];
      showDownloadUrls = data.showDownloadUrls !== false; // default true
      renderAllButtons(input);
    });

    // React to settings changes live
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if ('showDownloadUrls' in changes) {
        showDownloadUrls = !!changes.showDownloadUrls.newValue;
        renderAllButtons(input);
      }
    });

    // Add custom button form
    document.getElementById('uo-add-btn').addEventListener('click', () => {
      const label = document.getElementById('uo-add-label').value.trim();
      const url   = document.getElementById('uo-add-url').value.trim();
      if (!label) { showToast('Enter a label for the button.', 'warning'); return; }
      if (!url)   { showToast('Enter a URL for the button.', 'warning'); return; }
      customTemplates.push({ label, url });
      chrome.storage.sync.set({ customTemplates });
      document.getElementById('uo-add-label').value = '';
      document.getElementById('uo-add-url').value   = '';
      document.getElementById('uo-add-form').classList.add('hidden');
      renderAllButtons(input);
      showToast(`"${label}" button added.`, 'success');
    });

    document.getElementById('uo-add-cancel').addEventListener('click', () => {
      document.getElementById('uo-add-form').classList.add('hidden');
    });

    input.addEventListener('input', () => syncButtons(input));

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && URL_TEMPLATES.length === 1) {
        const id = input.value.trim();
        if (id) openUrl(URL_TEMPLATES[0], id);
      }
    });

    // Notepad — persist to chrome.storage.local
    const notepad = document.getElementById('uo-notepad');
    chrome.storage.local.get('notepadContent', ({ notepadContent }) => {
      notepad.value = notepadContent || '';
    });

    let notepadSaveTimer = null;
    notepad.addEventListener('input', () => {
      clearTimeout(notepadSaveTimer);
      notepadSaveTimer = setTimeout(() => {
        chrome.storage.local.set({ notepadContent: notepad.value });
      }, 600);
    });

    document.getElementById('uo-notepad-save').addEventListener('click', () => {
      clearTimeout(notepadSaveTimer);
      chrome.storage.local.set({ notepadContent: notepad.value });
      showToast('Saved', 'success');
    });

    document.getElementById('uo-notepad-clear').addEventListener('click', () => {
      notepad.value = '';
      clearTimeout(notepadSaveTimer);
      chrome.storage.local.remove('notepadContent');
      showToast('Cleared', 'success');
    });
  });
})();
