import { normalizeWhitespace } from './utils/stringUtils.js';
import { CMS_BEHAVIOR } from './utils/cmsBehaviorUtils.js';
import { normalizeSchema } from "./utils/schemaUtils.js";
import { detectProvider } from "./utils/providerUtils.js";
import { extractAnalyticsCodes } from "./utils/analyticsUtils.js";


import {
  registerVehicleMenus,
  resolveVehicleMenuText
} from "./menus/vehicleMenus.js";


chrome.runtime.onInstalled.addListener(registerVehicleMenus);
chrome.runtime.onStartup.addListener(registerVehicleMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  const text = resolveVehicleMenuText(info.menuItemId);
  if (!text) return;

  chrome.tabs.sendMessage(tab.id, {
    action: "insertText",
    text
  });
});


chrome.runtime.onMessage.addListener(async (message, sender) => {
  if (message.type === 'RESOLVE_CURRENT_PAGE') {
    const context = await chrome.tabs.sendMessage(
      sender.tab.id,
      { type: 'GET_CMS_CONTEXT' }
    );

    const slug = normalizeWhitespace(context.slug || '');

    const previewUrl = CMS_BEHAVIOR.PREVIEW_URLS_ARE_DETERMINISTIC
      ? `/preview/${slug}`
      : null;

    return {
      slug,
      previewUrl,
      sourceUrl: context.url
    };
  }
});


chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === "RUN_WEBSITE_INSPECTION") {
    const pageData = await chrome.tabs.sendMessage(sender.tab.id, {
      type: "INSPECT_WEBSITE"
    });

    const schema = normalizeSchema(pageData.schemaNodes);
    const provider = detectProvider(
      pageData.schemaNodes,
      pageData.links,
      pageData.scriptSrcs
    );

    return {
      url: pageData.url,
      meta: { title: pageData.title, description: pageData.description },
      provider,
      schema,
      analytics: extractAnalyticsCodes(pageData.scriptSrcs),
      slugs: pageData.slugs
    };
  }
});
