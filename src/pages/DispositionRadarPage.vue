<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { formatNumber } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';

const mockDispositionStocks = [
  {
    code: '2455',
    name: '全新',
    caseCode: 'A',
    caseTitle: '真．主力鎖籌碼',
    group: '主力吃貨區',
    statusMinutes: 20,
    daysToExit: 4,
    preDispositionNetLots: 5200,
    duringDispositionNetLots: 1280,
    priceTrend: [91.2, 95.8, 101.5, 104.2, 102.8, 105.6, 103.9, 106.2],
    priceNote: '高檔震盪',
    thesis: '處置前先卡位，處置中仍續買，籌碼沒有鬆掉。',
  },
  {
    code: '8027',
    name: '鈦昇',
    caseCode: 'B',
    caseTitle: '主力護盤套牢',
    group: '主力吃貨區',
    statusMinutes: 5,
    daysToExit: 2,
    preDispositionNetLots: 4860,
    duringDispositionNetLots: 260,
    priceTrend: [138, 134, 129, 123, 119, 114, 109, 105],
    priceNote: '一路走弱',
    thesis: '處置前大買，處置中只微幅承接，價格卻一路往下。',
  },
  {
    code: '3374',
    name: '精材',
    caseCode: 'C',
    caseTitle: '倒貨主力',
    group: '主力倒貨區',
    statusMinutes: 20,
    daysToExit: 5,
    preDispositionNetLots: 6100,
    duringDispositionNetLots: -2360,
    priceTrend: [188, 194, 205, 211, 207, 199, 192, 184],
    priceNote: '高檔轉弱',
    thesis: '處置前大買拉抬，進處置後主力反手賣出。',
  },
  {
    code: '6438',
    name: '迅得',
    caseCode: 'D',
    caseTitle: '避開不碰',
    group: '主力倒貨區',
    statusMinutes: 5,
    daysToExit: 7,
    preDispositionNetLots: -1850,
    duringDispositionNetLots: -920,
    priceTrend: [121, 117, 115, 112, 110, 106, 101, 98],
    priceNote: '題材退潮',
    thesis: '處置前已經賣，處置中繼續賣，主力沒有留下來接。',
  },
];

const { manifest, loadGlobalData } = useGlobalData();
const router = useRouter();
const dispositionRadar = ref(null);
const radarError = ref('');
const isRadarLoading = ref(false);
const selectedStock = ref(null);
const activeView = ref('accumulation');
const CHART_BASELINE_Y = 112;
const CHART_POSITIVE_HEIGHT = 74;
const CHART_NEGATIVE_HEIGHT = 58;

const sourceStocks = computed(() => {
  const items = dispositionRadar.value?.items ?? [];
  return items.length ? items : mockDispositionStocks;
});

const isUsingMockData = computed(() => !(dispositionRadar.value?.items ?? []).length);

const accumulationStocks = computed(() =>
  sourceStocks.value
    .filter((item) => item.duringDispositionNetLots >= 0)
    .sort((left, right) => right.duringDispositionNetLots - left.duringDispositionNetLots),
);

const distributionStocks = computed(() =>
  sourceStocks.value
    .filter((item) => item.duringDispositionNetLots < 0)
    .sort((left, right) => Math.abs(right.duringDispositionNetLots) - Math.abs(left.duringDispositionNetLots)),
);

const radarViews = computed(() => [
  {
    key: 'accumulation',
    tone: 'up',
    eyebrow: 'Accumulation',
    label: '主力吃貨區',
    title: '主力吃貨區',
    sortLabel: '買超由高到低',
    count: accumulationStocks.value.length,
    stocks: accumulationStocks.value,
  },
  {
    key: 'distribution',
    tone: 'down',
    eyebrow: 'Distribution',
    label: '主力倒貨區',
    title: '主力倒貨區',
    sortLabel: '賣超由高到低',
    count: distributionStocks.value.length,
    stocks: distributionStocks.value,
  },
]);

const activeRadarView = computed(() =>
  radarViews.value.find((view) => view.key === activeView.value) ?? radarViews.value[0],
);

const activeStocks = computed(() => activeRadarView.value?.stocks ?? []);

const dataStatusLabel = computed(() => {
  if (isRadarLoading.value) return '載入中';
  if (!isUsingMockData.value) return '即時處置';
  return 'Mock';
});

const dataStatusNote = computed(() => {
  if (!isUsingMockData.value) {
    return `官方處置 ${formatNumber(dispositionRadar.value?.summary?.activeCount ?? sourceStocks.value.length)} 檔`;
  }

  return radarError.value ? '真實資料讀取失敗' : '介面範例';
});

const pageSeo = computed(() => ({
  title: '處置股雷達',
  description: '用進處置前 10 天與處置期間的主力籌碼變化，分辨主力鎖籌碼、護盤套牢、倒貨與避開不碰的處置股型態。',
  routePath: '/disposition-radar',
  keywords: ['處置股雷達', '處置股', '主力買賣超', '籌碼分析', '處置期間'],
}));

const modalBars = computed(() => {
  if (!selectedStock.value) return [];

  return [
    {
      label: '進處置前 10 天',
      value: selectedStock.value.preDispositionNetLots,
    },
    {
      label: '處置期間',
      value: selectedStock.value.duringDispositionNetLots,
    },
  ];
});

const modalMaxAbsValue = computed(() =>
  Math.max(...modalBars.value.map((item) => Math.abs(item.value)), 1),
);

useSeoMeta(pageSeo);

onMounted(async () => {
  await loadGlobalData();
  await loadDispositionRadar();
});

watch(
  () => manifest.value?.dispositionRadarPath,
  async () => {
    await loadDispositionRadar();
  },
);

async function loadDispositionRadar() {
  const dataPath = manifest.value?.dispositionRadarPath ?? 'data/radar/disposition.json';
  isRadarLoading.value = true;
  radarError.value = '';

  try {
    dispositionRadar.value = await fetchJson(dataPath);
  } catch (error) {
    dispositionRadar.value = null;
    radarError.value = error instanceof Error ? error.message : '處置股雷達資料載入失敗';
  } finally {
    isRadarLoading.value = false;
  }
}

function openDetail(stock) {
  selectedStock.value = stock;
}

function closeDetail() {
  selectedStock.value = null;
}

function openSelectedStockPage() {
  if (!selectedStock.value?.code || typeof window === 'undefined') return;

  const stockHref = router.resolve(createStockRoute(selectedStock.value.code)).href;
  const absoluteHref = new URL(stockHref, window.location.href).toString();
  window.open(absoluteHref, '_blank', 'noopener,noreferrer');
}

function setActiveView(key) {
  activeView.value = key;
}

function shiftActiveView(direction) {
  const views = radarViews.value;
  const currentIndex = views.findIndex((view) => view.key === activeView.value);
  const nextIndex = (currentIndex + direction + views.length) % views.length;
  activeView.value = views[nextIndex].key;
}

function getTone(value) {
  return value >= 0 ? 'up' : 'down';
}

function getSignedLots(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number > 0 ? '+' : ''}${formatNumber(number)} 張`;
}

function formatStatusMinutes(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} 分鐘` : '分盤';
}

function formatDaysToExit(value) {
  const days = Number(value);
  return Number.isFinite(days) ? `距出關 ${formatNumber(days)} 天` : '出關日待確認';
}

function getSparklinePath(values) {
  if (!Array.isArray(values) || values.length < 2) return '';

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const width = 168;
  const height = 52;
  const padding = 5;
  const step = (width - padding * 2) / (values.length - 1);

  return values
    .map((value, index) => {
      const x = padding + index * step;
      const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function getSparklineEndPoint(values) {
  if (!Array.isArray(values) || values.length < 2) return { x: 0, y: 0 };

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const width = 168;
  const height = 52;
  const padding = 5;

  return {
    x: width - padding,
    y: height - padding - ((values.at(-1) - minValue) / range) * (height - padding * 2),
  };
}

function getPriceTrendTone(stock) {
  const values = stock?.priceTrend ?? [];
  if (values.length < 2) return 'flat';
  const change = values.at(-1) - values[0];
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
}

function getBarHeight(value) {
  const chartHeight = Number(value) >= 0 ? CHART_POSITIVE_HEIGHT : CHART_NEGATIVE_HEIGHT;
  return Math.max((Math.abs(value) / modalMaxAbsValue.value) * chartHeight, 4);
}

function getBarY(value) {
  return value >= 0 ? CHART_BASELINE_Y - getBarHeight(value) : CHART_BASELINE_Y;
}

function getBarValueY(value) {
  if (value >= 0) {
    return Math.max(getBarY(value) - 10, 18);
  }

  return CHART_BASELINE_Y + getBarHeight(value) + 18;
}
</script>

<template>
  <section class="page-shell disposition-radar-page">
    <section class="disposition-hero">
      <div class="disposition-hero-copy">
        <span class="hero-kicker">Disposition Chip Radar</span>
        <h1>處置股雷達</h1>
        <p>「進處置前」與「處置期間」主力籌碼雙軌對照，先分辨真吃貨、護盤套牢、倒貨與該避開的題材股。</p>
      </div>

      <div class="disposition-hero-metrics" aria-label="處置股雷達摘要">
        <div class="hero-metric is-up">
          <span>吃貨名單</span>
          <strong>{{ accumulationStocks.length }}</strong>
        </div>
        <div class="hero-metric is-down">
          <span>倒貨名單</span>
          <strong>{{ distributionStocks.length }}</strong>
        </div>
        <div class="hero-metric">
          <span>資料型態</span>
          <strong>{{ dataStatusLabel }}</strong>
          <small>{{ dataStatusNote }}</small>
        </div>
      </div>
    </section>

    <section
      class="radar-board"
      aria-label="處置期間主力買賣超對比"
      @keydown.left.prevent="shiftActiveView(-1)"
      @keydown.right.prevent="shiftActiveView(1)"
    >
      <div class="radar-switchbar">
        <button type="button" class="switch-arrow" aria-label="切換到上一區" @click="shiftActiveView(-1)">
          ‹
        </button>

        <div class="radar-segmented" role="tablist" aria-label="處置股分類">
          <button
            v-for="view in radarViews"
            :id="`disposition-tab-${view.key}`"
            :key="view.key"
            type="button"
            role="tab"
            class="view-tab"
            :class="[`is-${view.tone}`, { 'is-active': activeView === view.key }]"
            :aria-selected="activeView === view.key"
            :aria-controls="`disposition-panel-${view.key}`"
            @click="setActiveView(view.key)"
          >
            <span>{{ view.label }}</span>
            <strong>{{ view.count }} 檔</strong>
          </button>
        </div>

        <button type="button" class="switch-arrow" aria-label="切換到下一區" @click="shiftActiveView(1)">
          ›
        </button>
      </div>

      <article
        :id="`disposition-panel-${activeRadarView.key}`"
        class="disposition-column"
        :class="`is-${activeRadarView.key}`"
        role="tabpanel"
        :aria-labelledby="`disposition-tab-${activeRadarView.key}`"
      >
        <header class="column-header">
          <div>
            <p class="eyebrow">{{ activeRadarView.eyebrow }}</p>
            <h2>{{ activeRadarView.title }}</h2>
          </div>
          <div class="column-meta">
            <span class="column-count">{{ activeRadarView.count }} 檔</span>
            <span class="sort-pill">{{ activeRadarView.sortLabel }}</span>
          </div>
        </header>

        <div v-if="activeStocks.length" class="stock-card-list">
          <button
            v-for="(stock, index) in activeStocks"
            :key="stock.code"
            type="button"
            class="disposition-card"
            :class="`is-${getTone(stock.duringDispositionNetLots)}`"
            @click="openDetail(stock)"
          >
            <span class="case-ribbon">{{ stock.caseCode }}</span>
            <span class="rank-pill">#{{ index + 1 }}</span>
            <div class="card-topline">
              <div>
                <strong>{{ stock.code }} {{ stock.name }}</strong>
                <span>{{ stock.caseTitle }}</span>
              </div>
              <span class="status-pill">{{ formatStatusMinutes(stock.statusMinutes) }}</span>
            </div>

            <div class="primary-flow" :class="`is-${getTone(stock.duringDispositionNetLots)}`">
              {{ getSignedLots(stock.duringDispositionNetLots) }}
            </div>

            <div class="status-row">
              <span>處置 {{ formatStatusMinutes(stock.statusMinutes) }}撮合</span>
              <span>{{ formatDaysToExit(stock.daysToExit) }}</span>
            </div>

            <div class="chip-timeline">
              <div class="timeline-item" :class="`is-${getTone(stock.preDispositionNetLots)}`">
                <span>進處置前 10 天</span>
                <strong>{{ getSignedLots(stock.preDispositionNetLots) }}</strong>
              </div>
              <div class="timeline-item" :class="`is-${getTone(stock.duringDispositionNetLots)}`">
                <span>處置期間</span>
                <strong>{{ getSignedLots(stock.duringDispositionNetLots) }}</strong>
              </div>
            </div>

            <div class="sparkline-row">
              <span>{{ stock.priceNote }}</span>
              <svg class="sparkline" viewBox="0 0 168 52" aria-hidden="true">
                <path class="sparkline-grid" d="M5 26H163"></path>
                <path
                  class="sparkline-path"
                  :class="`is-${getPriceTrendTone(stock)}`"
                  :d="getSparklinePath(stock.priceTrend)"
                ></path>
                <circle
                  class="sparkline-dot"
                  :class="`is-${getPriceTrendTone(stock)}`"
                  :cx="getSparklineEndPoint(stock.priceTrend).x"
                  :cy="getSparklineEndPoint(stock.priceTrend).y"
                  r="3.2"
                ></circle>
              </svg>
            </div>
          </button>
        </div>

        <p v-else class="empty-state">目前沒有符合條件的處置股</p>
      </article>
    </section>

    <Teleport to="body">
      <div v-if="selectedStock" class="disposition-modal-backdrop" @click.self="closeDetail">
        <section
          class="disposition-modal is-clickable"
          role="dialog"
          aria-modal="true"
          tabindex="0"
          :aria-labelledby="`disposition-modal-${selectedStock.code}`"
          :aria-describedby="`disposition-modal-hint-${selectedStock.code}`"
          @click="openSelectedStockPage"
          @keydown.enter.prevent.self="openSelectedStockPage"
          @keydown.space.prevent.self="openSelectedStockPage"
        >
          <header class="modal-header">
            <div>
              <p class="eyebrow">Chip Flow Detail</p>
              <h2 :id="`disposition-modal-${selectedStock.code}`">{{ selectedStock.code }} {{ selectedStock.name }}</h2>
              <span>{{ selectedStock.caseCode }}｜{{ selectedStock.caseTitle }}</span>
            </div>
            <button type="button" class="modal-close-button" aria-label="關閉處置股明細" @click.stop="closeDetail">關閉</button>
          </header>

          <div class="modal-chart-wrap">
            <svg class="bar-chart" viewBox="0 0 420 255" role="img" :aria-label="`${selectedStock.code} 進處置前與處置期間主力買賣超比較`">
              <line class="chart-guide" x1="42" y1="38" x2="378" y2="38"></line>
              <line class="chart-axis" x1="42" :y1="CHART_BASELINE_Y" x2="378" :y2="CHART_BASELINE_Y"></line>
              <line class="chart-guide" x1="42" y1="170" x2="378" y2="170"></line>
              <g v-for="(bar, index) in modalBars" :key="bar.label">
                <rect
                  class="chart-bar"
                  :class="`is-${getTone(bar.value)}`"
                  :x="index === 0 ? 112 : 260"
                  :y="getBarY(bar.value)"
                  width="56"
                  :height="getBarHeight(bar.value)"
                  rx="6"
                ></rect>
                <text
                  class="chart-value"
                  :class="`is-${getTone(bar.value)}`"
                  :x="index === 0 ? 140 : 288"
                  :y="getBarValueY(bar.value)"
                  text-anchor="middle"
                >
                  {{ getSignedLots(bar.value) }}
                </text>
                <text class="chart-label" :x="index === 0 ? 140 : 288" y="232" text-anchor="middle">{{ bar.label }}</text>
              </g>
            </svg>
          </div>

          <div class="modal-summary-grid">
            <div class="modal-summary-item" :class="`is-${getTone(selectedStock.preDispositionNetLots)}`">
              <span>進處置前 10 天</span>
              <strong>{{ getSignedLots(selectedStock.preDispositionNetLots) }}</strong>
            </div>
            <div class="modal-summary-item" :class="`is-${getTone(selectedStock.duringDispositionNetLots)}`">
              <span>處置期間</span>
              <strong>{{ getSignedLots(selectedStock.duringDispositionNetLots) }}</strong>
            </div>
          </div>

          <p class="modal-thesis">{{ selectedStock.thesis }}</p>
          <div class="modal-action-row">
            <p :id="`disposition-modal-hint-${selectedStock.code}`" class="modal-open-hint">點擊彈窗空白處也可另開個股頁。</p>
            <button type="button" class="modal-open-button" @click.stop="openSelectedStockPage">開啟個股頁</button>
          </div>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.disposition-radar-page {
  display: grid;
  gap: 22px;
}

.disposition-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
  gap: 18px;
  align-items: stretch;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(190, 61, 42, 0.08), transparent 34%),
    linear-gradient(315deg, rgba(19, 136, 94, 0.08), transparent 32%),
    var(--surface-strong);
  box-shadow: var(--shadow);
}

.disposition-hero-copy {
  display: grid;
  align-content: center;
  gap: 12px;
  min-width: 0;
}

.hero-kicker,
.eyebrow {
  margin: 0;
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.disposition-hero h1 {
  margin: 0;
  color: var(--page-text);
  font-size: 4rem;
  line-height: 1;
  letter-spacing: 0;
}

.disposition-hero p {
  max-width: 760px;
  margin: 0;
  color: var(--text-soft);
  font-size: 1rem;
}

.disposition-hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-content: end;
}

.hero-metric {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-elevated);
}

.hero-metric span {
  color: var(--text-soft);
  font-size: 0.78rem;
  font-weight: 800;
}

.hero-metric strong {
  color: var(--page-text);
  font-size: 1.6rem;
  line-height: 1;
}

.hero-metric small {
  color: var(--text-soft);
  font-size: 0.74rem;
  font-weight: 800;
}

.hero-metric.is-up strong {
  color: var(--up);
}

.hero-metric.is-down strong {
  color: var(--down);
}

.radar-board {
  display: grid;
  gap: 16px;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.36)),
    var(--surface);
  box-shadow: var(--shadow);
}

.radar-switchbar {
  position: sticky;
  top: 10px;
  z-index: 5;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--border);
  border-radius: 8px 8px 0 0;
  background: color-mix(in srgb, var(--surface-strong) 94%, transparent);
  backdrop-filter: blur(14px);
}

.switch-arrow {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--page-text);
  background: var(--surface-elevated);
  font-size: 1.45rem;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
  transition:
    transform var(--ease-standard),
    border-color var(--ease-standard),
    box-shadow var(--ease-standard);
}

.switch-arrow:hover,
.switch-arrow:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(11, 105, 155, 0.32);
  box-shadow: var(--surface-hover-shadow);
  outline: none;
}

.radar-segmented {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-muted);
}

.view-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  transition:
    background var(--ease-standard),
    border-color var(--ease-standard),
    color var(--ease-standard),
    box-shadow var(--ease-standard);
}

.view-tab span {
  min-width: 0;
  overflow: hidden;
  font-size: 0.88rem;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.view-tab strong {
  flex: 0 0 auto;
  font-size: 0.82rem;
  font-weight: 950;
}

.view-tab.is-active {
  border-color: color-mix(in srgb, currentColor 34%, transparent);
  background: var(--surface-strong);
  box-shadow: 0 10px 24px rgba(19, 37, 55, 0.1);
}

.disposition-column {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 18px;
  border-top: 4px solid var(--border);
}

.disposition-column.is-accumulation {
  border-top-color: var(--up);
}

.disposition-column.is-distribution {
  border-top-color: var(--down);
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.column-header h2 {
  margin: 2px 0 0;
  color: var(--page-text);
  font-size: 1.45rem;
  line-height: 1.15;
  letter-spacing: 0;
}

.column-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.column-count,
.sort-pill,
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-soft);
  background: var(--surface-muted);
  font-size: 0.8rem;
  font-weight: 900;
  white-space: nowrap;
}

.stock-card-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
  gap: 12px;
  align-items: stretch;
}

.disposition-card {
  position: relative;
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
  min-height: 264px;
  padding: 15px;
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), transparent 54%),
    var(--surface-strong);
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: none;
  transition:
    transform var(--ease-standard),
    border-color var(--ease-standard),
    box-shadow var(--ease-standard);
}

.disposition-card:hover,
.disposition-card:focus-visible {
  transform: translateY(-2px);
  border-color: rgba(11, 105, 155, 0.28);
  box-shadow: 0 14px 30px rgba(20, 41, 61, 0.08);
  outline: none;
}

.disposition-card.is-up {
  border-left-color: var(--up);
}

.disposition-card.is-down {
  border-left-color: var(--down);
}

.case-ribbon {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: #fff;
  background: #223142;
  font-weight: 900;
  font-size: 0.78rem;
}

.rank-pill {
  position: absolute;
  top: 12px;
  right: 46px;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-soft);
  background: var(--surface-muted);
  font-size: 0.74rem;
  font-weight: 950;
}

.card-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-right: 76px;
}

.card-topline > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.card-topline strong {
  color: var(--page-text);
  font-size: 1.05rem;
  line-height: 1.25;
}

.card-topline span:not(.status-pill) {
  color: var(--text-soft);
  font-size: 0.84rem;
  font-weight: 700;
}

.primary-flow {
  font-size: 2.45rem;
  font-weight: 950;
  line-height: 0.95;
  letter-spacing: 0;
}

.is-up {
  color: var(--up);
}

.is-down {
  color: var(--down);
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-row span {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-soft);
  font-size: 0.78rem;
  font-weight: 800;
}

.chip-timeline {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.timeline-item {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 11px;
  border: 1px solid color-mix(in srgb, currentColor 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 5%, transparent);
}

.timeline-item span {
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 800;
}

.timeline-item strong {
  color: currentColor;
  font-size: 1rem;
  line-height: 1.1;
}

.sparkline-row {
  display: grid;
  grid-template-columns: minmax(88px, 0.8fr) minmax(140px, 1.2fr);
  gap: 10px;
  align-items: center;
  min-width: 0;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

.sparkline-row > span {
  color: var(--text-soft);
  font-size: 0.8rem;
  font-weight: 900;
}

.sparkline {
  width: 100%;
  height: 54px;
  overflow: visible;
}

.sparkline-grid {
  fill: none;
  stroke: var(--chart-grid);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.sparkline-path {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sparkline-path.is-up,
.sparkline-dot.is-up {
  stroke: var(--up);
  fill: var(--up);
}

.sparkline-path.is-down,
.sparkline-dot.is-down {
  stroke: var(--down);
  fill: var(--down);
}

.sparkline-path.is-flat,
.sparkline-dot.is-flat {
  stroke: var(--neutral);
  fill: var(--neutral);
}

.disposition-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(7, 16, 26, 0.58);
  backdrop-filter: blur(10px);
}

.disposition-modal {
  display: grid;
  gap: 18px;
  width: min(680px, 100%);
  max-height: min(90vh, 760px);
  overflow: auto;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-strong);
  box-shadow: 0 32px 88px rgba(0, 0, 0, 0.34);
}

.disposition-modal.is-clickable {
  cursor: pointer;
  transition:
    border-color var(--ease-standard),
    box-shadow var(--ease-standard),
    transform var(--ease-standard);
}

.disposition-modal.is-clickable:hover,
.disposition-modal.is-clickable:focus-visible {
  border-color: rgba(11, 105, 155, 0.3);
  box-shadow: 0 36px 96px rgba(0, 0, 0, 0.38);
  outline: none;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.modal-header h2 {
  margin: 4px 0 2px;
  color: var(--page-text);
  font-size: 1.7rem;
  line-height: 1.1;
}

.modal-header span {
  color: var(--text-soft);
  font-size: 0.9rem;
  font-weight: 800;
}

.modal-close-button {
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--page-text);
  font-weight: 900;
  cursor: pointer;
}

.modal-chart-wrap {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-muted);
}

.bar-chart {
  display: block;
  width: 100%;
  min-height: 230px;
}

.chart-axis {
  stroke: var(--chart-grid-strong);
  stroke-width: 1.4;
}

.chart-guide {
  stroke: var(--chart-grid);
  stroke-width: 1;
  stroke-dasharray: 4 6;
}

.chart-bar.is-up {
  fill: var(--up);
}

.chart-bar.is-down {
  fill: var(--down);
}

.chart-value {
  font-size: 0.86rem;
  font-weight: 900;
}

.chart-value.is-up {
  fill: var(--up);
}

.chart-value.is-down {
  fill: var(--down);
}

.chart-label {
  fill: var(--chart-text);
  font-size: 0.78rem;
  font-weight: 800;
}

.modal-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.modal-summary-item {
  display: grid;
  gap: 7px;
  min-width: 0;
  padding: 14px;
  border: 1px solid currentColor;
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.modal-summary-item span {
  color: var(--text-soft);
  font-size: 0.82rem;
  font-weight: 900;
}

.modal-summary-item strong {
  color: currentColor;
  font-size: 1.24rem;
  line-height: 1.1;
}

.modal-thesis {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.96rem;
  font-weight: 700;
}

.modal-open-hint {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.82rem;
  font-weight: 900;
}

.modal-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 2px;
}

.modal-open-button {
  flex: 0 0 auto;
  min-height: 42px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--brand), var(--brand-deep));
  color: #fff;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(11, 105, 155, 0.2);
  transition:
    transform var(--ease-standard),
    box-shadow var(--ease-standard);
}

.modal-open-button:hover,
.modal-open-button:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 18px 34px rgba(11, 105, 155, 0.26);
  outline: none;
}

.empty-state {
  margin: 0;
  padding: 24px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--text-soft);
  background: var(--surface-muted);
  font-weight: 900;
  text-align: center;
}

@media (max-width: 980px) {
  .disposition-hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .disposition-radar-page {
    gap: 16px;
  }

  .disposition-hero {
    padding: 20px;
  }

  .disposition-hero h1 {
    font-size: 2.55rem;
  }

  .modal-summary-grid {
    grid-template-columns: 1fr;
  }

  .disposition-hero-metrics {
    gap: 8px;
  }

  .hero-metric {
    padding: 10px;
  }

  .hero-metric strong {
    font-size: 1.35rem;
  }

  .radar-switchbar {
    top: 8px;
    grid-template-columns: 38px minmax(0, 1fr) 38px;
    gap: 7px;
    padding: 9px;
  }

  .switch-arrow {
    width: 38px;
    height: 38px;
  }

  .radar-segmented {
    gap: 4px;
    border-radius: 20px;
  }

  .view-tab {
    display: grid;
    justify-items: center;
    gap: 2px;
    min-height: 44px;
    padding: 6px 8px;
  }

  .view-tab span {
    font-size: 0.78rem;
  }

  .view-tab strong {
    font-size: 0.76rem;
  }

  .disposition-column {
    padding: 12px;
  }

  .column-header {
    display: grid;
  }

  .column-meta {
    justify-content: flex-start;
  }

  .stock-card-list {
    grid-template-columns: 1fr;
  }

  .disposition-card {
    min-height: 248px;
    padding: 14px;
  }

  .primary-flow {
    font-size: 2.05rem;
  }

  .modal-header {
    display: grid;
  }

  .modal-close-button {
    justify-self: start;
  }

  .modal-action-row {
    display: grid;
    justify-items: start;
  }
}
</style>

<style>
html[data-theme="dark"] .disposition-radar-page .disposition-hero {
  border-color: rgba(125, 211, 252, 0.12);
  background:
    linear-gradient(135deg, rgba(255, 141, 116, 0.08), transparent 38%),
    linear-gradient(315deg, rgba(79, 209, 165, 0.1), transparent 34%),
    linear-gradient(180deg, rgba(17, 28, 43, 0.98), rgba(11, 20, 32, 0.96));
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.28);
}

html[data-theme="dark"] .disposition-radar-page .hero-metric {
  border-color: rgba(148, 163, 184, 0.15);
  background: rgba(10, 18, 30, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

html[data-theme="dark"] .disposition-radar-page .radar-board {
  border-color: rgba(125, 211, 252, 0.14);
  background: linear-gradient(180deg, rgba(12, 23, 36, 0.98), rgba(8, 16, 27, 0.96));
  box-shadow: 0 28px 74px rgba(0, 0, 0, 0.34);
}

html[data-theme="dark"] .disposition-radar-page .radar-switchbar {
  border-bottom-color: rgba(148, 163, 184, 0.12);
  background: rgba(10, 18, 30, 0.9);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.03);
}

html[data-theme="dark"] .disposition-radar-page .switch-arrow,
html[data-theme="dark"] .disposition-radar-page .radar-segmented,
html[data-theme="dark"] .disposition-radar-page .column-count,
html[data-theme="dark"] .disposition-radar-page .sort-pill,
html[data-theme="dark"] .disposition-radar-page .status-pill,
html[data-theme="dark"] .disposition-radar-page .rank-pill,
html[data-theme="dark"] .disposition-radar-page .status-row span {
  border-color: rgba(148, 163, 184, 0.14);
  background: rgba(8, 17, 29, 0.82);
  color: #adc2d6;
}

html[data-theme="dark"] .disposition-radar-page .view-tab.is-active {
  background: rgba(17, 29, 44, 0.98);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 12px 28px rgba(0, 0, 0, 0.28);
}

html[data-theme="dark"] .disposition-radar-page .disposition-column {
  background: linear-gradient(180deg, rgba(14, 25, 39, 0.92), rgba(9, 18, 30, 0.88));
}

html[data-theme="dark"] .disposition-radar-page .disposition-card {
  border-color: rgba(148, 163, 184, 0.13);
  background: linear-gradient(180deg, rgba(24, 36, 52, 0.98), rgba(13, 24, 38, 0.98));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

html[data-theme="dark"] .disposition-radar-page .disposition-card:hover,
html[data-theme="dark"] .disposition-radar-page .disposition-card:focus-visible {
  border-color: rgba(125, 211, 252, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.045),
    0 16px 34px rgba(0, 0, 0, 0.28);
}

html[data-theme="dark"] .disposition-radar-page .case-ribbon {
  color: #07111c;
  background: #c8d8e8;
}

html[data-theme="dark"] .disposition-radar-page .timeline-item {
  background: color-mix(in srgb, currentColor 12%, rgba(6, 14, 24, 0.8));
}

html[data-theme="dark"] .disposition-radar-page .sparkline-row {
  border-top-color: rgba(148, 163, 184, 0.12);
}

html[data-theme="dark"] .disposition-radar-page .modal-chart-wrap,
html[data-theme="dark"] .disposition-radar-page .empty-state {
  border-color: rgba(148, 163, 184, 0.14);
  background: rgba(9, 18, 30, 0.82);
}

html[data-theme="dark"] .disposition-radar-page .modal-open-hint {
  color: #9fb2c5;
}

html[data-theme="dark"] .disposition-radar-page .modal-open-button {
  background: linear-gradient(135deg, #38bdf8, #0b699b);
  color: #06111c;
  box-shadow: 0 16px 34px rgba(56, 189, 248, 0.16);
}
</style>
