function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildInsiderHoldingsIndex(payload) {
  const items = payload?.items ?? [];
  const map = new Map();

  for (const item of items) {
    const code = String(item?.code ?? '').trim();
    if (!code) continue;
    if (!map.has(code)) map.set(code, []);
    map.get(code).push(item);
  }

  for (const list of map.values()) {
    list.sort((a, b) => String(a.reportMonth ?? '').localeCompare(String(b.reportMonth ?? '')));
  }

  return map;
}

export function getLatestInsiderRecord(code, index) {
  const list = index?.get(String(code ?? '').trim());
  if (!list?.length) return null;
  return list.at(-1);
}

export function buildInsiderSignal(record) {
  if (!record) return null;
  const deltaPct = toNumber(record?.deltaFromPrevMonth?.pct);
  const deltaShares = toNumber(record?.deltaFromPrevMonth?.shares);
  if (deltaPct === null) return null;

  if (deltaPct >= 0.5) {
    return {
      key: 'insider-buy',
      title: '內部人持股增加',
      tone: 'up',
      note: `最近一筆內部人持股增加 ${deltaPct.toFixed(2)}%${deltaShares ? `，約 ${Math.abs(deltaShares / 1000).toFixed(0)} 張` : ''}。`,
    };
  }

  if (deltaPct <= -0.5) {
    return {
      key: 'insider-sell',
      title: '內部人持股減少',
      tone: 'down',
      note: `最近一筆內部人持股減少 ${Math.abs(deltaPct).toFixed(2)}%${deltaShares ? `，約 ${Math.abs(deltaShares / 1000).toFixed(0)} 張` : ''}。`,
    };
  }

  return null;
}

export function classifyInsiderTrend(code, index) {
  const record = getLatestInsiderRecord(code, index);
  const signal = buildInsiderSignal(record);

  return {
    record,
    signal,
    hasBuy: signal?.key === 'insider-buy',
    hasSell: signal?.key === 'insider-sell',
  };
}
