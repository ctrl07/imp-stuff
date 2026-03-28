const PREFIX = 'cms-extension';

/* Build a scoped storage key. */

function buildKey(key) {
  return `${PREFIX}:${key}`;
}

/* Save JSON data safely. */

export function saveToStorage(key, value) {
  try {
    localStorage.setItem(buildKey(key), JSON.stringify(value));
  } catch (e) {
    console.warn('Storage save failed:', e);
  }
}

/* Load JSON data safely. */

export function loadFromStorage(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(buildKey(key));
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.warn('Storage load failed:', e);
    return defaultValue;
  }
}

/* Remove stored value. */

export function removeFromStorage(key) {
  try {
    localStorage.removeItem(buildKey(key));
  } catch (e) {
    console.warn('Storage remove failed:', e);
  }
}