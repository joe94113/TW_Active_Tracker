import { buildSummaryHealthScore, buildSummaryOverheatWarnings } from './stockHealth';
import { computeAvgTradeValue, computeDailyTradeValue, classifyLiquidity } from './liquidity';
import { buildIndustryValuationIndex, computeIndustryValuation } from './industryValuation';
import { scoreVolumeQuality } from './volumeQuality';
import { detectPatternsFromSparkline } from './patternDetection';
import { aggregateSignalConfidence } from './signalConfidence';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function includesIgnoreCase(source, needle) {
  return String(source ?? '').toLowerCase().includes(String(needle ?? '').trim().toLowerCase());
}

export const DEFAULT_SCANNER_FILTERS = {
  query: '',
  foreignBuy: false,
  trustBuy: false,
  dualBuy: false,
  revenueDualGrowth: false,
  maStackAbove240: false,
  activeEtf: false,
  bullishSignal: false,
  healthyOnly: false,
  coolOnly: false,
  excludeRisk: true,
  nextDayOnly: false,
  themeOnly: '',
  minLiquidity: false,
  minTradeValue: 10000000,
  excludeMarginSurge: false,
  industryCheap: false,
  industryStrong: false,
  highConfidenceSignal: false,
};

export const DEFAULT_LIQUIDITY_MIN = 10000000;
export const LIQUIDITY_MIN_OPTIONS = [
  { value: 0, label: 'no limit' },
  { value: 5000000, label: '>= 5M' },
  { value: 10000000, label: '>= 10M' },
  { value: 30000000, label: '>= 30M' },
  { value: 100000000, label: '>= 100M' },
  { value: 500000000, label: '>= 500M' },
];

function createEmptyVolumeQuality() {
  return {
    score: null,
    tone: 'info',
    label: 'insufficient data',
    dispersion: null,
    maxShare: null,
    avgVolume: null,
    ratio5to20: null,
  };
}

export function createScannerRow(stock = {}, nextDayCodeSet = new Set(), context = {}) {
  const {
    industryValuationIndex = null,
    stockDetailMap = null,
    signalConfidenceData = null,
    earningsIndex = null,
    insiderIndex = null,
  } = context;

  const health = buildSummaryHealthScore(stock);
  const warnings = buildSummaryOverheatWarnings(stock);
  const warningTone = warnings[0]?.tone ?? 'info';

  const singleTradeValue = toNumber(stock.dailyTradeValue) ?? computeDailyTradeValue(stock);
  const avgTradeValue = toNumber(stock.avgTradeValue) ?? computeAvgTradeValue(stock);
  const liquidityTier = stock.liquidityTier ?? classifyLiquidity(avgTradeValue ?? singleTradeValue);

  const valuation = computeIndustryValuation(stock, industryValuationIndex);
  const detail = stockDetailMap?.get(String(stock.code ?? '').trim()) ?? null;

  const volumes =
    detail?.歷史資料
      ?.map((bar) => Number(bar?.volume ?? 0))
      .filter((value) => Number.isFinite(value)) ?? [];

  const volumeQuality =
    stock.volumeQuality?.score !== undefined
      ? stock.volumeQuality
      : volumes.length >= 5
        ? scoreVolumeQuality(volumes.slice(-20))
        : createEmptyVolumeQuality();

  const patterns =
    Array.isArray(stock.patterns) && stock.patterns.length
      ? stock.patterns
      : detectPatternsFromSparkline(stock.sparkline20 ?? []);

  const signalConfidence =
    stock.signalConfidence !== undefined
      ? {
          aggregate: toNumber(stock.signalConfidence) ?? 0,
          perSignal: Array.isArray(stock.signalConfidencePerSignal) ? stock.signalConfidencePerSignal : [],
        }
      : aggregateSignalConfidence(stock.technicalSignals ?? [], signalConfidenceData);

  const marginUsage = toNumber(stock.marginUsage) ?? toNumber(detail?.融資融券?.marginUsage);
  const marginChange = toNumber(stock.marginChange) ?? toNumber(detail?.融資融券?.marginChange);
  const marginSurge =
    Boolean(stock.hasMarginSurge) ||
    (marginUsage !== null && marginUsage >= 40) ||
    (marginChange !== null && marginChange >= 800000);

  const industryRank = toNumber(stock.industryRank) ?? toNumber(detail?.同產業比較?.rank20Day);
  const peerCount = toNumber(stock.industryPeerCount) ?? toNumber(detail?.同產業比較?.peerCount);
  const industryRankPct =
    industryRank !== null && peerCount
      ? (industryRank / peerCount) * 100
      : toNumber(stock.industryRankPct);

  const nextEarnings = stock.nextEarnings ?? earningsIndex?.get?.(String(stock.code ?? '').trim())?.[0] ?? null;
  const insiderRecord = stock.insiderRecord ?? insiderIndex?.get?.(String(stock.code ?? '').trim())?.at?.(-1) ?? null;

  return {
    ...stock,
    healthScore: health.totalScore,
    healthGrade: health.grade,
    healthTone: health.tone,
    warnings,
    warningTone,
    topWarningTitle: warnings[0]?.title ?? null,
    isRisk: Boolean(stock.isUnderDisposition || stock.hasAttentionWarning || stock.hasChangedTrading),
    isNextDayWatch: nextDayCodeSet.has(String(stock.code ?? '').trim()),

    dailyTradeValue: singleTradeValue,
    avgTradeValue,
    liquidityTier,

    industryValuation: stock.industryValuation ?? valuation,
    pePercentile: toNumber(stock.pePercentile) ?? valuation.pePercentile,
    valuationTone: stock.valuationTone ?? valuation.valuationTone,

    volumeQuality,
    volumeQualityScore: toNumber(stock.volumeQualityScore) ?? volumeQuality.score,

    patterns,
    topPattern: stock.topPattern ?? patterns[0] ?? null,

    signalConfidence: signalConfidence.aggregate,
    signalConfidencePerSignal: signalConfidence.perSignal,

    marginUsage,
    marginChange,
    hasMarginSurge: marginSurge,
    monthlyRevenueMoM: toNumber(stock.monthlyRevenueMoM),
    monthlyRevenueYoY: toNumber(stock.monthlyRevenueYoY),
    monthlyRevenueDualGrowth: Boolean(stock.monthlyRevenueDualGrowth),
    monthlyRevenueDate: stock.monthlyRevenueDate ?? null,
    ma5: toNumber(stock.ma5),
    ma10: toNumber(stock.ma10),
    ma20: toNumber(stock.ma20),
    ma60: toNumber(stock.ma60),
    ma240: toNumber(stock.ma240),
    maBullStack: Boolean(stock.maBullStack),
    maStackCrossedAbove240: Boolean(stock.maStackCrossedAbove240),

    industryRank,
    industryPeerCount: peerCount,
    industryRankPct,

    nextEarnings,
    insiderRecord,
  };
}

export function filterScannerRows(rows = [], filters = DEFAULT_SCANNER_FILTERS) {
  const query = String(filters.query ?? '').trim();
  const themeOnly = String(filters.themeOnly ?? '').trim();
  const minTradeValue = Number(filters.minTradeValue ?? DEFAULT_LIQUIDITY_MIN);

  return rows.filter((row) => {
    if (query) {
      const matched =
        includesIgnoreCase(row.code, query) ||
        includesIgnoreCase(row.name, query) ||
        includesIgnoreCase(row.industryName, query) ||
        includesIgnoreCase(row.themeTitle, query) ||
        includesIgnoreCase(row.topSignalTitle, query);
      if (!matched) return false;
    }

    if (themeOnly && !includesIgnoreCase(row.themeTitle, themeOnly) && !includesIgnoreCase(row.industryName, themeOnly)) {
      return false;
    }

    if (filters.foreignBuy && (toNumber(row.foreign5Day) ?? 0) <= 0) return false;
    if (filters.trustBuy && (toNumber(row.investmentTrust5Day) ?? 0) <= 0) return false;
    if (filters.dualBuy && !((toNumber(row.foreign5Day) ?? 0) > 0 && (toNumber(row.investmentTrust5Day) ?? 0) > 0)) return false;
    if (filters.revenueDualGrowth && !row.monthlyRevenueDualGrowth) return false;
    if (filters.maStackAbove240 && !row.maStackCrossedAbove240 && !row.maBullStack) return false;
    if (filters.activeEtf && (toNumber(row.activeEtfCount) ?? 0) <= 0) return false;
    if (filters.bullishSignal && row.topSignalTone !== 'up') return false;
    if (filters.healthyOnly && (toNumber(row.healthScore) ?? 0) < 62) return false;
    if (filters.coolOnly && (row.warnings?.length ?? 0) >= 2) return false;
    if (filters.excludeRisk && row.isRisk) return false;
    if (filters.nextDayOnly && !row.isNextDayWatch) return false;

    if (filters.minLiquidity && minTradeValue > 0) {
      const tradeValue = toNumber(row.avgTradeValue) ?? toNumber(row.dailyTradeValue) ?? 0;
      if (tradeValue < minTradeValue) return false;
    }

    if (filters.excludeMarginSurge && row.hasMarginSurge) return false;

    if (filters.industryCheap) {
      const pct = toNumber(row.pePercentile);
      if (pct === null || pct > 40) return false;
    }

    if (filters.industryStrong) {
      const pct = toNumber(row.industryRankPct);
      if (pct === null || pct > 40) return false;
    }

    if (filters.highConfidenceSignal) {
      const confidence = toNumber(row.signalConfidence);
      if (confidence === null || confidence < 0.6) return false;
    }

    return true;
  });
}

function computeCompositeScore(row) {
  const health = toNumber(row.healthScore) ?? 0;
  const return20Bonus = Math.max(toNumber(row.return20) ?? 0, 0);
  const changeBonus = Math.max(toNumber(row.changePercent) ?? 0, 0) * 2;
  const etfBonus = (toNumber(row.activeEtfCount) ?? 0) * 3;
  const revenueBonus = row.monthlyRevenueDualGrowth ? 8 : 0;
  const ma240Bonus = row.maStackCrossedAbove240 ? 10 : row.maBullStack ? 6 : 0;

  const volumeQualityBonus =
    toNumber(row.volumeQualityScore) !== null ? ((toNumber(row.volumeQualityScore) ?? 0) - 50) * 0.12 : 0;

  const confidenceBonus =
    toNumber(row.signalConfidence) !== null ? (toNumber(row.signalConfidence) ?? 0) * 14 : 0;

  const industryStrengthBonus = (() => {
    const pct = toNumber(row.industryRankPct);
    if (pct === null) return 0;
    return Math.max(0, 10 - pct / 10);
  })();

  const valuationBonus = (() => {
    const pct = toNumber(row.pePercentile);
    if (pct === null) return 0;
    if (pct <= 30) return 6;
    if (pct <= 50) return 3;
    if (pct >= 85) return -5;
    return 0;
  })();

  const liquidityBonus = (() => {
    const tradeValue = toNumber(row.avgTradeValue) ?? toNumber(row.dailyTradeValue);
    if (tradeValue === null) return -4;
    if (tradeValue < 5000000) return -6;
    if (tradeValue < 20000000) return -2;
    if (tradeValue >= 200000000) return 3;
    return 0;
  })();

  const marginPenalty = row.hasMarginSurge ? -6 : 0;
  const patternBonus = row.topPattern?.tone === 'up' ? 4 : row.topPattern?.tone === 'down' ? -4 : 0;
  const insiderBonus = row.insiderRecord?.deltaFromPrevMonth?.pct
    ? Math.max(-6, Math.min(6, Number(row.insiderRecord.deltaFromPrevMonth.pct) * 3))
    : 0;

  return (
    health +
    return20Bonus +
    changeBonus +
    etfBonus +
    revenueBonus +
    ma240Bonus +
    volumeQualityBonus +
    confidenceBonus +
    industryStrengthBonus +
    valuationBonus +
    liquidityBonus +
    marginPenalty +
    patternBonus +
    insiderBonus
  );
}

export function sortScannerRows(rows = []) {
  return [...rows].sort((left, right) => computeCompositeScore(right) - computeCompositeScore(left));
}

export function buildScannerContext({
  universe = [],
  stockDetailMap = null,
  signalConfidenceData = null,
  earningsIndex = null,
  insiderIndex = null,
} = {}) {
  return {
    industryValuationIndex: buildIndustryValuationIndex(universe),
    stockDetailMap,
    signalConfidenceData,
    earningsIndex,
    insiderIndex,
  };
}
