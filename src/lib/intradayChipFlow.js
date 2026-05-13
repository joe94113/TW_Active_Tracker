function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function quantile(values, ratio) {
  if (!values.length) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function normalizePoints(data) {
  return (data?.points ?? [])
    .map((point) => {
      const timestamp = Number(point?.timestamp);
      const price = Number(point?.price);
      const volumeShares = Number(point?.volume ?? 0);

      if (!Number.isFinite(timestamp) || !Number.isFinite(price) || price <= 0) {
        return null;
      }

      return {
        timestamp,
        time: point?.time ?? '',
        dateTime: point?.dateTime ?? null,
        price,
        high: Number(point?.high ?? price),
        low: Number(point?.low ?? price),
        volumeShares: Number.isFinite(volumeShares) ? Math.max(volumeShares, 0) : 0,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function describeDominance(largeCumulativeLots, retailCumulativeLots) {
  if (largeCumulativeLots > 0 && retailCumulativeLots < 0) return '大戶偏多';
  if (largeCumulativeLots < 0 && retailCumulativeLots > 0) return '散戶偏多';
  if (largeCumulativeLots > 0 && retailCumulativeLots > 0) return '同步偏多';
  if (largeCumulativeLots < 0 && retailCumulativeLots < 0) return '同步偏空';
  return '多空拉鋸';
}

export function estimateIntradayChipFlow(data) {
  const points = normalizePoints(data);
  if (points.length < 2) {
    return null;
  }

  const turnoverValues = points
    .map((point) => point.price * point.volumeShares)
    .filter((value) => Number.isFinite(value) && value > 0);

  const baseTurnover = quantile(turnoverValues, 0.5) || 1;
  const surgeTurnover = quantile(turnoverValues, 0.8) || baseTurnover;

  let largeCumulativeLots = 0;
  let retailCumulativeLots = 0;
  let largeBuyLotsTotal = 0;
  let largeSellLotsTotal = 0;
  let retailBuyLotsTotal = 0;
  let retailSellLotsTotal = 0;

  const rows = points.map((point, index) => {
    const previousPrice = index > 0 ? points[index - 1].price : Number(data?.previousClose ?? points[0].price);
    const referencePrice = Number.isFinite(previousPrice) && previousPrice > 0 ? previousPrice : point.price;
    const priceDelta = point.price - referencePrice;
    const range = Math.max(point.high, point.price, referencePrice) - Math.min(point.low, point.price, referencePrice);
    const effectiveRange = Math.max(range, referencePrice * 0.0025, 0.01);
    const directionalStrength = clamp(priceDelta / effectiveRange, -1, 1);
    const turnover = point.price * point.volumeShares;
    const turnoverRatio = turnover / baseTurnover;
    const surgeScore = clamp(
      (turnover - baseTurnover * 0.8) / Math.max(surgeTurnover * 1.4 - baseTurnover * 0.8, 1),
      0,
      1,
    );
    const directionScore = Math.abs(directionalStrength);
    const largeShare = clamp(0.2 + surgeScore * 0.4 + directionScore * 0.18, 0.18, 0.82);
    const retailShare = 1 - largeShare;
    const volumeLots = point.volumeShares / 1000;

    const largeNetLots = volumeLots * directionalStrength * largeShare;
    const retailNetLots = -volumeLots * directionalStrength * retailShare;
    const largeBuyLots = Math.max(largeNetLots, 0);
    const largeSellLots = Math.max(-largeNetLots, 0);
    const retailBuyLots = Math.max(retailNetLots, 0);
    const retailSellLots = Math.max(-retailNetLots, 0);

    largeCumulativeLots += largeNetLots;
    retailCumulativeLots += retailNetLots;
    largeBuyLotsTotal += largeBuyLots;
    largeSellLotsTotal += largeSellLots;
    retailBuyLotsTotal += retailBuyLots;
    retailSellLotsTotal += retailSellLots;

    return {
      ...point,
      turnover,
      turnoverRatio,
      largeShare,
      retailShare,
      volumeLots,
      largeNetLots,
      retailNetLots,
      largeBuyLots,
      largeSellLots,
      retailBuyLots,
      retailSellLots,
      largeCumulativeLots,
      retailCumulativeLots,
    };
  });

  const latest = rows.at(-1);

  return {
    marketDate: data?.marketDate ?? latest?.dateTime?.slice(0, 10) ?? null,
    updatedAt: data?.updatedAt ?? latest?.dateTime ?? null,
    previousClose: data?.previousClose ?? null,
    methodology:
      '使用每 5 分鐘價量變化、價格位移與相對量能，估算盤中大戶與散戶的偏買、偏賣與淨買賣節奏；適合搭配分時圖輔助觀察，非交易所原始分點資料。',
    dominantSide: describeDominance(largeCumulativeLots, retailCumulativeLots),
    rows,
    summary: {
      largeCumulativeLots,
      retailCumulativeLots,
      largeBuyLotsTotal,
      largeSellLotsTotal,
      retailBuyLotsTotal,
      retailSellLotsTotal,
      largeLatestLots: latest?.largeNetLots ?? 0,
      retailLatestLots: latest?.retailNetLots ?? 0,
      largeLatestBuyLots: latest?.largeBuyLots ?? 0,
      largeLatestSellLots: latest?.largeSellLots ?? 0,
      retailLatestBuyLots: latest?.retailBuyLots ?? 0,
      retailLatestSellLots: latest?.retailSellLots ?? 0,
      averageTurnoverRatio: rows.reduce((sum, row) => sum + row.turnoverRatio, 0) / rows.length,
      pointCount: rows.length,
    },
  };
}
