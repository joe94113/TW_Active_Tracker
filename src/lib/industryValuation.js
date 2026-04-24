function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentileRank(sortedValues, target) {
  if (!sortedValues.length || target === null) return null;
  const below = sortedValues.filter((value) => value < target).length;
  const equal = sortedValues.filter((value) => value === target).length;
  return ((below + equal / 2) / sortedValues.length) * 100;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildIndustryStats(stocks) {
  const peValues = [];
  const pbValues = [];
  const dyValues = [];

  for (const stock of stocks) {
    const pe = toNumber(stock.peRatio);
    if (pe !== null && pe > 0 && pe < 500) peValues.push(pe);
    const pb = toNumber(stock.pbRatio);
    if (pb !== null && pb > 0 && pb < 100) pbValues.push(pb);
    const dy = toNumber(stock.dividendYield);
    if (dy !== null && dy >= 0 && dy < 50) dyValues.push(dy);
  }

  const sortAsc = (arr) => [...arr].sort((a, b) => a - b);

  return {
    peSorted: sortAsc(peValues),
    pbSorted: sortAsc(pbValues),
    dySorted: sortAsc(dyValues),
    count: stocks.length,
    peMedian: peValues.length ? median(peValues) : null,
    pbMedian: pbValues.length ? median(pbValues) : null,
    dyMedian: dyValues.length ? median(dyValues) : null,
  };
}

export function buildIndustryValuationIndex(stocks = []) {
  const groups = new Map();

  for (const stock of stocks) {
    const industryName = String(stock?.industryName ?? '').trim();
    if (!industryName) continue;
    if (!groups.has(industryName)) groups.set(industryName, []);
    groups.get(industryName).push(stock);
  }

  const index = new Map();
  for (const [industryName, items] of groups.entries()) {
    if (items.length < 4) continue;
    index.set(industryName, buildIndustryStats(items));
  }

  return index;
}

export function computeIndustryValuation(stock, industryIndex) {
  const industryName = String(stock?.industryName ?? '').trim();
  if (!industryName || !industryIndex?.has(industryName)) {
    return {
      industryName: industryName || null,
      pePercentile: null,
      pbPercentile: null,
      dyPercentile: null,
      peRelative: null,
      pbRelative: null,
      peerCount: 0,
      valuationTone: 'normal',
    };
  }

  const stats = industryIndex.get(industryName);
  const pe = toNumber(stock.peRatio);
  const pb = toNumber(stock.pbRatio);
  const dy = toNumber(stock.dividendYield);

  const pePercentile = pe !== null ? percentileRank(stats.peSorted, pe) : null;
  const pbPercentile = pb !== null ? percentileRank(stats.pbSorted, pb) : null;
  const dyPercentile = dy !== null ? percentileRank(stats.dySorted, dy) : null;

  const peRelative = pe !== null && stats.peMedian ? pe / stats.peMedian : null;
  const pbRelative = pb !== null && stats.pbMedian ? pb / stats.pbMedian : null;

  let valuationTone = 'normal';
  if (pePercentile !== null) {
    if (pePercentile <= 30) valuationTone = 'cheap';
    else if (pePercentile >= 80) valuationTone = 'expensive';
  }

  return {
    industryName,
    pePercentile,
    pbPercentile,
    dyPercentile,
    peRelative,
    pbRelative,
    peerCount: stats.count,
    valuationTone,
  };
}

export function describeValuation(valuation) {
  if (!valuation || valuation.pePercentile === null) return null;
  const pct = Math.round(valuation.pePercentile);
  if (pct <= 20) return `產業內 PE 偏低，落在第 ${pct} 百分位`;
  if (pct <= 40) return `產業內 PE 略低，落在第 ${pct} 百分位`;
  if (pct >= 80) return `產業內 PE 偏高，落在第 ${pct} 百分位`;
  if (pct >= 60) return `產業內 PE 略高，落在第 ${pct} 百分位`;
  return `產業內 PE 位在中間區間，落在第 ${pct} 百分位`;
}
