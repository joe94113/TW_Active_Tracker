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
import { formatTradeValue } from '../lib/liquidity';
import { describeValuation } from '../lib/industryValuation';
import { describeConfidence } from '../lib/signalConfidence';
import { buildEarningsIndex, findNextEarnings } from '../lib/marketCalendar';
import { buildInsiderHoldingsIndex } from '../lib/insiderHoldings';
import { createStockRoute } from '../lib/stockRouting';
import { createStockCodeMap, mergeStockUniverse } from '../lib/stockUniverse';

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

const universe = computed(() => mergeStockUniverse(stockList.value, stockSearchList.value));
const stockMap = computed(() => createStockCodeMap(universe.value));
const nextDayCodeSet = computed(() => {
  const latest = [...(replayHistory.value?.snapshots ?? [])]
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(String(item?.marketDate ?? '')))
    .sort((left, right) => String(right.marketDate).localeCompare(String(left.marketDate)))[0];
  return new Set([...(latest?.stable ?? []), ...(latest?.aggressive ?? [])].map((item) => String(item?.code ?? '').trim()));
});

const earningsIndex = computed(() => buildEarningsIndex(earningsCalendar.value));
const insiderIndex = computed(() => buildInsiderHoldingsIndex(insiderHoldings.value));

const scannerContext = computed(() =>
  buildScannerContext({
    universe: universe.value,
    stockDetailMap: null, // 先用輕量模式（sparkline 推估），個股頁再做完整型態偵測
    signalConfidenceData: signalConfidenceStats.value,
    earningsIndex: earningsIndex.value,
    insiderIndex: insiderIndex.value,
  }),
);

const scannerRows = computed(() =>
  sortScannerRows(
    universe.value.map((item) => createScannerRow(item, nextDayCodeSet.value, scannerContext.value)),
  ),
);
const filteredRows = computed(() => filterScannerRows(scannerRows.value, filters).slice(0, 80));

const pageSeo = computed(() => ({
  title: '選股條件篩選器',
  description: '直接勾選外資連買、投信連買、主動 ETF、流動性、產業估值與技術型態，快速縮小選股範圍。',
  routePath: '/scanner',
  keywords: ['選股條件篩選器', '股票掃描器', '外資連買', '技術轉強', '產業相對估值', '流動性'],
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
  if (!historyPath) return;

  isReplayLoading.value = true;
  replayError.value = '';

  try {
    replayHistory.value = await fetchJson(historyPath);
  } catch (error) {
    replayHistory.value = null;
    replayError.value = error instanceof Error ? error.message : '選股回放載入失敗';
  } finally {
    isReplayLoading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, DEFAULT_SCANNER_FILTERS);
}

function getWarningTone(item) {
  if (item.topWarningTitle && item.warningTone === 'risk') return 'risk';
  if (item.topWarningTitle && item.warningTone === 'warning') return 'warning';
  return 'info';
}

function formatPercentile(value) {
  if (value === null || !Number.isFinite(Number(value))) return '—';
  return `第 ${Math.round(Number(value))} 百分位`;
}
</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isLoading || isReplayLoading"
      :error-message="replayError || errorMessage"
      :has-data="Boolean(universe.length)"
      empty-message="選股條件篩選器資料尚未整理完成。"
    />

    <template v-if="universe.length">
      <section class="page-hero compact scanner-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Stock Scanner</span>
          <h1>選股條件篩選器</h1>
          <p>把常用的技術、籌碼、估值、流動性與風險條件做成可勾選掃描器，想找外資連買、起漲、排除過熱都能同頁完成。</p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">可掃描 {{ formatNumber(universe.length, 0) }} 檔</span>
            <span class="theme-observation-chip">目前命中 {{ formatNumber(filteredRows.length, 0) }} 檔</span>
            <span class="theme-observation-chip">回放資料 {{ replayHistory?.marketDate ? formatDate(replayHistory.marketDate) : '整理中' }}</span>
            <DataFreshnessBadge
              :generated-at="manifest?.generatedAt"
              :market-date="manifest?.generatedAtLocalDate"
              size="compact"
            />
          </div>
        </div>
      </section>

      <section class="scanner-layout">
        <aside class="scanner-filter-sidebar">
          <section class="panel scanner-filter-panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">篩選條件</h2>
                <p class="panel-subtitle">想抓剛起漲、法人偏多或排除過熱，都可以直接勾選。</p>
              </div>
              <button type="button" class="ghost-button" @click="resetFilters">重設</button>
            </div>

            <div class="scanner-filter-grid">
              <label class="scanner-filter-field is-wide">
                <span>搜尋代號 / 名稱 / 題材</span>
                <input v-model="filters.query" type="text" placeholder="例如 2454、CPO、重電" />
              </label>
              <label class="scanner-filter-field">
                <span>限定題材或產業</span>
                <input v-model="filters.themeOnly" type="text" placeholder="例如 PCB、AI、金融" />
              </label>

              <label class="scanner-check"><input v-model="filters.foreignBuy" type="checkbox" /> 外資 5 日買超</label>
              <label class="scanner-check"><input v-model="filters.trustBuy" type="checkbox" /> 投信 5 日買超</label>
              <label class="scanner-check"><input v-model="filters.dualBuy" type="checkbox" /> 雙法人同步偏多</label>
              <label class="scanner-check"><input v-model="filters.activeEtf" type="checkbox" /> 主動 ETF 持有</label>
              <label class="scanner-check"><input v-model="filters.bullishSignal" type="checkbox" /> 技術訊號偏多</label>
              <label class="scanner-check"><input v-model="filters.healthyOnly" type="checkbox" /> 體檢 62 分以上</label>
              <label class="scanner-check"><input v-model="filters.coolOnly" type="checkbox" /> 排除過熱警示</label>
              <label class="scanner-check"><input v-model="filters.excludeRisk" type="checkbox" /> 排除注意 / 處置 / 變更交易</label>
              <label class="scanner-check"><input v-model="filters.nextDayOnly" type="checkbox" /> 僅看隔日觀察清單</label>

              <!-- 新增：流動性過濾 -->
              <label class="scanner-check">
                <input v-model="filters.minLiquidity" type="checkbox" />
                僅看流動性達門檻
              </label>
              <label class="scanner-filter-field" v-if="filters.minLiquidity">
                <span>日均成交值下限</span>
                <select v-model.number="filters.minTradeValue">
                  <option v-for="option in LIQUIDITY_MIN_OPTIONS" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <!-- 新增：融資升溫排除 -->
              <label class="scanner-check">
                <input v-model="filters.excludeMarginSurge" type="checkbox" />
                排除融資升溫股（使用率 ≥ 40% 或單日增 ≥ 800 張）
              </label>

              <!-- 新增：產業相對便宜 -->
              <label class="scanner-check">
                <input v-model="filters.industryCheap" type="checkbox" />
                產業內 PE 相對便宜（前 40 百分位）
              </label>

              <!-- 新增：產業內相對強度 -->
              <label class="scanner-check">
                <input v-model="filters.industryStrong" type="checkbox" />
                產業內 20 日報酬前 40%
              </label>

              <!-- 新增：高信心訊號 -->
              <label class="scanner-check">
                <input v-model="filters.highConfidenceSignal" type="checkbox" />
                技術訊號可信度 ≥ 60%
              </label>
            </div>
          </section>
        </aside>

        <section class="panel scanner-result-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">命中結果</h2>
              <p class="panel-subtitle">按綜合評分排序，顯示前 80 檔。</p>
            </div>
            <span class="meta-chip">{{ formatNumber(filteredRows.length, 0) }} 檔</span>
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
                    <span>{{ row.industryName ?? '—' }}</span>
                    <span v-if="row.themeTitle">・{{ row.themeTitle }}</span>
                  </div>
                </div>
                <div class="scanner-result-score">
                  <span class="status-badge" :class="`is-${row.healthTone}`">體檢 {{ formatNumber(row.healthScore, 0) }}</span>
                  <span :class="row.changePercent > 0 ? 'text-up' : row.changePercent < 0 ? 'text-down' : ''">
                    {{ formatPercent(row.changePercent) }}
                  </span>
                </div>
              </div>

              <div class="scanner-result-chips">
                <span v-if="row.topSignalTitle" class="status-badge" :class="`is-${row.topSignalTone || 'info'}`">
                  {{ row.topSignalTitle }}
                </span>
                <span v-if="row.signalConfidence !== null" class="meta-chip">
                  訊號可信度 {{ formatNumber((row.signalConfidence ?? 0) * 100, 0) }}%
                </span>
                <span v-if="row.pePercentile !== null" class="meta-chip">
                  產業估值 {{ formatPercentile(row.pePercentile) }}
                </span>
                <span v-if="row.industryRankPct !== null" class="meta-chip">
                  產業排名前 {{ formatNumber(row.industryRankPct, 0) }}%
                </span>
                <span v-if="row.avgTradeValue !== null || row.dailyTradeValue !== null" class="meta-chip">
                  成交值 {{ formatTradeValue(row.avgTradeValue ?? row.dailyTradeValue) }}
                </span>
                <span v-if="row.volumeQualityScore !== null" class="meta-chip">
                  量能 {{ row.volumeQuality.label }}
                </span>
                <span v-if="row.topPattern" class="meta-chip">
                  {{ row.topPattern.title }}
                </span>
                <span v-if="row.hasMarginSurge" class="meta-chip is-warning">融資升溫</span>
                <span v-if="row.nextEarnings" class="meta-chip">
                  財報 {{ row.nextEarnings.daysUntil }} 天後
                </span>
                <span v-if="row.insiderRecord?.deltaFromPrevMonth?.pct" class="meta-chip">
                  內部人 {{ formatPercent(row.insiderRecord.deltaFromPrevMonth.pct) }}
                </span>
                <span v-if="(row.foreign5Day ?? 0) > 0" class="meta-chip is-up">外資 5 日 +{{ formatLots(row.foreign5Day) }}</span>
                <span v-if="(row.investmentTrust5Day ?? 0) > 0" class="meta-chip is-up">投信 5 日 +{{ formatLots(row.investmentTrust5Day) }}</span>
                <span v-if="(row.activeEtfCount ?? 0) > 0" class="meta-chip">主動 ETF {{ formatNumber(row.activeEtfCount, 0) }} 檔</span>
                <span v-if="row.topWarningTitle" class="status-badge" :class="`is-${getWarningTone(row)}`">
                  {{ row.topWarningTitle }}
                </span>
                <span v-if="row.isNextDayWatch" class="status-badge is-up">隔日觀察</span>
              </div>
            </RouterLink>
          </div>

          <p v-else class="empty-state">目前沒有符合條件的股票，可以嘗試放寬或重設條件。</p>
        </section>
      </section>
    </template>
  </section>
</template>
