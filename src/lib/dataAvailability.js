export function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function hasFiniteNumber(value) {
  return toFiniteNumber(value) !== null;
}

export function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

export function firstAvailable(...values) {
  return values.find((value) => hasText(value) || hasFiniteNumber(value) || hasItems(value)) ?? null;
}

export function uniqueBy(items, getKey) {
  const seen = new Set();

  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = getKey(item);
    if (key === null || key === undefined || key === '' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
