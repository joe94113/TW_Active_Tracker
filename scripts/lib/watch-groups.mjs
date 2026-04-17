const numberFormatter = new Intl.NumberFormat('zh-TW', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}%`;
}

function takeUniqueByCode(items, usedCodes, formatter, limit = 3) {
  const results = [];

  for (const item of items ?? []) {
    const code = String(item?.code ?? '').trim();

    if (!code || usedCodes.has(code)) {
      continue;
    }

    usedCodes.add(code);
    results.push(formatter(item));

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function clampRating(value) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function normalizeLots(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount / 1000 : null;
}

function createBaseItem(item) {
  return {
    code: item.code,
    name: item.name,
    close: item.close ?? null,
    changePercent: item.changePercent ?? null,
    return20: item.return20 ?? null,
    volumeLots: normalizeLots(item.volume),
  };
}

export function buildRatingText(value) {
  const rating = clampRating(value);
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
}

function rateStableInstitutional(item) {
  const foreign = Math.max(0, Number(item?.foreignAccumulated ?? 0));
  const trust = Math.max(0, Number(item?.trustAccumulated ?? 0));
  const return20 = Number(item?.return20 ?? 0);
  const days = Math.max(Number(item?.foreignDays ?? 0), Number(item?.trustDays ?? 0));
  const raw =
    2.2 +
    Math.min((foreign + trust) / 30000000, 1.1) +
    Math.min(return20 / 30, 0.9) +
    Math.min(days / 8, 0.8);
  return clampRating(raw);
}

function rateStableBullish(item) {
  const return20 = Number(item?.return20 ?? 0);
  const total5Day = Math.max(0, Number(item?.total5Day ?? 0));
  const etfCount = Number(item?.activeEtfCount ?? 0);
  const raw =
    2 + Math.min(return20 / 24, 1) + Math.min(total5Day / 8000000, 0.8) + Math.min(etfCount / 4, 0.8);
  return clampRating(raw);
}

function rateAggressiveVolume(item) {
  const volumeRatio5 = Math.max(0, Number(item?.volumeRatio5 ?? 0));
  const distanceToHigh20 = Math.max(0, Number(item?.distanceToHigh20 ?? 99));
  const changePercent = Number(item?.changePercent ?? 0);
  const raw =
    2.3 +
    Math.min(changePercent / 8, 0.9) +
    Math.max(0, (70 - volumeRatio5) / 120) +
    Math.max(0, (6 - distanceToHigh20) / 8);
  return clampRating(raw);
}

function rateAggressiveConsolidation(item) {
  const rangePercent = Math.max(0, Number(item?.rangePercent ?? 99));
  const distanceToHigh = Math.max(0, Number(item?.distanceToHigh ?? 99));
  const rsi = Number(item?.rsi ?? 50);
  const raw =
    2.1 +
    Math.max(0, (8 - rangePercent) / 10) +
    Math.max(0, (2.5 - distanceToHigh) / 3) +
    Math.max(0, (rsi - 50) / 35);
  return clampRating(raw);
}

function createStableInstitutionalItem(item) {
  return {
    ...createBaseItem(item),
    label: '雙法人偏多',
    rating: rateStableInstitutional(item),
    detail: `${item.signalLabel}｜外資 ${formatNumber(item.foreignAccumulated, 0)} / 投信 ${formatNumber(item.trustAccumulated, 0)}｜20 日 ${formatPercent(item.return20)}`,
  };
}

function createStableBullishItem(item) {
  return {
    ...createBaseItem(item),
    label: '偏多焦點',
    rating: rateStableBullish(item),
    detail: `${item.topSignalTitle}｜20 日 ${formatPercent(item.return20)}｜五日籌碼 ${numberFormatter.format(Math.round(Number(item.total5Day ?? 0)))}`,
  };
}

function createAggressiveVolumeItem(item) {
  return {
    ...createBaseItem(item),
    label: '量縮價揚',
    rating: rateAggressiveVolume(item),
    detail: `單日 ${formatPercent(item.changePercent)}｜量能比 5 日 ${formatNumber(item.volumeRatio5, 0)}%｜距 20 日高 ${formatNumber(item.distanceToHigh20, 1)}%`,
  };
}

function createAggressiveConsolidationItem(item) {
  return {
    ...createBaseItem(item),
    label: '盤整待發',
    rating: rateAggressiveConsolidation(item),
    detail: `30 日區間 ${formatNumber(item.rangePercent, 1)}%｜離前高 ${formatNumber(item.distanceToHigh, 1)}%｜RSI ${formatNumber(item.rsi, 1)}`,
  };
}

export function buildWatchGroups({
  institutionalResonance = [],
  bullishSignals = [],
  volumeSqueezeRisers = [],
  consolidationWatch = [],
} = {}) {
  const stableCodes = new Set();
  const aggressiveCodes = new Set();
  const stable = [];
  const aggressive = [];

  stable.push(...takeUniqueByCode(institutionalResonance, stableCodes, createStableInstitutionalItem, 3));
  stable.push(...takeUniqueByCode(bullishSignals, stableCodes, createStableBullishItem, 2));
  aggressive.push(...takeUniqueByCode(volumeSqueezeRisers, aggressiveCodes, createAggressiveVolumeItem, 3));
  aggressive.push(...takeUniqueByCode(consolidationWatch, aggressiveCodes, createAggressiveConsolidationItem, 3));

  const stableSorted = stable.sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0)).slice(0, 5);
  const stableCodeSet = new Set(stableSorted.map((item) => item.code));
  const aggressiveDeduped = aggressive
    .filter((item) => !stableCodeSet.has(item.code))
    .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))
    .slice(0, 6);

  return {
    stable: stableSorted,
    aggressive: aggressiveDeduped,
  };
}
