import { normalizeCase } from './stringUtils.js';

/*  Known section synonyms. */

const SECTION_SYNONYMS = {
  'new': 'New',
  'new vehicles': 'New',
  'new inventory': 'New',

  'used': 'Used',
  'pre-owned': 'Used',
  'pre owned': 'Used',

  'service': 'Service',
  'service department': 'Service',

  'finance': 'Finance',
  'specials': 'Specials',
  'about': 'About Us',
  'about us': 'About Us'
};

/* Resolve section to canonical name. */

export function normalizeSectionName(input) {
  const normalized = normalizeCase(input);
  return SECTION_SYNONYMS[normalized] || input;
}
