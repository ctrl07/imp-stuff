import { extractAnalyticsCodes } from "./utils/analyticsUtils.js";
import { detectProvider } from "./utils/providerUtils.js";
import { normalizeSchema } from "./utils/schemaUtils.js";
import { registerVehicleMenus, resolveVehicleMenuText } from "./menus/vehicleMenus.js";

/* Menus */

function initMenus() {
  registerVehicleMenus();
}

chrome.runtime.onInstalled.addListener(initMenus);
chrome.runtime.onStartup.addListener(initMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  const text = resolveVehicleMenuText(info.menuItemId);
  if (!text) return;

  chrome.tabs.sendMessage(tab.id, {
    action: "insertText",
    text
  });
});

/* Side Panel */
function enableSidePanel() {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
}

chrome.runtime.onInstalled.addListener(enableSidePanel);
chrome.runtime.onStartup.addListener(enableSidePanel);

/* Website Inspector */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RUN_WEBSITE_INSPECTION") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        });

        if (!tab?.id) {
          throw new Error("No active tab found");
        }

        const pageData = await chrome.tabs.sendMessage(tab.id, {
          type: "INSPECT_WEBSITE"
        });

        sendResponse({
          url: pageData.url,
          meta: {
            title: pageData.title,
            description: pageData.description
          },
          provider: detectProvider(
            pageData.schemaNodes,
            pageData.links,
            pageData.scriptSrcs
          ),
          schema: normalizeSchema(pageData.schemaNodes),
          analytics: extractAnalyticsCodes(pageData.scriptSrcs),
          slugs: pageData.slugs,
          scriptSrcs: pageData.scriptSrcs,
          links: pageData.links
        });
      } catch (err) {
        console.error("Website inspection failed:", err);
        sendResponse({ error: err.message || String(err) });
      }
    })();

    return true; // required for async responses
  }
});

/* Toolbar click */
chrome.action.onClicked.addListener(tab => {
  if (tab?.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

/* Keyboard shortcut */
chrome.commands.onCommand.addListener(cmd => {
  if (cmd === "open-side-panel") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.sidePanel.open({
          tabId: tabs[0].id,
          windowId: tabs[0].windowId
        });
      }
    });
  }
});