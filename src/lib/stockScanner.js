import { buildSummaryHealthScore, buildSummaryOverheatWarnings } from './stockHealth';

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
  activeEtf: false,
  bullishSignal: false,
  healthyOnly: false,
  coolOnly: false,
  excludeRisk: true,
  nextDayOnly: false,
  themeOnly: '',
};

export function createScannerRow(stock = {}, nextDayCodeSet = new Set()) {
  const health = buildSummaryHealthScore(stock);
  const warnings = buildSummaryOverheatWarnings(stock);
  const warningTone = warnings[0]?.tone ?? 'info';

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
  };
}

export function filterScannerRows(rows = [], filters = DEFAULT_SCANNER_FILTERS) {
  const query = String(filters.query ?? '').trim();
  const themeOnly = String(filters.themeOnly ?? '').trim();

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
    if (filters.activeEtf && (toNumber(row.activeEtfCount) ?? 0) <= 0) return false;
    if (filters.bullishSignal && row.topSignalTone !== 'up') return false;
    if (filters.healthyOnly && (toNumber(row.healthScore) ?? 0) < 62) return false;
    if (filters.coolOnly && (row.warnings?.length ?? 0) >= 2) return false;
    if (filters.excludeRisk && row.isRisk) return false;
    if (filters.nextDayOnly && !row.isNextDayWatch) return false;

    return true;
  });
}

export function sortScannerRows(rows = []) {
  return [...rows].sort((left, right) => {
    const leftScore =
      (toNumber(left.healthScore) ?? 0) +
      Math.max(toNumber(left.return20) ?? 0, 0) +
      Math.max(toNumber(left.changePercent) ?? 0, 0) * 2 +
      ((toNumber(left.activeEtfCount) ?? 0) * 3);
    const rightScore =
      (toNumber(right.healthScore) ?? 0) +
      Math.max(toNumber(right.return20) ?? 0, 0) +
      Math.max(toNumber(right.changePercent) ?? 0, 0) * 2 +
      ((toNumber(right.activeEtfCount) ?? 0) * 3);

    return rightScore - leftScore;
  });
}
