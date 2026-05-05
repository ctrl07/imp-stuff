/* global RULES, ut_cleanUrls, ut_classifyAll, ut_groupByCategory, ut_loadCmsSlugs, ut_matchRedirects, ut_redirectSummary, ut_toTsv */

const panel = {
  data: null,
  sitemapLinks: [],
  sitemapAbort: false
};

function el(id) {
  return document.getElementById(id);
}

function setStatus(message) {
  const status = el('status');
  if (status) status.textContent = message;
}

function setText(id, text) {
  const element = el(id);
  if (!element) return;
  element.textContent = text || '';
}

function copyText(value, label) {
  if (!value) {
    setStatus(`Nothing to copy for ${label}.`);
    return;
  }

  navigator.clipboard.writeText(value)
    .then(() => setStatus(`${label} copied.`))
    .catch(() => setStatus(`Copy failed for ${label}.`));
}

function disableButtons(disabled) {
  document.querySelectorAll('button').forEach(button => {
    button.disabled = disabled;
  });
}

async function refresh() {
  setStatus('Refreshing ...');
  disableButtons(true);

  const result = await chrome.runtime.sendMessage({ type: 'RUN_WEBSITE_INSPECTION' });

  if (!result || result.error) {
    setStatus(result?.error ? `Error: ${result.error}` : 'Inspection failed.');
    renderEmpty();
    disableButtons(false);
    return;
  }

  panel.data = result;
  panel.sitemapLinks = [];
  render(result);
  renderSitemapLinks([]);
  setStatus('Click any value to copy.');
  disableButtons(false);
}


function render(data) {
  setText('page-url', data.url || 'No URL available.');
  setText('page-title', data.meta?.title || 'None');
  setText('page-description', data.meta?.description || 'None');

  const provConf = el('provider-confidence');
  if (data.provider?.name) {
    setText('provider-name', data.provider.name);
    setText('provider-confidence', data.provider.confidence);
    if (provConf) provConf.classList.remove('hidden');
  } else {
    setText('provider-name', 'None detected.');
    if (provConf) provConf.classList.add('hidden');
  }

  renderAnalytics(data.analytics);
  renderPhones(data.phones);
  renderLinks(data.links);
  renderScripts(data.scriptSrcs);
  renderSlugs(data.slugs);
}

function renderAnalytics(analytics = {}) {
  const block = el('analytics-block');
  const label = el('analytics-label');
  if (!block) return;

  const items = [];
  ['ga4', 'gtm', 'ua'].forEach(key => {
    const type = key.toUpperCase();
    normalizeArray(analytics[key]).forEach(code => items.push(`${type}: ${code}`));
  });

  if (label) label.textContent = `Analytics (${items.length})`;
  block.textContent = items.length ? items.join('\n') : 'No analytics codes found.';
}

function renderPhones(phones = []) {
  const block = el('phones-block');
  const label = el('phones-label');
  if (!block) return;
  const formatted = phones.map(({ label, number }) => `${label}: ${number}`);
  if (label) label.textContent = `Phones (${phones.length})`;
  block.textContent = phones.length ? formatted.join('\n') : 'No phones found.';
}

function renderLinks(links = []) {
  const block = el('links-block');
  const label = el('links-label');
  if (!block) return;
  if (label) label.textContent = `Links (${links.length})`;
  block.textContent = links.length ? links.join('\n') : 'No links found.';
}

function renderScripts(scripts = []) {
  const block = el('scripts-block');
  const label = el('scripts-label');
  if (!block) return;
  if (label) label.textContent = `Scripts (${scripts.length})`;
  block.textContent = scripts.length ? scripts.join('\n') : 'No scripts found.';
}

function renderSlugs(slugs = []) {
  const block = el('slugs-block');
  const label = el('slugs-label');
  if (!block) return;
  if (label) label.textContent = `Slugs (${slugs.length})`;
  block.textContent = slugs.length ? slugs.join('\n') : 'No slugs found.';
}

function normalizeArray(value) {
  if (!value) return [];
  return [...new Set(value.map(String).map(v => v.trim()).filter(Boolean))];
}

function renderEmpty() {
  setText('page-url', 'No URL available.');
  setText('page-title', 'None');
  setText('page-description', 'None');
  setText('provider-name', 'None detected.');
  const provConf = el('provider-confidence'); if (provConf) provConf.style.display = 'none';
  renderAnalytics({});
  renderPhones([]);
  renderLinks([]);
  renderScripts([]);
  renderSlugs([]);
}

function bindEvents() {
  el('refresh-button')?.addEventListener('click', refresh);
  el('page-url')?.addEventListener('click', () => copyText(el('page-url')?.textContent, 'Page URL'));
  el('page-title')?.addEventListener('click', () => copyText(el('page-title')?.textContent, 'Title'));
  el('page-description')?.addEventListener('click', () => copyText(el('page-description')?.textContent, 'Description'));
  el('provider-name')?.addEventListener('click', () => copyText(el('provider-name')?.textContent, 'Provider'));
  el('phones-block')?.addEventListener('click', () => copyText(el('phones-block')?.textContent, 'Phones'));
  el('analytics-block')?.addEventListener('click', () => copyText(el('analytics-block')?.textContent, 'Analytics'));
  el('links-block')?.addEventListener('click', () => copyText(el('links-block')?.textContent, 'Links'));
  el('scripts-block')?.addEventListener('click', () => copyText(el('scripts-block')?.textContent, 'Scripts'));
  el('slugs-block')?.addEventListener('click', () => copyText(el('slugs-block')?.textContent, 'Slugs'));
  el('sitemap-links-block')?.addEventListener('click', () => copyText(el('sitemap-links-block')?.textContent, 'Sitemap URLs'));
}

function renderSitemapLinks(links = []) {
  const block = el('sitemap-links-block');
  const label = el('sitemap-links-label');
  if (!block) return;
  if (label) label.textContent = `Sitemap URLs (${links.length})`;
  block.textContent = links.length ? links.join('\n') : 'Click to expand and crawl sitemap...';
}

function initGlobalCrawler() {
  const details = el('sitemap-links-details');
  if (!details) return;

  details.addEventListener('toggle', async () => {
    if (!details.open || panel.sitemapLinks.length > 0) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const crawlUrl = tab?.url || '';
    if (!crawlUrl) {
      setStatus('No URL to crawl.');
      return;
    }

    panel.sitemapAbort = 'running';
    setStatus('Crawling sitemap...');

    try {
      const links = await getAllSitemapLinks(crawlUrl);
      panel.sitemapLinks = links;
      renderSitemapLinks(links);
      setStatus('Sitemap crawl complete.');
    } catch (err) {
      console.warn('Sitemap crawl error:', err);
      setStatus('Crawl failed.');
    } finally {
      panel.sitemapAbort = false;
    }
  });
}

const SITEMAP_MAX_INDEXES = 50;
const SITEMAP_MAX_URLS = 50000;

async function getAllSitemapLinks(pageUrl) {
  const origin = new URL(pageUrl).origin;
  const candidates = new Set([...(await discoverFromRobots(origin)), `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]);
  const visited = new Set();
  const result = [];
  for (const url of candidates) {
    if (panel.sitemapAbort === true || visited.size >= SITEMAP_MAX_INDEXES || result.length >= SITEMAP_MAX_URLS) break;
    await crawlSitemap(url, visited, result);
  }
  return [...new Set(result)].slice(0, SITEMAP_MAX_URLS);
}

async function discoverFromRobots(origin) {
  try {
    const response = await fetch(`${origin}/robots.txt`);
    if (!response.ok) return [];
    const text = await response.text();
    return text.split(/\r?\n/)
      .map(line => line.match(/^\s*Sitemap:\s*(.+?)\s*$/i))
      .filter(Boolean)
      .map(match => match[1])
      .map(url => {
        try { return new URL(url.trim(), origin).toString(); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchSitemapText(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    if (!url.toLowerCase().endsWith('.gz')) return await response.text();
    if ('DecompressionStream' in window && response.body) {
      return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text();
    }
    return await response.text();
  } catch {
    return null;
  }
}

async function crawlSitemap(url, visited, collector, depth = 0) {
  if (depth > 10) return;
  if (visited.has(url) || visited.size >= SITEMAP_MAX_INDEXES || collector.length >= SITEMAP_MAX_URLS) return;
  visited.add(url);
  const xml = await fetchSitemapText(url);
  if (!xml) return;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return;
  const root = doc.documentElement?.tagName?.toLowerCase() || '';

  const getLocs = tag => Array.from(doc.getElementsByTagName(tag))
    .map(node => node.querySelector('loc')?.textContent?.trim())
    .filter(Boolean);

  if (root === 'sitemapindex' || doc.getElementsByTagName('sitemap').length) {
    for (const loc of getLocs('sitemap')) {
      if (panel.sitemapAbort === true || visited.size >= SITEMAP_MAX_INDEXES || collector.length >= SITEMAP_MAX_URLS) break;
      const next = safeUrl(loc, url);
      if (next) await crawlSitemap(next, visited, collector);
    }
  } else {
    for (const loc of getLocs('url')) {
      if (panel.sitemapAbort === true || collector.length >= SITEMAP_MAX_URLS) break;
      const next = safeUrl(loc, url);
      if (next) collector.push(next);
    }
  }
}

function safeUrl(href, base) {
  try { return new URL(href, base).toString(); } catch { return null; }
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  initTabs();
  initUrlTools();
  initGlobalCrawler();
  refresh();
});

/* Tab nav */

function initTabs() {
  document.querySelectorAll('.page-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      document.querySelectorAll('.page-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; });
      const target = el(`page-${page}`);
      if (target) target.style.display = '';
    });
  });
}

/* URL Stuff */

const utState = { classified: [], results: [] };

function setUrlStatus(msg) {
  const s = el('url-status');
  if (s) s.textContent = msg;
}

function initUrlTools() {
  el('op-use-sitemap')?.addEventListener('click', utUseSitemap);
  el('op-clean-classify')?.addEventListener('click', utCleanClassify);
  el('op-match-redirects')?.addEventListener('click', utRunMatchRedirects);
  el('op-copy-tsv')?.addEventListener('click', utCopyTsv);

  const slider = el('fuzzy-threshold');
  const label  = el('threshold-label');
  slider?.addEventListener('input', () => { if (label) label.textContent = `${slider.value}%`; });
}

function utUseSitemap() {
  if (!panel.sitemapLinks?.length) {
    setUrlStatus('No sitemap data — run the Sitemap Crawler first.');
    return;
  }
  const input = el('url-bulk-input');
  if (input) input.value = panel.sitemapLinks.join('\n');
  setUrlStatus(`Loaded ${panel.sitemapLinks.length} sitemap URLs.`);
}

function utCleanClassify() {
  const raw = el('url-bulk-input')?.value || '';
  if (!raw.trim()) { setUrlStatus('Paste some URLs first.'); return; }

  const { clean, dropped } = ut_cleanUrls(raw);
  utState.classified = ut_classifyAll(clean);

  const total    = clean.length + Object.values(dropped).reduce((a, b) => a + b, 0);
  const dropParts = Object.entries(dropped).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
  const summaryEl = el('ut-classify-summary');
  if (summaryEl) {
    summaryEl.textContent = `${clean.length} clean / ${total} input` +
      (dropParts.length ? ` — dropped: ${dropParts.join(', ')}` : '');
  }

  utRenderCategoryBreakdown(utState.classified);
  el('ut-classify-section').style.display  = '';
  el('ut-redirect-section').style.display  = 'none';
  setUrlStatus(`Classified ${clean.length} URLs.`);
}

function utRenderCategoryBreakdown(classified) {
  const container = el('ut-category-breakdown');
  if (!container) return;
  container.innerHTML = '';

  const groups   = ut_groupByCategory(classified);
  const catOrder = [...Object.keys(RULES.categories), 'unclassified'];

  for (const cat of catOrder) {
    const items = groups[cat];
    if (!items?.length) continue;

    const catLabel = RULES.categories[cat]?.label || 'Unclassified';

    const detailsId = `ut-cat-${cat}`;

    const paths = items.map(i => { try { return new URL(i.url).pathname; } catch { return i.url; } });

    const head = document.createElement('div');
    head.className = 'section-head cat-head';
    head.dataset.toggle = detailsId;

    const span = document.createElement('span');
    span.textContent = `${catLabel} (${items.length})`;
    head.appendChild(span);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-all-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', e => { e.stopPropagation(); copyText(paths.join('\n'), catLabel); });
    head.appendChild(copyBtn);

    const details = document.createElement('details');
    details.id = detailsId;
    const summary = document.createElement('summary');
    summary.className = 'details-toggle';
    const pre = document.createElement('pre');
    pre.className = 'code-block';
    pre.textContent = paths.join('\n');

    details.appendChild(summary);
    details.appendChild(pre);
    container.appendChild(head);
    container.appendChild(details);
  }
}

function utRunMatchRedirects() {
  const cmsRaw = el('cms-slug-input')?.value || '';
  if (!cmsRaw.trim())          { setUrlStatus('Paste CMS slugs first.'); return; }
  if (!utState.classified.length) { setUrlStatus('Run Clean & Classify first.'); return; }

  const threshold = parseInt(el('fuzzy-threshold')?.value || '65', 10) / 100;
  const cmsSlugs  = ut_loadCmsSlugs(cmsRaw);

  utState.results = ut_matchRedirects(utState.classified, cmsSlugs, threshold);

  const counts    = ut_redirectSummary(utState.results);
  const summaryEl = el('ut-redirect-summary');
  if (summaryEl) {
    summaryEl.textContent =
      `Matched: ${counts.matched}  ·  Redirect: ${counts.redirect}  ·  ` +
      `Unmatched: ${counts.unmatched}  ·  Excluded (VDP): ${counts.excluded}`;
  }

  const tsvEl = el('ut-tsv-output');
  if (tsvEl) tsvEl.textContent = ut_toTsv(utState.results);

  el('ut-redirect-section').style.display = '';
  setUrlStatus('Done. Copy TSV to paste into Excel.');
}

function utCopyTsv() {
  if (!utState.results.length) { setUrlStatus('No results to copy.'); return; }
  navigator.clipboard.writeText(ut_toTsv(utState.results))
    .then(() => setUrlStatus('TSV copied.'))
    .catch(() => setUrlStatus('Copy failed.'));
}
