/* Normalize whitespace, trims, collapses multiple spaces */

export function normalizeWhitespace(value = '') {
  return String(value)
    .trim()
    .replace(/\s+/g, ' ');
}

/* Normalize case for comparisons. */

export function normalizeCase(value = '') {
  return normalizeWhitespace(value).toLowerCase();
}

/* Remove unsafe characters (basic safety). */

export function stripUnsafeChars(value = '') {
  return String(value).replace(/[^\w\s-]/g, '');
}

/* Create URL-safe slugs. */

export function slugifySafe(value = '') {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}