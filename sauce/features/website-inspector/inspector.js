document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refresh-data");
  if (!refreshBtn) return;

  refreshBtn.addEventListener("click", async () => {
    const data = await chrome.runtime.sendMessage({
      type: "RUN_WEBSITE_INSPECTION"
    });

    if (data?.error) {
      console.warn("Inspector error:", data.error);
      return;
    }

    window.__lastInspection = data;
    await renderAll(data);
  });
});

/* Render Orchestrator */

async function renderAll(data) {
  renderURL(data.url);
  renderProvider(data.provider);
  renderMeta(data.meta);
  renderAddress(data.schema);
  renderGeo(data.schema);
  renderSocial(data.schema);
  renderAnalytics(data.analytics);
  renderSlugs(data.slugs);
  renderSchema(data.schema);
  renderList("script-list", data.scriptSrcs);
  renderList("link-list", data.links);
  
  // Auto-fetch sitemaps in background (silently populates when ready)
  try {
    const links = await getAllSitemapLinks(data.url);
    renderList("sitemap-link-list", links);
  } catch (e) {
    console.warn("Auto sitemap fetch failed:", e);
  }

}

/* Section Renderers */
function renderURL(url) {
  const el = document.getElementById("url-info");
  el.innerHTML = "";
  url ? renderValue(el, url) : renderEmpty(el);
}

function renderProvider(provider) {
  const el = document.getElementById("provider-info");
  el.innerHTML = "";
  if (!provider?.name) return renderEmpty(el);

  const div = document.createElement("div");
  div.className = "detail";
  div.textContent = `${provider.name} (${provider.confidence})`;
  el.appendChild(div);
}

function renderMeta(meta) {
  const el = document.getElementById("meta-info");
  el.innerHTML = "";
  if (!meta?.title && !meta?.description) return renderEmpty(el);
  if (meta.title) renderLabeled(el, "Title", meta.title);
  if (meta.description) renderLabeled(el, "Description", meta.description);
}

function renderAddress(schema) {
  const el = document.getElementById("address-info");
  el.innerHTML = "";

  const a = schema?.address || {};
  const text = [
    a.street,
    a.city && `${a.city}, ${a.state} ${a.zip}`,
    a.country
  ].filter(Boolean).join("\n");

  text ? renderValue(el, text) : renderEmpty(el);
}

function renderGeo(schema) {
  const el = document.getElementById("geo-info");
  el.innerHTML = "";

  if (!schema?.geo?.lat || !schema?.geo?.lng) return renderEmpty(el);

  renderLabeled(el, "Latitude", schema.geo.lat);
  renderLabeled(el, "Longitude", schema.geo.lng);
}

function renderSocial(schema) {
  const el = document.getElementById("social-info");
  el.innerHTML = "";

  if (!schema?.social?.length) return renderEmpty(el);
  schema.social.forEach(url => renderValue(el, url));
}

/* Helpers for analytics rendering */
function toCaps(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x.trim().toUpperCase();
  if (typeof x === 'object' && 'id' in x) return String(x.id).trim().toUpperCase();
  return String(x).trim().toUpperCase();
}
function uniq(arr) {
  return Array.from(new Set((arr || []).map(toCaps).filter(Boolean)));
}

/* Capitalized Analytics Renderer */
function renderAnalytics(codes) {
  const el = document.getElementById("analytics-info");
  el.innerHTML = "";

  // Normalize & dedupe (uppercase)
  const ga4 = uniq(codes?.ga4);
  const ua  = uniq(codes?.ua);
  const gtm = uniq(codes?.gtm);

  const found = ga4.length || ua.length || gtm.length;
  if (!found) return renderEmpty(el);

  ga4.forEach(v => renderLabeled(el, "GA4", v));
  ua.forEach(v  => renderLabeled(el, "UA", v));
  gtm.forEach(v => renderLabeled(el, "GTM", v));
}

/* Schema / Lists */

function renderSchema(schema) {
  const el = document.getElementById("schema-info");
  el.innerHTML = "";

  if (!schema || typeof schema !== "object") {
    return renderEmpty(el);
  }

  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(schema, null, 2);
  pre.style.whiteSpace = "pre-wrap";
  pre.style.wordBreak = "break-word";
  el.appendChild(pre);
}

function renderList(containerId, list = []) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";

  if (!Array.isArray(list) || !list.length) {
    return renderEmpty(el);
  }

  list.forEach(item => renderValue(el, item));
}

/* UI Helpers  */

function renderValue(container, value) {
  const div = document.createElement("div");
  div.className = "detail";
  div.textContent = value;
  div.onclick = () => navigator.clipboard.writeText(value);
  container.appendChild(div);
}

function renderLabeled(container, label, value) {
  const div = document.createElement("div");
  div.className = "detail";
  div.innerHTML = `<div class="label">${label}</div>${value}`;
  div.onclick = () => navigator.clipboard.writeText(value);
  container.appendChild(div);
}

function renderEmpty(container) {
  const div = document.createElement("div");
  div.className = "no-data";
  div.textContent = "No data found";
  container.appendChild(div);
}

/* SITEMAP DISCOVERY & PARSING */

/** Max limits to avoid runaway crawls on very large sites */
const SITEMAP_MAX_INDEXES = 50;   // total sitemap files to traverse
const SITEMAP_MAX_URLS    = 50000; // total URLs to collect

/**
 * Entry point: discover, crawl, and return all links from sitemaps.
 * @param {string} pageUrl - the inspected page URL (use data.url or location.href)
 * @returns {Promise<string[]>}
 */
async function getAllSitemapLinks(pageUrl) {
  const origin = new URL(pageUrl).origin;

  // 1) from robots.txt
  const robotsSitemaps = await discoverFromRobots(origin);

  // 2) common fallbacks
  const candidates = new Set([
    ...robotsSitemaps,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`
  ]);

  const visited = new Set();
  const foundUrls = [];
  for (const smUrl of candidates) {
    if (visited.size >= SITEMAP_MAX_INDEXES || foundUrls.length >= SITEMAP_MAX_URLS) break;
    await crawlSitemap(smUrl, visited, foundUrls);
  }
  return Array.from(new Set(foundUrls)).slice(0, SITEMAP_MAX_URLS);
}

/**
 * Discover sitemap URLs from robots.txt "Sitemap:" entries.
 * @param {string} origin
 * @returns {Promise<string[]>}
 */
async function discoverFromRobots(origin) {
  try {
    const res = await fetch(`${origin}/robots.txt`, { method: 'GET' });
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    const out = [];
    for (const line of lines) {
      const m = line.match(/^\s*Sitemap:\s*(.+?)\s*$/i);
      if (m && m[1]) {
        const raw = m[1].trim();
        try {
          // Resolve relative to origin if necessary
          const abs = new URL(raw, origin).toString();
          out.push(abs);
        } catch {}
      }
    }
    return out;
  } catch (e) {
    console.warn('robots.txt fetch failed:', e);
    return [];
  }
}

/**
 * Fetch text. If the URL ends with .gz and the server doesn't auto-decompress,
 * use DecompressionStream('gzip') when available.
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchSitemapText(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;

    // If server already applied Content-Encoding: gzip, res.text() is fine.
    if (!url.toLowerCase().endsWith('.gz')) {
      return await res.text();
    }

    // For .xml.gz files without Content-Encoding, decompress manually:
    if ('DecompressionStream' in window && res.body) {
      const ds = new DecompressionStream('gzip');
      const stream = res.body.pipeThrough(ds);
      const decompressed = await new Response(stream).text();
      return decompressed;
    }

    // Fallback – hope res.text() works if UA decompressed based on headers
    return await res.text();
  } catch (e) {
    console.warn('fetchSitemapText failed:', url, e);
    return null;
  }
}

/**
 * Crawl a sitemap: handle <sitemapindex> recursively and <urlset> URLs.
 * @param {string} sitemapUrl
 * @param {Set<string>} visitedSitemaps
 * @param {string[]} collector
 */
async function crawlSitemap(sitemapUrl, visitedSitemaps, collector) {
  // Stop if limits reached
  if (visitedSitemaps.size >= SITEMAP_MAX_INDEXES || collector.length >= SITEMAP_MAX_URLS) return;
  if (visitedSitemaps.has(sitemapUrl)) return;
  visitedSitemaps.add(sitemapUrl);

  const xmlText = await fetchSitemapText(sitemapUrl);
  if (!xmlText) return;

  let doc;
  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  } catch (e) {
    console.warn('DOMParser failed for', sitemapUrl, e);
    return;
  }

  const root = doc.documentElement ? doc.documentElement.tagName.toLowerCase() : '';
  if (root.includes('parsererror')) {
    console.warn('Sitemap XML parse error:', sitemapUrl);
    return;
  }

  if (root === 'sitemapindex') {
    // Get nested <sitemap><loc>...</loc></sitemap>
    const locs = Array.from(doc.querySelectorAll('sitemap > loc')).map(n => n.textContent.trim());
    for (const loc of locs) {
      if (visitedSitemaps.size >= SITEMAP_MAX_INDEXES || collector.length >= SITEMAP_MAX_URLS) break;
      // Resolve against parent sitemap URL (relative paths can appear)
      const nextUrl = safeResolveUrl(loc, sitemapUrl);
      if (nextUrl) await crawlSitemap(nextUrl, visitedSitemaps, collector);
    }
  } else if (root === 'urlset') {
    // Collect <url><loc>...</loc></url>
    const locs = Array.from(doc.querySelectorAll('url > loc')).map(n => n.textContent.trim());
    for (const loc of locs) {
      if (collector.length >= SITEMAP_MAX_URLS) break;
      const abs = safeResolveUrl(loc, sitemapUrl);
      if (abs) collector.push(abs);
    }
  } else {
    // Some sitemaps include namespaces (e.g., <urlset xmlns="...">)
    // Try namespace-agnostic selection:
    const nsUrlNodes = doc.getElementsByTagName('url');
    const nsSmNodes  = doc.getElementsByTagName('sitemap');

    if (nsSmNodes && nsSmNodes.length) {
      const locs = Array.from(nsSmNodes).map(n => n.getElementsByTagName('loc')[0]?.textContent?.trim()).filter(Boolean);
      for (const loc of locs) {
        if (visitedSitemaps.size >= SITEMAP_MAX_INDEXES || collector.length >= SITEMAP_MAX_URLS) break;
        const nextUrl = safeResolveUrl(loc, sitemapUrl);
        if (nextUrl) await crawlSitemap(nextUrl, visitedSitemaps, collector);
      }
    } else if (nsUrlNodes && nsUrlNodes.length) {
      const locs = Array.from(nsUrlNodes).map(n => n.getElementsByTagName('loc')[0]?.textContent?.trim()).filter(Boolean);
      for (const loc of locs) {
        if (collector.length >= SITEMAP_MAX_URLS) break;
        const abs = safeResolveUrl(loc, sitemapUrl);
        if (abs) collector.push(abs);
      }
    }
  }
}

/** Safe absolute URL resolution against a base */
function safeResolveUrl(maybeRelative, base) {
  try { return new URL(maybeRelative, base).toString(); }
  catch { return null; }
}

/* Slug Dialog */
let currentSlugs = [];

function renderSlugs(slugs = []) {
  currentSlugs = slugs;
}

document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("slug-dialog");
  const textarea = document.getElementById("slug-text");

  document.getElementById("copy-slugs")?.addEventListener("click", () => {
    if (!currentSlugs.length) {
      alert("No slugs found. Refresh data first.");
      return;
    }
    textarea.value = currentSlugs.join("\n");
    dialog.showModal();
  });

  document.getElementById("copy-slug-text")?.addEventListener("click", () => {
    navigator.clipboard.writeText(textarea.value);
  });

  document.getElementById("close-slug-dialog")?.addEventListener("click", () => {
    dialog.close();
  });

  /* Copy / Download helpers */
  document.getElementById("copy-schema-json")?.addEventListener("click", () => {
    const data = window.__lastInspection?.schema;
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    }
  });

  document.getElementById("download-schema-json")?.addEventListener("click", () => {
    const data = window.__lastInspection?.schema;
    if (!data) return;

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "schema.json";
    a.click();
  });

  document.getElementById("copy-scripts")?.addEventListener("click", () => {
    const list = window.__lastInspection?.scriptSrcs || [];
    if (list.length) navigator.clipboard.writeText(list.join("\n"));
  });

  document.getElementById("copy-links")?.addEventListener("click", () => {
    const list = window.__lastInspection?.links || [];
    if (list.length) navigator.clipboard.writeText(list.join("\n"));
  });

  /* ---- Sitemap Links: UI injection & handlers ---- */

  // 1) Add a "Fetch Sitemap Links" button next to your existing "Copy Links" button.
  const copyLinksBtn = document.getElementById("copy-links");
  if (copyLinksBtn) {
    const fetchBtn = document.createElement("button");
    fetchBtn.id = "fetch-sitemap-links";
    fetchBtn.textContent = "Fetch Sitemap Links";
    fetchBtn.style.marginLeft = "8px";
    copyLinksBtn.parentElement?.appendChild(fetchBtn);

    // 2) Create a new container under the existing link-list for sitemap results (once).
    let sitemapSection = document.getElementById("sitemap-link-list");
    if (!sitemapSection) {
      sitemapSection = document.createElement("div");
      sitemapSection.id = "sitemap-link-list";
      sitemapSection.style.marginTop = "8px";

      const linkList = document.getElementById("link-list");
      if (linkList && linkList.parentElement) {
        // Insert after the existing "Links" list
        const heading = document.createElement("h5");
        heading.textContent = "Sitemap Links";
        heading.style.margin = "12px 0 6px";
        linkList.parentElement.appendChild(heading);

        // Add small "Copy" button for sitemap links
        const actions = document.createElement("div");
        actions.className = "header-actions";
        const copySmBtn = document.createElement("button");
        copySmBtn.id = "copy-sitemap-links";
        copySmBtn.textContent = "Copy Sitemap Links";
        actions.appendChild(copySmBtn);
        linkList.parentElement.appendChild(actions);

        linkList.parentElement.appendChild(sitemapSection);

        // Copy all sitemap links
        copySmBtn.addEventListener("click", () => {
          const list = Array.from(sitemapSection.querySelectorAll(".detail")).map(d => d.textContent.trim()).filter(Boolean);
          if (list.length) navigator.clipboard.writeText(list.join("\n"));
        });
      }
    }

    // 3) Wire up the click to crawl sitemaps
    fetchBtn.addEventListener("click", async () => {
      const pageUrl = window.__lastInspection?.url || window.location.href;
      fetchBtn.disabled = true;
      const original = fetchBtn.textContent;
      fetchBtn.textContent = "Fetching…";

      try {
        const links = await getAllSitemapLinks(pageUrl);
        // Reuse your existing renderList helper for consistent UI
        renderList("sitemap-link-list", links);
        if (!links.length) {
          renderEmpty(document.getElementById("sitemap-link-list"));
        }
      } catch (e) {
        console.warn("Sitemap fetch error:", e);
        const el = document.getElementById("sitemap-link-list");
        if (el) {
          el.innerHTML = "";
          renderEmpty(el);
        }
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = original;
      }
    });
  }
});