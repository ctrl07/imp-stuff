/* Vehicle Menus */

const MENU_STRUCTURE = [
  {
    id: "supplies",
    title: "Supplies",
    contexts: ["editable"],
    children: [
      { id: "alt-text", title: "Alt Text" },
      { id: "filter", title: "Filter" },
      { id: "dealer", title: "Dealer Alt" },
      {
        id: "re-codes",
        title: "Replacement Codes",
        children: [
          { id: "dealership-name", title: "Name" },
          { id: "dealership-city", title: "City" },
          { id: "dealership-state-abbv", title: "State Abbv" },
          { id: "dealership-make", title: "Make" },
          { id: "city-state", title: "City, State" },
          { id: "schema-logo", title: "Schema Logo" },
          { id: "schema-desc", title: "Schema Desc" }
        ]
      },
      {
        id: "css",
        title: "CSS Snippets",
        children: [
          { id: "img-text", title: "Img + Text" },
          { id: "img-three", title: "3 Images" }
        ]
      }
    ]
  }
];

const TEXT_TEMPLATES = new Map([
  ["alt-text", "#CURRENTYEAR# #DEALERMAKE# (insert model here) in #CITY# #STATE#"],
  ["filter", "/searchnew.aspx?Year=2026&ModelAndTrim=(insert model here)"],
  ["dealer", "(add banner context) at #NAME# in #CITY# #STATE#."],
  ["dealership-name", "%(DEALERSHIP_NAME) "],
  ["dealership-city", "%(CITY) "],
  ["dealership-state-abbv", "%(STATE_ABBREV) "],
  ["dealership-make", "%(MAKE) "],
  ["city-state", "%(CITY), %(STATE_ABBREV) "],
  ["schema-logo", "(Add Primary URL Here)/static/dealer-######/logo.png"],
  ["schema-desc", "#NAME# is a %(MAKE) dealer in %(CITY), %(STATE_ABBREV). We specialize in new %(MAKE), used cars, service, and financing."],
  ["img-text", `<div class="row"><div class="col-md-6"><img class="img-responsive margin-auto" src="" ></div><div class="col-md-6"><p></p></div></div><br>`],
  ["img-three", `<div class="row"><div class="col-md-4"><img class="img-responsive margin-auto" src=""></div><div class="col-md-4"><img class="img-responsive margin-auto" src=""></div><div class="col-md-4"><img class="img-responsive margin-auto" src="" ></div></div><br>`]
]);

function registerVehicleMenus() {
  chrome.contextMenus.removeAll(() => createMenuItems(MENU_STRUCTURE));
}

function createMenuItems(items, parentId) {
  for (const item of items) {
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: item.contexts || ["editable"],
      parentId
    });

    if (item.children?.length) {
      createMenuItems(item.children, item.id);
    }
  }
}

function resolveVehicleMenuText(menuId) {
  return TEXT_TEMPLATES.get(menuId) || null;
}

/* Provider Detection */
// Signals: footer text, CDN link hrefs, meta generator, network origin.

const PROVIDERS = [
  // name, [...match strings against combined haystack]
  ["DealerOn",          ["dealer-cdn.com", "dealeroncdn", "dealeron.com", "powered by dealeron", " dealeron"]],
  ["Dealer.com",        ["images.dealer.com", "cdn.dealer.com", "static.dealer.com", "a cox automotive brand", "dealer.com/content/"]],
  ["Dealer Inspire",    ["dealerinspire.com", "dealer inspire", "/wp-content/themes/dealerinspire", "/wp-content/themes/di-"]],
  ["CDK Global",        ["drivingusdealers.com", "cdn-prod.drivingusdealers", "cdkglobal.com", "cdk global", "websiteprovider.net", "cobaltgroup.com"]],
  ["DealerSocket",      ["dealersocket.com", "dscdigital.com", "ds-cdn.com"]],
  ["Team Velocity",     ["teamvelocitymarketing.com", "teamvelocityportal.com", "tvmotorsports.com", "team velocity"]],
  ["Fox Dealer",        ["foxdealerassets.com", "foxdealer.com", "fox dealer"]],
  ["Dealer eProcess",   ["dealereprocess.com", "cdn.dealereprocess", "dealer eprocess"]],
  ["Sincro",            ["sincro.com", " sincro "]],
  ["Naked Lime",        ["nakedlime.com", "naked lime"]],
  ["Dominion Dealer",   ["drivedominion.com", "dominionsolutions.com", "dominion dealer"]],
  ["Stream Companies",  ["streamcompanies.com", "stream companies"]],
  ["Car-Research",      ["car-research.com/", "car-research xrm"]],
  ["TradePending",      ["tradepending.com"]],
  ["Reynolds Web",      ["reyrey.com", "reynolds web"]],
  ["EDealer",           ["edealer.ca", " edealer "]],
  ["Flick Fusion",      ["flickfusion.com"]],
  ["Izmocars",          ["izmocars.com", "izmo.com"]],
  // WordPress (no specific provider but worth flagging)
  ["WordPress",         ["/wp-content/themes/", "/wp-includes/", "wordpress.org"]],
];

function detectProvider({ footerText = "", networkOrigin = "", linkHrefs = [], metaGenerator = "" }) {
  const hay = [footerText, networkOrigin, ...linkHrefs, metaGenerator]
    .join(" ")
    .toLowerCase();

  for (const [name, patterns] of PROVIDERS) {
    if (patterns.some(p => hay.includes(p))) {
      return { name, confidence: "high" };
    }
  }
  return null;
}

/* Network Tracking */

const networkOrigins = new Map();
const tabStatusCodes  = new Map();

chrome.webRequest.onCompleted.addListener(
  details => {
    if (details.type === "main_frame") {
      networkOrigins.set(details.tabId, details.url.toLowerCase());
      tabStatusCodes.set(details.tabId, details.statusCode);
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.tabs.onRemoved.addListener(tabId => {
  networkOrigins.delete(tabId);
  tabStatusCodes.delete(tabId);
});

/* Message Handling */

// Must return true synchronously to keep the response channel open.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "RUN_WEBSITE_INSPECTION") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active browser tab found.');

        const pageData = await chrome.tabs.sendMessage(tab.id, { type: "SNAPSHOT" });
        if (!pageData) throw new Error('No response from the page snapshot script.');

        const networkOrigin = networkOrigins.get(tab.id) || "";

        sendResponse({
          ...pageData,
          networkOrigin,
          provider: detectProvider({
            footerText:    pageData.footerText    || "",
            networkOrigin,
            linkHrefs:     pageData.linkHrefs     || [],
            metaGenerator: pageData.metaGenerator || ""
          })
        });
      } catch (e) {
        sendResponse({ error: String(e) });
      }
    })();
    return true;
  }

  if (msg.type === 'WB_SCRAPE_URL') {
    (async () => {
      try {
        const result = await wbScrapeUrl(msg.url, msg.settings || {}, msg.reuseTabId || null);
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});

/* Init */

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  registerVehicleMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const text = resolveVehicleMenuText(info.menuItemId);
  if (text) chrome.tabs.sendMessage(tab.id, { action: "INSERT_TEXT", text });
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "open-side-panel") {
    const t = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (t?.id) chrome.sidePanel.open({ tabId: t.id });
  }
});

// Keep the service worker alive while the panel holds a 'wb-keepalive' port.
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'wb-keepalive') {
    port.onMessage.addListener(() => {});
  }
});

/* ── Tab helpers (used by Scrape) ───────────────────────────────────── */

function wbCreateTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, tab => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(tab);
    });
  });
}

function wbRemoveTab(tabId) {
  return new Promise(resolve => {
    chrome.tabs.remove(tabId, () => resolve());
  });
}

function wbWaitForTabLoad(tabId, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      err ? reject(err) : resolve();
    };

    const timer = setTimeout(
      () => finish(new Error('Timed out waiting for tab load')),
      timeoutMs
    );

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
    };

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError) return finish(new Error(chrome.runtime.lastError.message));
      if (tab.status === 'complete') finish();
    });
  });
}

/* ── Scrape — no CDP, no banner ───────────────────────────────────────── */

async function wbScrapeUrl(url, settings = {}, reuseTabId = null) {
  const {
    extract_title = true,
    extract_description = true,
    extract_h1 = true,
    extract_links = true,
    custom_selectors = [],
    wait_ms = 3000
  } = settings;

  // Crawl-check: reuse the caller's active tab if its URL matches (avoids opening duplicate tab)
  let ownedTab = null;
  let tabId;
  if (reuseTabId !== null) {
    try {
      const existing = await new Promise((res, rej) =>
        chrome.tabs.get(reuseTabId, t => chrome.runtime.lastError ? rej() : res(t))
      );
      const norm = u => { try { const p = new URL(u); return p.origin + p.pathname.replace(/\/+$/, ''); } catch { return u; } };
      if (norm(existing.url) === norm(url)) {
        tabId = reuseTabId;
      }
    } catch (_) {}
  }

  if (tabId == null) {
    ownedTab = await wbCreateTab(url);
    tabId = ownedTab.id;
    await wbWaitForTabLoad(tabId);
  }

  try {
    if (wait_ms > 0) await new Promise(r => setTimeout(r, wait_ms));

    const statusCode = tabStatusCodes.get(tabId) || null;

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (extractTitle, extractDescription, extractH1, extractLinks, customSelectors) => {
        try {
          Object.defineProperty(document, 'hidden', { value: false, configurable: true });
          Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        } catch (_) {}
        const q = s => document.querySelector(s);
        const qa = s => Array.from(document.querySelectorAll(s));

        const result = {};

        if (extractTitle) result.title = document.title || null;
        if (extractDescription) result.meta_description = q('meta[name="description"]')?.content || null;
        if (extractH1) result.h1 = q('h1')?.innerText?.trim() || null;

        if (extractLinks) {
          result.links = Array.from(document.links)
            .map(a => a.href)
            .filter(h => h.startsWith('http'));
        } else {
          result.links = [];
        }

        result.custom_data = {};
        for (const selector of customSelectors) {
          try {
            const els = qa(selector);
            result.custom_data[selector] = els.map(el => el.innerText?.trim() || el.textContent?.trim()).filter(Boolean).join(' | ');
          } catch (_) {
            result.custom_data[selector] = null;
          }
        }

        return result;
      },
      args: [extract_title, extract_description, extract_h1, extract_links, custom_selectors],
    });

    return { url, statusCode, ...result };
  } finally {
    if (ownedTab) await wbRemoveTab(ownedTab.id);
  }
}
