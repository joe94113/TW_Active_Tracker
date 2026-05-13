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

function getPriceRows(detail) {
  const rows = detail?.歷史資料;

  return Array.isArray(rows)
    ? rows.filter((row) => row && typeof row === 'object' && (toNumber(row.close) ?? toNumber(row.high) ?? toNumber(row.low)) !== null)
    : [];
}

function calculateWindowVwap(rows) {
  let weightedClose = 0;
  let totalVolume = 0;

  rows.forEach((row) => {
    const close = toNumber(row.close);
    const volume = toNumber(row.volume);

    if (close === null || volume === null || volume <= 0) {
      return;
    }

    weightedClose += close * volume;
    totalVolume += volume;
  });

  if (totalVolume <= 0) {
    return null;
  }

  return weightedClose / totalVolume;
}

function toUtcStamp(dateText) {
  if (!dateText) return null;
  const stamp = Date.parse(`${dateText}T00:00:00Z`);
  return Number.isFinite(stamp) ? stamp : null;
}

function buildEventDateFromYearMonth(yearMonth, day = 10, asOfDate = null) {
  if (!yearMonth) return null;

  const normalized = String(yearMonth).replaceAll('/', '').replaceAll('-', '');

  if (!/^\d{6}$/.test(normalized)) {
    return null;
  }

  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6)) - 1;
  const nextMonthDate = new Date(Date.UTC(year, month + 1, day));
  const asOfStamp = toUtcStamp(asOfDate);

  while (asOfStamp !== null && nextMonthDate.getTime() <= asOfStamp) {
    nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
  }

  return nextMonthDate.toISOString().slice(0, 10);
}

function buildQuarterEventDate(year, quarter, asOfDate = null) {
  const numericYear = Number(year);
  const numericQuarter = Number(quarter);

  if (!Number.isFinite(numericYear) || !Number.isFinite(numericQuarter)) {
    return null;
  }

  const quarterEndMonth = numericQuarter * 3;
  const eventDate = new Date(Date.UTC(numericYear, quarterEndMonth + 1, 14));
  const asOfStamp = toUtcStamp(asOfDate);

  while (asOfStamp !== null && eventDate.getTime() <= asOfStamp) {
    eventDate.setUTCMonth(eventDate.getUTCMonth() + 3);
  }

  return eventDate.toISOString().slice(0, 10);
}

function resolveAlertEventLabel(alert) {
  switch (alert?.type) {
    case 'disposition':
      return '處置交易開始';
    case 'attention':
      return '注意交易公告';
    case 'changed-trading':
      return '變更交易公告';
    case 'short-sale':
      return '借券賣出餘量更新';
    default:
      return alert?.badgeLabel || alert?.title || '交易提醒';
  }
}

function resolveAlertEventStatus(alertDate, asOfDate) {
  if (!alertDate) return 'reference';
  if (!asOfDate) return 'recent';
  return String(alertDate) > String(asOfDate) ? 'upcoming' : 'recent';
}

function buildAlertEventCalendar(selectionSignals) {
  const asOfDate = selectionSignals?.asOfDate ?? null;
  const alerts = Array.isArray(selectionSignals?.alerts) ? selectionSignals.alerts : [];

  return alerts
    .map((alert) => {
      if (!alert?.date) {
        return null;
      }

      return {
        key: `alert-${alert.key ?? `${alert.type ?? 'note'}-${alert.date}`}`,
        label: resolveAlertEventLabel(alert),
        date: alert.date,
        status: resolveAlertEventStatus(alert.date, asOfDate),
        note: alert.note || alert.detail || alert.footnote || null,
      };
    })
    .filter(Boolean);
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
  const asOfDate = detail?.priceDate ?? selectionSignals?.asOfDate ?? null;
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

  const nextRevenueDate = buildEventDateFromYearMonth(monthlyRevenue?.資料年月, 10, asOfDate);
  if (nextRevenueDate) {
    events.push({
      key: 'next-revenue',
      label: '下次月營收觀察窗',
      date: nextRevenueDate,
      status: 'upcoming',
      note: '一般可先留意每月 10 日前後更新節奏。',
    });
  }

  const nextQuarterDate = buildQuarterEventDate(incomeStatement?.年度, incomeStatement?.季別, asOfDate);
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

  events.push(...buildAlertEventCalendar(selectionSignals));

  return events
    .filter((item) => item.date)
    .filter(
      (item, index, list) =>
        list.findIndex(
          (candidate) =>
            candidate.key === item.key ||
            (candidate.date === item.date && candidate.label === item.label),
        ) === index,
    )
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
}

export function buildLargeHolderCostZone(detail, holderSnapshot = null) {
  const rows = getPriceRows(detail);
  const latestSummary = detail?.最新摘要 ?? {};
  const currentPrice = toNumber(latestSummary.close) ?? toNumber(rows.at(-1)?.close);
  const holder = holderSnapshot ?? detail?.持股分散 ?? null;
  const largeHolderRatio = toNumber(holder?.largeHolderRatio);
  const largeHolderRatioDelta = toNumber(holder?.largeHolderRatioDelta);
  const retailRatio = toNumber(holder?.retailRatio);
  const retailRatioDelta = toNumber(holder?.retailRatioDelta);

  if (!rows.length || currentPrice === null || largeHolderRatio === null) {
    return null;
  }

  let lookbackDays = 30;
  if (largeHolderRatioDelta !== null) {
    if (largeHolderRatioDelta >= 1.5) {
      lookbackDays = 5;
    } else if (largeHolderRatioDelta >= 0.8) {
      lookbackDays = 10;
    } else if (largeHolderRatioDelta >= 0.2) {
      lookbackDays = 20;
    } else if (largeHolderRatioDelta <= -1) {
      lookbackDays = 60;
    }
  }

  const windowRows = rows.slice(-Math.min(Math.max(lookbackDays, 5), rows.length));
  if (!windowRows.length) {
    return null;
  }

  const closes = windowRows.map((row) => toNumber(row.close)).filter((value) => value !== null);
  const highs = windowRows.map((row) => toNumber(row.high) ?? toNumber(row.close)).filter((value) => value !== null);
  const lows = windowRows.map((row) => toNumber(row.low) ?? toNumber(row.close)).filter((value) => value !== null);
  const vwap = calculateWindowVwap(windowRows) ?? closes.at(-1) ?? currentPrice;

  if (vwap === null) {
    return null;
  }

  const observedHigh = highs.length ? Math.max(...highs) : vwap;
  const observedLow = lows.length ? Math.min(...lows) : vwap;
  const observedSpan = Math.max(observedHigh - observedLow, vwap * 0.02);
  const deltaFactor = Math.min(Math.max(Math.abs(largeHolderRatioDelta ?? 0), 0), 5);
  let halfBand = Math.max(vwap * (0.03 + deltaFactor * 0.004), observedSpan * 0.18);

  if (largeHolderRatio >= 70) {
    halfBand *= 0.92;
  } else if (largeHolderRatio <= 45) {
    halfBand *= 1.08;
  }

  const low = Math.max(0, vwap - halfBand);
  const high = vwap + halfBand;
  const distancePercent = currentPrice ? ((currentPrice - vwap) / vwap) * 100 : null;
  const status = currentPrice > high ? 'above' : currentPrice < low ? 'below' : 'inside';
  const confidence = Math.round(
    Math.min(
      92,
      46
        + Math.min(windowRows.length, 60) * 0.45
        + (largeHolderRatioDelta !== null ? 10 : 0)
        + (retailRatio !== null ? 6 : 0),
    ),
  );

  let summary = '股價仍在推估的大戶成本帶附近，可觀察區間內換手是否穩定。';
  if (status === 'above') {
    summary = '股價站在推估大戶成本帶之上，代表優勢仍在，但若離帶過遠就要留意追價風險。';
  } else if (status === 'below') {
    summary = '股價跌回推估大戶成本帶下方，大戶優勢可能轉弱，先看能否重新站回帶內。';
  }

  let note = `以近 ${windowRows.length} 個交易日價量與最新持股分散推估，當作大戶主要換手區。`;
  if (largeHolderRatioDelta !== null) {
    if (Math.abs(largeHolderRatioDelta) < 0.005) {
      note += ' 大戶持股比本期大致持平。';
    } else {
      note += ` 大戶持股比本期${largeHolderRatioDelta >= 0 ? '增加' : '減少'} ${Math.abs(largeHolderRatioDelta).toFixed(2)} 個百分點。`;
    }
  }
  if (retailRatioDelta !== null) {
    if (Math.abs(retailRatioDelta) < 0.005) {
      note += ' 散戶持股比本期大致持平。';
    } else {
      note += ` 散戶持股比本期${retailRatioDelta >= 0 ? '增加' : '減少'} ${Math.abs(retailRatioDelta).toFixed(2)} 個百分點。`;
    }
  }

  return {
    low,
    high,
    mid: vwap,
    lookbackDays: windowRows.length,
    currentPrice,
    distancePercent,
    status,
    confidence,
    largeHolderRatio,
    largeHolderRatioDelta,
    retailRatio,
    retailRatioDelta,
    asOfDate: holder?.date ?? detail?.priceDate ?? null,
    summary,
    note,
  };
}
