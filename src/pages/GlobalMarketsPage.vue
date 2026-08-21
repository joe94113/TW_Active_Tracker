<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import {
  ArrowDownRightIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ChartBarSquareIcon,
  CircleStackIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
} from '@heroicons/vue/24/outline';
import MiniTrendChart from '../components/MiniTrendChart.vue';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { getDataFreshnessStatus } from '../lib/dataFreshness';
import { hasFiniteNumber, hasText, toFiniteNumber } from '../lib/dataAvailability';
import { formatDate, formatNumber, formatPercent } from '../lib/formatters';
import { buildTaiwanMarketBias } from '../lib/taiwanMarketBias';

const CURRENCY_CODES = {
  'USDJPY=X': 'JPY',
  'USDKRW=X': 'KRW',
  'USDCNY=X': 'CNY',
  'USDTWD=X': 'TWD',
};

const DRIVER_DEFINITIONS = [
  { symbol: '^IXIC', icon: ChartBarSquareIcon },
  { symbol: '^N225', icon: CircleStackIcon },
  { symbol: 'USDTWD=X', icon: CurrencyDollarIcon },
  { symbol: '^TNX', icon: BuildingLibraryIcon },
  { symbol: 'CL=F', icon: BanknotesIcon },
];

const { globalMarkets, dashboard, manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();
const activeSection = ref('indices');

onMounted(loadGlobalData);

const sections = computed(() => (globalMarkets.value?.sections ?? [])
  .map((section) => ({
    ...section,
    items: (section.items ?? []).filter((item) => hasFiniteNumber(item.close)),
  }))
  .filter((section) => section.items.length));

watch(sections, (items) => {
  if (!items.some((item) => item.key === activeSection.value)) activeSection.value = items[0]?.key ?? '';
}, { immediate: true });

const activeRows = computed(() => sections.value.find((section) => section.key === activeSection.value)?.items ?? []);
const marketItemMap = computed(() => new Map(sections.value.flatMap((section) => section.items).map((item) => [item.symbol, item])));
const currencies = computed(() => Object.entries(CURRENCY_CODES).map(([symbol, code]) => ({
  code,
  ...(marketItemMap.value.get(symbol) ?? {}),
})).filter((item) => hasFiniteNumber(item.close)));
const latestForeignFlow = computed(() => [...(dashboard.value?.法人追蹤?.每日法人合計 ?? [])]
  .sort((a, b) => String(b.日期 ?? '').localeCompare(String(a.日期 ?? '')))[0] ?? null);
const nasdaq = computed(() => marketItemMap.value.get('^IXIC') ?? null);
const treasury = computed(() => marketItemMap.value.get('^TNX') ?? null);
const bias = computed(() => buildTaiwanMarketBias({
  currencies: currencies.value,
  foreignFlow: latestForeignFlow.value,
  nasdaq: nasdaq.value,
  treasury10Year: treasury.value,
}));

const freshness = computed(() => getDataFreshnessStatus({
  generatedAt: globalMarkets.value?.generatedAt ?? manifest.value?.generatedAt,
  marketDate: globalMarkets.value?.marketDate,
}));
const globalView = computed(() => freshness.value.isStale ? {
  ...bias.value,
  label: '歷史回看',
  state: 'stale',
  summary: `國際市場資料停在 ${formatDate(globalMarkets.value?.marketDate)}，不把歷史變動當作今日風向。`,
} : bias.value);
const globalHeadline = computed(() => freshness.value.isStale
  ? '全球風向：歷史回看'
  : `今日全球風向：${globalView.value.label}`);

const driverCards = computed(() => DRIVER_DEFINITIONS.map((definition) => {
  const item = marketItemMap.value.get(definition.symbol);
  if (!item || !hasFiniteNumber(item.close)) return null;
  return {
    ...item,
    icon: definition.icon,
    value: formatQuote(item),
    impact: getTaiwanImpact(item),
  };
}).filter(Boolean));

const impactRows = computed(() => [
  buildImpact('^IXIC', '科技股'),
  buildImpact('^TNX', '成長股'),
  buildImpact('USDTWD=X', '外資資金'),
  buildImpact('CL=F', '航運 / 製造'),
].filter(Boolean).slice(0, 3));

const changeSummary = computed(() => {
  const summary = globalMarkets.value?.summary ?? {};
  return [
    summary.strongest && hasFiniteNumber(summary.strongest.changePercent)
      ? { label: '最強', item: summary.strongest, icon: ArrowUpRightIcon, tone: 'up' }
      : null,
    summary.weakest && hasFiniteNumber(summary.weakest.changePercent)
      ? { label: '最弱', item: summary.weakest, icon: ArrowDownRightIcon, tone: 'down' }
      : null,
    summary.mostVolatile && hasFiniteNumber(summary.mostVolatile.changePercent)
      ? { label: '波動最大', item: summary.mostVolatile, icon: ArrowPathIcon, tone: 'warning' }
      : null,
    treasury.value && hasFiniteNumber(getBasisPointChange(treasury.value))
      ? { label: '需留意', item: treasury.value, icon: ExclamationTriangleIcon, tone: 'warning', basisPoints: true }
      : null,
  ].filter(Boolean);
});

useSeoMeta({
  title: '國際市場 | 全球風向儀',
  description: '把國際股市、原物料、外匯與對台股的可能影響整理在同一頁。',
});

function formatQuote(item) {
  const value = formatNumber(item?.close);
  return item?.unit === 'percent' && value !== '-' ? `${value}%` : value;
}

function getBasisPointChange(item) {
  const direct = toFiniteNumber(item?.changeBasisPoints);
  if (direct !== null) return direct;
  const change = toFiniteNumber(item?.change);
  return change === null ? null : change * 100;
}

function getTaiwanImpact(item) {
  const change = toFiniteNumber(item?.changePercent);
  if (change === null) return { label: '中性', tone: 'neutral' };
  if (item.symbol === 'USDTWD=X') return change < 0 ? { label: '有利', tone: 'safe' } : { label: '留意', tone: 'warning' };
  if (item.symbol === '^TNX') return getBasisPointChange(item) <= 0 ? { label: '有利', tone: 'safe' } : { label: '留意', tone: 'warning' };
  if (item.symbol === 'CL=F') return change < 0 ? { label: '成本壓力減輕', tone: 'safe' } : { label: '成本壓力', tone: 'warning' };
  if (['^IXIC', '^SOX'].includes(item.symbol)) return change > 0 ? { label: '有利', tone: 'safe' } : { label: '壓力', tone: 'risk' };
  return Math.abs(change) < 0.2 ? { label: '中性', tone: 'neutral' } : change > 0 ? { label: '中性偏多', tone: 'safe' } : { label: '中性偏空', tone: 'warning' };
}

function buildImpact(symbol, group) {
  const item = marketItemMap.value.get(symbol);
  if (!item || !hasFiniteNumber(item.changePercent)) return null;
  const impact = getTaiwanImpact(item);
  return { group, item, impact, reason: buildImpactReason(item) };
}

function buildImpactReason(item) {
  const change = toFiniteNumber(item.changePercent);
  if (item.symbol === '^IXIC') return `NASDAQ ${change >= 0 ? '上漲' : '下跌'} ${formatPercent(Math.abs(change))}，影響電子權值股氣氛。`;
  if (item.symbol === '^TNX') return `10 年債殖利率變動 ${formatBasisPoints(getBasisPointChange(item))}，影響成長股評價。`;
  if (item.symbol === 'USDTWD=X') return `美元 / 台幣 ${change < 0 ? '下降，台幣升值' : '上升，台幣貶值'}，影響外資進出。`;
  if (item.symbol === 'CL=F') return `WTI 原油${change >= 0 ? '上漲' : '下跌'} ${formatPercent(Math.abs(change))}，影響航運與製造成本。`;
  return '';
}

function formatBasisPoints(value) {
  const number = toFiniteNumber(value);
  if (number === null) return '';
  return `${number >= 0 ? '+' : ''}${formatNumber(number)} 個基點`;
}

function getTrendTone(item) {
  return (toFiniteNumber(item?.changePercent) ?? 0) >= 0 ? 'up' : 'down';
}
</script>

<template>
  <section class="investor-page global-redesign">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(sections.length)"
      empty-message="國際市場目前沒有可確認的資料。"
    />

    <template v-if="sections.length">
      <header class="global-heading">
        <div class="global-title-row"><GlobeAltIcon /><h1>國際市場 - 全球風向儀</h1><span>更新日 {{ formatDate(globalMarkets?.marketDate) }}</span></div>
        <h2 :class="`is-${globalView.state}`">{{ globalHeadline }}</h2>
        <p>{{ globalView.summary }}</p>
      </header>

      <section v-if="driverCards.length" class="global-driver-strip ir-surface">
        <article v-for="item in driverCards" :key="item.symbol" class="global-driver">
          <component :is="item.icon" />
          <div><strong>{{ item.shortLabel || item.label }}</strong><span>{{ item.value }}</span><p :class="(item.changePercent ?? 0) >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatPercent(item.changePercent) }}</p></div>
          <em :class="`ir-text-${item.impact.tone}`">{{ item.impact.label }}</em>
        </article>
      </section>

      <p v-if="freshness.isStale" class="ir-data-note is-warning">下方全為 {{ formatDate(globalMarkets?.marketDate) }} 的歷史資料，只用來回看當日全球資金方向。</p>

      <div class="global-content-grid">
        <section class="ir-surface market-table-panel">
          <div class="ir-tabs global-tabs">
            <button v-for="section in sections" :key="section.key" type="button" class="ir-tab" :class="{ 'is-active': activeSection === section.key }" @click="activeSection = section.key">{{ section.title }}</button>
          </div>
          <div class="ir-table-wrap">
            <table class="ir-table global-table">
              <thead><tr><th>市場</th><th class="is-number">最新</th><th class="is-number">當日</th><th class="is-number">5 日</th><th class="is-number">20 日</th><th class="is-center">走勢</th><th class="is-center">對台股可能影響</th></tr></thead>
              <tbody>
                <tr v-for="item in activeRows" :key="item.symbol">
                  <td><strong class="ir-stock-code">{{ item.label }}</strong><span class="ir-stock-name">{{ formatDate(item.marketDate) }}</span></td>
                  <td class="is-number"><strong>{{ formatQuote(item) }}</strong></td>
                  <td class="is-number" :class="(item.changePercent ?? 0) >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatPercent(item.changePercent) }}</td>
                  <td class="is-number" :class="(item.return5 ?? 0) >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ hasFiniteNumber(item.return5) ? formatPercent(item.return5) : '' }}</td>
                  <td class="is-number" :class="(item.return20 ?? 0) >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ hasFiniteNumber(item.return20) ? formatPercent(item.return20) : '' }}</td>
                  <td class="is-center"><MiniTrendChart v-if="item.sparkline?.length >= 2" :values="item.sparkline.map((point) => point.close)" :tone="getTrendTone(item)" /></td>
                  <td class="is-center"><span class="ir-status" :class="`is-${getTaiwanImpact(item).tone}`">{{ getTaiwanImpact(item).label }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="ir-note global-footnote">漲跌幅以各市場原幣計算；對台股影響是依當日變動方向整理的觀察。</p>
        </section>

        <aside class="global-side">
          <section v-if="impactRows.length" class="ir-surface ir-section">
            <div class="ir-section-head"><h2>對台股的三個影響</h2></div>
            <div class="ir-list">
              <article v-for="item in impactRows" :key="item.group" class="ir-list-row impact-row">
                <ChartBarSquareIcon /><div><strong>{{ item.group }}</strong><p>{{ item.reason }}</p></div><span :class="`ir-text-${item.impact.tone}`">{{ item.impact.label }}</span>
              </article>
            </div>
          </section>

          <section v-if="changeSummary.length" class="ir-surface ir-section">
            <div class="ir-section-head"><h2>{{ freshness.isStale ? '資料日最大變化' : '今日最大變化' }}</h2></div>
            <div class="ir-list">
              <article v-for="row in changeSummary" :key="`${row.label}-${row.item.symbol}`" class="ir-list-row change-row">
                <component :is="row.icon" :class="`is-${row.tone}`" /><span>{{ row.label }}</span><strong>{{ row.item.shortLabel || row.item.label }}</strong>
                <em :class="row.basisPoints ? 'ir-text-warning' : ((row.item.changePercent ?? 0) >= 0 ? 'ir-text-up' : 'ir-text-down')">{{ row.basisPoints ? formatBasisPoints(getBasisPointChange(row.item)) : formatPercent(row.item.changePercent) }}</em>
              </article>
            </div>
          </section>

          <RouterLink to="/asian-currency-watch" class="ir-button global-asia-link">查看每日亞幣觀察<ArrowRightIcon /></RouterLink>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.global-redesign { gap: 12px; }
.global-heading { display: grid; gap: 6px; padding: 3px 2px 4px; }.global-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }.global-title-row > svg { width: 28px; color: var(--ir-brand); }.global-title-row h1 { margin: 0; color: var(--ir-text); font-size: clamp(1.45rem, 2.2vw, 2rem); }.global-title-row span { color: var(--ir-soft); font-size: .75rem; }.global-heading h2 { margin: 8px 0 0; color: var(--ir-text); font-size: 1.35rem; }.global-heading h2.is-bullish { color: #23b58a; }.global-heading h2.is-bearish { color: #f06f5e; }.global-heading h2.is-stale, .global-heading h2.is-insufficient { color: var(--large); }.global-heading > p { margin: 0; color: var(--ir-soft); font-size: .82rem; line-height: 1.5; }
.global-driver-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }.global-driver { display: grid; grid-template-columns: 25px minmax(0, 1fr) auto; gap: 9px; align-items: start; min-width: 0; padding: 14px; border-right: 1px solid var(--ir-line); }.global-driver:last-child { border-right: 0; }.global-driver > svg { width: 23px; color: var(--ir-brand); }.global-driver strong, .global-driver span { display: block; }.global-driver strong { color: var(--ir-text); font-size: .8rem; }.global-driver span { margin-top: 4px; color: var(--ir-text); font-size: 1rem; font-weight: 900; }.global-driver p { margin: 2px 0 0; font-size: .72rem; font-weight: 800; }.global-driver em { align-self: center; font-size: .72rem; font-style: normal; font-weight: 900; }
.global-content-grid { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(310px, .95fr); gap: 12px; align-items: start; }.market-table-panel { min-width: 0; overflow: hidden; }.global-tabs { min-height: 50px; padding: 0 12px; border-bottom: 1px solid var(--ir-line); }.global-tabs .ir-tab { min-width: 120px; border-width: 0 0 2px; border-radius: 0; }.global-table { min-width: 840px; }.global-table th:first-child { width: 180px; }.global-table th:nth-child(2) { width: 120px; }.global-table th:nth-child(3), .global-table th:nth-child(4), .global-table th:nth-child(5) { width: 90px; }.global-table th:nth-child(6) { width: 125px; }.global-table th:last-child { width: 150px; }.global-table :deep(.mini-trend-chart) { width: 94px; height: 38px; margin: 0 auto; }.global-footnote { padding: 10px 13px 13px; }
.global-side { display: grid; gap: 12px; }.impact-row { grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; }.impact-row > svg { width: 22px; color: var(--ir-brand); }.impact-row p { margin: 4px 0 0; color: var(--ir-soft); font-size: .72rem; line-height: 1.45; }.impact-row > span { font-size: .75rem; font-weight: 900; }.change-row { grid-template-columns: 20px 64px minmax(0, 1fr) auto; align-items: center; }.change-row > svg { width: 18px; color: var(--ir-brand); }.change-row > svg.is-up { color: var(--up); }.change-row > svg.is-down { color: var(--down); }.change-row > svg.is-warning { color: var(--large); }.change-row span { color: var(--ir-soft); font-size: .72rem; }.change-row strong { font-size: .8rem; }.change-row em { font-size: .75rem; font-style: normal; font-weight: 900; }.global-asia-link { width: 100%; min-height: 48px; border-color: var(--ir-brand); color: var(--ir-brand); }

@media (max-width: 1080px) { .global-content-grid { grid-template-columns: 1fr; }.global-side { grid-template-columns: 1fr 1fr; }.global-asia-link { grid-column: 1 / -1; }.global-driver-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }.global-driver:nth-child(3n) { border-right: 0; } }
@media (max-width: 720px) { .global-driver-strip { grid-template-columns: 1fr 1fr; }.global-driver:nth-child(3n) { border-right: 1px solid var(--ir-line); }.global-driver:nth-child(2n) { border-right: 0; }.global-side { grid-template-columns: 1fr; }.global-asia-link { grid-column: auto; }.global-table { min-width: 0; }.global-table th:first-child { width: 34%; }.global-table th:nth-child(2) { width: 24%; }.global-table th:nth-child(3) { width: 18%; }.global-table th:nth-child(7) { width: 24%; }.global-table th:nth-child(4), .global-table td:nth-child(4), .global-table th:nth-child(5), .global-table td:nth-child(5), .global-table th:nth-child(6), .global-table td:nth-child(6) { display: none; }.global-table th, .global-table td { padding-inline: 7px; }.global-table .ir-status { padding-inline: 5px; font-size: .66rem; text-align: center; } }
@media (max-width: 480px) { .global-driver-strip { grid-template-columns: 1fr; }.global-driver, .global-driver:nth-child(3n), .global-driver:nth-child(2n) { border-right: 0; border-bottom: 1px solid var(--ir-line); }.global-driver:last-child { border-bottom: 0; }.global-title-row { align-items: flex-start; }.global-title-row h1 { flex: 1; } }
</style>
