import { TOPIC_DEFINITIONS } from './theme-radar.mjs';
import { buildSummaryHealthScore, buildSummaryOverheatWarnings } from '../../src/lib/stockHealth.js';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  const text = String(value ?? '').trim().replaceAll('/', '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function average(values) {
  const validValues = values.map(toNumber).filter((value) => value !== null);

  if (!validValues.length) {
    return null;
  }

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function percentChange(target, base) {
  const left = toNumber(target);
  const right = toNumber(base);

  if (left === null || right === null || right === 0) {
    return null;
  }

  return ((left - right) / right) * 100;
}

function formatNumber(value, digits = 0) {
  const number = toNumber(value);

  if (number === null) {
    return '—';
  }

  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(number);
}

function formatPercent(value, digits = 2) {
  const number = toNumber(value);

  if (number === null) {
    return '—';
  }

  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}%`;
}

function formatLots(value, digits = 0) {
  const number = toNumber(value);

  if (number === null) {
    return '—';
  }

  const lots = number / 1000;
  const absoluteLots = Math.abs(lots);

  if (absoluteLots >= 10000) {
    return `${(lots / 10000).toFixed(2)} 萬張`;
  }

  return `${formatNumber(lots, digits)} 張`;
}

function isRiskyStock(stock) {
  return Boolean(stock?.isUnderDisposition || stock?.hasAttentionWarning || stock?.hasChangedTrading);
}

function createStockMetaMap(stockMetaList = []) {
  return new Map(
    (stockMetaList ?? [])
      .map((item) => [String(item?.code ?? '').trim(), item])
      .filter(([code]) => code),
  );
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

function getHigh(rows, field) {
  const values = rows.map((row) => toNumber(row?.[field])).filter((value) => value !== null);
  return values.length ? Math.max(...values) : null;
}

function getDominantSignal(detail) {
  const signals = Array.isArray(detail?.technicalSignals) ? detail.technicalSignals : [];
  return [...signals].sort((left, right) => (toNumber(right?.importance) ?? 0) - (toNumber(left?.importance) ?? 0))[0] ?? null;
}

function isCurrentDetailDate(detailDate, marketDate) {
  const normalizedDetailDate = normalizeDate(detailDate);
  const normalizedMarketDate = normalizeDate(marketDate);

  if (!normalizedDetailDate || !normalizedMarketDate) {
    return true;
  }

  return normalizedDetailDate === normalizedMarketDate;
}

function createDetailMap(stockDetailList = [], stockMetaMap = new Map()) {
  return new Map(
    (stockDetailList ?? [])
      .map((detail) => {
        const code = String(detail?.code ?? '').trim();

        if (!code) {
          return null;
        }

        const stockMeta = stockMetaMap.get(code) ?? {};
        const rows = getHistoryRows(detail);

        if (!rows.length) {
          return null;
        }

        const latest = rows.at(-1);
        const previous = rows.at(-2) ?? null;
        const rows20 = rows.slice(-20);
        const rows30 = rows.slice(-30);
        const avgVolume5 = average(rows.slice(-6, -1).map((row) => row.volume));
        const avgVolume20 = average(rows.slice(-21, -1).map((row) => row.volume));
        const indicators = detail?.最新指標 ?? {};
        const dominantSignal = getDominantSignal(detail);
        const return20 = rows.length >= 21 ? percentChange(latest.close, rows.at(-21)?.close) : toNumber(stockMeta?.return20);
        const return60 = rows.length >= 61 ? percentChange(latest.close, rows.at(-61)?.close) : toNumber(stockMeta?.return60);
        const rangeHigh30 = getHigh(rows30, 'high');
        const rangeLow30 = (() => {
          const lows = rows30.map((row) => row.low).filter((value) => value !== null);
          return lows.length ? Math.min(...lows) : null;
        })();

        return [
          code,
          {
            code,
            name: detail?.name ?? stockMeta?.name ?? code,
            industryName: stockMeta?.industryName ?? null,
            close: latest.close,
            priceDate: normalizeDate(detail?.priceDate ?? latest?.date),
            changePercent: percentChange(latest.close, previous?.close),
            return20,
            return60,
            volume: latest.volume,
            avgVolume5,
            avgVolume20,
            volumeRatio5: avgVolume5 ? (latest.volume / avgVolume5) * 100 : null,
            volumeRatio20: avgVolume20 ? (latest.volume / avgVolume20) * 100 : null,
            distanceToHigh20: (() => {
              const high20 = getHigh(rows20, 'high');
              return high20 === null ? null : Math.max(0, percentChange(high20, latest.close));
            })(),
            rangePercent30:
              rangeHigh30 !== null && rangeLow30 !== null && rangeLow30 > 0
                ? percentChange(rangeHigh30, rangeLow30)
                : null,
            maFast: toNumber(indicators?.maFast ?? indicators?.ma5),
            maShort: toNumber(indicators?.maShort ?? indicators?.ma10),
            maMedium: toNumber(indicators?.maMedium ?? indicators?.ma20),
            maLong: toNumber(indicators?.maLong ?? indicators?.ma60),
            rsi: toNumber(indicators?.rsi14 ?? indicators?.rsi),
            topSignalTitle: stockMeta?.topSignalTitle ?? dominantSignal?.title ?? null,
            topSignalTone: stockMeta?.topSignalTone ?? dominantSignal?.tone ?? 'normal',
            activeEtfCount: toNumber(stockMeta?.activeEtfCount) ?? 0,
            foreign5Day: toNumber(stockMeta?.foreign5Day),
            investmentTrust5Day: toNumber(stockMeta?.investmentTrust5Day),
            total5Day: toNumber(stockMeta?.total5Day),
            foreignTargetPrice: toNumber(stockMeta?.foreignTargetPrice),
            premiumToTarget: toNumber(stockMeta?.premiumToTarget),
            topSelectionSignalTitle: stockMeta?.topSelectionSignalTitle ?? null,
            isUnderDisposition: Boolean(stockMeta?.isUnderDisposition),
            hasAttentionWarning: Boolean(stockMeta?.hasAttentionWarning),
            hasChangedTrading: Boolean(stockMeta?.hasChangedTrading),
          },
        ];
      })
      .filter(Boolean),
  );
}

function getMergedStock(code, stockMetaMap, detailMap) {
  const meta = stockMetaMap.get(code) ?? {};
  const detail = detailMap.get(code) ?? {};

  return {
    ...meta,
    ...detail,
    code,
    name: detail.name ?? meta.name ?? code,
    industryName: detail.industryName ?? meta.industryName ?? null,
    close: toNumber(detail.close ?? meta.close),
    priceDate: normalizeDate(detail.priceDate ?? meta.priceDate),
    changePercent: toNumber(detail.changePercent ?? meta.changePercent),
    return20: toNumber(detail.return20 ?? meta.return20),
    return60: toNumber(detail.return60 ?? meta.return60),
    topSignalTitle: detail.topSignalTitle ?? meta.topSignalTitle ?? null,
    topSignalTone: detail.topSignalTone ?? meta.topSignalTone ?? 'normal',
    activeEtfCount: toNumber(detail.activeEtfCount ?? meta.activeEtfCount) ?? 0,
    foreign5Day: toNumber(detail.foreign5Day ?? meta.foreign5Day),
    investmentTrust5Day: toNumber(detail.investmentTrust5Day ?? meta.investmentTrust5Day),
    total5Day: toNumber(detail.total5Day ?? meta.total5Day),
    foreignTargetPrice: toNumber(detail.foreignTargetPrice ?? meta.foreignTargetPrice),
    premiumToTarget: toNumber(detail.premiumToTarget ?? meta.premiumToTarget),
    isUnderDisposition: Boolean(detail.isUnderDisposition ?? meta.isUnderDisposition),
    hasAttentionWarning: Boolean(detail.hasAttentionWarning ?? meta.hasAttentionWarning),
    hasChangedTrading: Boolean(detail.hasChangedTrading ?? meta.hasChangedTrading),
  };
}

function createEntryItem(base = {}, options = {}) {
  const close = toNumber(options.close ?? base.close);
  const rawTargetPrice = toNumber(options.foreignTargetPrice ?? base.foreignTargetPrice);
  const foreignTargetPrice = rawTargetPrice !== null && rawTargetPrice > 0 ? rawTargetPrice : null;
  const premiumToTarget =
    close !== null && foreignTargetPrice !== null && close > 0
      ? ((foreignTargetPrice - close) / close) * 100
      : null;

  const item = {
    code: String(options.code ?? base.code ?? '').trim(),
    name: options.name ?? base.name ?? null,
    industryName: options.industryName ?? base.industryName ?? null,
    themeTitle: options.themeTitle ?? base.themeTitle ?? null,
    label: options.label ?? base.label ?? null,
    note: options.note ?? base.note ?? null,
    score: Math.round(toNumber(options.score ?? base.score) ?? 0),
    close,
    changePercent: toNumber(options.changePercent ?? base.changePercent),
    return20: toNumber(options.return20 ?? base.return20),
    foreign5Day: toNumber(options.foreign5Day ?? base.foreign5Day),
    investmentTrust5Day: toNumber(options.investmentTrust5Day ?? base.investmentTrust5Day),
    activeEtfCount: toNumber(options.activeEtfCount ?? base.activeEtfCount) ?? 0,
    topSignalTitle: options.topSignalTitle ?? base.topSignalTitle ?? null,
    topSignalTone: options.topSignalTone ?? base.topSignalTone ?? 'normal',
    foreignTargetPrice,
    premiumToTarget,
    tags: (options.tags ?? []).filter(Boolean).slice(0, 4),
    metrics: (options.metrics ?? []).filter((metric) => metric?.label && metric?.value),
  };

  const health = buildSummaryHealthScore(item);
  const warnings = buildSummaryOverheatWarnings(item);

  return {
    ...item,
    healthScore: health.totalScore,
    healthGrade: health.grade,
    healthTone: health.tone,
    warningCount: warnings.length,
    topWarningTitle: warnings[0]?.title ?? null,
    topWarningTone: warnings[0]?.tone ?? null,
  };
}

function uniqueByCode(items = [], limit = 6) {
  const usedCodes = new Set();
  const results = [];

  for (const item of items ?? []) {
    const code = String(item?.code ?? '').trim();

    if (!code || usedCodes.has(code)) {
      continue;
    }

    usedCodes.add(code);
    results.push(item);

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function pickFallbackFreshStarters(detailMap) {
  return [...detailMap.values()]
    .filter((item) => !isRiskyStock(item))
    .filter((item) => (toNumber(item.return20) ?? 999) <= 28)
    .filter((item) => (toNumber(item.return20) ?? -999) >= -2)
    .filter((item) => (toNumber(item.distanceToHigh20) ?? 999) <= 6)
    .filter((item) => {
      const maMedium = toNumber(item.maMedium);
      return maMedium === null || (toNumber(item.close) ?? 0) >= maMedium;
    })
    .filter((item) => {
      const rsi = toNumber(item.rsi);
      return rsi === null || (rsi >= 50 && rsi <= 70);
    })
    .filter((item) => {
      const ratio20 = toNumber(item.volumeRatio20);
      return ratio20 === null || ratio20 <= 150;
    })
    .sort((left, right) => {
      const rightScore =
        Math.max(0, 28 - (toNumber(right.return20) ?? 28)) * 8 +
        Math.max(0, 6 - (toNumber(right.distanceToHigh20) ?? 6)) * 12 +
        ((toNumber(right.changePercent) ?? 0) > 0 ? 8 : 0);
      const leftScore =
        Math.max(0, 28 - (toNumber(left.return20) ?? 28)) * 8 +
        Math.max(0, 6 - (toNumber(left.distanceToHigh20) ?? 6)) * 12 +
        ((toNumber(left.changePercent) ?? 0) > 0 ? 8 : 0);
      return rightScore - leftScore;
    })
    .slice(0, 8);
}

function buildFreshStarters(selectionRadar, stockMetaMap, detailMap) {
  const primary = (selectionRadar?.volumeSqueezeRisers ?? [])
    .filter((item) => (toNumber(item?.return20) ?? 999) <= 28)
    .filter((item) => (toNumber(item?.distanceToHigh20) ?? 999) <= 6)
    .map((item) => {
      const stock = getMergedStock(item.code, stockMetaMap, detailMap);
      return createEntryItem(stock, {
        ...stock,
        label: '量縮轉強',
        note: '量能還沒完全放大，但價格已重新墊高，適合盯下一段放量確認。',
        score:
          (toNumber(item.score) ?? 0) +
          Math.max(0, 28 - (toNumber(stock.return20) ?? 28)) * 4 +
          Math.max(0, 6 - (toNumber(item.distanceToHigh20) ?? 6)) * 12,
        tags: [
          stock.topSignalTitle,
          stock.topSelectionSignalTitle,
          (toNumber(stock.activeEtfCount) ?? 0) > 0 ? `${stock.activeEtfCount} 檔 ETF` : null,
        ],
        metrics: [
          { label: '20 日', value: formatPercent(stock.return20) },
          { label: '距前高', value: formatPercent(item.distanceToHigh20) },
          { label: '量比 20 日', value: `${formatNumber(stock.volumeRatio20, 0)}%` },
        ],
      });
    });

  if (primary.length) {
    return uniqueByCode(primary);
  }

  return uniqueByCode(
    pickFallbackFreshStarters(detailMap).map((stock) =>
      createEntryItem(stock, {
        ...stock,
        label: '量縮轉強',
        note: '量能仍偏收斂，但價格與均線位置已轉強，適合觀察是否進一步放量。',
        score:
          Math.max(0, 28 - (toNumber(stock.return20) ?? 28)) * 8 +
          Math.max(0, 6 - (toNumber(stock.distanceToHigh20) ?? 6)) * 14 +
          ((toNumber(stock.changePercent) ?? 0) > 0 ? 10 : 0) +
          ((toNumber(stock.activeEtfCount) ?? 0) * 4),
        tags: [stock.topSignalTitle, stock.topSelectionSignalTitle],
        metrics: [
          { label: '20 日', value: formatPercent(stock.return20) },
          { label: '距前高', value: formatPercent(stock.distanceToHigh20) },
          { label: 'RSI', value: formatNumber(stock.rsi, 1) },
        ],
      }),
    ),
  );
}

function buildNearBreakouts(selectionRadar, stockMetaMap, detailMap) {
  const primary = (selectionRadar?.consolidationWatch ?? [])
    .filter((item) => (toNumber(item?.distanceToHigh) ?? 999) <= 3.2)
    .map((item) => {
      const stock = getMergedStock(item.code, stockMetaMap, detailMap);
      return createEntryItem(stock, {
        ...stock,
        label: '整理待突破',
        note: '箱型壓縮與均線靠攏，距離前高不遠，適合盯盤中是否帶量突破。',
        score:
          (toNumber(item.score) ?? 0) +
          Math.max(0, 14 - (toNumber(item.rangePercent) ?? 14)) * 4 +
          Math.max(0, 3.2 - (toNumber(item.distanceToHigh) ?? 3.2)) * 18,
        tags: [stock.topSignalTitle, stock.topSelectionSignalTitle],
        metrics: [
          { label: '整理區間', value: formatPercent(item.rangePercent) },
          { label: '距前高', value: formatPercent(item.distanceToHigh) },
          { label: 'RSI', value: formatNumber(item.rsi, 1) },
        ],
      });
    });

  if (primary.length) {
    return uniqueByCode(primary);
  }

  return uniqueByCode(
    [...detailMap.values()]
      .filter((item) => !isRiskyStock(item))
      .filter((item) => (toNumber(item.rangePercent30) ?? 999) <= 15)
      .filter((item) => (toNumber(item.distanceToHigh20) ?? 999) <= 3.5)
      .filter((item) => {
        const rsi = toNumber(item.rsi);
        return rsi === null || (rsi >= 48 && rsi <= 68);
      })
      .sort((left, right) => (toNumber(left.distanceToHigh20) ?? 999) - (toNumber(right.distanceToHigh20) ?? 999))
      .map((stock) =>
        createEntryItem(stock, {
          ...stock,
          label: '整理待突破',
          note: '整理區間夠窄、距離前高不遠，適合留意隔日量價是否同步突破。',
          score:
            Math.max(0, 15 - (toNumber(stock.rangePercent30) ?? 15)) * 6 +
            Math.max(0, 3.5 - (toNumber(stock.distanceToHigh20) ?? 3.5)) * 18,
          tags: [stock.topSignalTitle, stock.topSelectionSignalTitle],
          metrics: [
            { label: '整理區間', value: formatPercent(stock.rangePercent30) },
            { label: '距前高', value: formatPercent(stock.distanceToHigh20) },
            { label: '20 日', value: formatPercent(stock.return20) },
          ],
        }),
      ),
  );
}

function buildInstitutionalTurns(selectionRadar, stockMetaMap, detailMap, dashboard) {
  const primary = (selectionRadar?.institutionalResonance ?? []).map((item) => {
    const stock = getMergedStock(item.code, stockMetaMap, detailMap);
    return createEntryItem(stock, {
      ...stock,
      label: '雙法人剛轉買',
      note: '雙法人剛從賣方轉為偏多，通常是明日優先觀察的第一批名單。',
      score:
        (toNumber(item.score) ?? 0) +
        Math.max(0, 4 - (toNumber(item.foreignDays) ?? 4)) * 10 +
        Math.max(0, 4 - (toNumber(item.trustDays) ?? 4)) * 10,
      tags: [
        (toNumber(item.foreignDays) ?? 0) > 0 ? `外資 ${item.foreignDays} 天` : null,
        (toNumber(item.trustDays) ?? 0) > 0 ? `投信 ${item.trustDays} 天` : null,
        stock.topSignalTitle,
      ],
      metrics: [
        { label: '外資 5 日', value: formatLots(stock.foreign5Day ?? item.foreignAccumulated) },
        { label: '投信 5 日', value: formatLots(stock.investmentTrust5Day ?? item.trustAccumulated) },
        { label: '20 日', value: formatPercent(stock.return20) },
      ],
    });
  });

  if (primary.length) {
    return uniqueByCode(primary);
  }

  const foreignList = dashboard?.法人追蹤?.外資連買 ?? [];
  const trustList = dashboard?.法人追蹤?.投信連買 ?? [];
  const fallbackMap = new Map();

  for (const item of foreignList) {
    const code = String(item?.代號 ?? '').trim();

    if (!code) {
      continue;
    }

    fallbackMap.set(code, {
      code,
      name: item?.名稱 ?? null,
      foreignDays: toNumber(item?.連買天數) ?? 0,
      foreignAccumulated: toNumber(item?.累計買超股數) ?? 0,
      trustDays: 0,
      trustAccumulated: 0,
      close: toNumber(item?.收盤價),
      changePercent: toNumber(item?.漲跌幅),
      mode: 'foreign',
    });
  }

  for (const item of trustList) {
    const code = String(item?.代號 ?? '').trim();

    if (!code) {
      continue;
    }

    const existing = fallbackMap.get(code) ?? {
      code,
      name: item?.名稱 ?? null,
      foreignDays: 0,
      foreignAccumulated: 0,
      close: toNumber(item?.收盤價),
      changePercent: toNumber(item?.漲跌幅),
      mode: 'trust',
    };

    fallbackMap.set(code, {
      ...existing,
      trustDays: toNumber(item?.連買天數) ?? 0,
      trustAccumulated: toNumber(item?.累計買超股數) ?? 0,
      mode: existing.foreignDays > 0 ? 'dual' : 'trust',
    });
  }

  return uniqueByCode(
    [...fallbackMap.values()]
      .map((row) => {
        const stock = getMergedStock(row.code, stockMetaMap, detailMap);

        if (isRiskyStock(stock)) {
          return null;
        }

        return createEntryItem(stock, {
          ...stock,
          name: stock.name ?? row.name,
          close: stock.close ?? row.close,
          changePercent: stock.changePercent ?? row.changePercent,
          label: row.mode === 'dual' ? '雙法人剛轉買' : '單法人剛轉向',
          note:
            row.mode === 'dual'
              ? '外資與投信同時出現在連買名單，短線資金態度偏多。'
              : '雖然不是雙法人共振，但主力之一剛轉為連買，適合先放入追蹤名單。',
          score:
            Math.max(0, 5 - row.foreignDays) * 10 +
            Math.max(0, 5 - row.trustDays) * 10 +
            Math.max(0, (toNumber(row.foreignAccumulated) ?? 0) / 500000) +
            Math.max(0, (toNumber(row.trustAccumulated) ?? 0) / 200000) +
            (row.mode === 'dual' ? 16 : 6),
          tags: [
            row.foreignDays > 0 ? `外資 ${row.foreignDays} 天` : null,
            row.trustDays > 0 ? `投信 ${row.trustDays} 天` : null,
            stock.topSignalTitle,
          ],
          metrics: [
            { label: '外資 5 日', value: formatLots(stock.foreign5Day ?? row.foreignAccumulated) },
            { label: '投信 5 日', value: formatLots(stock.investmentTrust5Day ?? row.trustAccumulated) },
            { label: '20 日', value: formatPercent(stock.return20) },
          ],
        });
      })
      .filter(Boolean)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0)),
  );
}

function createTopicHistoryMap(themeHistory = null) {
  const snapshots = [...(themeHistory?.snapshots ?? [])]
    .filter((item) => normalizeDate(item?.marketDate))
    .sort((left, right) => String(left.marketDate).localeCompare(String(right.marketDate)));

  return {
    snapshotCount: snapshots.length,
    current: snapshots.at(-1) ?? null,
    previousByDays(days) {
      const snapshot = snapshots.at(-(days + 1)) ?? null;
      const topicMap = new Map((snapshot?.topics ?? []).map((topic) => [topic.slug, toNumber(topic.score)]));
      return { snapshot, topicMap };
    },
  };
}

function getTopicDefinition(slug) {
  return TOPIC_DEFINITIONS.find((topic) => topic.slug === slug) ?? null;
}

function getThemeCandidatePool(topic, stockMetaMap, detailMap) {
  const candidateCodes = new Set([
    ...(topic?.leaderStocks ?? []).map((item) => String(item?.code ?? '').trim()),
    ...(topic?.catchUpStocks ?? []).map((item) => String(item?.code ?? '').trim()),
    ...(topic?.relatedStocks ?? []).map((item) => String(item?.code ?? '').trim()),
    ...((getTopicDefinition(topic?.slug)?.coreStocks ?? []).map((code) => String(code ?? '').trim())),
  ]);

  return [...candidateCodes]
    .filter(Boolean)
    .map((code) => getMergedStock(code, stockMetaMap, detailMap))
    .filter((item) => item.code && item.name);
}

function pickThemeLeader(topic, stockMetaMap, detailMap) {
  const pool = getThemeCandidatePool(topic, stockMetaMap, detailMap)
    .filter((item) => !isRiskyStock(item))
    .sort((left, right) => {
      const rightScore =
        Math.max(0, toNumber(right.return20) ?? 0) * 3 +
        Math.max(0, toNumber(right.total5Day) ?? 0) / 300000 +
        ((toNumber(right.activeEtfCount) ?? 0) * 6) +
        (right.topSignalTone === 'up' ? 8 : 0);
      const leftScore =
        Math.max(0, toNumber(left.return20) ?? 0) * 3 +
        Math.max(0, toNumber(left.total5Day) ?? 0) / 300000 +
        ((toNumber(left.activeEtfCount) ?? 0) * 6) +
        (left.topSignalTone === 'up' ? 8 : 0);
      return rightScore - leftScore;
    });

  return pool[0] ?? null;
}

function buildThemeIgnition(themeRadar, themeHistory, stockMetaMap, detailMap) {
  const historyMap = createTopicHistoryMap(themeHistory);
  const window5 = historyMap.previousByDays(5);
  const window10 = historyMap.previousByDays(10);

  const warmingThemes = [...(themeRadar?.topics ?? [])]
    .map((topic) => {
      const currentScore = toNumber(topic?.score) ?? 0;
      const delta5 = window5.topicMap.has(topic.slug) ? currentScore - (window5.topicMap.get(topic.slug) ?? 0) : null;
      const delta10 = window10.topicMap.has(topic.slug) ? currentScore - (window10.topicMap.get(topic.slug) ?? 0) : null;
      return {
        ...topic,
        delta5,
        delta10,
      };
    })
    .filter((topic) => (toNumber(topic.delta5) ?? -999) >= 8 || (toNumber(topic.delta10) ?? -999) >= 12)
    .sort((left, right) => (toNumber(right.delta5) ?? toNumber(right.delta10) ?? -999) - (toNumber(left.delta5) ?? toNumber(left.delta10) ?? -999))
    .slice(0, 4);

  const candidateThemes = warmingThemes.length
    ? warmingThemes
    : [...(themeRadar?.topics ?? [])]
        .slice(0, 3)
        .map((topic) => ({
          ...topic,
          delta5: null,
          delta10: null,
        }));

  const items = candidateThemes
    .map((topic) => {
      const leader = pickThemeLeader(topic, stockMetaMap, detailMap);

      if (!leader) {
        return null;
      }

      return createEntryItem(leader, {
        ...leader,
        themeTitle: topic.title,
        label: '題材剛升溫',
        note: warmingThemes.length
          ? `${topic.title} 在近 5 / 10 日熱度與資金面明顯抬升，適合先看主線代表股。`
          : `${topic.title} 目前位居主線前排，即使歷史樣本尚少，也適合先看代表股。`,
        score:
          (toNumber(topic.score) ?? 0) +
          Math.max(0, toNumber(topic.delta5) ?? 0) * 4 +
          Math.max(0, toNumber(topic.delta10) ?? 0) * 2 +
          Math.max(0, toNumber(leader.total5Day) ?? 0) / 300000,
        tags: [topic.title, leader.topSignalTitle, (toNumber(leader.activeEtfCount) ?? 0) > 0 ? `${leader.activeEtfCount} 檔 ETF` : null],
        metrics: [
          { label: '5 日升溫', value: topic.delta5 === null ? '—' : formatNumber(topic.delta5, 0) },
          { label: '10 日升溫', value: topic.delta10 === null ? '—' : formatNumber(topic.delta10, 0) },
          { label: '20 日', value: formatPercent(leader.return20) },
        ],
      });
    })
    .filter(Boolean);

  return {
    items: uniqueByCode(items),
    history: {
      snapshotCount: historyMap.snapshotCount,
      warming5: candidateThemes.slice(0, 3).map((topic) => ({
        slug: topic.slug,
        title: topic.title,
        delta: topic.delta5,
        leaderCode: pickThemeLeader(topic, stockMetaMap, detailMap)?.code ?? null,
        leaderName: pickThemeLeader(topic, stockMetaMap, detailMap)?.name ?? null,
      })),
      warming10: candidateThemes
        .slice(0, 3)
        .map((topic) => ({
          slug: topic.slug,
          title: topic.title,
          delta: topic.delta10,
          leaderCode: pickThemeLeader(topic, stockMetaMap, detailMap)?.code ?? null,
          leaderName: pickThemeLeader(topic, stockMetaMap, detailMap)?.name ?? null,
        }))
        .filter((item) => item.delta !== null),
      currentLeader: themeRadar?.topics?.[0]
        ? {
            slug: themeRadar.topics[0].slug,
            title: themeRadar.topics[0].title,
          }
        : null,
      previousLeader: window5.snapshot?.leaderTitle
        ? {
            slug: window5.snapshot?.leaderSlug ?? null,
            title: window5.snapshot.leaderTitle,
          }
        : null,
    },
  };
}

function buildCatchUpCandidates(themeRadar, stockMetaMap, detailMap) {
  const items = (themeRadar?.topics ?? [])
    .slice(0, 6)
    .flatMap((topic) => {
      const pool = getThemeCandidatePool(topic, stockMetaMap, detailMap).filter((item) => !isRiskyStock(item));

      if (!pool.length) {
        return [];
      }

      const sortedByStrength = [...pool].sort((left, right) => (toNumber(right.return20) ?? -999) - (toNumber(left.return20) ?? -999));
      const leader = sortedByStrength[0];
      const leaderReturn = toNumber(leader?.return20) ?? 0;

      return sortedByStrength
        .filter((stock) => stock.code !== leader.code)
        .filter((stock) => {
          const return20 = toNumber(stock.return20);
          return return20 !== null && leaderReturn >= 5 && return20 <= Math.min(leaderReturn * 0.7, 18);
        })
        .map((stock) =>
          createEntryItem(stock, {
            ...stock,
            themeTitle: topic.title,
            label: '補漲候選',
            note: `${topic.title} 主線已先動，但這檔相對仍落後，適合觀察是否接棒。`,
            score:
              Math.max(0, leaderReturn - (toNumber(stock.return20) ?? 0)) * 3 +
              Math.max(0, (toNumber(stock.total5Day) ?? 0) / 300000) +
              ((toNumber(stock.activeEtfCount) ?? 0) * 6) +
              (stock.topSignalTone === 'up' ? 10 : 0),
            tags: [topic.title, stock.topSignalTitle, stock.topSelectionSignalTitle],
            metrics: [
              { label: '20 日', value: formatPercent(stock.return20) },
              { label: '龍頭漲幅', value: formatPercent(leaderReturn) },
              { label: '外資 5 日', value: formatLots(stock.foreign5Day) },
            ],
          }),
        );
    })
    .filter(Boolean)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));

  return uniqueByCode(items);
}

export function buildEntryRadar({
  dashboard = null,
  stockMetaList = [],
  stockDetailList = [],
  selectionRadar = null,
  themeHistory = null,
} = {}) {
  const stockMetaMap = createStockMetaMap(stockMetaList);
  const detailMap = createDetailMap(stockDetailList, stockMetaMap);
  const themeRadar = dashboard?.題材雷達 ?? null;
  const marketDate =
    normalizeDate(dashboard?.市場總覽?.即時狀態?.marketDate) ??
    normalizeDate(dashboard?.市場總覽?.資料日期) ??
    null;
  const freshDetailMap = new Map(
    [...detailMap.entries()].filter(([, item]) => isCurrentDetailDate(item?.priceDate, marketDate)),
  );

  const freshStarters = buildFreshStarters(selectionRadar, stockMetaMap, freshDetailMap);
  const nearBreakouts = buildNearBreakouts(selectionRadar, stockMetaMap, freshDetailMap);
  const institutionalTurns = buildInstitutionalTurns(selectionRadar, stockMetaMap, freshDetailMap, dashboard);
  const themeIgnitionResult = buildThemeIgnition(themeRadar, themeHistory, stockMetaMap, freshDetailMap);
  const catchUpCandidates = buildCatchUpCandidates(themeRadar, stockMetaMap, freshDetailMap);
  const topThemeTitle = themeIgnitionResult.history.currentLeader?.title ?? themeRadar?.topics?.[0]?.title ?? null;

  return {
    generatedAt: dashboard?.generatedAt ?? null,
    marketDate,
    spotlight: {
      freshStarterCount: freshStarters.length,
      nearBreakoutCount: nearBreakouts.length,
      institutionalTurnCount: institutionalTurns.length,
      themeIgnitionCount: themeIgnitionResult.items.length,
      catchUpCount: catchUpCandidates.length,
      topThemeTitle,
    },
    observations: [
      topThemeTitle ? `目前主線先看 ${topThemeTitle}` : null,
      freshStarters[0] ? `剛轉強可先看 ${freshStarters[0].code} ${freshStarters[0].name}` : null,
      institutionalTurns[0] ? `法人轉向可留意 ${institutionalTurns[0].code} ${institutionalTurns[0].name}` : null,
      catchUpCandidates[0] ? `補漲候選先看 ${catchUpCandidates[0].code} ${catchUpCandidates[0].name}` : null,
    ].filter(Boolean),
    sections: {
      freshStarters,
      nearBreakouts,
      institutionalTurns,
      themeIgnition: themeIgnitionResult.items,
      catchUpCandidates,
    },
    themeHistory: themeIgnitionResult.history,
  };
}
