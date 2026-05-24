'use strict';

// ─── Edit this array to add, remove, or reorder destinations ──────────────────
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
// ──────────────────────────────────────────────────────────────────────────────

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
    btn.className = 'outline secondary pico-btn-sm';
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
  document.querySelectorAll('#uo-buttons button').forEach((btn, i) => {
    btn.disabled = needsId(URL_TEMPLATES[i]) && !hasId;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('uo-id-input');

  renderButtons(input);

  input.addEventListener('input', () => syncButtons(input));

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && URL_TEMPLATES.length === 1) {
      const id = input.value.trim();
      if (id) openUrl(URL_TEMPLATES[0], id);
    }
  });
});
