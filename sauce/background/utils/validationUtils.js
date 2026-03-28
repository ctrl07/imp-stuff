/* Ensure required fields are present.*/

export function validateRequiredFields(obj, requiredFields = []) {
  const missing = [];

  requiredFields.forEach(field => {
    if (!obj[field] || String(obj[field]).trim() === '') {
      missing.push(field);
    }
  });

  return {
    valid: missing.length === 0,
    missing
  };
}

/* Detect duplicate values (e.g., slugs). */

export function findDuplicates(list = []) {
  const seen = new Set();
  const duplicates = new Set();

  list.forEach(item => {
    if (seen.has(item)) duplicates.add(item);
    seen.add(item);
  });

  return Array.from(duplicates);
}