'use strict';

/* Context Menus */

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
  ["alt-text",              "#CURRENTYEAR# #DEALERMAKE# (insert model here) in #CITY# #STATE#"],
  ["filter",                "/searchnew.aspx?Year=2026&ModelAndTrim=(insert model here)"],
  ["dealer",                "(add banner context) at #NAME# in #CITY# #STATE#."],
  ["dealership-name",       "%(DEALERSHIP_NAME) "],
  ["dealership-city",       "%(CITY) "],
  ["dealership-state-abbv", "%(STATE_ABBREV) "],
  ["dealership-make",       "%(MAKE) "],
  ["city-state",            "%(CITY), %(STATE_ABBREV) "],
  ["schema-logo",           "(Add Primary URL Here)/static/dealer-######/logo.png"],
  ["schema-desc",           "#NAME# is a %(MAKE) dealer in %(CITY), %(STATE_ABBREV). We specialize in new %(MAKE), used cars, service, and financing."],
  ["img-text",  `<div class="row"><div class="col-md-6"><img class="img-responsive margin-auto" src="" ></div><div class="col-md-6"><p></p></div></div><br>`],
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
    if (item.children?.length) createMenuItems(item.children, item.id);
  }
}

function resolveVehicleMenuText(menuId) {
  return TEXT_TEMPLATES.get(menuId) || null;
}

/* Provider Detection */

const PROVIDERS = [
  ["DealerOn",         ["dealer-cdn.com", "dealeroncdn", "dealeron.com", "powered by dealeron", " dealeron"]],
  ["Dealer.com",       ["images.dealer.com", "cdn.dealer.com", "static.dealer.com", "a cox automotive brand", "dealer.com/content/"]],
  ["Dealer Inspire",   ["dealerinspire.com", "dealer inspire", "/wp-content/themes/dealerinspire", "/wp-content/themes/di-"]],
  ["CDK Global",       ["drivingusdealers.com", "cdn-prod.drivingusdealers", "cdkglobal.com", "cdk global", "websiteprovider.net", "cobaltgroup.com"]],
  ["DealerSocket",     ["dealersocket.com", "dscdigital.com", "ds-cdn.com"]],
  ["Team Velocity",    ["teamvelocitymarketing.com", "teamvelocityportal.com", "tvmotorsports.com", "team velocity"]],
  ["Fox Dealer",       ["foxdealerassets.com", "foxdealer.com", "fox dealer"]],
  ["Dealer eProcess",  ["dealereprocess.com", "cdn.dealereprocess", "dealer eprocess"]],
  ["Sincro",           ["sincro.com", " sincro "]],
  ["Naked Lime",       ["nakedlime.com", "naked lime"]],
  ["Dominion Dealer",  ["drivedominion.com", "dominionsolutions.com", "dominion dealer"]],
  ["Stream Companies", ["streamcompanies.com", "stream companies"]],
  ["Car-Research",     ["car-research.com/", "car-research xrm"]],
  ["TradePending",     ["tradepending.com"]],
  ["Reynolds Web",     ["reyrey.com", "reynolds web"]],
  ["EDealer",          ["edealer.ca", " edealer "]],
  ["Flick Fusion",     ["flickfusion.com"]],
  ["Izmocars",         ["izmocars.com", "izmo.com"]],
  ["WordPress",        ["/wp-content/themes/", "/wp-includes/", "wordpress.org"]],
];

function detectProvider({ footerText = "", networkOrigin = "", linkHrefs = [], metaGenerator = "" }) {
  const hay = [footerText, networkOrigin, ...linkHrefs, metaGenerator].join(" ").toLowerCase();
  for (const [name, patterns] of PROVIDERS) {
    if (patterns.some(p => hay.includes(p))) return { name, confidence: "high" };
  }
  return null;
}

/* Network Tracking */

chrome.webRequest.onCompleted.addListener(
  details => {
    if (details.type === "main_frame") {
      chrome.storage.session.set({
        [`tab_${details.tabId}`]: { url: details.url.toLowerCase(), statusCode: details.statusCode }
      });
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove(`tab_${tabId}`);
});

/* PDF Rename */

function pdfNameFromUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    const slug = (url.hostname + url.pathname)
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return slug + '.pdf';
  } catch {
    return 'download.pdf';
  }
}

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const isPdf = item.mime === 'application/pdf' ||
                item.filename.toLowerCase().endsWith('.pdf');
  if (!isPdf) { suggest(); return; }

  chrome.storage.sync.get('renamePdfDownloads', ({ renamePdfDownloads }) => {
    if (!renamePdfDownloads) { suggest(); return; }
    suggest({ filename: pdfNameFromUrl(item.finalUrl || item.url) });
  });
  return true; // async suggest
});

/* CDP helpers — callback-based to properly consume chrome.runtime.lastError */

const wbAttach = tabId => new Promise((res, rej) =>
  chrome.debugger.attach({ tabId }, '1.3', () =>
    chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res()
  )
);
const wbDetach = tabId => new Promise(res =>
  chrome.debugger.detach({ tabId }, () => { chrome.runtime.lastError; res(); })
);
const wbSend = (tabId, method, params) => new Promise((res, rej) =>
  chrome.debugger.sendCommand({ tabId }, method, params, r =>
    chrome.runtime.lastError ? rej(new Error(`${method}: ${chrome.runtime.lastError.message}`)) : res(r)
  )
);

/* Message Handling */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "WB_SCREENSHOT_TABID") {
    (async () => {
      const { tabId, url } = msg;
      let attached = false;
      try {
        // Load capture settings from storage (defaults match the UI defaults)
        const settings = await new Promise(resolve =>
          chrome.storage.sync.get(
            {
              screenshotSettleMs: 2000, screenshotWidth: 1280, screenshotMaxHeight: 8000, screenshotScale: 1,
              screenshotScrollStepMs: 80, screenshotScrollSettleMs: 300, screenshotImgWaitMs: 3000,
            },
            resolve
          )
        );
        const { screenshotSettleMs, screenshotWidth, screenshotMaxHeight, screenshotScale,
                screenshotScrollStepMs, screenshotScrollSettleMs, screenshotImgWaitMs } = settings;

        await wbAttach(tabId);
        attached = true;

        // TODO: auto-hide chat widgets / accessibility tools before capture is unreliable
        // (GPU-composited iframes don't respect CSS/DOM removal before Page.captureScreenshot).
        // For now, manually close any overlays on the page before capturing — most widgets
        // (CarNow, AudioEye, KPA consent) remember the dismissed state in localStorage/sessionStorage
        // so they won't re-appear for the session or across visits.

        if (screenshotSettleMs > 0) {
          await new Promise(r => setTimeout(r, screenshotSettleMs));
        }

        await wbSend(tabId, 'Emulation.setDeviceMetricsOverride', {
          width: screenshotWidth, height: 800, deviceScaleFactor: screenshotScale, mobile: false,
        });

        // Measure true content height and resize viewport to fit full page
        const { result } = await wbSend(tabId, 'Runtime.evaluate', {
          expression: `Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)`,
        });
        const pageHeight = Math.min(result.value || 800, screenshotMaxHeight);

        await wbSend(tabId, 'Emulation.setDeviceMetricsOverride', {
          width: screenshotWidth, height: pageHeight, deviceScaleFactor: screenshotScale, mobile: false,
        });

        // Scroll sweep top→bottom→top to trigger IntersectionObserver / lazy-loaded images
        await wbSend(tabId, 'Runtime.evaluate', {
          expression: `(async () => {
            const h    = document.documentElement.scrollHeight;
            const step = window.innerHeight || 900;
            for (let y = 0; y < h; y += step) {
              window.scrollTo(0, y);
              await new Promise(r => setTimeout(r, ${screenshotScrollStepMs}));
            }
            window.scrollTo(0, 0);
            await new Promise(r => setTimeout(r, ${screenshotScrollSettleMs}));
          })()`,
          awaitPromise: true,
          timeout: 30000,
        });

        // Wait for any still-loading <img> elements (capped by screenshotImgWaitMs)
        await wbSend(tabId, 'Runtime.evaluate', {
          expression: `Promise.race([
            Promise.all(
              Array.from(document.images)
                .filter(img => !img.complete)
                .map(img => new Promise(r => { img.onload = img.onerror = r; }))
            ),
            new Promise(r => setTimeout(r, ${screenshotImgWaitMs})),
          ])`,
          awaitPromise: true,
          timeout: screenshotImgWaitMs + 2000,
        });

        const { data: screenshotBase64 } = await wbSend(tabId, 'Page.captureScreenshot', {
          format: 'png', fromSurface: true,
        });

        sendResponse({ ok: true, url, screenshotBase64 });
      } catch (err) {
        sendResponse({ ok: false, url, error: String(err) });
      } finally {
        if (attached) await wbDetach(tabId);
      }
    })();
    return true;
  }

  if (msg.type === "RUN_WEBSITE_INSPECTION") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active browser tab found.');

        const pageData = await chrome.tabs.sendMessage(tab.id, { type: "SNAPSHOT" });
        if (!pageData) throw new Error('No response from the page snapshot script.');

        const key = `tab_${tab.id}`;
        const data = await chrome.storage.session.get(key);
        const networkOrigin = data[key]?.url || "";

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

  if (msg.type === 'STAFF_ADD_EMPLOYEE') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active browser tab found.');
        const result = await chrome.tabs.sendMessage(tab.id, msg);
        sendResponse(result);
      } catch (e) {
        sendResponse({ error: String(e) });
      }
    })();
    return true;
  }
});

/* Keepalive / Wakeup */

chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'wb-wakeup') {
    port.onMessage.addListener(() => {});
  }
});

/* Init */

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  registerVehicleMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const text = resolveVehicleMenuText(info.menuItemId);
  if (text) {
    chrome.tabs.sendMessage(tab.id, { type: "INSERT_TEXT", text }).catch(err => {
      console.warn(`Failed to send INSERT_TEXT to tab ${tab.id}:`, err);
    });
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "open-side-panel") {
    const t = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (t?.id) {
      chrome.sidePanel.open({ tabId: t.id }).catch(err => {
        console.warn(`Failed to open side panel on tab ${t.id}:`, err);
      });
    }
  }
});
