// content/bootstrap.js
import { readCmsContext } from './cmsContext.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CMS_CONTEXT') {
    sendResponse(readCmsContext());
  }
});
