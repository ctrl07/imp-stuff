import { normalizeCase } from './stringUtils.js';

const PAGE_TYPE_MAP = {
  'platform page': '0',
  'platform': '0',

  'custom content': '1',
  'local link': '2',
  'external link': '3',

  'custom content with inventory': '7',
  'custom iframe': '9',
  'iframe': '9',

  'custom model research page': '10',
  'model research': '10',

  'special listing page': '12',
  'specials listing': '12'
};

/* Convert human-readable page type to CMS value. */

export function getPageTypeValue(input) {
  if (!input) return null;

  const normalized = normalizeCase(input);

  if (PAGE_TYPE_MAP[normalized]) {
    return PAGE_TYPE_MAP[normalized];
  }

  // Fuzzy matching
  for (const key in PAGE_TYPE_MAP) {
    if (normalized.includes(key)) {
      return PAGE_TYPE_MAP[key];
    }
  }

  return null;
}

/*  Page type eligibility check. */

export function isAutomatablePageType(input) {
  const value = getPageTypeValue(input);
  return value !== null && value !== '0';
}
