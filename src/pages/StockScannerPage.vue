<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  StarIcon,
  UserGroupIcon,
} from '@heroicons/vue/24/outline';
import DataFreshnessBadge from '../components/DataFreshnessBadge.vue';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { useTomorrowWatchCodes } from '../composables/useTomorrowWatchCodes';
import { hasFiniteNumber, hasText } from '../lib/dataAvailability';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { buildEarningsIndex } from '../lib/marketCalendar';
import { buildInsiderHoldingsIndex } from '../lib/insiderHoldings';
import { createStockRoute } from '../lib/stockRouting';
import {
  buildScannerContext,
  createScannerRow,
  sortScannerRows,
} from '../lib/stockScanner';
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
const { isWatched, toggleWatch } = useTomorrowWatchCodes();

const strategyOptions = [
  {
    key: 'institutional',
    label: '法人正在買',
    icon: UserGroupIcon,
    description: '近 5 日外資或投信有買超資料',
  },
  {
    key: 'turning',
    label: '剛轉強',
    icon: ArrowTrendingUpIcon,
    description: '均線或主要技術訊號轉強',
  },
  {
    key: 'volume',
    label: '成交量放大',
    icon: ChartBarIcon,
    description: '量能品質分數較高且有成交資料',
  },
  {
    key: 'lowRisk',
    label: '波動較小',
    icon: ShieldCheckIcon,
    description: '排除處置與明顯過熱警示',
  },
];

const activeStrategy = ref('institutional');
const selectedCode = ref('');
const showMore = ref(false);
const filters = reactive({
  query: '',
  positiveInstitutional: true,
  positiveTrend: false,
  qualityVolume: false,
  excludeRisk: true,
});

const universe = computed(() => mergeStockUniverse(stockList.value, stockSearchList.value));
const scannerContext = computed(() =>
  buildScannerContext({
    universe: universe.value,
    stockDetailMap: null,
    signalConfidenceData: signalConfidenceStats.value,
    earningsIndex: buildEarningsIndex(earningsCalendar.value),
    insiderIndex: buildInsiderHoldingsIndex(insiderHoldings.value),
  }),
);
const scannerRows = computed(() =>
  sortScannerRows(universe.value.map((item) => createScannerRow(item, new Set(), scannerContext.value))),
);
const hasData = computed(() => scannerRows.value.length > 0);

const strategyRows = computed(() => scannerRows.value.filter((row) => {
  if (activeStrategy.value === 'institutional') {
    return (row.foreign5Day ?? 0) > 0 || (row.investmentTrust5Day ?? 0) > 0;
  }
  if (activeStrategy.value === 'turning') {
    return Boolean(row.maStackCrossedAbove240 || row.maBullStack || row.topSignalTone === 'up' || row.topPattern?.tone === 'up');
  }
  if (activeStrategy.value === 'volume') {
    return hasFiniteNumber(row.volumeQualityScore) && row.volumeQualityScore >= 60
      && hasFiniteNumber(row.avgTradeValue ?? row.dailyTradeValue);
  }
  return !row.isRisk && (row.warnings?.length ?? 0) <= 1 && (row.healthScore ?? 0) >= 58;
}));

const filteredRows = computed(() => {
  const query = filters.query.trim().toLowerCase();

  return strategyRows.value.filter((row) => {
    if (query) {
      const haystack = [row.code, row.name, row.industryName, row.themeTitle, row.topSignalTitle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.positiveInstitutional && (row.foreign5Day ?? 0) <= 0 && (row.investmentTrust5Day ?? 0) <= 0) return false;
    if (filters.positiveTrend && (row.return20 ?? 0) <= 0 && !row.maBullStack && row.topSignalTone !== 'up') return false;
    if (filters.qualityVolume && (!hasFiniteNumber(row.volumeQualityScore) || row.volumeQualityScore < 60)) return false;
    if (filters.excludeRisk && row.isRisk) return false;
    return true;
  });
});

const displayedRows = computed(() => filteredRows.value.slice(0, showMore.value ? 12 : 6));
const selectedRow = computed(() =>
  filteredRows.value.find((row) => row.code === selectedCode.value) ?? displayedRows.value[0] ?? null,
);
const activeStrategyOption = computed(() =>
  strategyOptions.find((item) => item.key === activeStrategy.value) ?? strategyOptions[0],
);
const dataDate = computed(() =>
  selectedRow.value?.priceDate ?? manifest.value?.generatedAtLocalDate ?? null,
);

const selectedReasons = computed(() => {
  const row = selectedRow.value;
  if (!row) return [];

  return [
    (row.foreign5Day ?? 0) > 0
      ? { key: 'foreign', icon: UserGroupIcon, label: '外資買超', value: formatLots(row.foreign5Day), note: '近 5 日累計' }
      : null,
    (row.investmentTrust5Day ?? 0) > 0
      ? { key: 'trust', icon: UserGroupIcon, label: '投信買超', value: formatLots(row.investmentTrust5Day), note: '近 5 日累計' }
      : null,
    row.maStackCrossedAbove240
      ? { key: 'ma-cross', icon: ArrowTrendingUpIcon, label: '均線剛轉強', value: '站上 MA240', note: '短中期均線同步站上長期均線' }
      : row.maBullStack
        ? { key: 'ma-stack', icon: ArrowTrendingUpIcon, label: '趨勢偏多', value: '均線多頭', note: '短中期均線維持在 MA240 上方' }
        : null,
    hasFiniteNumber(row.volumeQualityScore)
      ? { key: 'volume', icon: ChartBarIcon, label: '量能品質', value: `${formatNumber(row.volumeQualityScore, 0)} 分`, note: row.volumeQuality?.label ?? '依近期成交量穩定度計算' }
      : null,
    row.monthlyRevenueDualGrowth
      ? { key: 'revenue', icon: BoltIcon, label: '營收動能', value: '月增、年增', note: row.monthlyRevenueDate ? `資料日 ${formatDate(row.monthlyRevenueDate)}` : '最新月營收同向成長' }
      : null,
    (row.activeEtfCount ?? 0) > 0
      ? { key: 'etf', icon: CheckCircleIcon, label: '主動 ETF', value: `${formatNumber(row.activeEtfCount, 0)} 檔持有`, note: '依已整理持股揭露資料' }
      : null,
  ].filter(Boolean).slice(0, 3);
});

const selectedWarnings = computed(() => {
  const row = selectedRow.value;
  if (!row) return [];
  return [
    ...(row.warnings ?? []).map((item) => item?.title ?? item?.note ?? item).filter(hasText),
    row.hasMarginSurge ? '融資使用明顯增加，短線波動可能放大。' : null,
    (row.return20 ?? 0) > 25 ? `近 20 日已上漲 ${formatPercent(row.return20)}，留意追高風險。` : null,
  ].filter(Boolean).slice(0, 2);
});

const selectedConclusion = computed(() => {
  if (!selectedRow.value) return '目前沒有足夠資料可判斷。';
  if (!selectedReasons.value.length) return '目前可用的支持訊號不多，先放在後段觀察。';
  if (selectedWarnings.value.length) return '有支持訊號，但仍有風險需要先確認。';
  return '目前有多項資料同向，可列入優先觀察。';
});

watch(
  () => displayedRows.value.map((row) => row.code).join(','),
  () => {
    if (!displayedRows.value.some((row) => row.code === selectedCode.value)) {
      selectedCode.value = displayedRows.value[0]?.code ?? '';
    }
  },
  { immediate: true },
);

useSeoMeta(computed(() => ({
  title: '條件掃描',
  description: '用法人、趨勢、量能與風險條件找出台股觀察名單，並直接查看每檔入選原因。',
  routePath: '/scanner',
  keywords: ['台股條件掃描', '法人買超', '剛轉強', '量能放大', '低風險選股'],
})));

onMounted(() => {
  loadGlobalData();
});

function applyStrategy(key) {
  activeStrategy.value = key;
  showMore.value = false;
  filters.positiveInstitutional = key === 'institutional';
  filters.positiveTrend = key === 'turning';
  filters.qualityVolume = key === 'volume';
  filters.excludeRisk = key !== 'volume';
}

function resetFilters() {
  filters.query = '';
  applyStrategy(activeStrategy.value);
}

function riskLabel(row) {
  if (row.isRisk || (row.warnings?.length ?? 0) >= 3) return { label: '高', tone: 'risk' };
  if ((row.warnings?.length ?? 0) >= 2 || (row.healthScore ?? 100) < 50) return { label: '中高', tone: 'warning' };
  if ((row.warnings?.length ?? 0) === 1 || row.hasMarginSurge) return { label: '中', tone: 'warning' };
  return { label: '低', tone: 'safe' };
}

function matchingReasons(row) {
  return [
    (row.foreign5Day ?? 0) > 0 ? '外資買超' : null,
    (row.investmentTrust5Day ?? 0) > 0 ? '投信買超' : null,
    row.maStackCrossedAbove240 ? '均線剛轉強' : row.maBullStack ? '均線偏多' : null,
    hasFiniteNumber(row.volumeQualityScore) && row.volumeQualityScore >= 60 ? '量能穩定' : null,
    row.monthlyRevenueDualGrowth ? '月營收雙增' : null,
  ].filter(Boolean).slice(0, 2);
}
</script>

<template>
  <section class="page-shell investor-page scanner-redesign-page">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="hasData"
      empty-message="目前沒有可用的選股資料。"
    />

    <template v-if="hasData">
      <header class="ir-page-heading scanner-heading">
        <div>
          <h1>條件掃描</h1>
          <p>先選你今天想找的股票，再查看入選原因與風險。</p>
        </div>
        <div class="scanner-heading-meta">
          <span v-if="dataDate">資料日期 {{ formatDate(dataDate) }}</span>
          <DataFreshnessBadge
            :generated-at="manifest?.generatedAt"
            :market-date="dataDate"
            size="compact"
            variant="inline"
          />
        </div>
      </header>

      <div class="ir-stepper" aria-label="條件掃描步驟">
        <div class="ir-step"><span class="ir-step-index">1</span><span>選策略</span></div>
        <div class="ir-step"><span class="ir-step-index">2</span><span>微調條件</span></div>
        <div class="ir-step is-active"><span class="ir-step-index">3</span><span>查看結果</span></div>
      </div>

      <section class="scanner-workspace">
        <aside class="ir-surface ir-section scanner-strategy-panel">
          <div class="ir-section-head">
            <div>
              <h2>我今天想找</h2>
              <p>{{ activeStrategyOption.description }}</p>
            </div>
          </div>

          <div class="scanner-strategy-list">
            <button
              v-for="option in strategyOptions"
              :key="option.key"
              type="button"
              class="scanner-strategy-button"
              :class="{ 'is-active': activeStrategy === option.key }"
              @click="applyStrategy(option.key)"
            >
              <component :is="option.icon" />
              <span>{{ option.label }}</span>
              <CheckCircleIcon v-if="activeStrategy === option.key" class="strategy-check" />
            </button>
          </div>

          <div class="scanner-filter-block">
            <strong>調整條件</strong>
            <label class="ir-field">
              <span>搜尋股票或產業</span>
              <span class="scanner-search-field">
                <MagnifyingGlassIcon />
                <input v-model="filters.query" class="ir-input" type="search" placeholder="例如 2330、半導體" />
              </span>
            </label>
            <label class="ir-check"><input v-model="filters.positiveInstitutional" type="checkbox" />近 5 日法人買超</label>
            <label class="ir-check"><input v-model="filters.positiveTrend" type="checkbox" />趨勢資料偏多</label>
            <label class="ir-check"><input v-model="filters.qualityVolume" type="checkbox" />量能品質 60 分以上</label>
            <label class="ir-check"><input v-model="filters.excludeRisk" type="checkbox" />排除處置與高風險</label>
            <button type="button" class="ir-button is-primary" @click="resetFilters">
              <ArrowPathIcon />重新篩選
            </button>
          </div>
        </aside>

        <section class="ir-surface scanner-result-panel">
          <div class="ir-section scanner-result-headline">
            <div>
              <h2>最符合 {{ formatNumber(filteredRows.length, 0) }} 檔</h2>
              <p>依目前策略排序，先顯示 {{ formatNumber(displayedRows.length, 0) }} 檔。</p>
            </div>
            <button
              v-if="filteredRows.length > 6"
              type="button"
              class="ir-button"
              @click="showMore = !showMore"
            >
              {{ showMore ? '收回前 6 檔' : '查看更多' }}
            </button>
          </div>

          <div v-if="displayedRows.length" class="scanner-ranked-list" role="listbox" aria-label="條件掃描結果">
            <article
              v-for="(row, index) in displayedRows"
              :key="row.code"
              class="scanner-ranked-row"
              :class="{ 'is-selected': selectedRow?.code === row.code }"
              role="option"
              :aria-selected="selectedRow?.code === row.code"
              tabindex="0"
              @click="selectedCode = row.code"
              @keydown.enter="selectedCode = row.code"
            >
              <span class="ir-rank" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</span>
              <RouterLink class="scanner-stock-link" :to="createStockRoute(row.code)" @click.stop>
                <strong>{{ row.code }}</strong>
                <span>{{ row.name }}</span>
              </RouterLink>
              <div class="scanner-row-price">
                <strong v-if="hasFiniteNumber(row.close)">{{ formatNumber(row.close) }}</strong>
                <span
                  v-if="hasFiniteNumber(row.changePercent)"
                  :class="row.changePercent > 0 ? 'ir-text-up' : row.changePercent < 0 ? 'ir-text-down' : ''"
                >
                  {{ row.changePercent > 0 ? '▲' : row.changePercent < 0 ? '▼' : '' }} {{ formatPercent(Math.abs(row.changePercent)) }}
                </span>
              </div>
              <div class="scanner-row-reasons">
                <span v-for="reason in matchingReasons(row)" :key="`${row.code}-${reason}`">
                  <CheckCircleIcon />{{ reason }}
                </span>
                <span v-if="!matchingReasons(row).length" class="ir-muted">目前可用訊號較少</span>
              </div>
              <span class="ir-status" :class="`is-${riskLabel(row).tone}`">風險 {{ riskLabel(row).label }}</span>
              <button
                type="button"
                class="ir-row-action"
                :class="{ 'is-active': isWatched(row.code) }"
                :aria-label="isWatched(row.code) ? `從明日觀察移除 ${row.name}` : `加入明日觀察 ${row.name}`"
                @click.stop="toggleWatch(row.code)"
              >
                <StarIcon />
              </button>
            </article>
          </div>

          <div v-else class="ir-empty">
            <strong>目前沒有符合條件的股票</strong>
            <span>放寬一項條件，或改用其他策略再查看。</span>
          </div>

          <p class="ir-note scanner-source-note">只顯示目前資料中實際存在的價格、法人、量能與風險訊號。</p>
        </section>

        <aside class="ir-surface ir-section scanner-detail-panel">
          <template v-if="selectedRow">
            <div class="scanner-detail-heading">
              <div>
                <span>為什麼入選</span>
                <h2>{{ selectedRow.code }} {{ selectedRow.name }}</h2>
              </div>
              <button
                type="button"
                class="ir-icon-button"
                :class="{ 'is-active': isWatched(selectedRow.code) }"
                :aria-label="isWatched(selectedRow.code) ? '從明日觀察移除' : '加入明日觀察'"
                @click="toggleWatch(selectedRow.code)"
              >
                <StarIcon />
              </button>
            </div>

            <div v-if="hasFiniteNumber(selectedRow.close)" class="scanner-detail-quote">
              <span>股價</span>
              <strong>{{ formatNumber(selectedRow.close) }}</strong>
              <b
                v-if="hasFiniteNumber(selectedRow.changePercent)"
                :class="selectedRow.changePercent > 0 ? 'ir-text-up' : selectedRow.changePercent < 0 ? 'ir-text-down' : ''"
              >
                {{ selectedRow.changePercent > 0 ? '▲' : selectedRow.changePercent < 0 ? '▼' : '' }}
                {{ formatPercent(Math.abs(selectedRow.changePercent)) }}
              </b>
            </div>

            <div class="ir-data-note">
              <ArrowTrendingUpIcon class="ir-inline-icon" />
              <span>{{ selectedConclusion }}</span>
            </div>

            <section v-if="selectedReasons.length" class="scanner-detail-section">
              <h3>入選依據</h3>
              <div class="scanner-evidence-list">
                <article v-for="reason in selectedReasons" :key="reason.key">
                  <component :is="reason.icon" />
                  <div>
                    <strong>{{ reason.label }}</strong>
                    <span>{{ reason.note }}</span>
                  </div>
                  <b>{{ reason.value }}</b>
                </article>
              </div>
            </section>

            <section v-if="selectedWarnings.length" class="scanner-detail-section">
              <h3>需要留意</h3>
              <div class="scanner-warning-list">
                <p v-for="warning in selectedWarnings" :key="warning">
                  <ExclamationTriangleIcon />{{ warning }}
                </p>
              </div>
            </section>

            <button type="button" class="ir-button is-primary scanner-watch-button" @click="toggleWatch(selectedRow.code)">
              <StarIcon />{{ isWatched(selectedRow.code) ? '已加入明日觀察' : '加入明日觀察' }}
            </button>
            <RouterLink class="ir-button" :to="createStockRoute(selectedRow.code)">查看個股</RouterLink>
          </template>
        </aside>
      </section>
    </template>
  </section>
</template>

<style scoped>
.scanner-heading-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ir-soft);
  font-size: 0.76rem;
}

.scanner-workspace {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr) 330px;
  gap: 14px;
  align-items: stretch;
}

.scanner-strategy-panel,
.scanner-detail-panel {
  align-self: start;
}

.scanner-strategy-list,
.scanner-filter-block,
.scanner-ranked-list,
.scanner-detail-panel,
.scanner-evidence-list,
.scanner-warning-list,
.scanner-detail-section {
  display: grid;
}

.scanner-strategy-list {
  gap: 7px;
}

.scanner-strategy-button {
  display: grid;
  grid-template-columns: 24px 1fr 20px;
  align-items: center;
  gap: 9px;
  min-height: 52px;
  padding: 0 11px;
  border: 1px solid var(--ir-line);
  border-radius: 7px;
  background: transparent;
  color: var(--ir-text);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 900;
  text-align: left;
  cursor: pointer;
}

.scanner-strategy-button > svg {
  width: 23px;
  height: 23px;
  color: var(--ir-soft);
}

.scanner-strategy-button .strategy-check {
  width: 19px;
  height: 19px;
}

.scanner-strategy-button.is-active {
  border-color: var(--ir-brand);
  color: var(--ir-brand);
  background: var(--ir-row-hover);
}

.scanner-strategy-button.is-active > svg {
  color: var(--ir-brand);
}

.scanner-filter-block {
  gap: 12px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--ir-line);
}

.scanner-search-field {
  position: relative;
  display: block;
}

.scanner-search-field > svg {
  position: absolute;
  top: 11px;
  left: 10px;
  width: 18px;
  height: 18px;
  color: var(--ir-soft);
}

.scanner-search-field .ir-input {
  padding-left: 35px;
}

.scanner-result-panel {
  overflow: hidden;
}

.scanner-result-headline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid var(--ir-line);
}

.scanner-result-headline h2,
.scanner-result-headline p {
  margin: 0;
}

.scanner-result-headline h2 {
  color: var(--ir-text);
  font-size: 1.06rem;
}

.scanner-result-headline p {
  margin-top: 4px;
  color: var(--ir-soft);
  font-size: 0.76rem;
}

.scanner-ranked-row {
  display: grid;
  grid-template-columns: 38px minmax(105px, 1.05fr) minmax(94px, 0.8fr) minmax(160px, 1.4fr) 68px 40px;
  align-items: center;
  gap: 9px;
  min-height: 83px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ir-line);
  cursor: pointer;
}

.scanner-ranked-row.is-selected {
  box-shadow: inset 3px 0 0 var(--ir-brand);
  background: var(--ir-row-hover);
}

.scanner-stock-link {
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.scanner-stock-link strong,
.scanner-stock-link span {
  display: block;
}

.scanner-stock-link strong {
  color: var(--ir-text);
  font-size: 1rem;
}

.scanner-stock-link span {
  margin-top: 3px;
  color: var(--ir-soft);
  font-size: 0.76rem;
}

.scanner-row-price {
  display: grid;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.scanner-row-price strong {
  color: var(--ir-text);
}

.scanner-row-price span {
  font-size: 0.76rem;
  font-weight: 800;
}

.scanner-row-reasons {
  display: grid;
  gap: 4px;
}

.scanner-row-reasons > span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--ir-soft);
  font-size: 0.74rem;
}

.scanner-row-reasons svg {
  width: 16px;
  height: 16px;
  color: var(--down);
}

.scanner-source-note {
  padding: 10px 12px;
}

.scanner-detail-panel {
  gap: 14px;
}

.scanner-detail-heading,
.scanner-detail-quote,
.scanner-evidence-list article,
.scanner-warning-list p {
  display: flex;
  align-items: center;
}

.scanner-detail-heading,
.scanner-detail-quote {
  justify-content: space-between;
  gap: 10px;
}

.scanner-detail-heading span {
  color: var(--ir-soft);
  font-size: 0.75rem;
  font-weight: 800;
}

.scanner-detail-heading h2 {
  margin: 4px 0 0;
  color: var(--ir-text);
  font-size: 1.25rem;
}

.scanner-detail-quote {
  justify-content: flex-start;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ir-line);
}

.scanner-detail-quote span {
  color: var(--ir-soft);
  font-size: 0.75rem;
}

.scanner-detail-quote strong {
  color: var(--ir-text);
  font-size: 1.3rem;
}

.scanner-detail-quote b {
  margin-left: auto;
  font-size: 0.84rem;
}

.scanner-detail-section {
  gap: 9px;
}

.scanner-detail-section h3 {
  margin: 0;
  color: var(--ir-text);
  font-size: 0.9rem;
}

.scanner-evidence-list {
  border: 1px solid var(--ir-line);
  border-radius: 7px;
}

.scanner-evidence-list article {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--ir-line);
}

.scanner-evidence-list article:last-child {
  border-bottom: 0;
}

.scanner-evidence-list svg {
  width: 21px;
  height: 21px;
  color: var(--down);
}

.scanner-evidence-list strong,
.scanner-evidence-list span {
  display: block;
}

.scanner-evidence-list strong {
  color: var(--ir-text);
  font-size: 0.78rem;
}

.scanner-evidence-list span {
  margin-top: 2px;
  color: var(--ir-soft);
  font-size: 0.68rem;
}

.scanner-evidence-list b {
  color: var(--ir-text);
  font-size: 0.78rem;
  text-align: right;
}

.scanner-warning-list {
  gap: 7px;
}

.scanner-warning-list p {
  gap: 7px;
  margin: 0;
  color: var(--ir-soft);
  font-size: 0.75rem;
  line-height: 1.45;
}

.scanner-warning-list svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  color: var(--large);
}

.scanner-watch-button {
  width: 100%;
  margin-top: auto;
}

@media (max-width: 1180px) {
  .scanner-workspace {
    grid-template-columns: 240px minmax(0, 1fr);
  }

  .scanner-detail-panel {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scanner-detail-heading,
  .scanner-detail-quote,
  .scanner-detail-panel > .ir-data-note,
  .scanner-detail-panel > .ir-button {
    grid-column: 1 / -1;
  }
}

@media (max-width: 820px) {
  .scanner-workspace {
    grid-template-columns: 1fr;
  }

  .scanner-strategy-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scanner-filter-block {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scanner-filter-block > strong,
  .scanner-filter-block > .ir-field,
  .scanner-filter-block > .ir-button {
    grid-column: 1 / -1;
  }
}

@media (max-width: 620px) {
  .scanner-heading-meta {
    align-items: flex-start;
    flex-direction: column;
  }

  .scanner-ranked-row {
    grid-template-columns: 34px minmax(0, 1fr) auto 38px;
    min-height: 98px;
  }

  .scanner-row-price {
    text-align: right;
  }

  .scanner-row-reasons {
    grid-column: 2 / 4;
  }

  .scanner-ranked-row > .ir-status {
    grid-column: 2;
  }

  .scanner-detail-panel {
    grid-template-columns: 1fr;
  }

  .scanner-detail-panel > * {
    grid-column: 1 !important;
  }
}
</style>
