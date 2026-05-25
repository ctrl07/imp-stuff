'use strict';

(function initUrlOpenerPanel() {
  // ─── Edit this array to add, remove, or reorder destinations ────────────────
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
  // ─────────────────────────────────────────────────────────────────────────────

  function openUrl(template, id) {
    const url = template.url.replace('{id}', encodeURIComponent(id));
    chrome.tabs.create({ url, active: true });
  }

  function needsId(template) {
    return template.url.includes('{id}');
  }

  function renderButtons(input) {
    const container = document.getElementById('uo-buttons');
    container.innerHTML = '';

    URL_TEMPLATES.forEach(template => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'outline secondary pico-btn-sm tmpl-btn';
      btn.textContent = template.label;
      btn.disabled = needsId(template); // enabled immediately if no {id}

      btn.addEventListener('click', () => {
        const id = input.value.trim();
        if (needsId(template) && !id) return;
        openUrl(template, id);
      });

      container.appendChild(btn);
    });
  }

  function syncButtons(input) {
    const hasId = input.value.trim().length > 0;
    // Only sync template buttons (skip the trailing Download URLs button)
    document.querySelectorAll('#uo-buttons button.tmpl-btn').forEach((btn, i) => {
      btn.disabled = needsId(URL_TEMPLATES[i]) && !hasId;
    });
  }

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

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('st-open-busted').addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab || !tab.url || !tab.url.startsWith('http')) return;
        const url = new URL(tab.url);
        url.searchParams.set('_cb', Math.random().toString(36).slice(2, 8));
        chrome.tabs.create({ url: url.toString(), active: true });
      });
    });

    const input = document.getElementById('uo-id-input');

    renderButtons(input);

    // Download URLs button (not a URL template — always enabled)
    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'outline secondary pico-btn-sm';
    dlBtn.textContent = 'Download URLs';
    dlBtn.addEventListener('click', downloadSiteContentCsv);
    document.getElementById('uo-buttons').appendChild(dlBtn);

    input.addEventListener('input', () => syncButtons(input));

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && URL_TEMPLATES.length === 1) {
        const id = input.value.trim();
        if (id) openUrl(URL_TEMPLATES[0], id);
      }
    });
  });
})();
