<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { DEFAULT_SCANNER_FILTERS, createScannerRow, filterScannerRows, sortScannerRows } from '../lib/stockScanner';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';
import { createStockCodeMap, mergeStockUniverse } from '../lib/stockUniverse';

const { manifest, stockList, stockSearchList, isLoading, errorMessage, loadGlobalData } = useGlobalData();

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
const scannerRows = computed(() => sortScannerRows(universe.value.map((item) => createScannerRow(item, nextDayCodeSet.value))));
const filteredRows = computed(() => filterScannerRows(scannerRows.value, filters).slice(0, 80));

const pageSeo = computed(() => ({
  title: '選股條件篩選器',
  description: '直接勾選外資連買、投信連買、主動 ETF、技術轉強與排除過熱風險，快速縮小選股範圍。',
  routePath: '/scanner',
  keywords: ['選股條件篩選器', '股票掃描器', '外資連買', '技術轉強'],
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
          <p>把常用的技術、籌碼、風險條件做成可勾選掃描器，想找外資連買、起漲、排除過熱都能同頁完成。</p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">可掃描 {{ formatNumber(universe.length, 0) }} 檔</span>
            <span class="theme-observation-chip">目前命中 {{ formatNumber(filteredRows.length, 0) }} 檔</span>
            <span class="theme-observation-chip">回放資料 {{ replayHistory?.marketDate ? formatDate(replayHistory.marketDate) : '整理中' }}</span>
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
            </div>
          </section>
        </aside>

        <section class="panel scanner-result-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">命中名單</h2>
              <p class="panel-subtitle">體檢分數高、條件越集中，通常越值得先看。</p>
            </div>
            <span class="meta-chip">{{ formatNumber(filteredRows.length, 0) }} 檔</span>
          </div>

          <div v-if="filteredRows.length" class="radar-stock-grid">
            <RouterLink
              v-for="item in filteredRows"
              :key="item.code"
              :to="createStockRoute(item.code)"
              class="radar-stock-card"
              :class="`is-${item.healthTone}`"
            >
              <div class="radar-stock-head">
                <div>
                  <strong>{{ item.code }} {{ item.name }}</strong>
                  <p class="muted">{{ item.industryName || item.themeTitle || '台股個股' }}</p>
                </div>
                <div class="radar-stock-chip-stack">
                  <span class="meta-chip" :class="{ 'is-up': item.isNextDayWatch }">{{ item.isNextDayWatch ? '隔日名單' : '一般掃描' }}</span>
                  <span class="meta-chip">體檢 {{ item.healthScore }}</span>
                </div>
              </div>

              <div v-if="item.topWarningTitle" class="entry-warning-chip-row">
                <span class="status-badge" :class="`is-${getWarningTone(item)}`">{{ item.topWarningTitle }}</span>
                <span class="muted">先確認是不是已經偏熱。</span>
              </div>

              <div class="radar-stock-metrics">
                <div>
                  <span>收盤</span>
                  <strong>{{ formatNumber(item.close) }}</strong>
                </div>
                <div>
                  <span>單日</span>
                  <strong :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                    {{ formatPercent(item.changePercent) }}
                  </strong>
                </div>
                <div>
                  <span>20 日</span>
                  <strong :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
                    {{ formatPercent(item.return20) }}
                  </strong>
                </div>
                <div>
                  <span>外資 5 日</span>
                  <strong>{{ formatLots(item.foreign5Day) }}</strong>
                </div>
                <div>
                  <span>投信 5 日</span>
                  <strong>{{ formatLots(item.investmentTrust5Day) }}</strong>
                </div>
                <div>
                  <span>訊號</span>
                  <strong>{{ item.topSignalTitle || '-' }}</strong>
                </div>
              </div>
            </RouterLink>
          </div>
          <div v-else class="empty-state compact">
            <strong>目前沒有符合條件的股票</strong>
            <p>可以放寬條件，或改用題材 / 代號關鍵字重新掃描。</p>
          </div>
        </section>
      </section>
    </template>
  </section>
</template>
