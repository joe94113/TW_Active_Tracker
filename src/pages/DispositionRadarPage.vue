<script setup>
import { computed, ref } from 'vue';
import { useSeoMeta } from '../composables/useSeoMeta';
import { formatNumber } from '../lib/formatters';

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

const selectedStock = ref(null);
const CHART_BASELINE_Y = 112;
const CHART_POSITIVE_HEIGHT = 74;
const CHART_NEGATIVE_HEIGHT = 58;

const accumulationStocks = computed(() =>
  mockDispositionStocks
    .filter((item) => item.duringDispositionNetLots > 0)
    .sort((left, right) => right.duringDispositionNetLots - left.duringDispositionNetLots),
);

const distributionStocks = computed(() =>
  mockDispositionStocks
    .filter((item) => item.duringDispositionNetLots < 0)
    .sort((left, right) => Math.abs(right.duringDispositionNetLots) - Math.abs(left.duringDispositionNetLots)),
);

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

function openDetail(stock) {
  selectedStock.value = stock;
}

function closeDetail() {
  selectedStock.value = null;
}

function getTone(value) {
  return value >= 0 ? 'up' : 'down';
}

function getSignedLots(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number > 0 ? '+' : ''}${formatNumber(number)} 張`;
}

function getAbsLots(value) {
  const number = Math.abs(Number(value));
  return Number.isFinite(number) ? `${formatNumber(number)} 張` : '-';
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
          <strong>Mock</strong>
        </div>
      </div>
    </section>

    <section class="disposition-columns" aria-label="處置期間主力買賣超對比">
      <article class="disposition-column is-accumulation">
        <header class="column-header">
          <div>
            <p class="eyebrow">Accumulation</p>
            <h2>主力吃貨區</h2>
          </div>
          <span class="column-count">{{ accumulationStocks.length }} 檔</span>
        </header>

        <div class="stock-card-list">
          <button
            v-for="stock in accumulationStocks"
            :key="stock.code"
            type="button"
            class="disposition-card"
            :class="`is-${getTone(stock.duringDispositionNetLots)}`"
            @click="openDetail(stock)"
          >
            <span class="case-ribbon">{{ stock.caseCode }}</span>
            <div class="card-topline">
              <div>
                <strong>{{ stock.code }} {{ stock.name }}</strong>
                <span>{{ stock.caseTitle }}</span>
              </div>
              <span class="status-pill">{{ stock.statusMinutes }} 分鐘</span>
            </div>

            <div class="primary-flow" :class="`is-${getTone(stock.duringDispositionNetLots)}`">
              {{ getSignedLots(stock.duringDispositionNetLots) }}
            </div>

            <div class="status-row">
              <span>處置 {{ stock.statusMinutes }} 分鐘撮合</span>
              <span>距出關 {{ stock.daysToExit }} 天</span>
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
      </article>

      <article class="disposition-column is-distribution">
        <header class="column-header">
          <div>
            <p class="eyebrow">Distribution</p>
            <h2>主力倒貨區</h2>
          </div>
          <span class="column-count">{{ distributionStocks.length }} 檔</span>
        </header>

        <div class="stock-card-list">
          <button
            v-for="stock in distributionStocks"
            :key="stock.code"
            type="button"
            class="disposition-card"
            :class="`is-${getTone(stock.duringDispositionNetLots)}`"
            @click="openDetail(stock)"
          >
            <span class="case-ribbon">{{ stock.caseCode }}</span>
            <div class="card-topline">
              <div>
                <strong>{{ stock.code }} {{ stock.name }}</strong>
                <span>{{ stock.caseTitle }}</span>
              </div>
              <span class="status-pill">{{ stock.statusMinutes }} 分鐘</span>
            </div>

            <div class="primary-flow" :class="`is-${getTone(stock.duringDispositionNetLots)}`">
              -{{ getAbsLots(stock.duringDispositionNetLots) }}
            </div>

            <div class="status-row">
              <span>處置 {{ stock.statusMinutes }} 分鐘撮合</span>
              <span>距出關 {{ stock.daysToExit }} 天</span>
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
      </article>
    </section>

    <Teleport to="body">
      <div v-if="selectedStock" class="disposition-modal-backdrop" @click.self="closeDetail">
        <section class="disposition-modal" role="dialog" aria-modal="true" :aria-labelledby="`disposition-modal-${selectedStock.code}`">
          <header class="modal-header">
            <div>
              <p class="eyebrow">Chip Flow Detail</p>
              <h2 :id="`disposition-modal-${selectedStock.code}`">{{ selectedStock.code }} {{ selectedStock.name }}</h2>
              <span>{{ selectedStock.caseCode }}｜{{ selectedStock.caseTitle }}</span>
            </div>
            <button type="button" class="modal-close-button" aria-label="關閉處置股明細" @click="closeDetail">關閉</button>
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
  font-size: clamp(2rem, 4vw, 4.4rem);
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

.hero-metric.is-up strong {
  color: var(--up);
}

.hero-metric.is-down strong {
  color: var(--down);
}

.disposition-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.disposition-column {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.disposition-column.is-accumulation {
  border-top: 4px solid var(--up);
}

.disposition-column.is-distribution {
  border-top: 4px solid var(--down);
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.column-header h2 {
  margin: 2px 0 0;
  color: var(--page-text);
  font-size: 1.45rem;
  line-height: 1.15;
  letter-spacing: 0;
}

.column-count,
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
  gap: 12px;
}

.disposition-card {
  position: relative;
  display: grid;
  gap: 14px;
  width: 100%;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 8px;
  background: var(--surface-strong);
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 16px 34px rgba(20, 41, 61, 0.07);
  transition:
    transform var(--ease-standard),
    border-color var(--ease-standard),
    box-shadow var(--ease-standard);
}

.disposition-card:hover,
.disposition-card:focus-visible {
  transform: translateY(-2px);
  border-color: rgba(11, 105, 155, 0.28);
  box-shadow: var(--surface-hover-shadow);
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

.card-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-right: 32px;
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
  font-size: clamp(2rem, 4.2vw, 3rem);
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
  border: 1px solid currentColor;
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 8%, transparent);
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

@media (max-width: 980px) {
  .disposition-hero,
  .disposition-columns {
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

  .disposition-column {
    padding: 12px;
  }

  .disposition-card {
    padding: 14px;
  }

  .primary-flow {
    font-size: 2.1rem;
  }

  .modal-header {
    display: grid;
  }

  .modal-close-button {
    justify-self: start;
  }
}
</style>
