function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeDailyTradeValue(stock) {
  const turnover = toNumber(stock?.turnover);
  if (turnover !== null && turnover > 0) return turnover;

  const close = toNumber(stock?.close);
  const volume = toNumber(stock?.volume);
  if (close !== null && close > 0 && volume !== null && volume > 0) {
    return close * volume;
  }

  return null;
}

export function computeAvgTradeValue(stock) {
  const sparkline20 = Array.isArray(stock?.sparkline20) ? stock.sparkline20 : null;
  const volume = toNumber(stock?.volume);
  const single = computeDailyTradeValue(stock);

  if (single === null) return null;
  if (!sparkline20 || sparkline20.length < 5 || volume === null || volume <= 0) {
    return single;
  }

  const avgPrice = sparkline20.reduce((sum, value) => sum + Number(value || 0), 0) / sparkline20.length;
  if (!Number.isFinite(avgPrice) || avgPrice <= 0) {
    return single;
  }

  return avgPrice * volume;
}

export const LIQUIDITY_TIERS = [
  { key: 'very-low', label: '流動性偏低', max: 5_000_000, tone: 'risk' },
  { key: 'low', label: '成交偏薄', max: 20_000_000, tone: 'warning' },
  { key: 'normal', label: '流動性中等', max: 100_000_000, tone: 'normal' },
  { key: 'high', label: '流動性充足', max: 500_000_000, tone: 'up' },
  { key: 'very-high', label: '熱門交易股', max: Infinity, tone: 'up' },
];

export function classifyLiquidity(value) {
  if (value === null || !Number.isFinite(value)) {
    return { key: 'unknown', label: '資料不足', tone: 'info' };
  }

  return LIQUIDITY_TIERS.find((tier) => value <= tier.max) ?? LIQUIDITY_TIERS.at(-1);
}

export function formatTradeValue(value) {
  const num = toNumber(value);
  if (num === null) return '-';
  if (Math.abs(num) >= 100000000) return `${(num / 100000000).toFixed(2)} 億`;
  if (Math.abs(num) >= 10000000) return `${(num / 10000000).toFixed(1)} 千萬`;
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(0)} 萬`;
  return num.toFixed(0);
}
