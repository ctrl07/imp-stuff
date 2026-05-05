/* ── url-tool.js ──────────────────────────────────────────────────────────────
 * Pure pipeline functions.
 * All exports are prefixed ut_ to avoid collisions.
 * Depends on: rules.js (RULES constant must be loaded first)
 * ─────────────────────────────────────────────────────────────────────────── */

/* ── Constants ────────────────────────────────────────────────────────────── */

const UT_STATIC_EXT = /\.(css|js|json|jpg|jpeg|png|gif|svg|webp|woff|woff2|ttf|eot|ico|pdf|zip|map|gz|xml)(\?.*)?$/i;
const UT_SITEMAP_RE  = /sitemap/i;

const UT_TSV_HEADERS = [
  'From*', 'To*', 'redirect_status', 'categories', 'tags',
];


/* ── Stage 2: Clean ───────────────────────────────────────────────────────── */

function ut_detectBaseHost(lines) {
  const counts = {};
  for (const line of lines) {
    try {
      const host = new URL(line.trim()).hostname.toLowerCase();
      counts[host] = (counts[host] || 0) + 1;
    } catch { /* skip */ }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || '';
}

/**
 * Clean a block of raw text into a deduplicated, filtered list of URLs.
 * Returns { clean: string[], dropped: object, baseHost: string }
 */
function ut_cleanUrls(rawText) {
  const lines    = rawText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const baseHost = ut_detectBaseHost(lines);
  const seen     = new Set();
  const clean    = [];
  const dropped  = { duplicate: 0, asset: 0, external: 0, sitemap: 0, invalid: 0 };

  for (const line of lines) {
    let url;
    try { url = new URL(line); } catch { dropped.invalid++; continue; }

    const addr = url.href;
    if (seen.has(addr))                                       { dropped.duplicate++; continue; }
    seen.add(addr);

    if (UT_STATIC_EXT.test(url.pathname))                     { dropped.asset++;     continue; }
    if (UT_SITEMAP_RE.test(url.pathname))                     { dropped.sitemap++;   continue; }
    if (baseHost && url.hostname.toLowerCase() !== baseHost)  { dropped.external++;  continue; }

    clean.push(addr);
  }

  return { clean, dropped, baseHost };
}


/* ── Stage 3: Classify & Tag ─────────────────────────────────────────────── */

/* Convert capturing groups to non-capturing to avoid regex warnings. */
function ut_nc(pattern) {
  return pattern.replace(/\((?!\?)/g, '(?:');
}

function ut_classifyUrl(urlStr) {
  const enabledDealers = Object.entries(RULES.dealers)
    .filter(([, v]) => v)
    .map(([k]) => k);

  for (const [catKey, catConfig] of Object.entries(RULES.categories)) {
    if (!catConfig.providers) continue;
    for (const dealer of enabledDealers) {
      const patterns = catConfig.providers[dealer];
      if (!patterns) continue;
      for (const pattern of Object.values(patterns)) {
        if (new RegExp(ut_nc(pattern), 'i').test(urlStr)) return catKey;
      }
    }
  }
  return 'unclassified';
}

function ut_applyTags(urlStr) {
  const tagRules = RULES.tags || {};
  const applied  = {};

  for (const [tag, config] of Object.entries(tagRules)) {
    applied[tag] = config.pattern
      ? new RegExp(ut_nc(config.pattern), 'i').test(urlStr)
      : false;
  }

  for (const [tag, config] of Object.entries(tagRules)) {
    if (config.derived_from) {
      applied[tag] = config.derived_from.some(src => applied[src]);
    }
  }

  return Object.entries(applied).filter(([, v]) => v).map(([k]) => k);
}

/**
 * Classify and tag every URL in the clean list.
 * Returns array of { url, category, tags: string[], isVdp: bool }
 */
function ut_classifyAll(cleanUrls) {
  return cleanUrls.map(url => {
    const category = ut_classifyUrl(url);
    const tags     = ut_applyTags(url);
    return { url, category, tags, isVdp: tags.includes('vdp') };
  });
}

/**
 * Group classified items by category key.
 * Returns { [category]: item[] }
 */
function ut_groupByCategory(classified) {
  const groups = {};
  for (const item of classified) {
    (groups[item.category] = groups[item.category] || []).push(item);
  }
  return groups;
}


/* ── Stage 4: CMS slug matching ──────────────────────────────────────────── */

/* Parse a block of raw CMS slug text into a normalised Set. */
function ut_loadCmsSlugs(rawText) {
  const slugs = rawText
    .split(/[\n\r]+/)
    .map(l => l.trim().toLowerCase().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return new Set(slugs);
}

function ut_stripHost(urlStr) {
  try {
    return new URL(urlStr).pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  } catch {
    return urlStr.toLowerCase().replace(/^\/+|\/+$/g, '');
  }
}

/* Sørensen–Dice coefficient on character bigrams, returns 0–1; 1 = identical. */
function ut_dice(a, b) {
  if (a === b)                        return 1;
  if (a.length < 2 || b.length < 2)  return 0;

  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }

  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const n  = bigrams.get(bg) || 0;
    if (n > 0) { bigrams.set(bg, n - 1); hits++; }
  }

  return (2 * hits) / (a.length + b.length - 2);
}

/**
 * Find the closest CMS slug above the threshold (0–1).
 * Returns the best match string, or null.
 */
function ut_fuzzyMatch(slug, cmsSlugs, threshold) {
  let best = null, bestScore = threshold;
  for (const candidate of cmsSlugs) {
    const score = ut_dice(slug, candidate);
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  return best;
}

/**
 * Run redirect matching against CMS slugs.
 * Returns enriched array with slug, redirect_status, closest_cms_match added.
 *
 * threshold: 0–1 (e.g. 0.65)
 */
function ut_matchRedirects(classified, cmsSlugs, threshold) {
  return classified.map(item => {
    const slug = ut_stripHost(item.url);

    if (cmsSlugs.has(slug)) {
      return { ...item, slug, redirect_status: 'matched', closest_cms_match: slug };
    }

    const closest = ut_fuzzyMatch(slug, cmsSlugs, threshold);
    return {
      ...item,
      slug,
      redirect_status:    closest ? 'redirect' : 'unmatched',
      closest_cms_match:  closest || '',
    };
  });
}

/**
 * Tally redirect_status counts from a results array.
 */
function ut_redirectSummary(results) {
  const counts = { matched: 0, redirect: 0, unmatched: 0 };
  for (const r of results) {
    const k = r.redirect_status;
    if (k in counts) counts[k]++;
  }
  return counts;
}


/* ── Stage 5: TSV output ─────────────────────────────────────────────────── */

/**
 * Serialise results to a tab-separated string ready to paste into Excel.
 */
function ut_toTsv(results) {
  const rows = results.map(r => [
    r.slug               || '',
    r.closest_cms_match  || '',
    r.redirect_status    || '',
    r.category           || '',
    (r.tags || []).join(','),
  ].map(v => String(v).replace(/\t/g, ' ')));

  return [UT_TSV_HEADERS, ...rows].map(r => r.join('\t')).join('\n');
}
