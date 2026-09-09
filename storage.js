function readStoredArray(key, { allowEmpty = true } = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(value) && (allowEmpty || value.length)) return value;
  } catch {
    // Invalid mock data falls back to the screen's seed data.
  }
  return null;
}

function writeStoredValue(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
