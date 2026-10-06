export function normalizeSnapshotDate(value) {
  const text = String(value ?? '').trim().replaceAll('/', '-');
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function requireValidToday(today) {
  const normalized = normalizeSnapshotDate(today);
  if (!normalized) throw new TypeError(`Invalid comparison date: ${today}`);
  return normalized;
}

export function requireCurrentOrPastSnapshotDate(value, today, label = '資料來源') {
  const normalized = normalizeSnapshotDate(value);
  const normalizedToday = requireValidToday(today);
  if (!normalized) {
    throw new Error(`${label}未提供有效資料日期：${value ?? '<missing>'}`);
  }
  if (normalized > normalizedToday) {
    throw new Error(`${label}回傳未來日期 ${normalized}，台北今日為 ${normalizedToday}`);
  }
  return normalized;
}

export function getUsableCachedSnapshot(snapshot, today) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const normalizedToday = requireValidToday(today);
  const disclosureDate = normalizeSnapshotDate(snapshot.disclosureDate);
  if (!disclosureDate || disclosureDate > normalizedToday) return null;
  return disclosureDate === snapshot.disclosureDate
    ? snapshot
    : { ...snapshot, disclosureDate };
}

export function selectCacheFallback({ latest, previous, today }) {
  const usableLatest = getUsableCachedSnapshot(latest, today);
  const usablePrevious = getUsableCachedSnapshot(previous, today);

  if (usableLatest) {
    return {
      snapshot: usableLatest,
      comparisonSnapshot:
        usablePrevious && usablePrevious.disclosureDate < usableLatest.disclosureDate
          ? usablePrevious
          : null,
      selected: 'latest',
    };
  }

  if (usablePrevious) {
    return {
      snapshot: usablePrevious,
      comparisonSnapshot: null,
      selected: 'previous',
    };
  }

  return null;
}
