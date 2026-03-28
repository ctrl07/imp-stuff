import { extractAnalyticsCodes } from "./utils/analyticsUtils.js";
import { detectProvider } from "./utils/providerUtils.js";
import { normalizeSchema } from "./utils/schemaUtils.js";
import { registerVehicleMenus, resolveVehicleMenuText } from "./menus/vehicleMenus.js";


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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "insertText") {
    insertText(lastFocusedElement, msg.text);
  }
});

/* Enable side panel */
function enableSidePanel() {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
}

chrome.runtime.onInstalled.addListener(enableSidePanel);
chrome.runtime.onStartup.addListener(enableSidePanel);

/* Website Inspector */
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "RUN_WEBSITE_INSPECTION") {
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

    return {
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
      slugs: pageData.slugs
    };
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