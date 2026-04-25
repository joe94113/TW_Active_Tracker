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
const hasUniverse = computed(() => universe.value.length > 0);

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
          <p>把月營收、法人買盤、技術面、流動性和風險條件放在同一頁。你可以先縮小範圍，再點進個股確認是不是值得放進觀察清單。</p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">資料日 {{ formatDate(manifest?.generatedAtLocalDate) }}</span>
            <span class="theme-observation-chip">回放基準 {{ latestReplaySnapshot?.marketDate ? formatDate(latestReplaySnapshot.marketDate) : '尚未整理' }}</span>
            <span class="theme-observation-chip">主動式 ETF 涵蓋 {{ formatNumber(universe.filter((item) => (item.activeEtfCount ?? 0) > 0).length) }} 檔</span>
          </div>
        </div>

        <aside class="scanner-hero-board">
          <div class="scanner-overview-grid">
            <article v-for="card in overviewCards" :key="card.title" class="scanner-overview-card">
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

      <section class="scanner-layout">
        <aside class="scanner-filter-sidebar">
          <section class="panel scanner-filter-panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">篩選條件</h2>
                <p class="panel-subtitle">先用條件把股票池縮小，再看每檔卡片是不是同時具備趨勢、成交值和籌碼支持。</p>
              </div>
              <button type="button" class="ghost-button" @click="resetFilters">回復預設</button>
            </div>

            <div class="scanner-filter-stack">
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
            <span class="meta-chip">{{ formatNumber(filteredRows.length) }} 檔</span>
          </div>

          <div v-if="filteredRows.length" class="scanner-result-list">
            <RouterLink
              v-for="row in filteredRows"
              :key="row.code"
              class="scanner-result-card"
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

              <div class="radar-stock-metrics scanner-result-metrics">
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
