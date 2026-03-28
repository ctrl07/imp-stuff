import { extractPageData } from "./cmsExtractor.js";
import { readCmsContext } from './cmsContext.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CMS_CONTEXT') {
    sendResponse(readCmsContext());
  }
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === "INSPECT_WEBSITE") {
    respond(extractPageData());
  }
});