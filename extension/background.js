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

chrome.webRequest.onCompleted.addListener(
  details => {
    if (details.type === "main_frame") {
      networkOrigins.set(details.tabId, details.url.toLowerCase());
    }
  },
  { urls: ["<all_urls>"] }
);

/* CDP Session — persistent debugger tab, banner fires only once */

let wbCdpSession = null; // { tabId }

/* Message Handling */

// Must return true synchronously to keep the response channel open.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'WB_CDP_CONNECT') {
    (async () => {
      try {
        if (wbCdpSession) { sendResponse({ ok: true, already: true }); return; }
        const tab = await wbCreateTab('about:blank');
        await wbAttach(tab.id);
        await wbSend(tab.id, 'Page.enable', {});
        await wbSend(tab.id, 'Runtime.enable', {});
        await wbSend(tab.id, 'Page.setLifecyclePagesEnabled', { enabled: true }).catch(() => {});
        wbCdpSession = { tabId: tab.id };
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.type === 'WB_CDP_DISCONNECT') {
    (async () => {
      try {
        if (wbCdpSession) {
          await wbDetach(wbCdpSession.tabId).catch(() => {});
          await wbRemoveTab(wbCdpSession.tabId);
          wbCdpSession = null;
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.type === 'WB_CDP_STATUS') {
    sendResponse({ connected: !!wbCdpSession });
    return true;
  }

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

  if (msg.type === "WB_CAPTURE_TAB") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab.');
        const result = await wbCaptureTab(tab.id, tab.url, tab.title, msg.settings || {});
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.type === 'WB_EXECUTE_CAPTURE_URL') {
    (async () => {
      try {
        const result = await wbCaptureUrl(msg.url, msg.settings || {});
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.type === 'WB_SCRAPE_URL') {
    (async () => {
      try {
        const result = await wbScrapeUrl(msg.url, msg.settings || {});
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

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-side-panel" && tab?.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Keep the service worker alive while the panel holds a 'wb-keepalive' port.
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'wb-keepalive') {
    port.onMessage.addListener(() => {});
  }
});

/* ── Wayback CDP Capture ──────────────────────────────────────────────── */

async function wbCaptureTab(tabId, url, title, settings = {}) {
  const {
    scrollInterval = 600,
    maxScrolls     = null,
    delaySettle    = 3000,
    customCss      = '',
    width          = 1920,
    height         = 1080,
  } = settings;

  await wbAttach(tabId);
  try {
    await wbSend(tabId, 'Page.enable',    {});
    await wbSend(tabId, 'Runtime.enable', {});
    await wbSend(tabId, 'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile: false });
    await wbSend(tabId, 'Emulation.setEmulatedMedia', { media: 'screen' });

    // Make the page behave as focused + visible even in a background tab.
    // Without this, IntersectionObserver-based lazy loaders never fire and
    // some scroll-triggered animations don't run.
    await wbSend(tabId, 'Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
    await wbSend(tabId, 'Runtime.evaluate', {
      expression: `(()=>{
        try {
          Object.defineProperty(document,'hidden',{value:false,configurable:true});
          Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
          document.dispatchEvent(new Event('visibilitychange'));
        } catch(_){}
      })()`,
    });

    // Scroll to trigger lazy-loaded images
    const maxScrollsJS = maxScrolls === null ? 'null' : String(maxScrolls);
    await wbSend(tabId, 'Runtime.evaluate', {
      expression: `(async()=>{await new Promise(resolve=>{
        const d=window.innerHeight, m=${maxScrollsJS};
        let c=0;
        const t=setInterval(()=>{
          window.scrollBy(0,d); c++;
          const bot=window.scrollY+window.innerHeight>=document.body.scrollHeight;
          if((bot&&c>=2)||(m!==null&&c>=m)){clearInterval(t);window.scrollTo(0,0);resolve();}
        },${scrollInterval});
      })})()`,
      awaitPromise: true,
      timeout: 120000,
    });

    await new Promise(r => setTimeout(r, delaySettle));

    // Inject custom CSS
    if (customCss.trim()) {
      await wbSend(tabId, 'Runtime.evaluate', {
        expression: `(()=>{const s=document.createElement('style');
          s.id='__wb_css';s.textContent=${JSON.stringify(customCss)};
          document.head.appendChild(s);})()`,
      });
    }

    // Measure true content height
    const { result } = await wbSend(tabId, 'Runtime.evaluate', {
      expression: `(()=>{const b=document.body,e=document.documentElement;
        return Math.min(Math.max(b.scrollHeight,b.offsetHeight),
                        Math.max(e.scrollHeight,e.offsetHeight));})()`,
    });
    const pageHeight = result.value;

    // Export full-page PDF
    const pdf = await wbSend(tabId, 'Page.printToPDF', {
      printBackground: true,
      paperWidth:      width  / 96,
      paperHeight:     pageHeight / 96,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    });

    // pdf.data is base64 — convert to Blob via fetch (works in MV3 service workers)
    const blob = await fetch(`data:application/pdf;base64,${pdf.data}`).then(r => r.blob());

    return { pdfBase64: pdf.data, size: blob.size, pageHeight };

  } finally {
    try { await wbDetach(tabId); } catch (_) {}
  }
}

// CDP helpers
const wbAttach = tabId => new Promise((res, rej) =>
  chrome.debugger.attach({ tabId }, '1.3', () =>
    chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res()
  )
);
const wbDetach = tabId => new Promise((res, rej) =>
  chrome.debugger.detach({ tabId }, () =>
    chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res()
  )
);
const wbSend = (tabId, method, params) => new Promise((res, rej) =>
  chrome.debugger.sendCommand({ tabId }, method, params, r =>
    chrome.runtime.lastError ? rej(new Error(`${method}: ${chrome.runtime.lastError.message}`)) : res(r)
  )
);

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
    let timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out waiting for tab load'));
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError) return;
      if (tab.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

async function wbCaptureUrl(url, settings) {
  const tab = await wbCreateTab(url);
  try {
    await wbWaitForTabLoad(tab.id);
    return await wbCaptureTab(tab.id, url, tab.title || url, settings);
  } finally {
    await wbRemoveTab(tab.id);
  }
}

/* ── Wayback CDP Scrape ───────────────────────────────────────────────── */

async function wbScrapeUrl(url, settings = {}) {
  if (wbCdpSession?.tabId) return wbScrapeViaSession(url, settings);

  const {
    extract_links = true,
    extract_text  = true,
    wait_ms       = 2000,
  } = settings;

  const tab = await wbCreateTab(url);
  try {
    await wbWaitForTabLoad(tab.id);
    await wbAttach(tab.id);
    try {
      await wbSend(tab.id, 'Runtime.enable', {});

      // Treat as focused/visible so JS runs normally in the background tab
      await wbSend(tab.id, 'Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
      await wbSend(tab.id, 'Runtime.evaluate', {
        expression: `(()=>{
          try {
            Object.defineProperty(document,'hidden',{value:false,configurable:true});
            Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
            document.dispatchEvent(new Event('visibilitychange'));
          } catch(_){}
        })()`,
      });

      // Wait for JS-rendered content to settle
      await new Promise(r => setTimeout(r, wait_ms));

      const { result } = await wbSend(tab.id, 'Runtime.evaluate', {
        expression: `(()=>{
          const q = s => document.querySelector(s);
          return {
            title:            document.title || null,
            meta_description: q('meta[name="description"]')?.content || null,
            h1:               q('h1')?.innerText?.trim() || null,
            links:            ${extract_links}
              ? Array.from(document.links).map(a => a.href).filter(h => h.startsWith('http'))
              : [],
            text_preview:     ${extract_text}
              ? (document.body?.innerText || '').slice(0, 500).trim() || null
              : null,
          };
        })()`,
        returnByValue: true,
      });

      return { url, ...result.value };
    } finally {
      await wbDetach(tab.id).catch(() => {});
    }
  } finally {
    await wbRemoveTab(tab.id);
  }
}

// Resolves when Page.loadEventFired fires on tabId, or after timeoutMs.
function wbWaitForPageLoad(tabId, timeoutMs = 30000) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; chrome.debugger.onEvent.removeListener(listener); resolve(); } };
    const timer = setTimeout(finish, timeoutMs);
    const listener = (source, method) => {
      if (source.tabId === tabId && method === 'Page.loadEventFired') { clearTimeout(timer); finish(); }
    };
    chrome.debugger.onEvent.addListener(listener);
  });
}

// Resolves when Page.lifecycleEvent networkIdle fires, or after timeoutMs.
function wbWaitForNetworkIdle(tabId, timeoutMs = 5000) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; chrome.debugger.onEvent.removeListener(listener); resolve(); } };
    const timer = setTimeout(finish, timeoutMs);
    const listener = (source, method, params) => {
      if (source.tabId === tabId && method === 'Page.lifecycleEvent' && params?.name === 'networkIdle') {
        clearTimeout(timer); finish();
      }
    };
    chrome.debugger.onEvent.addListener(listener);
  });
}

// Scrape using the persistent CDP session tab — no attach/detach overhead, banner fires once.
async function wbScrapeViaSession(url, settings = {}) {
  const { extract_links = true, extract_text = true, wait_ms = 5000 } = settings;
  const tabId = wbCdpSession.tabId;

  await wbSend(tabId, 'Page.navigate', { url });
  await wbWaitForPageLoad(tabId, 30000);
  await wbWaitForNetworkIdle(tabId, wait_ms);

  // Emulate focus/visibility so JS-gated content renders
  await wbSend(tabId, 'Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  await wbSend(tabId, 'Runtime.evaluate', {
    expression: `(()=>{
      try {
        Object.defineProperty(document,'hidden',{value:false,configurable:true});
        Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
        document.dispatchEvent(new Event('visibilitychange'));
      } catch(_){}
    })()`,
  });

  const { result } = await wbSend(tabId, 'Runtime.evaluate', {
    expression: `(()=>{
      const q = s => document.querySelector(s);
      return {
        title:            document.title || null,
        meta_description: q('meta[name="description"]')?.content || null,
        h1:               q('h1')?.innerText?.trim() || null,
        links:            ${extract_links}
          ? Array.from(document.links).map(a => a.href).filter(h => h.startsWith('http'))
          : [],
        text_preview:     ${extract_text}
          ? (document.body?.innerText || '').slice(0, 500).trim() || null
          : null,
      };
    })()`,
    returnByValue: true,
  });

  return { url, ...result.value };
}
