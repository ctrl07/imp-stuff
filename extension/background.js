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

/* Message Handling */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
