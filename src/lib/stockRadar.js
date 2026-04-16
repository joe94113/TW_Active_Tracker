import { buildThemeMomentumTopics } from './themeRadar';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createMergedStockList(stockSummaries = [], stockSearchList = []) {
  const summaryMap = new Map(
    stockSummaries
      .filter(Boolean)
      .map((item) => [String(item.code ?? '').trim(), item]),
  );
  const searchMap = new Map(
    stockSearchList
      .filter(Boolean)
      .map((item) => [String(item.code ?? '').trim(), item]),
  );
  const codes = new Set([...summaryMap.keys(), ...searchMap.keys()]);

  return [...codes]
    .map((code) => {
      const summary = summaryMap.get(code) ?? {};
      const search = searchMap.get(code) ?? {};
      return {
        ...search,
        ...summary,
        code,
        name: summary.name ?? search.name ?? code,
        industryName: summary.industryName ?? search.industryName ?? null,
      };
    })
    .filter((item) => item.code && item.name);
}

function isRiskyStock(stock) {
  return Boolean(stock.isUnderDisposition || stock.hasAttentionWarning || stock.hasChangedTrading);
}

function hasPositiveInstitutionalFlow(stock) {
  return (toNumber(stock.foreign5Day) ?? 0) > 0 || (toNumber(stock.investmentTrust5Day) ?? 0) > 0;
}

function hasDualInstitutionalSupport(stock) {
  return (toNumber(stock.foreign5Day) ?? 0) > 0 && (toNumber(stock.investmentTrust5Day) ?? 0) > 0;
}

function buildSignalTags(stock) {
  return [
    stock.topSignalTitle,
    hasDualInstitutionalSupport(stock) ? '外資投信同步偏多' : null,
    (toNumber(stock.activeEtfCount) ?? 0) > 0 ? `${stock.activeEtfCount} 檔主動式 ETF 持有` : null,
    stock.nextExDividendDate ? `除息日 ${stock.nextExDividendDate}` : null,
  ].filter(Boolean);
}

function calculateCompressionMetrics(stock) {
  const series = Array.isArray(stock.sparkline20)
    ? stock.sparkline20.map((item) => toNumber(item)).filter((item) => item !== null)
    : [];

  if (series.length < 12) {
    return null;
  }

  const highest = Math.max(...series);
  const lowest = Math.min(...series);
  const last = series.at(-1);
  const startWindow = series.slice(0, 5);
  const endWindow = series.slice(-5);
  const startAverage = startWindow.reduce((sum, value) => sum + value, 0) / startWindow.length;
  const endAverage = endWindow.reduce((sum, value) => sum + value, 0) / endWindow.length;
  const rangePercent = last ? ((highest - lowest) / last) * 100 : null;
  const driftPercent = startAverage ? ((endAverage - startAverage) / startAverage) * 100 : null;
  const shortSlopePercent = series.at(-5) ? ((last - series.at(-5)) / series.at(-5)) * 100 : null;

  return {
    highest,
    lowest,
    last,
    rangePercent,
    driftPercent,
    shortSlopePercent,
  };
}

function normalizeRadarStock(stock, options = {}) {
  return {
    code: stock.code,
    name: stock.name,
    industryName: stock.industryName ?? null,
    close: toNumber(stock.close),
    changePercent: toNumber(stock.changePercent),
    return20: toNumber(stock.return20),
    return60: toNumber(stock.return60),
    peRatio: toNumber(stock.peRatio),
    pbRatio: toNumber(stock.pbRatio),
    dividendYield: toNumber(stock.dividendYield),
    foreign5Day: toNumber(stock.foreign5Day),
    investmentTrust5Day: toNumber(stock.investmentTrust5Day),
    total5Day: toNumber(stock.total5Day),
    activeEtfCount: toNumber(stock.activeEtfCount) ?? 0,
    topSignalTitle: stock.topSignalTitle ?? null,
    topSignalTone: stock.topSignalTone ?? 'normal',
    signalCount: toNumber(stock.signalCount) ?? 0,
    topSelectionSignalTitle: stock.topSelectionSignalTitle ?? null,
    selectionSignalTone: stock.selectionSignalTone ?? 'normal',
    selectionSignalCount: toNumber(stock.selectionSignalCount) ?? 0,
    isUnderDisposition: Boolean(stock.isUnderDisposition),
    hasAttentionWarning: Boolean(stock.hasAttentionWarning),
    hasChangedTrading: Boolean(stock.hasChangedTrading),
    nextExDividendDate: stock.nextExDividendDate ?? null,
    score: Math.round(toNumber(options.score) ?? 0),
    note: options.note ?? null,
    tags: options.tags ?? [],
    metrics: options.metrics ?? {},
  };
}

function buildTechnicalBreakouts(stockList) {
  return stockList
    .filter((stock) => !isRiskyStock(stock))
    .filter((stock) => stock.topSignalTone === 'up' || (toNumber(stock.signalCount) ?? 0) >= 2)
    .filter((stock) => (toNumber(stock.return20) ?? -999) >= 4 || (toNumber(stock.changePercent) ?? 0) >= 2)
    .map((stock) => {
      const score =
        (toNumber(stock.signalCount) ?? 0) * 18 +
        Math.max(0, toNumber(stock.return20) ?? 0) * 2.1 +
        Math.max(0, toNumber(stock.changePercent) ?? 0) * 5 +
        (toNumber(stock.activeEtfCount) ?? 0) * 4 +
        (hasDualInstitutionalSupport(stock) ? 16 : hasPositiveInstitutionalFlow(stock) ? 7 : 0);

      return normalizeRadarStock(stock, {
        score,
        note: `${stock.topSignalTitle ?? '技術面轉強'}，近期價格結構偏強，適合列入突破追蹤。`,
        tags: buildSignalTags(stock),
        metrics: {
          signal: stock.topSignalTitle ?? '技術面轉強',
          return20: toNumber(stock.return20),
          changePercent: toNumber(stock.changePercent),
        },
      });
    })
    .sort((left, right) => right.score - left.score || (right.return20 ?? 0) - (left.return20 ?? 0))
    .slice(0, 12);
}

function buildInstitutionalMomentum(stockList) {
  return stockList
    .filter((stock) => !isRiskyStock(stock))
    .filter((stock) => hasDualInstitutionalSupport(stock) || (hasPositiveInstitutionalFlow(stock) && (toNumber(stock.activeEtfCount) ?? 0) > 0))
    .map((stock) => {
      const score =
        (hasDualInstitutionalSupport(stock) ? 44 : 24) +
        (toNumber(stock.activeEtfCount) ?? 0) * 5 +
        Math.max(0, toNumber(stock.return20) ?? 0) * 1.6 +
        Math.max(0, toNumber(stock.changePercent) ?? 0) * 3 +
        ((toNumber(stock.total5Day) ?? 0) > 0 ? 12 : 0);

      return normalizeRadarStock(stock, {
        score,
        note: hasDualInstitutionalSupport(stock)
          ? '外資與投信同步偏多，籌碼面有共識。'
          : '法人買盤搭配主動式 ETF 曝光，屬於偏多資金流。',
        tags: buildSignalTags(stock),
        metrics: {
          foreign5Day: toNumber(stock.foreign5Day),
          investmentTrust5Day: toNumber(stock.investmentTrust5Day),
          activeEtfCount: toNumber(stock.activeEtfCount),
        },
      });
    })
    .sort((left, right) => right.score - left.score || (right.total5Day ?? 0) - (left.total5Day ?? 0))
    .slice(0, 12);
}

function buildSqueezeCandidates(stockList) {
  return stockList
    .filter((stock) => !isRiskyStock(stock))
    .map((stock) => {
      const compression = calculateCompressionMetrics(stock);

      if (!compression || compression.rangePercent === null || compression.driftPercent === null || compression.shortSlopePercent === null) {
        return null;
      }

      if (compression.rangePercent > 16 || compression.driftPercent < -4 || compression.driftPercent > 20 || compression.shortSlopePercent <= 0) {
        return null;
      }

      if (stock.topSignalTone === 'down') {
        return null;
      }

      if (
        !hasPositiveInstitutionalFlow(stock) &&
        (toNumber(stock.activeEtfCount) ?? 0) === 0 &&
        (toNumber(stock.signalCount) ?? 0) === 0
      ) {
        return null;
      }

      const score =
        Math.max(0, 18 - compression.rangePercent) * 5 +
        Math.max(0, compression.shortSlopePercent) * 8 +
        Math.max(0, compression.driftPercent) * 4 +
        (toNumber(stock.signalCount) ?? 0) * 8 +
        (toNumber(stock.activeEtfCount) ?? 0) * 4 +
        (hasPositiveInstitutionalFlow(stock) ? 10 : 0);

      return normalizeRadarStock(stock, {
        score,
        note: '近 20 日價格壓縮，短線斜率開始轉正，適合當成整理待突破名單。',
        tags: buildSignalTags(stock),
        metrics: {
          rangePercent: compression.rangePercent,
          driftPercent: compression.driftPercent,
          shortSlopePercent: compression.shortSlopePercent,
        },
      });
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || (left.metrics.rangePercent ?? 999) - (right.metrics.rangePercent ?? 999))
    .slice(0, 12);
}

function buildValuationSupport(stockList) {
  return stockList
    .filter((stock) => !isRiskyStock(stock))
    .filter((stock) => {
      const peRatio = toNumber(stock.peRatio);
      const pbRatio = toNumber(stock.pbRatio);
      const dividendYield = toNumber(stock.dividendYield);
      return (dividendYield !== null && dividendYield >= 3) || (peRatio !== null && peRatio <= 18) || (pbRatio !== null && pbRatio <= 2.2);
    })
    .map((stock) => {
      const peRatio = toNumber(stock.peRatio);
      const pbRatio = toNumber(stock.pbRatio);
      const dividendYield = toNumber(stock.dividendYield);
      const score =
        (dividendYield !== null ? dividendYield * 10 : 0) +
        (peRatio !== null ? Math.max(0, 18 - peRatio) * 2.2 : 0) +
        (pbRatio !== null ? Math.max(0, 2.2 - pbRatio) * 16 : 0) +
        (hasPositiveInstitutionalFlow(stock) ? 8 : 0) +
        ((toNumber(stock.return20) ?? 0) > 0 ? 6 : 0);

      return normalizeRadarStock(stock, {
        score,
        note: '估值或股利具備支撐，適合偏防守或回檔承接型選股。',
        tags: buildSignalTags(stock),
        metrics: {
          peRatio,
          pbRatio,
          dividendYield,
        },
      });
    })
    .sort((left, right) => right.score - left.score || (right.metrics.dividendYield ?? 0) - (left.metrics.dividendYield ?? 0))
    .slice(0, 12);
}

function buildRiskAlerts(stockList) {
  return stockList
    .filter((stock) => isRiskyStock(stock))
    .map((stock) => {
      const riskFlags = [
        stock.isUnderDisposition ? '處置股' : null,
        stock.hasChangedTrading ? '變更交易' : null,
        stock.hasAttentionWarning ? '注意股' : null,
      ].filter(Boolean);
      const score =
        (stock.isUnderDisposition ? 100 : 0) +
        (stock.hasChangedTrading ? 70 : 0) +
        (stock.hasAttentionWarning ? 40 : 0) +
        Math.max(0, toNumber(stock.return20) ?? 0);

      return normalizeRadarStock(stock, {
        score,
        note: `${riskFlags.join(' / ')}，短線操作前要先評估流動性與追價風險。`,
        tags: riskFlags,
        metrics: {
          return20: toNumber(stock.return20),
          changePercent: toNumber(stock.changePercent),
        },
      });
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}

function buildThemeRotation(themeRadar) {
  return buildThemeMomentumTopics(themeRadar, 6).map((topic) => ({
    ...topic,
    leaders: topic.leaderStocks ?? [],
    catchUps: topic.catchUpStocks ?? [],
  }));
}

export function buildStockRadar({ stockSummaries = [], stockSearchList = [], themeRadar = null } = {}) {
  const mergedStockList = createMergedStockList(stockSummaries, stockSearchList);
  const technicalBreakouts = buildTechnicalBreakouts(stockSummaries);
  const institutionalMomentum = buildInstitutionalMomentum(stockSummaries);
  const squeezeCandidates = buildSqueezeCandidates(stockSummaries);
  const valuationSupport = buildValuationSupport(mergedStockList);
  const riskAlerts = buildRiskAlerts(mergedStockList);
  const themeRotation = buildThemeRotation(themeRadar);

  return {
    spotlight: {
      breakoutCount: technicalBreakouts.length,
      institutionalCount: institutionalMomentum.length,
      squeezeCount: squeezeCandidates.length,
      valueCount: valuationSupport.length,
      riskCount: riskAlerts.length,
      topTheme: themeRotation[0] ?? null,
    },
    technicalBreakouts,
    institutionalMomentum,
    squeezeCandidates,
    valuationSupport,
    riskAlerts,
    themeRotation,
  };
}
