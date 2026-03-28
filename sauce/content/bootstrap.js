let lastFocusedElement = null;

/* Track focused input for context menu insertion */
function trackTarget(e) {
  const el = e.target;
  if (
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  ) {
    lastFocusedElement = el;
  }
}

window.addEventListener("focusin", trackTarget);
window.addEventListener("contextmenu", trackTarget);

/* Insert text into focused element */
function insertText(el, text) {
  if (!el || !text) return;

  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    el.value =
      el.value.slice(0, start) +
      text +
      el.value.slice(end);

    el.setSelectionRange(start + text.length, start + text.length);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
  } else if (el.isContentEditable) {
    document.execCommand("insertText", false, text);
  }
}

/* Extract CMS / Website Data (Inspector) */
function extractPageData() {
  const schemaScripts = [
    ...document.querySelectorAll('script[type="application/ld+json"]')
  ];

  const schemaBlocks = [];
  schemaScripts.forEach(s => {
    try {
      schemaBlocks.push(JSON.parse(s.textContent.trim()));
    } catch {}
  });

  const schemaNodes = [];
  schemaBlocks.forEach(b => {
    if (Array.isArray(b)) schemaNodes.push(...b);
    else if (b?.["@graph"]) schemaNodes.push(...b["@graph"]);
    else if (typeof b === "object") schemaNodes.push(b);
  });

  return {
    url: location.href,
    title: document.title || null,
    description:
      document.querySelector('meta[name="description"]')?.content || null,

    schemaNodes,

    scriptSrcs: [...document.querySelectorAll("script[src]")]
      .map(s => s.src.toLowerCase()),

    links: [...document.querySelectorAll("a[href]")]
      .map(a => a.href.toLowerCase()),

    slugs: [...document.querySelectorAll(
      '#mainTable > tbody > tr > td.colspace > em:first-of-type'
    )]
      .map(el => el.textContent.trim())
      .filter(Boolean)
  };
}

/* Message Handler */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "INSPECT_WEBSITE") {
    sendResponse(extractPageData());
  }

  if (msg.action === "insertText") {
    insertText(lastFocusedElement, msg.text);
  }
});