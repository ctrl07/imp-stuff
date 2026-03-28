import { normalizeWhitespace } from './utils/stringUtils.js';
import { CMS_BEHAVIOR } from './utils/cmsBehaviorUtils.js';

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