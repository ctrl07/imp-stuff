document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refresh-data");
  if (!refreshBtn) return;

  refreshBtn.addEventListener("click", async () => {
    const data = await chrome.runtime.sendMessage({
      type: "RUN_WEBSITE_INSPECTION"
    });

    renderAll(data);
  });
});

/* Render Orchestrator */

function renderAll(data) {
  renderURL(data.url);
  renderProvider(data.provider);
  renderMeta(data.meta);
  renderAddress(data.schema);
  renderGeo(data.schema);
  renderSocial(data.schema);
  renderAnalytics(data.analytics);
}

/* Render Helpers */
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

  if (!schema?.geo?.lat || !schema?.geo?.lng)
    return renderEmpty(el);

  renderLabeled(el, "Latitude", schema.geo.lat);
  renderLabeled(el, "Longitude", schema.geo.lng);
}

function renderSocial(schema) {
  const el = document.getElementById("social-info");
  el.innerHTML = "";

  if (!schema?.social?.length) return renderEmpty(el);

  schema.social.forEach(url => renderValue(el, url));
}

function renderAnalytics(codes) {
  const el = document.getElementById("analytics-info");
  el.innerHTML = "";

  const found =
    codes?.ga4?.length || codes?.ua?.length || codes?.gtm?.length;

  if (!found) return renderEmpty(el);

  codes.ga4?.forEach(v => renderLabeled(el, "GA4", v));
  codes.ua?.forEach(v => renderLabeled(el, "UA", v));
  codes.gtm?.forEach(v => renderLabeled(el, "GTM", v));
}

/*  UI Helpers */
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

/* Copy Slug Logic */
const copySlugsBtn = document.getElementById("copy-slugs");
const dialog = document.getElementById("slug-dialog");
const textarea = document.getElementById("slug-text");
const copyBtn = document.getElementById("copy-slug-text");
const closeBtn = document.getElementById("close-slug-dialog");

let currentSlugs = [];

function renderSlugs(slugs = []) {
  currentSlugs = slugs;
}

copySlugsBtn.addEventListener("click", () => {
  if (!currentSlugs.length) {
    alert("No slugs found. Refresh data first.");
    return;
  }

  textarea.value = currentSlugs.join("\n");
  dialog.showModal();
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(textarea.value);
});

closeBtn.addEventListener("click", () => {
  dialog.close();
});