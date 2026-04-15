function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values) {
  const validValues = values.map(toNumber).filter((value) => value !== null);

  if (!validValues.length) {
    return null;
  }

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function percentDiff(numerator, denominator) {
  const left = toNumber(numerator);
  const right = toNumber(denominator);

  if (left === null || right === null || right === 0) {
    return null;
  }

  return (left / right) * 100;
}

function priceDistancePercent(target, base) {
  const left = toNumber(target);
  const right = toNumber(base);

  if (left === null || right === null || right === 0) {
    return null;
  }

  return ((left - right) / right) * 100;
}

function buildStockMetaMap(stockMetaList = []) {
  return new Map(stockMetaList.map((item) => [String(item.code ?? '').trim(), item]));
}

function getHistoryRows(detail) {
  return (detail?.歷史資料 ?? [])
    .map((row) => ({
      ...row,
      close: toNumber(row?.close),
      high: toNumber(row?.high) ?? toNumber(row?.close),
      low: toNumber(row?.low) ?? toNumber(row?.close),
      volume: toNumber(row?.volume),
    }))
    .filter((row) => row.close !== null);
}

function getHighLow(rows) {
  const highs = rows.map((row) => row.high).filter((value) => value !== null);
  const lows = rows.map((row) => row.low).filter((value) => value !== null);

  return {
    high: highs.length ? Math.max(...highs) : null,
    low: lows.length ? Math.min(...lows) : null,
  };
}

function getLatestIndicators(detail) {
  return detail?.最新指標 ?? {};
}

function getLatestSummary(detail) {
  return detail?.最新摘要 ?? {};
}

function buildBaseEntry(detail, stockMeta = {}) {
  const latestSummary = getLatestSummary(detail);

  return {
    code: detail?.code ?? stockMeta?.code ?? null,
    name: detail?.name ?? stockMeta?.name ?? null,
    industryName: stockMeta?.industryName ?? null,
    close: toNumber(latestSummary?.close),
    changePercent: toNumber(latestSummary?.changePercent ?? stockMeta?.changePercent),
    return20: toNumber(latestSummary?.return20 ?? stockMeta?.return20),
    volume: toNumber(latestSummary?.volume ?? stockMeta?.volume),
    foreign5Day: toNumber(stockMeta?.foreign5Day),
    investmentTrust5Day: toNumber(stockMeta?.investmentTrust5Day),
    total5Day: toNumber(stockMeta?.total5Day),
    topSignalTitle: stockMeta?.topSignalTitle ?? null,
    topSignalTone: stockMeta?.topSignalTone ?? 'normal',
  };
}

function pickVolumeSqueezeRisers(stockDetailList, stockMetaMap) {
  return stockDetailList
    .map((detail) => {
      const stockMeta = stockMetaMap.get(detail?.code) ?? {};
      const rows = getHistoryRows(detail);

      if (rows.length < 25) {
        return null;
      }

      const latest = rows.at(-1);
      const previous = rows.at(-2);
      const latestIndicators = getLatestIndicators(detail);
      const avgVolume5 = average(rows.slice(-6, -1).map((row) => row.volume));
      const avgVolume20 = average(rows.slice(-21, -1).map((row) => row.volume));
      const ma20 = toNumber(latestIndicators?.maMedium ?? latestIndicators?.ma20);
      const windowHigh20 = getHighLow(rows.slice(-20)).high;
      const volumeRatio5 = percentDiff(latest.volume, avgVolume5);
      const volumeRatio20 = percentDiff(latest.volume, avgVolume20);
      const distanceToHigh20 = windowHigh20 === null ? null : Math.max(0, priceDistancePercent(windowHigh20, latest.close));
      const singleDayChange = priceDistancePercent(latest.close, previous?.close);

      if (
        singleDayChange === null ||
        singleDayChange < 1.2 ||
        volumeRatio5 === null ||
        volumeRatio5 > 88 ||
        volumeRatio20 === null ||
        volumeRatio20 > 95 ||
        ma20 === null ||
        latest.close < ma20
      ) {
        return null;
      }

      const score =
        singleDayChange * 14 +
        Math.max(0, 100 - volumeRatio5) +
        Math.max(0, 100 - volumeRatio20) +
        Math.max(0, 3 - (distanceToHigh20 ?? 3)) * 12 +
        Math.max(0, toNumber(stockMeta?.activeEtfCount) ?? 0) * 2;

      return {
        ...buildBaseEntry(detail, stockMeta),
        score,
        volumeRatio5,
        volumeRatio20,
        distanceToHigh20,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, 4);
}

function pickConsolidationWatch(stockDetailList, stockMetaMap) {
  return stockDetailList
    .map((detail) => {
      const stockMeta = stockMetaMap.get(detail?.code) ?? {};
      const rows = getHistoryRows(detail);

      if (rows.length < 65) {
        return null;
      }

      const latest = rows.at(-1);
      const latestIndicators = getLatestIndicators(detail);
      const recent30 = rows.slice(-30);
      const { high, low } = getHighLow(recent30);
      const avgVolume20 = average(rows.slice(-21, -1).map((row) => row.volume));
      const ma20 = toNumber(latestIndicators?.maMedium ?? latestIndicators?.ma20);
      const ma60 = toNumber(latestIndicators?.maLong ?? latestIndicators?.ma60);
      const rsi = toNumber(latestIndicators?.rsi14 ?? latestIndicators?.rsi);
      const rangePercent = high !== null && low !== null ? priceDistancePercent(high, low) : null;
      const distanceToHigh = high !== null ? Math.max(0, priceDistancePercent(high, latest.close)) : null;
      const maGapPercent = ma20 !== null && ma60 !== null ? Math.abs(priceDistancePercent(ma20, ma60)) : null;
      const volumeRatio20 = percentDiff(latest.volume, avgVolume20);
      const singleDayChange = priceDistancePercent(latest.close, rows.at(-2)?.close);

      if (
        rangePercent === null ||
        rangePercent > 12 ||
        distanceToHigh === null ||
        distanceToHigh > 2.8 ||
        maGapPercent === null ||
        maGapPercent > 4 ||
        rsi === null ||
        rsi < 48 ||
        rsi > 68 ||
        singleDayChange === null ||
        singleDayChange < -1.5
      ) {
        return null;
      }

      const score =
        Math.max(0, 12 - rangePercent) * 10 +
        Math.max(0, 3 - distanceToHigh) * 16 +
        Math.max(0, 4 - maGapPercent) * 10 +
        Math.max(0, (volumeRatio20 ?? 0) - 90) * 0.4;

      return {
        ...buildBaseEntry(detail, stockMeta),
        score,
        rangePercent,
        distanceToHigh,
        maGapPercent,
        volumeRatio20,
        rsi,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, 4);
}

function buildInstitutionalResonance(dashboard, stockMetaMap) {
  const foreignList = dashboard?.法人追蹤?.外資連買 ?? [];
  const trustList = dashboard?.法人追蹤?.投信連買 ?? [];
  const foreignMap = new Map(foreignList.map((item) => [String(item.代號 ?? '').trim(), item]));
  const trustMap = new Map(trustList.map((item) => [String(item.代號 ?? '').trim(), item]));
  const codeSet = new Set([...foreignMap.keys(), ...trustMap.keys()]);

  return [...codeSet]
    .map((code) => {
      const foreign = foreignMap.get(code) ?? null;
      const trust = trustMap.get(code) ?? null;
      const stockMeta = stockMetaMap.get(code) ?? {};
      const foreignSupportive = Boolean(foreign) || String(trust?.其他法人態度 ?? '').includes('外資同步偏多');
      const trustSupportive = Boolean(trust) || String(foreign?.其他法人態度 ?? '').includes('投信同步偏多');
      const foreignFiveDay = Math.max(0, toNumber(stockMeta?.foreign5Day) ?? 0);
      const trustFiveDay = Math.max(0, toNumber(stockMeta?.investmentTrust5Day) ?? 0);

      if (!foreignSupportive || !trustSupportive) {
        return null;
      }

      const foreignDays = toNumber(foreign?.連買天數) ?? 0;
      const trustDays = toNumber(trust?.連買天數) ?? 0;
      const foreignAccumulated = toNumber(foreign?.累計買超股數) ?? foreignFiveDay;
      const trustAccumulated = toNumber(trust?.累計買超股數) ?? trustFiveDay;
      const totalAccumulated = foreignAccumulated + trustAccumulated;
      const hasDoubleConsecutiveBuy = foreignDays > 0 && trustDays > 0;

      if (!hasDoubleConsecutiveBuy && (foreignFiveDay <= 0 || trustFiveDay <= 0)) {
        return null;
      }

      return {
        code,
        name: foreign?.名稱 ?? trust?.名稱 ?? stockMeta?.name ?? null,
        industryName: stockMeta?.industryName ?? null,
        close: toNumber(foreign?.收盤價 ?? trust?.收盤價 ?? stockMeta?.close),
        changePercent: toNumber(foreign?.漲跌幅 ?? trust?.漲跌幅 ?? stockMeta?.changePercent),
        return20: toNumber(stockMeta?.return20),
        foreignDays,
        trustDays,
        foreignAccumulated,
        trustAccumulated,
        totalAccumulated,
        signalLabel: hasDoubleConsecutiveBuy ? '雙法人連買' : '雙法人五日同步買超',
        score: foreignDays * 14 + trustDays * 14 + Math.min(totalAccumulated / 300000, 60),
      };
    })
    .filter(Boolean)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, 5);
}

export function buildSelectionRadar({ dashboard, stockMetaList = [], stockDetailList = [] }) {
  const stockMetaMap = buildStockMetaMap(stockMetaList);

  return {
    volumeSqueezeRisers: pickVolumeSqueezeRisers(stockDetailList, stockMetaMap),
    consolidationWatch: pickConsolidationWatch(stockDetailList, stockMetaMap),
    institutionalResonance: buildInstitutionalResonance(dashboard, stockMetaMap),
  };
}
