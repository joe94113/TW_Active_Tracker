<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import DataFreshnessBadge from '../components/DataFreshnessBadge.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import {
  DEFAULT_SCANNER_FILTERS,
  LIQUIDITY_MIN_OPTIONS,
  buildScannerContext,
  createScannerRow,
  filterScannerRows,
  sortScannerRows,
} from '../lib/stockScanner';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { buildEarningsIndex } from '../lib/marketCalendar';
import { buildInsiderHoldingsIndex } from '../lib/insiderHoldings';
import { createStockRoute } from '../lib/stockRouting';
import { mergeStockUniverse } from '../lib/stockUniverse';

const {
  manifest,
  stockList,
  stockSearchList,
  earningsCalendar,
  insiderHoldings,
  signalConfidenceStats,
  isLoading,
  errorMessage,
  loadGlobalData,
} = useGlobalData();

const replayHistory = ref(null);
const isReplayLoading = ref(false);
const replayError = ref('');

const filters = reactive({ ...DEFAULT_SCANNER_FILTERS });
const scannerViewMode = ref('compact');
const isScannerFiltersCollapsed = ref(false);

const liquidityOptions = LIQUIDITY_MIN_OPTIONS.map((option) => ({
  ...option,
  label:
    option.value === 0
      ? '不限成交值'
      : option.value === 5_000_000
        ? '至少 500 萬'
        : option.value === 10_000_000
          ? '至少 1,000 萬'
          : option.value === 30_000_000
            ? '至少 3,000 萬'
            : option.value === 100_000_000
              ? '至少 1 億'
              : '至少 5 億',
}));

const universe = computed(() => mergeStockUniverse(stockList.value, stockSearchList.value));
const latestReplaySnapshot = computed(() => {
  const snapshots = Array.isArray(replayHistory.value?.snapshots) ? replayHistory.value.snapshots : [];
  return [...snapshots]
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(String(item?.marketDate ?? '')))
    .sort((left, right) => String(right.marketDate).localeCompare(String(left.marketDate)))[0] ?? null;
});
const nextDayCodeSet = computed(
  () =>
    new Set(
      [
        ...(latestReplaySnapshot.value?.stable ?? []),
        ...(latestReplaySnapshot.value?.aggressive ?? []),
      ].map((item) => String(item?.code ?? '').trim()),
    ),
);

const earningsIndex = computed(() => buildEarningsIndex(earningsCalendar.value));
const insiderIndex = computed(() => buildInsiderHoldingsIndex(insiderHoldings.value));

const scannerContext = computed(() =>
  buildScannerContext({
    universe: universe.value,
    stockDetailMap: null,
    signalConfidenceData: signalConfidenceStats.value,
    earningsIndex: earningsIndex.value,
    insiderIndex: insiderIndex.value,
  }),
);

const scannerRows = computed(() =>
  sortScannerRows(universe.value.map((item) => createScannerRow(item, nextDayCodeSet.value, scannerContext.value))),
);

const filteredRows = computed(() => filterScannerRows(scannerRows.value, filters).slice(0, 80));
const topFilteredRows = computed(() => filteredRows.value.slice(0, 10));
const hasUniverse = computed(() => universe.value.length > 0);

const factorRankRows = computed(() =>
  scannerRows.value.map((row) => ({
    row,
    profile: buildFactorProfile(row),
  })),
);

const topFactorRows = computed(() =>
  [...factorRankRows.value]
    .filter((item) => item.profile.risk >= 45 && item.profile.liquidityOk)
    .sort((left, right) => right.profile.total - left.profile.total)
    .slice(0, 6),
);

const riskFactorRows = computed(() =>
  [...factorRankRows.value]
    .filter((item) => item.profile.risk < 58 || item.profile.warningLevel >= 2)
    .sort((left, right) => right.profile.warningLevel - left.profile.warningLevel || right.profile.total - left.profile.total)
    .slice(0, 4),
);

const weakFactorRows = computed(() =>
  [...factorRankRows.value]
    .filter((item) => item.profile.total < 58 || item.profile.trend < 45 || item.profile.flow < 42)
    .sort((left, right) => left.profile.total - right.profile.total)
    .slice(0, 4),
);

const factorSummaryCards = computed(() => [
  {
    label: '多因子高分',
    value: formatNumber(topFactorRows.value.length),
    note: topFactorRows.value[0] ? `${topFactorRows.value[0].row.code} ${topFactorRows.value[0].row.name}` : '等待候選',
    tone: 'up',
  },
  {
    label: '風險降權',
    value: formatNumber(riskFactorRows.value.length),
    note: riskFactorRows.value[0] ? `${riskFactorRows.value[0].row.code} ${riskFactorRows.value[0].row.name}` : '暫無明顯風險',
    tone: 'warning',
  },
  {
    label: '弱勢避開',
    value: formatNumber(weakFactorRows.value.length),
    note: weakFactorRows.value[0] ? `${weakFactorRows.value[0].row.code} ${weakFactorRows.value[0].row.name}` : '暫無弱勢名單',
    tone: 'down',
  },
  {
    label: '納入評分',
    value: formatNumber(factorRankRows.value.length),
    note: '趨勢 / 籌碼 / 品質 / 風控',
    tone: 'info',
  },
]);

const overviewCards = computed(() => [
  {
    title: '可掃描股票',
    value: formatNumber(universe.value.length),
    note: '已整合個股摘要、月營收、法人與訊號可信度。',
  },
  {
    title: '符合條件',
    value: formatNumber(filteredRows.value.length),
    note: '依目前條件排序後，最多先顯示 80 檔。',
  },
  {
    title: '月營收雙增',
    value: formatNumber(scannerRows.value.filter((item) => item.monthlyRevenueDualGrowth).length),
    note: 'MoM 與 YoY 同時往上，代表營收節奏有加速。',
  },
  {
    title: '站上 MA240',
    value: formatNumber(scannerRows.value.filter((item) => item.maStackCrossedAbove240 || item.maBullStack).length),
    note: 'MA5 / 10 / 20 站上 MA240，偏向中期結構轉強。',
  },
]);

const heroSummaryItems = computed(() => [
  {
    label: '資料日',
    value: formatDate(manifest.value?.generatedAtLocalDate) || '尚未整理',
    note: '先確認這次掃描用的是哪一天的個股與法人資料。',
  },
  {
    label: '回放基準',
    value: latestReplaySnapshot.value?.marketDate ? formatDate(latestReplaySnapshot.value.marketDate) : '樣本累積中',
    note: '用最近一次盤後觀察名單來比對隔日與後續表現。',
  },
  {
    label: 'ETF 涵蓋',
    value: `${formatNumber(universe.value.filter((item) => (item.activeEtfCount ?? 0) > 0).length)} 檔`,
    note: '先知道哪些股票同時被主動式 ETF 關注。',
  },
]);

const pageSeo = computed(() => ({
  title: '選股條件篩選器',
  description: '把月營收、法人買盤、技術面、流動性與風險條件整合在同一頁，快速挑出比較可交易的台股名單。',
  routePath: '/scanner',
  keywords: ['台股選股', '條件篩選器', '月營收雙增', '法人連買', 'MA240', '選股雷達'],
}));

useSeoMeta(pageSeo);

onMounted(async () => {
  await loadGlobalData();
  await loadReplayHistory();
});

watch(
  () => manifest.value?.stockRadarHistoryPath,
  async () => {
    await loadReplayHistory();
  },
);

async function loadReplayHistory() {
  const historyPath = manifest.value?.stockRadarHistoryPath;
  if (!historyPath) {
    replayHistory.value = null;
    return;
  }

  isReplayLoading.value = true;
  replayError.value = '';

  try {
    replayHistory.value = await fetchJson(historyPath);
  } catch (error) {
    replayHistory.value = null;
    replayError.value = error instanceof Error ? error.message : '選股回放資料讀取失敗';
  } finally {
    isReplayLoading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, DEFAULT_SCANNER_FILTERS);
}

function formatTradeValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  if (Math.abs(number) >= 100000000) return `${(number / 100000000).toFixed(2)} 億`;
  if (Math.abs(number) >= 10000) return `${(number / 10000).toFixed(0)} 萬`;
  return formatNumber(number);
}

function getWarningTone(item) {
  if (item.topWarningTitle && item.warningTone === 'risk') return 'risk';
  if (item.topWarningTitle && item.warningTone === 'warning') return 'warning';
  return 'info';
}

function formatPercentile(value) {
  if (value === null || !Number.isFinite(Number(value))) return '資料不足';
  return `產業內第 ${Math.round(Number(value))} 百分位`;
}

function getConfidenceLabel(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return { text: '資料不足', tone: 'info' };
  if (confidence >= 0.75) return { text: '訊號偏強', tone: 'up' };
  if (confidence >= 0.55) return { text: '訊號中等', tone: 'normal' };
  if (confidence >= 0.35) return { text: '先列觀察', tone: 'warning' };
  return { text: '可信度偏弱', tone: 'down' };
}

function getValuationLabel(row) {
  const percentile = Number(row.pePercentile);
  if (!Number.isFinite(percentile)) return '估值資料不足';
  if (percentile <= 30) return '估值偏低';
  if (percentile <= 45) return '估值不算貴';
  if (percentile >= 80) return '估值偏高';
  return '估值中性';
}

function getLiquidityLabel(row) {
  const tradeValue = Number(row.avgTradeValue ?? row.dailyTradeValue);
  if (!Number.isFinite(tradeValue)) return '成交值資料不足';
  if (tradeValue >= 500000000) return '流動性高';
  if (tradeValue >= 100000000) return '流動性佳';
  if (tradeValue >= 30000000) return '流動性正常';
  if (tradeValue >= 10000000) return '流動性偏弱';
  return '流動性不足';
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampFactorScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreTradeValue(value) {
  const tradeValue = toFiniteNumber(value, 0);
  if (tradeValue >= 500000000) return 14;
  if (tradeValue >= 100000000) return 10;
  if (tradeValue >= 30000000) return 6;
  if (tradeValue >= 10000000) return 2;
  if (tradeValue >= 5000000) return -2;
  return -8;
}

function scoreInstitutionalFlow(value) {
  const lots = toFiniteNumber(value, 0) / 1000;
  if (lots === 0) return 0;
  const direction = lots > 0 ? 1 : -1;
  const magnitude = Math.min(22, Math.log10(Math.abs(lots) + 1) * 6);
  return direction * magnitude;
}

function buildFactorProfile(row) {
  const return20 = toFiniteNumber(row.return20, 0);
  const changePercent = toFiniteNumber(row.changePercent, 0);
  const foreign5Day = toFiniteNumber(row.foreign5Day, 0);
  const trust5Day = toFiniteNumber(row.investmentTrust5Day, 0);
  const activeEtfCount = toFiniteNumber(row.activeEtfCount, 0);
  const healthScore = toFiniteNumber(row.healthScore, 50);
  const signalConfidence = toFiniteNumber(row.signalConfidence, 0);
  const volumeQuality = toFiniteNumber(row.volumeQualityScore, 50);
  const pePercentile = Number(row.pePercentile);
  const industryRankPct = Number(row.industryRankPct);
  const tradeValue = toFiniteNumber(row.avgTradeValue ?? row.dailyTradeValue, 0);
  const warningCount = row.warnings?.length ?? 0;
  const topSignalTone = row.topSignalTone ?? row.topPattern?.tone ?? 'normal';
  const topWarningTone = row.warningTone ?? 'info';

  const trend = clampFactorScore(
    46 +
      Math.max(Math.min(return20, 32), -28) * 0.72 +
      Math.max(Math.min(changePercent, 9), -9) * 1.45 +
      (row.maStackCrossedAbove240 ? 11 : row.maBullStack ? 7 : 0) +
      (topSignalTone === 'up' ? 8 : topSignalTone === 'down' ? -8 : 0) +
      (volumeQuality - 50) * 0.18,
  );

  const flow = clampFactorScore(
    48 +
      scoreInstitutionalFlow(foreign5Day + trust5Day) +
      ((foreign5Day > 0 && trust5Day > 0) ? 9 : 0) +
      activeEtfCount * 5 +
      (row.isNextDayWatch ? 5 : 0) -
      ((foreign5Day < 0 && trust5Day < 0) ? 8 : 0),
  );

  const valuationBonus = Number.isFinite(pePercentile)
    ? pePercentile <= 30
      ? 8
      : pePercentile <= 45
        ? 4
        : pePercentile >= 85
          ? -10
          : 0
    : -2;

  const industryBonus = Number.isFinite(industryRankPct)
    ? industryRankPct <= 25
      ? 8
      : industryRankPct <= 45
        ? 4
        : industryRankPct >= 80
          ? -7
          : 0
    : 0;

  const quality = clampFactorScore(
    healthScore * 0.56 +
      24 +
      (row.monthlyRevenueDualGrowth ? 9 : 0) +
      signalConfidence * 14 +
      scoreTradeValue(tradeValue) +
      valuationBonus +
      industryBonus,
  );

  const overheatPenalty =
    Math.max(return20 - 34, 0) * 0.45 +
    Math.max(changePercent - 7, 0) * 1.2 +
    (row.hasMarginSurge ? 13 : 0);

  const risk = clampFactorScore(
    92 -
      warningCount * 10 -
      (row.isRisk ? 28 : 0) -
      (topWarningTone === 'risk' ? 12 : topWarningTone === 'warning' ? 7 : 0) -
      overheatPenalty +
      Math.min(scoreTradeValue(tradeValue), 8),
  );

  const total = clampFactorScore(trend * 0.32 + flow * 0.26 + quality * 0.24 + risk * 0.18);
  const warningLevel = (row.isRisk ? 2 : 0) + warningCount + (row.hasMarginSurge ? 1 : 0) + (risk < 45 ? 2 : risk < 58 ? 1 : 0);
  const liquidityOk = tradeValue >= 10000000;

  const reasons = [
    row.maStackCrossedAbove240 ? '剛站上 MA240' : row.maBullStack ? '均線多頭' : null,
    foreign5Day > 0 && trust5Day > 0 ? '雙法人買超' : foreign5Day > 0 ? '外資買超' : trust5Day > 0 ? '投信買超' : null,
    row.monthlyRevenueDualGrowth ? '月營收雙增' : null,
    activeEtfCount > 0 ? `ETF ${formatNumber(activeEtfCount)} 檔持有` : null,
    signalConfidence >= 0.6 ? '訊號可信度高' : null,
    Number.isFinite(industryRankPct) && industryRankPct <= 35 ? '產業相對強勢' : null,
  ].filter(Boolean);

  const cautions = [
    row.isRisk ? '注意 / 處置 / 變更交易' : null,
    row.hasMarginSurge ? '融資偏熱' : null,
    warningCount >= 2 ? '過熱警示偏多' : null,
    tradeValue < 10000000 ? '流動性不足' : null,
    return20 < -8 ? '20 日轉弱' : null,
    flow < 42 ? '籌碼偏弱' : null,
  ].filter(Boolean);

  return {
    total,
    trend,
    flow,
    quality,
    risk,
    warningLevel,
    liquidityOk,
    reasons: reasons.slice(0, 3),
    cautions: cautions.slice(0, 3),
  };
}

function getFactorTone(profile) {
  if (profile.risk < 45 || profile.warningLevel >= 3) return 'warning';
  if (profile.total >= 72) return 'up';
  if (profile.total >= 62) return 'normal';
  return 'down';
}

function getFactorBars(profile) {
  return [
    { label: '趨勢', value: profile.trend },
    { label: '籌碼', value: profile.flow },
    { label: '品質', value: profile.quality },
    { label: '風控', value: profile.risk },
  ];
}

function buildReasonChips(row) {
  const chips = [];

  if (row.monthlyRevenueDualGrowth) chips.push('月營收雙增');
  if (row.maStackCrossedAbove240) chips.push('MA 剛站上 MA240');
  else if (row.maBullStack) chips.push('MA5/10/20 在 MA240 上方');
  if ((row.foreign5Day ?? 0) > 0 && (row.investmentTrust5Day ?? 0) > 0) chips.push('雙法人連買');
  else if ((row.foreign5Day ?? 0) > 0) chips.push('外資偏多');
  else if ((row.investmentTrust5Day ?? 0) > 0) chips.push('投信偏多');
  if ((row.activeEtfCount ?? 0) > 0) chips.push(`主動式 ETF ${row.activeEtfCount} 檔`);
  if (row.isNextDayWatch) chips.push('列入隔日觀察');
  return chips;
}
</script>

<template>
  <section class="page-shell scanner-page">
    <StatusCard
      :is-loading="isLoading || isReplayLoading"
      :error-message="replayError || errorMessage"
      :has-data="hasUniverse"
      empty-message="選股條件篩選器資料尚未整理完成。"
    />

    <template v-if="hasUniverse">
      <section class="page-hero compact scanner-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Stock Scanner</span>
          <h1>選股條件篩選器</h1>
          <p class="page-subtitle">先用條件把股票池縮小，再去看哪些股票同時具備趨勢、量能、籌碼與風險控管條件。</p>
          <div class="hero-summary-grid scanner-hero-summary-grid">
            <article
              v-for="item in heroSummaryItems"
              :key="item.label"
              class="hero-summary-card"
            >
              <span class="hero-summary-label">{{ item.label }}</span>
              <strong class="hero-summary-value">{{ item.value }}</strong>
              <p class="hero-summary-note">{{ item.note }}</p>
            </article>
          </div>
        </div>

        <aside class="scanner-hero-board">
          <div class="scanner-overview-grid">
            <article v-for="card in overviewCards.slice(0, 2)" :key="card.title" class="scanner-overview-card">
              <span class="scanner-overview-label">{{ card.title }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.note }}</p>
            </article>
          </div>
          <DataFreshnessBadge
            :generated-at="manifest?.generatedAt"
            :market-date="manifest?.generatedAtLocalDate"
            size="compact"
            variant="inline"
          />
        </aside>
      </section>

      <section class="panel scanner-priority-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">今日符合條件 Top 10</h2>
            <p class="panel-subtitle">先看目前條件篩出的前段名單，再決定要不要加嚴籌碼、趨勢或風險條件。</p>
          </div>
          <span class="meta-chip">前 {{ formatNumber(topFilteredRows.length) }} / {{ formatNumber(filteredRows.length) }} 檔</span>
        </div>

        <div class="scanner-priority-filter-row">
          <label class="scanner-filter-field">
            <span>股票 / 題材快搜</span>
            <input v-model="filters.query" type="text" placeholder="例如 2454、CPO、PCB" />
          </label>
          <label class="scanner-filter-field">
            <span>產業或題材</span>
            <input v-model="filters.themeOnly" type="text" placeholder="例如 矽光子、重電" />
          </label>
          <button type="button" class="ghost-button" @click="resetFilters">回復預設</button>
        </div>

        <div v-if="topFilteredRows.length" class="scanner-priority-list">
          <RouterLink
            v-for="(row, index) in topFilteredRows"
            :key="`priority-${row.code}`"
            class="scanner-priority-card"
            :to="createStockRoute(row.code)"
          >
            <span class="scanner-priority-rank">#{{ index + 1 }}</span>
            <div class="scanner-priority-main">
              <strong>{{ row.code }} {{ row.name }}</strong>
              <span>{{ row.industryName || row.themeTitle || '未分類產業' }}</span>
            </div>
            <div class="scanner-priority-signal">
              <b :class="row.changePercent > 0 ? 'text-up' : row.changePercent < 0 ? 'text-down' : ''">
                {{ formatPercent(row.changePercent) }}
              </b>
              <small>體檢 {{ formatNumber(row.healthScore) }}</small>
            </div>
            <div class="scanner-priority-chips">
              <span v-for="chip in buildReasonChips(row).slice(0, 3)" :key="`priority-${row.code}-${chip}`" class="meta-chip">
                {{ chip }}
              </span>
              <span class="meta-chip" :class="`is-${getConfidenceLabel(row.signalConfidence).tone}`">
                {{ getConfidenceLabel(row.signalConfidence).text }}
              </span>
            </div>
          </RouterLink>
        </div>

        <div v-else class="empty-state compact">
          <strong>目前沒有符合條件的股票</strong>
          <p>先放寬快搜或題材條件，再用下方進階篩選逐步加嚴。</p>
        </div>
      </section>

      <section class="panel scanner-factor-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">多因子強弱排行榜</h2>
            <p class="panel-subtitle">把趨勢、籌碼、品質與風控合併排序，先看全市場最值得打開個股頁的候選，以及需要降權的弱勢名單。</p>
          </div>
          <span class="meta-chip">{{ formatNumber(factorRankRows.length) }} 檔</span>
        </div>

        <div class="scanner-factor-summary-grid">
          <article
            v-for="card in factorSummaryCards"
            :key="card.label"
            class="scanner-factor-summary-card"
            :class="`is-${card.tone}`"
          >
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <p>{{ card.note }}</p>
          </article>
        </div>

        <div class="scanner-factor-board">
          <div class="scanner-factor-main">
            <div class="scanner-factor-section-head">
              <div>
                <h3>高分候選</h3>
                <p>分數同時看動能、法人、基本品質與風險扣分。</p>
              </div>
            </div>

            <div class="scanner-factor-main-list">
              <RouterLink
                v-for="(item, index) in topFactorRows"
                :key="`factor-top-${item.row.code}`"
                class="scanner-factor-card"
                :class="`is-${getFactorTone(item.profile)}`"
                :to="createStockRoute(item.row.code)"
              >
                <div class="scanner-factor-card-head">
                  <span class="scanner-factor-rank">#{{ index + 1 }}</span>
                  <span class="scanner-factor-score">{{ formatNumber(item.profile.total) }}</span>
                </div>
                <strong>{{ item.row.code }} {{ item.row.name }}</strong>
                <p>{{ item.row.industryName || item.row.themeTitle || '未分類產業' }}</p>
                <div class="scanner-factor-bars">
                  <div
                    v-for="bar in getFactorBars(item.profile)"
                    :key="`${item.row.code}-${bar.label}`"
                    class="scanner-factor-bar"
                  >
                    <span>{{ bar.label }}</span>
                    <div class="scanner-factor-bar-track">
                      <i :style="{ width: `${bar.value}%` }"></i>
                    </div>
                    <strong>{{ formatNumber(bar.value) }}</strong>
                  </div>
                </div>
                <div class="scanner-factor-chip-row">
                  <span v-for="reason in item.profile.reasons" :key="`${item.row.code}-${reason}`" class="meta-chip">{{ reason }}</span>
                </div>
              </RouterLink>
            </div>
          </div>

          <div class="scanner-factor-side">
            <section class="scanner-factor-mini-section">
              <div class="scanner-factor-section-head">
                <div>
                  <h3>風險降權</h3>
                  <p>分數不一定差，但風控分或警示扣分較重。</p>
                </div>
              </div>
              <div class="scanner-factor-mini-list">
                <RouterLink
                  v-for="item in riskFactorRows"
                  :key="`factor-risk-${item.row.code}`"
                  class="scanner-factor-mini-card is-warning"
                  :to="createStockRoute(item.row.code)"
                >
                  <div>
                    <strong>{{ item.row.code }} {{ item.row.name }}</strong>
                    <span>{{ item.profile.cautions[0] || item.row.topWarningTitle || '風險分偏低' }}</span>
                  </div>
                  <b>{{ formatNumber(item.profile.risk) }}</b>
                </RouterLink>
              </div>
            </section>

            <section class="scanner-factor-mini-section">
              <div class="scanner-factor-section-head">
                <div>
                  <h3>弱勢避開</h3>
                  <p>趨勢或籌碼分數偏弱，先放到觀察名單後段。</p>
                </div>
              </div>
              <div class="scanner-factor-mini-list">
                <RouterLink
                  v-for="item in weakFactorRows"
                  :key="`factor-weak-${item.row.code}`"
                  class="scanner-factor-mini-card is-down"
                  :to="createStockRoute(item.row.code)"
                >
                  <div>
                    <strong>{{ item.row.code }} {{ item.row.name }}</strong>
                    <span>{{ item.profile.cautions[0] || '多因子分數偏弱' }}</span>
                  </div>
                  <b>{{ formatNumber(item.profile.total) }}</b>
                </RouterLink>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section class="scanner-layout">
        <aside class="scanner-filter-sidebar">
          <section class="panel scanner-filter-panel" :class="{ 'is-collapsed': isScannerFiltersCollapsed }">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">篩選條件</h2>
                <p class="panel-subtitle">先用條件把股票池縮小，再看每檔卡片是不是同時具備趨勢、成交值和籌碼支持。</p>
              </div>
              <div class="scanner-filter-actions">
                <button
                  type="button"
                  class="ghost-button"
                  :aria-expanded="String(!isScannerFiltersCollapsed)"
                  @click="isScannerFiltersCollapsed = !isScannerFiltersCollapsed"
                >
                  {{ isScannerFiltersCollapsed ? '展開條件' : '收合條件' }}
                </button>
                <button type="button" class="ghost-button" @click="resetFilters">回復預設</button>
              </div>
            </div>

            <div v-show="!isScannerFiltersCollapsed" class="scanner-filter-stack">
              <section class="scanner-filter-section">
                <div class="scanner-filter-section-head">
                  <strong>快速定位</strong>
                  <span>先縮小股票池，再決定要不要加嚴條件。</span>
                </div>
                <div class="scanner-filter-grid">
                  <label class="scanner-filter-field is-wide">
                    <span>股票代號 / 名稱 / 題材</span>
                    <input v-model="filters.query" type="text" placeholder="例如 2454、CPO、PCB" />
                  </label>

                  <label class="scanner-filter-field is-wide">
                    <span>只看特定題材或產業</span>
                    <input v-model="filters.themeOnly" type="text" placeholder="例如 矽光子、重電、PCB" />
                  </label>
                </div>
              </section>

              <section class="scanner-filter-section">
                <div class="scanner-filter-section-head">
                  <strong>趨勢與籌碼</strong>
                  <span>用月營收、均線與法人買盤先找出比較像剛轉強的股票。</span>
                </div>
                <div class="scanner-filter-check-grid">
                  <label class="scanner-check"><input v-model="filters.dualBuy" type="checkbox" /> 外資與投信同步買超</label>
                  <label class="scanner-check"><input v-model="filters.foreignBuy" type="checkbox" /> 外資近 5 日偏多</label>
                  <label class="scanner-check"><input v-model="filters.trustBuy" type="checkbox" /> 投信近 5 日偏多</label>
                  <label class="scanner-check"><input v-model="filters.activeEtf" type="checkbox" /> 有主動式 ETF 持有</label>
                  <label class="scanner-check"><input v-model="filters.revenueDualGrowth" type="checkbox" /> 月營收 MoM / YoY 同增</label>
                  <label class="scanner-check"><input v-model="filters.maStackAbove240" type="checkbox" /> MA5 / 10 / 20 站上 MA240</label>
                  <label class="scanner-check"><input v-model="filters.bullishSignal" type="checkbox" /> 只看偏多技術訊號</label>
                  <label class="scanner-check"><input v-model="filters.nextDayOnly" type="checkbox" /> 只看隔日觀察清單交集</label>
                </div>
              </section>

              <section class="scanner-filter-section">
                <div class="scanner-filter-section-head">
                  <strong>品質與風險</strong>
                  <span>排掉太熱、太差或訊號可信度偏低的股票，保留比較可交易的名單。</span>
                </div>
                <div class="scanner-filter-check-grid">
                  <label class="scanner-check"><input v-model="filters.healthyOnly" type="checkbox" /> 只看體檢分數 62 以上</label>
                  <label class="scanner-check"><input v-model="filters.coolOnly" type="checkbox" /> 排除過熱股票</label>
                  <label class="scanner-check"><input v-model="filters.excludeRisk" type="checkbox" /> 排除注意、處置、變更交易</label>
                  <label class="scanner-check"><input v-model="filters.excludeMarginSurge" type="checkbox" /> 排除融資過熱</label>
                  <label class="scanner-check"><input v-model="filters.industryCheap" type="checkbox" /> 只看產業相對便宜</label>
                  <label class="scanner-check"><input v-model="filters.industryStrong" type="checkbox" /> 只看產業相對強勢</label>
                  <label class="scanner-check"><input v-model="filters.highConfidenceSignal" type="checkbox" /> 只看高可信度訊號</label>
                </div>
              </section>

              <section class="scanner-filter-section">
                <div class="scanner-filter-section-head">
                  <strong>流動性</strong>
                  <span>確認成交值夠不夠，避免挑到有訊號但不好交易的股票。</span>
                </div>
                <div class="scanner-filter-grid">
                  <label class="scanner-check scanner-check-wide">
                    <input v-model="filters.minLiquidity" type="checkbox" />
                    只看流動性達標
                  </label>
                  <label v-if="filters.minLiquidity" class="scanner-filter-field">
                    <span>最低日均成交值</span>
                    <select v-model.number="filters.minTradeValue" class="scanner-filter-select">
                      <option v-for="option in liquidityOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                </div>
              </section>
            </div>
          </section>
        </aside>

        <section class="panel scanner-result-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">符合條件的股票</h2>
              <p class="panel-subtitle">排序會先考慮體檢分數、訊號可信度、產業相對估值與量能品質，目的不是找最熱門，而是找比較可交易的名單。</p>
            </div>
            <div class="scanner-result-actions">
              <div class="scanner-view-switch" role="tablist" aria-label="切換結果顯示密度">
                <button
                  type="button"
                  :class="{ 'is-active': scannerViewMode === 'compact' }"
                  :aria-selected="scannerViewMode === 'compact'"
                  @click="scannerViewMode = 'compact'"
                >
                  精簡
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': scannerViewMode === 'detail' }"
                  :aria-selected="scannerViewMode === 'detail'"
                  @click="scannerViewMode = 'detail'"
                >
                  詳細
                </button>
              </div>
              <span class="meta-chip">{{ formatNumber(filteredRows.length) }} 檔</span>
            </div>
          </div>

          <div v-if="filteredRows.length" class="scanner-result-list">
            <RouterLink
              v-for="row in filteredRows"
              :key="row.code"
              class="scanner-result-card"
              :class="{ 'is-compact': scannerViewMode === 'compact' }"
              :to="createStockRoute(row.code)"
            >
              <div class="scanner-result-head">
                <div>
                  <strong>{{ row.code }} {{ row.name }}</strong>
                  <div class="scanner-result-meta">
                    <span>{{ row.industryName || '未分類產業' }}</span>
                    <span v-if="row.themeTitle">・{{ row.themeTitle }}</span>
                    <span v-if="row.topSignalTitle">・{{ row.topSignalTitle }}</span>
                  </div>
                </div>
                <div class="scanner-result-score">
                  <span class="status-badge" :class="`is-${row.healthTone}`">體檢 {{ formatNumber(row.healthScore) }}</span>
                  <span :class="row.changePercent > 0 ? 'text-up' : row.changePercent < 0 ? 'text-down' : ''">
                    {{ formatPercent(row.changePercent) }}
                  </span>
                </div>
              </div>

              <div class="scanner-result-chips">
                <span v-for="chip in buildReasonChips(row)" :key="`${row.code}-${chip}`" class="meta-chip">{{ chip }}</span>
                <span class="meta-chip" :class="`is-${getConfidenceLabel(row.signalConfidence).tone}`">
                  {{ getConfidenceLabel(row.signalConfidence).text }}
                </span>
                <span class="meta-chip">{{ getValuationLabel(row) }}</span>
                <span class="meta-chip">{{ getLiquidityLabel(row) }}</span>
                <span v-if="row.topWarningTitle" class="meta-chip" :class="`is-${getWarningTone(row)}`">{{ row.topWarningTitle }}</span>
              </div>

              <div v-if="scannerViewMode === 'detail'" class="radar-stock-metrics scanner-result-metrics">
                <div>
                  <span>收盤價</span>
                  <strong>{{ formatNumber(row.close) }}</strong>
                </div>
                <div>
                  <span>20 日表現</span>
                  <strong :class="(row.return20 ?? 0) > 0 ? 'text-up' : (row.return20 ?? 0) < 0 ? 'text-down' : ''">
                    {{ formatPercent(row.return20) }}
                  </strong>
                </div>
                <div>
                  <span>外資 5 日</span>
                  <strong>{{ formatLots(row.foreign5Day) }}</strong>
                </div>
                <div>
                  <span>投信 5 日</span>
                  <strong>{{ formatLots(row.investmentTrust5Day) }}</strong>
                </div>
                <div>
                  <span>日均成交值</span>
                  <strong>{{ formatTradeValue(row.avgTradeValue ?? row.dailyTradeValue) }}</strong>
                </div>
                <div>
                  <span>產業估值</span>
                  <strong>{{ formatPercentile(row.pePercentile) }}</strong>
                </div>
                <div>
                  <span>月營收</span>
                  <strong>{{ row.monthlyRevenueDualGrowth ? 'MoM / YoY 同增' : row.monthlyRevenueDate ? formatDate(row.monthlyRevenueDate) : '資料不足' }}</strong>
                </div>
                <div>
                  <span>MA240 結構</span>
                  <strong>
                    {{ row.maStackCrossedAbove240 ? '剛站上長期均線' : row.maBullStack ? '均線在 MA240 上方' : '尚未確認' }}
                  </strong>
                </div>
              </div>
              <div v-else class="scanner-result-note">
                收盤 {{ formatNumber(row.close) }}｜20 日 {{ formatPercent(row.return20) }}｜外資 {{ formatLots(row.foreign5Day) }}｜投信 {{ formatLots(row.investmentTrust5Day) }}
              </div>
            </RouterLink>
          </div>
          <div v-else class="empty-state compact">
            <strong>目前沒有符合條件的股票</strong>
            <p>可以先放寬成交值或風險條件，或改看單一題材，找還沒走遠但剛有訊號的股票。</p>
          </div>
        </section>
      </section>
    </template>
  </section>
</template>
