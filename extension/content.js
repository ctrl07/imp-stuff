let lastFocused = null;

window.addEventListener("focusin", e => {
  if (
    e.target &&
    (e.target.isContentEditable ||
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA")
  ) {
    lastFocused = e.target;
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "INSERT_TEXT" && lastFocused && document.contains(lastFocused)) {
    lastFocused.focus();
    if (lastFocused.isContentEditable) {
      // execCommand('insertText') is deprecated but still works reliably across browsers.
      // Alternative: use selectStart to place cursor and insert text directly, but execCommand is safer for contentEditable.
      document.execCommand('insertText', false, msg.text);
    } else {
      const cursorPos = lastFocused.selectionStart ?? lastFocused.value.length;
      lastFocused.value = lastFocused.value.slice(0, cursorPos) + msg.text + lastFocused.value.slice(cursorPos);
      lastFocused.selectionStart = lastFocused.selectionEnd = cursorPos + msg.text.length;
      // Dispatch input event for React/Vue frameworks that depend on it
      lastFocused.dispatchEvent(new Event('input', { bubbles: true }));
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "SNAPSHOT") {
    sendResponse(extractSnapshot());
    return true;
  }
});

function extractSnapshot() {
  const links = [...document.querySelectorAll("a[href]")].map(a => a.href);
  const linkHrefs = [...document.querySelectorAll("link[href], a[href]")].map(el => el.href);

  return {
    url:           location.href,
    meta:          { title: document.title, description: document.querySelector('meta[name="description"]')?.content || "" },
    metaGenerator: document.querySelector('meta[name="generator"]')?.content || "",
    footerText:    getFooterText(),
    analytics:     extractAnalytics(),
    schema:        extractSchema(),
    phones:        extractPhones(),
    links,
    linkHrefs,
    scriptSrcs:    [...document.querySelectorAll("script[src]")].map(s => s.src),
    slugs:         [...new Set(
      links.map(href => { try { return new URL(href).pathname; } catch { return null; } })
           .filter(p => p && p !== "/")
    )]
  };
}

function getFooterText() {
  const selectors = [
    "footer",
    "[role=\"contentinfo\"]",
    ".footer",
    "#footer",
    "[id*=\"footer\"]",
    "[class*=\"footer\"]"
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.innerText?.trim()) return el.innerText.toLowerCase();
  }

  return "";
}

function extractAnalytics() {
  const text = [
    document.documentElement.outerHTML.substring(0, 10000), // Head section (usually first 10KB)
    ...Array.from(document.scripts).map(s => s.textContent)
  ].join(' ');
  return {
    // Require at least 6 chars after G- to avoid false positives like "G-C"
    ga4: [...text.matchAll(/\bG-[A-Z0-9]{6,}\b/g)].map(m => m[0]),
    gtm: [...text.matchAll(/\bGTM-[A-Z0-9]+\b/g)].map(m => m[0]),
    ua:  [...text.matchAll(/\bUA-\d{4,}-\d+\b/g)].map(m => m[0])
  };
}

function extractSchema() {
  const out = { address: {}, geo: {}, social: [] };

  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try {
      const data = JSON.parse(s.textContent);
      const nodes = data["@graph"] ? data["@graph"] : Array.isArray(data) ? data : [data];

      nodes.forEach(n => {
        if (!n || typeof n !== "object") return;
        if (n.address) {
          out.address.street  ??= n.address.streetAddress;
          out.address.city    ??= n.address.addressLocality;
          out.address.state   ??= n.address.addressRegion;
          out.address.zip     ??= n.address.postalCode;
          out.address.country ??= n.address.addressCountry;
        }
        if (n.geo) {
          out.geo.lat ??= n.geo.latitude;
          out.geo.lng ??= n.geo.longitude;
        }
        if (n.sameAs) {
          out.social.push(...(Array.isArray(n.sameAs) ? n.sameAs : [n.sameAs]));
        }
      });
    } catch {}
  });

  out.social = [...new Set(out.social)];
  return out;
}

function extractPhones() {
  const seen = new Set();
  const phones = [];

  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    const number = a.href.replace(/^tel:/, "").replace(/\s/g, "").trim();
    if (!number || seen.has(number)) return;
    seen.add(number);
    phones.push({ number, label: inferPhoneLabel(a) });
  });

  return phones;
}

function inferPhoneLabel(el) {
  // 1. Link's own visible text (e.g. "Sales: 555-1234")
  const linkText = (el.textContent || "").toLowerCase();
  const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
  const combined = `${linkText} ${ariaLabel}`;
  const dept = matchDept(combined);
  if (dept) return dept;

  // 2. Walk up DOM - check class names and small containers
  let node = el;
  for (let i = 0; i < 6; i++) {
    node = node.parentElement;
    if (!node) break;

    const cls     = (node.className || "").toLowerCase();
    const dataAttr = (node.getAttribute("data-department") || node.getAttribute("data-type") || "").toLowerCase();
    const nodeAria = (node.getAttribute("aria-label") || "").toLowerCase();

    const fromAttrs = matchDept(`${cls} ${dataAttr} ${nodeAria}`);
    if (fromAttrs) return fromAttrs;

    // Only scan textContent on tight containers (avoids header/footer false positives)
    if (node.children.length <= 6) {
      const fromText = matchDept((node.textContent || "").toLowerCase());
      if (fromText) return fromText;
    }
  }

  return "Phone";
}

function matchDept(text) {
  if (/\bservice\b/.test(text))              return "Service";
  if (/\bsales\b/.test(text))               return "Sales";
  if (/\bparts\b/.test(text))               return "Parts";
  if (/financ/.test(text))                  return "Finance";
  if (/body[\s-]?shop|collision/.test(text)) return "Body Shop";
  if (/quick[\s-]?lane|quick[\s-]?lube/.test(text)) return "Quick Lane";
  if (/\bcertified\b/.test(text))           return "Certified";
  return null;
}
