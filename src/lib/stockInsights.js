function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampBand(level, ratio) {
  if (level === null) {
    return { low: null, high: null };
  }

  return {
    low: level * (1 - ratio),
    high: level * (1 + ratio),
  };
}

function getWindowExtremes(rows, size) {
  const windowRows = rows.slice(-size);
  const highs = windowRows.map((row) => toNumber(row.high) ?? toNumber(row.close)).filter((value) => value !== null);
  const lows = windowRows.map((row) => toNumber(row.low) ?? toNumber(row.close)).filter((value) => value !== null);

  return {
    high: highs.length ? Math.max(...highs) : null,
    low: lows.length ? Math.min(...lows) : null,
  };
}

function buildEventDateFromYearMonth(yearMonth, day = 10) {
  if (!yearMonth) return null;

  const normalized = String(yearMonth).replaceAll('/', '').replaceAll('-', '');

  if (!/^\d{6}$/.test(normalized)) {
    return null;
  }

  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6)) - 1;
  const nextMonthDate = new Date(Date.UTC(year, month + 1, day));

  return nextMonthDate.toISOString().slice(0, 10);
}

function buildQuarterEventDate(year, quarter) {
  const numericYear = Number(year);
  const numericQuarter = Number(quarter);

  if (!Number.isFinite(numericYear) || !Number.isFinite(numericQuarter)) {
    return null;
  }

  const quarterEndMonth = numericQuarter * 3;
  const eventDate = new Date(Date.UTC(numericYear, quarterEndMonth + 1, 14));
  return eventDate.toISOString().slice(0, 10);
}

export function buildKeyPriceZones(detail) {
  const rows = detail?.歷史資料 ?? [];
  const latestSummary = detail?.最新摘要 ?? {};
  const latestIndicators = detail?.最新指標 ?? {};
  const currentPrice = toNumber(latestSummary.close);
  const shortWindow = getWindowExtremes(rows, 20);
  const longWindow = getWindowExtremes(rows, 60);
  const levels = [
    { key: 'current', label: '目前價', value: currentPrice, role: 'reference' },
    { key: 'high20', label: '20 日高點', value: shortWindow.high, role: currentPrice !== null && shortWindow.high !== null && shortWindow.high > currentPrice ? 'resistance' : 'reference' },
    { key: 'low20', label: '20 日低點', value: shortWindow.low, role: currentPrice !== null && shortWindow.low !== null && shortWindow.low < currentPrice ? 'support' : 'reference' },
    { key: 'high60', label: '60 日高點', value: longWindow.high, role: currentPrice !== null && longWindow.high !== null && longWindow.high > currentPrice ? 'resistance' : 'reference' },
    { key: 'low60', label: '60 日低點', value: longWindow.low, role: currentPrice !== null && longWindow.low !== null && longWindow.low < currentPrice ? 'support' : 'reference' },
    { key: 'ma20', label: 'MA20', value: toNumber(latestIndicators.maMedium ?? latestIndicators.ma20), role: currentPrice !== null && toNumber(latestIndicators.maMedium ?? latestIndicators.ma20) !== null ? (toNumber(latestIndicators.maMedium ?? latestIndicators.ma20) <= currentPrice ? 'support' : 'resistance') : 'reference' },
    { key: 'ma60', label: 'MA60', value: toNumber(latestIndicators.maLong ?? latestIndicators.ma60), role: currentPrice !== null && toNumber(latestIndicators.maLong ?? latestIndicators.ma60) !== null ? (toNumber(latestIndicators.maLong ?? latestIndicators.ma60) <= currentPrice ? 'support' : 'resistance') : 'reference' },
  ];

  return levels.filter((item, index, list) =>
    item.value !== null &&
    list.findIndex((candidate) => candidate.key !== item.key && candidate.label === item.label) === index,
  );
}

export function buildSupportResistance(detail) {
  const currentPrice = toNumber(detail?.最新摘要?.close);
  const levels = buildKeyPriceZones(detail)
    .filter((item) => item.value !== null && item.role !== 'reference')
    .map((item) => ({
      ...item,
      distancePercent: currentPrice ? ((item.value - currentPrice) / currentPrice) * 100 : null,
      ...clampBand(item.value, item.role === 'support' ? 0.012 : 0.015),
    }));

  return {
    supports: levels
      .filter((item) => item.role === 'support')
      .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))
      .slice(0, 3),
    resistances: levels
      .filter((item) => item.role === 'resistance')
      .sort((left, right) => (left.value ?? Infinity) - (right.value ?? Infinity))
      .slice(0, 3),
  };
}

export function buildStockEventCalendar(detail) {
  const monthlyRevenue = detail?.財務資料?.月營收 ?? null;
  const incomeStatement = detail?.財務資料?.綜合損益表 ?? null;
  const etfExposure = detail?.主動ETF曝光 ?? null;
  const selectionSignals = detail?.交易提醒 ?? null;
  const events = [];

  if (monthlyRevenue?.出表日期) {
    events.push({
      key: 'last-revenue',
      label: '最近月營收已公布',
      date: monthlyRevenue.出表日期,
      status: 'recent',
      note: `最新資料年月 ${monthlyRevenue.資料年月 ?? '尚無資料'}`,
    });
  }

  const nextRevenueDate = buildEventDateFromYearMonth(monthlyRevenue?.資料年月, 10);
  if (nextRevenueDate) {
    events.push({
      key: 'next-revenue',
      label: '下次月營收觀察窗',
      date: nextRevenueDate,
      status: 'upcoming',
      note: '一般可先留意每月 10 日前後更新節奏。',
    });
  }

  const nextQuarterDate = buildQuarterEventDate(incomeStatement?.年度, incomeStatement?.季別);
  if (nextQuarterDate) {
    events.push({
      key: 'next-quarter',
      label: '下次季報觀察窗',
      date: nextQuarterDate,
      status: 'upcoming',
      note: `以上次季報 ${incomeStatement?.年度 ?? '-'} 年 Q${incomeStatement?.季別 ?? '-'} 推估下一個觀察時間。`,
    });
  }

  if (etfExposure?.items?.[0]?.disclosureDate) {
    events.push({
      key: 'etf-disclosure',
      label: '主動 ETF 揭露參考',
      date: etfExposure.items[0].disclosureDate,
      status: 'reference',
      note: `${etfExposure.items[0].etfName} 最近一次揭露日`,
    });
  }

  if (selectionSignals?.eventCalendar?.length) {
    events.push(...selectionSignals.eventCalendar);
  }

  return events
    .filter((item) => item.date)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key) === index)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
}
