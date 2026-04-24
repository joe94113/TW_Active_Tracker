function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return new Date(`${text}T00:00:00+08:00`);
}

function diffDays(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

export function buildEarningsIndex(earningsPayload) {
  const index = new Map();
  const items = earningsPayload?.items ?? [];

  for (const item of items) {
    const code = String(item?.code ?? '').trim();
    if (!code) continue;
    if (!index.has(code)) index.set(code, []);
    index.get(code).push({
      code,
      companyName: item.companyName ?? null,
      expectedDate: item.expectedDate ?? null,
      quarter: item.quarter ?? null,
      type: item.type ?? '財報',
      note: item.note ?? null,
    });
  }

  for (const list of index.values()) {
    list.sort((a, b) => String(a.expectedDate ?? '').localeCompare(String(b.expectedDate ?? '')));
  }

  return index;
}

export function findNextEarnings(code, earningsIndex, asOf = new Date()) {
  const list = earningsIndex?.get(String(code ?? '').trim());
  if (!list?.length) return null;

  const asOfKey = asOf.toISOString().slice(0, 10);
  const upcoming = list.find((item) => String(item.expectedDate ?? '') >= asOfKey);
  if (!upcoming) return null;

  const expected = parseDate(upcoming.expectedDate);
  return {
    ...upcoming,
    daysUntil: expected ? diffDays(asOf, expected) : null,
  };
}

export function buildProductEventIndex(productEventsPayload) {
  const items = (productEventsPayload?.items ?? []).map((item) => ({
    slug: item.slug ?? null,
    title: item.title ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? item.startDate ?? null,
    themes: Array.isArray(item.themes) ? item.themes : [],
    industries: Array.isArray(item.industries) ? item.industries : [],
    tone: item.tone ?? 'normal',
    url: item.url ?? null,
    note: item.note ?? null,
  }));

  const byTheme = new Map();
  for (const item of items) {
    for (const key of [...item.themes, ...item.industries]) {
      const normalized = String(key).trim();
      if (!normalized) continue;
      if (!byTheme.has(normalized)) byTheme.set(normalized, []);
      byTheme.get(normalized).push(item);
    }
  }

  return { items, byTheme };
}

export function findUpcomingThemeEvents(themeOrIndustry, productIndex, asOf = new Date(), withinDays = 45) {
  const key = String(themeOrIndustry ?? '').trim();
  if (!key || !productIndex) return [];

  return (productIndex.byTheme?.get(key) ?? [])
    .map((item) => {
      const start = parseDate(item.startDate);
      return { ...item, daysUntil: start ? diffDays(asOf, start) : null };
    })
    .filter((item) => item.daysUntil !== null && item.daysUntil >= -3 && item.daysUntil <= withinDays)
    .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999));
}

export function buildEarningsRiskBadge(nextEarnings) {
  if (!nextEarnings) return null;
  const days = toNumber(nextEarnings.daysUntil);
  if (days === null || days < 0) return null;

  if (days <= 3) {
    return {
      key: 'earnings-imminent',
      title: `${nextEarnings.type}倒數 ${days} 天`,
      tone: 'warning',
      note: '財報或法說很接近時，短線波動通常會放大，先想好要看的是公告前還是公告後。',
    };
  }

  if (days <= 10) {
    return {
      key: 'earnings-near',
      title: `${nextEarnings.type}倒數 ${days} 天`,
      tone: 'info',
      note: '事件進入觀察窗，可以先看市場是否提前卡位或先避開不確定性。',
    };
  }

  return {
    key: 'earnings-upcoming',
    title: `${nextEarnings.type}倒數 ${days} 天`,
    tone: 'info',
    note: null,
  };
}
