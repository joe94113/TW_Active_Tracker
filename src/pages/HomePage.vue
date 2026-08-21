<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import {
  ArrowRightIcon,
  BellAlertIcon,
  BookmarkSquareIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChartBarSquareIcon,
  CircleStackIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  GlobeAsiaAustraliaIcon,
  MagnifyingGlassIcon,
  PresentationChartLineIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
} from '@heroicons/vue/24/outline';
import StatusCard from '../components/StatusCard.vue';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import { useGlobalData } from '../composables/useGlobalData';
import { useLiveMarketOverview } from '../composables/useLiveMarketOverview';
import { useSeoMeta } from '../composables/useSeoMeta';
import { getDataFreshnessStatus } from '../lib/dataFreshness';
import { hasFiniteNumber, hasText, toFiniteNumber, uniqueBy } from '../lib/dataAvailability';
import { formatAmount, formatDate, formatNumber, formatPercent, formatPriceDelta } from '../lib/formatters';
import { buildTaiwanMarketBias } from '../lib/taiwanMarketBias';

const MARKET_CARD_DEFINITIONS = [
  { symbol: '^TWII', label: '台股加權', icon: PresentationChartLineIcon },
  { symbol: '^SOX', label: '費城半導體', icon: CircleStackIcon },
  { symbol: '^IXIC', label: 'NASDAQ', icon: ChartBarSquareIcon },
  { symbol: 'USDTWD=X', label: '美元 / 台幣', icon: CurrencyDollarIcon },
  { symbol: '^TNX', label: '美國 10 年債', icon: BuildingLibraryIcon },
];

const CURRENCY_DEFINITIONS = [
  { symbol: 'USDJPY=X', code: 'JPY' },
  { symbol: 'USDKRW=X', code: 'KRW' },
  { symbol: 'USDCNY=X', code: 'CNY' },
  { symbol: 'USDTWD=X', code: 'TWD' },
];

const {
  dashboard,
  globalMarkets,
  stockList,
  productEvents,
  earningsCalendar,
  manifest,
  isLoading,
  errorMessage,
  loadGlobalData,
} = useGlobalData();
const { isFavorite, toggleFavorite } = useFavoriteStocks();

const baseMarketOverview = computed(() => dashboard.value?.市場總覽 ?? null);
const {
  marketOverview,
  isLiveLoading,
  refreshLiveMarketData,
  startAutoRefresh,
} = useLiveMarketOverview(baseMarketOverview);

onMounted(async () => {
  await loadGlobalData();
  await refreshLiveMarketData();
  startAutoRefresh();
});

const marketItemMap = computed(() => new Map(
  (globalMarkets.value?.sections ?? [])
    .flatMap((section) => section.items ?? [])
    .filter((item) => hasFiniteNumber(item.close))
    .map((item) => [item.symbol, item]),
));

const latestForeignFlow = computed(() => [...(dashboard.value?.法人追蹤?.每日法人合計 ?? [])]
  .sort((left, right) => String(right.日期 ?? '').localeCompare(String(left.日期 ?? '')))[0] ?? null);

const currencies = computed(() => CURRENCY_DEFINITIONS.map((definition) => ({
  ...definition,
  ...(marketItemMap.value.get(definition.symbol) ?? {}),
})).filter((item) => hasFiniteNumber(item.close)));

const nasdaq = computed(() => marketItemMap.value.get('^IXIC') ?? null);
const treasury10Year = computed(() => marketItemMap.value.get('^TNX') ?? null);
const bias = computed(() => buildTaiwanMarketBias({
  currencies: currencies.value,
  foreignFlow: latestForeignFlow.value,
  nasdaq: nasdaq.value,
  treasury10Year: treasury10Year.value,
}));

const referenceDate = computed(() => globalMarkets.value?.marketDate
  ?? latestForeignFlow.value?.日期
  ?? marketOverview.value?.資料日期
  ?? null);

const freshness = computed(() => getDataFreshnessStatus({
  generatedAt: globalMarkets.value?.generatedAt ?? dashboard.value?.generatedAt ?? manifest.value?.generatedAt,
  marketDate: referenceDate.value,
}));

const marketView = computed(() => {
  if (freshness.value.isStale) {
    return {
      label: '歷史回看',
      state: 'stale',
      summary: `國際因子目前更新到 ${formatDate(referenceDate.value)}，為避免誤判，今日多空暫不下結論。`,
    };
  }
  return bias.value;
});

const marketHeadline = computed(() => marketView.value.state === 'stale'
  ? '台股狀態：歷史回看'
  : `今日台股：${marketView.value.label}`);

const signalCards = computed(() => {
  const cards = [];
  if (latestForeignFlow.value && hasFiniteNumber(latestForeignFlow.value.外資買賣超)) {
    const value = toFiniteNumber(latestForeignFlow.value.外資買賣超);
    cards.push({
      key: 'foreign',
      label: '外資買賣超',
      icon: UsersIcon,
      value: formatAmount(value),
      change: value,
      date: latestForeignFlow.value.日期,
      note: value > 0 ? '資金面有支持' : value < 0 ? '資金面有壓力' : '資金面持平',
      tone: value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral',
    });
  }

  MARKET_CARD_DEFINITIONS.forEach((definition) => {
    let item = marketItemMap.value.get(definition.symbol) ?? null;
    if (definition.symbol === '^TWII') {
      const summary = marketOverview.value?.大盤摘要 ?? {};
      if (hasFiniteNumber(summary.加權指數)) {
        item = {
          symbol: '^TWII',
          close: summary.加權指數,
          change: summary.漲跌點數,
          changePercent: summary.漲跌幅,
          marketDate: summary.資料日期 ?? marketOverview.value?.資料日期,
        };
      }
    }
    if (!item || !hasFiniteNumber(item.close)) return;

    cards.push({
      key: definition.symbol,
      label: definition.label,
      icon: definition.icon,
      value: definition.symbol === '^TNX' ? `${formatNumber(item.close)}%` : formatNumber(item.close),
      change: toFiniteNumber(item.changePercent),
      date: item.marketDate,
      note: buildSignalNote(definition.symbol, item),
      tone: getSignalTone(definition.symbol, item),
    });
  });
  return uniqueBy(cards, (item) => item.key).slice(0, 5);
});

const stockIndexMap = computed(() => new Map((stockList.value ?? []).map((item) => [String(item.code), item])));
const observationStocks = computed(() => (marketOverview.value?.強勢股 ?? [])
  .map((row) => {
    const code = String(row.代號 ?? row.code ?? '');
    const indexed = stockIndexMap.value.get(code) ?? {};
    const changePercent = toFiniteNumber(row.漲跌幅 ?? indexed.changePercent);
    return {
      code,
      name: row.名稱 ?? indexed.name,
      industry: indexed.industryName,
      close: toFiniteNumber(row.收盤價 ?? indexed.close),
      changePercent,
      reason: indexed.topSignalTitle ?? indexed.technicalSignals?.[0]?.title ?? null,
      risk: getStockRisk(indexed),
    };
  })
  .filter((item) => hasText(item.code) && hasText(item.name) && hasFiniteNumber(item.close))
  .slice(0, 3));

const topics = computed(() => (dashboard.value?.題材雷達?.topics ?? [])
  .filter((item) => hasText(item.title) && hasFiniteNumber(item.score))
  .slice(0, 5));
const topicMaxScore = computed(() => Math.max(...topics.value.map((item) => Number(item.score) || 0), 1));

const focusItems = computed(() => {
  const overviewNotes = marketOverview.value?.觀察摘要 ?? [];
  const topTopic = topics.value[0] ?? null;
  const volatile = globalMarkets.value?.summary?.mostVolatile ?? null;
  return [
    hasText(overviewNotes[0]) ? {
      key: 'market',
      label: '市場 / 族群',
      title: overviewNotes[0],
      icon: ChartBarIcon,
      to: '/industry-pulse',
    } : null,
    topTopic ? {
      key: 'topic',
      label: '題材輪動',
      title: `${topTopic.title}：${topTopic.observation ?? '仍在熱度前段'}`,
      icon: SparklesIcon,
      to: '/themes',
    } : null,
    volatile && hasFiniteNumber(volatile.changePercent) ? {
      key: 'risk',
      label: '國際變數',
      title: `${volatile.label}當日${volatile.changePercent >= 0 ? '上漲' : '下跌'} ${formatPercent(Math.abs(volatile.changePercent))}，波動度最高。`,
      icon: ExclamationTriangleIcon,
      to: '/global-markets',
    } : null,
  ].filter(Boolean).slice(0, 3);
});

const todayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const futureEvents = computed(() => uniqueBy([
  ...(productEvents.value?.items ?? []).map((item) => ({
    key: `product-${item.slug ?? item.startDate}-${item.title}`,
    date: item.startDate,
    title: item.title,
    note: item.note,
    url: item.url,
    tone: item.tone,
  })),
  ...(earningsCalendar.value?.items ?? []).map((item) => ({
    key: `earnings-${item.code}-${item.expectedDate}`,
    date: item.expectedDate,
    title: `${item.code} ${item.companyName} ${item.type}`,
    note: item.quarter,
    tone: 'normal',
  })),
], (item) => item.key)
  .filter((item) => hasText(item.date) && item.date >= todayKey)
  .sort((left, right) => left.date.localeCompare(right.date))
  .slice(0, 4));

const shortcuts = computed(() => [
  { label: '卡位雷達', note: '找剛起漲機會', to: '/entry-radar', icon: SparklesIcon },
  { label: '條件掃描', note: '依條件找股', to: '/scanner', icon: MagnifyingGlassIcon },
  { label: '個股頁', note: '查價格與籌碼', to: observationStocks.value?.[0]?.code ? `/stocks/${observationStocks.value[0].code}` : '/radar', icon: ChartBarSquareIcon },
  { label: '明日觀察', note: '整理隔日重點', to: '/watchlist', icon: BookmarkSquareIcon },
  { label: '國際市場', note: '盤前看全球風向', to: '/global-markets', icon: GlobeAsiaAustraliaIcon },
  { label: '每日亞幣', note: '快看台股背景', to: '/asian-currency-watch', icon: CurrencyDollarIcon },
]);

useSeoMeta({
  title: '台股主動通',
  description: '一頁看懂台股風向、重要訊號、觀察股與題材強弱。',
});

function getSignalTone(symbol, item) {
  const change = toFiniteNumber(item.changePercent);
  if (change === null || Math.abs(change) < 0.03) return 'neutral';
  if (symbol === 'USDTWD=X' || symbol === '^TNX') return change < 0 ? 'positive' : 'warning';
  return change > 0 ? 'positive' : 'negative';
}

function buildSignalNote(symbol, item) {
  const change = toFiniteNumber(item.changePercent);
  if (change === null) return '';
  if (symbol === 'USDTWD=X') return change < 0 ? '台幣升值，資金氣氛較有利' : '台幣貶值，留意外資壓力';
  if (symbol === '^TNX') return change < 0 ? '利率壓力減輕' : '成長股評價承壓';
  return change > 0 ? '對台股氣氛較有利' : '對台股氣氛偏壓抑';
}

function getStockRisk(stock) {
  if (stock.isUnderDisposition || stock.hasChangedTrading || (stock.warnings?.length ?? 0) >= 2) return { label: '高', tone: 'risk' };
  if (stock.hasAttentionWarning || stock.hasMarginSurge || (toFiniteNumber(stock.return20) ?? 0) >= 35) return { label: '中高', tone: 'warning' };
  if (stock.topSignalTone === 'down') return { label: '中', tone: 'warning' };
  return { label: '低', tone: 'safe' };
}
</script>

<template>
  <section class="investor-page home-redesign">
    <StatusCard
      :is-loading="isLoading && !dashboard"
      :error-message="!dashboard ? errorMessage : ''"
      :has-data="Boolean(dashboard)"
      empty-message="首頁目前沒有可顯示的市場資料。"
    />

    <template v-if="dashboard">
      <p class="home-data-date">資料日 {{ formatDate(referenceDate) }}<span v-if="isLiveLoading"> · 正在確認盤中價格</span></p>

      <section class="home-market-hero ir-surface">
        <div class="home-market-title">
          <div class="market-target"><BellAlertIcon /></div>
          <div>
            <h1>{{ marketHeadline }}</h1>
            <p>{{ marketView.summary }}</p>
          </div>
          <RouterLink to="/global-markets" class="ir-button">市場總覽<ArrowRightIcon /></RouterLink>
        </div>

        <div v-if="signalCards.length" class="home-signal-grid">
          <article v-for="item in signalCards" :key="item.key" class="home-signal-item">
            <component :is="item.icon" />
            <div>
              <span>{{ item.label }}<small v-if="item.date">{{ formatDate(item.date) }}</small></span>
              <strong>{{ item.value }}</strong>
              <p v-if="hasFiniteNumber(item.change)" :class="item.change >= 0 ? 'ir-text-up' : 'ir-text-down'">
                {{ item.key === 'foreign' ? '' : formatPercent(item.change) }}
              </p>
              <em :class="`is-${item.tone}`">{{ item.note }}</em>
            </div>
          </article>
        </div>
      </section>

      <div class="home-main-grid">
        <section v-if="focusItems.length" class="ir-surface ir-section">
          <div class="ir-section-head"><h2>{{ freshness.isStale ? '資料日先看 3 件事' : '今天先看 3 件事' }}</h2></div>
          <div class="focus-list">
            <RouterLink v-for="item in focusItems" :key="item.key" :to="item.to" class="focus-row">
              <component :is="item.icon" />
              <span>{{ item.label }}</span>
              <strong>{{ item.title }}</strong>
              <ArrowRightIcon />
            </RouterLink>
          </div>
        </section>

        <section v-if="observationStocks.length" class="ir-surface ir-section">
          <div class="ir-section-head">
            <div><h2>{{ freshness.isStale ? '資料日觀察股' : '今日觀察股' }}</h2><p>由市場強勢股中擷取</p></div>
            <RouterLink to="/watchlist" class="home-text-link">前往明日觀察<ArrowRightIcon /></RouterLink>
          </div>
          <div class="ir-table-wrap">
            <table class="ir-table home-stock-table">
              <thead><tr><th>#</th><th>股票</th><th class="is-number">漲跌</th><th>觀察理由</th><th class="is-center">風險</th><th class="is-center">自選</th></tr></thead>
              <tbody>
                <tr v-for="(stock, index) in observationStocks" :key="stock.code">
                  <td><span class="ir-rank" :class="{ 'is-top': index === 0 }">{{ index + 1 }}</span></td>
                  <td><RouterLink :to="`/stocks/${stock.code}`"><strong class="ir-stock-code">{{ stock.code }} {{ stock.name }}</strong><span v-if="stock.industry" class="ir-stock-name">{{ stock.industry }}</span></RouterLink></td>
                  <td class="is-number"><strong :class="stock.changePercent >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatPercent(stock.changePercent) }}</strong><span class="ir-cell-note">{{ formatNumber(stock.close) }}</span></td>
                  <td><span v-if="stock.reason">{{ stock.reason }}</span></td>
                  <td class="is-center"><span class="ir-status" :class="`is-${stock.risk.tone}`">{{ stock.risk.label }}</span></td>
                  <td class="is-center"><button type="button" class="ir-row-action" :class="{ 'is-active': isFavorite(stock.code) }" :title="isFavorite(stock.code) ? '移出自選' : '加入自選'" @click="toggleFavorite(stock.code)"><StarIcon /></button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div class="home-lower-grid" :class="{ 'has-single': !futureEvents.length }">
        <section v-if="topics.length" class="ir-surface ir-section">
          <div class="ir-section-head"><div><h2>題材強弱</h2><p>依現有新聞、法人與 ETF 資料整理</p></div><RouterLink to="/themes" class="home-text-link">更多題材<ArrowRightIcon /></RouterLink></div>
          <div class="topic-list">
            <RouterLink v-for="(topic, index) in topics" :key="topic.slug" :to="`/themes?topic=${encodeURIComponent(topic.slug)}`" class="topic-row">
              <span>{{ index + 1 }}</span><strong>{{ topic.title }}</strong>
              <div class="ir-progress"><i :style="{ '--progress': `${Math.max(6, (topic.score / topicMaxScore) * 100)}%` }" /></div>
              <em>{{ formatNumber(topic.score) }}</em>
            </RouterLink>
          </div>
        </section>

        <section v-if="futureEvents.length" class="ir-surface ir-section">
          <div class="ir-section-head"><h2>今日之後的重要事件</h2></div>
          <div class="event-list">
            <article v-for="item in futureEvents" :key="item.key" class="event-item">
              <CalendarDaysIcon /><time>{{ formatDate(item.date) }}</time><div><strong>{{ item.title }}</strong><p v-if="item.note">{{ item.note }}</p></div>
            </article>
          </div>
        </section>
      </div>

      <section class="ir-surface ir-section shortcut-section">
        <div class="ir-section-head"><h2>常用功能</h2></div>
        <div class="shortcut-grid">
          <RouterLink v-for="item in shortcuts" :key="item.label" :to="item.to" class="shortcut-item">
            <component :is="item.icon" /><div><strong>{{ item.label }}</strong><span>{{ item.note }}</span></div><ArrowRightIcon />
          </RouterLink>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.home-redesign { gap: 14px; }
.home-data-date { margin: 0 2px; color: var(--ir-soft); font-size: .75rem; }
.home-market-hero { padding: 18px; }
.home-market-title { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 16px; }
.market-target { display: grid; width: 58px; height: 58px; place-items: center; border: 2px solid var(--up); border-radius: 50%; color: var(--up); }
.market-target svg { width: 30px; }
.home-market-title h1 { margin: 0; color: var(--ir-text); font-size: clamp(1.45rem, 2.2vw, 2rem); }
.home-market-title p { margin: 5px 0 0; color: var(--ir-soft); font-size: .84rem; line-height: 1.5; }
.home-market-title .ir-button svg, .home-text-link svg { width: 16px; }
.home-signal-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin-top: 16px; border: 1px solid var(--ir-line); border-radius: 7px; }
.home-signal-item { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; min-width: 0; padding: 15px; border-right: 1px solid var(--ir-line); }
.home-signal-item:last-child { border-right: 0; }
.home-signal-item > svg { width: 25px; color: var(--ir-brand); }
.home-signal-item span { display: flex; flex-wrap: wrap; gap: 5px; color: var(--ir-text); font-size: .75rem; font-weight: 800; }
.home-signal-item span small { color: var(--ir-soft); font-size: .66rem; font-weight: 500; }
.home-signal-item strong { display: block; margin: 5px 0 1px; color: var(--ir-text); font-size: 1.14rem; font-variant-numeric: tabular-nums; }
.home-signal-item p { min-height: 18px; margin: 0; font-size: .72rem; font-weight: 800; }
.home-signal-item em { display: inline-flex; margin-top: 6px; padding: 2px 7px; border: 1px solid var(--ir-line); border-radius: 5px; color: var(--ir-soft); font-size: .66rem; font-style: normal; }
.home-signal-item em.is-positive { color: var(--up); }.home-signal-item em.is-negative { color: var(--down); }.home-signal-item em.is-warning { color: var(--large); }
.home-main-grid, .home-lower-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 14px; }
.home-lower-grid.has-single { grid-template-columns: 1fr; }
.focus-list { display: grid; gap: 7px; }
.focus-row { display: grid; grid-template-columns: 30px 95px minmax(0, 1fr) 18px; align-items: center; gap: 10px; min-height: 64px; padding: 10px 12px; border: 1px solid var(--ir-line); border-radius: 7px; color: inherit; text-decoration: none; }
.focus-row:hover { border-color: var(--ir-line-strong); background: var(--ir-row-hover); }
.focus-row > svg { width: 22px; color: var(--ir-brand); }.focus-row > svg:last-child { width: 16px; }
.focus-row span { color: var(--ir-soft); font-size: .72rem; }.focus-row strong { font-size: .8rem; line-height: 1.45; }
.home-text-link { display: inline-flex; align-items: center; gap: 5px; color: var(--ir-brand); font-size: .74rem; font-weight: 800; text-decoration: none; }
.home-stock-table { min-width: 620px; }.home-stock-table th:nth-child(1) { width: 48px; }.home-stock-table th:nth-child(2) { width: 135px; }.home-stock-table th:nth-child(3) { width: 90px; }.home-stock-table th:nth-child(5), .home-stock-table th:nth-child(6) { width: 58px; }
.topic-list { display: grid; }
.topic-row { display: grid; grid-template-columns: 30px minmax(130px, .7fr) minmax(150px, 1fr) 64px; align-items: center; gap: 10px; min-height: 44px; border-bottom: 1px solid var(--ir-line); color: inherit; text-decoration: none; }
.topic-row:last-child { border-bottom: 0; }.topic-row > span { color: var(--ir-soft); text-align: center; font-weight: 900; }.topic-row strong { font-size: .8rem; }.topic-row em { color: var(--ir-soft); font-size: .75rem; font-style: normal; text-align: right; }
.event-list { display: grid; }.event-item { display: grid; grid-template-columns: 20px 90px minmax(0, 1fr); align-items: start; gap: 9px; padding: 11px 0; border-bottom: 1px solid var(--ir-line); }.event-item:last-child { border-bottom: 0; }.event-item svg { width: 18px; color: var(--ir-brand); }.event-item time { color: var(--ir-soft); font-size: .72rem; }.event-item strong { color: var(--ir-text); font-size: .8rem; }.event-item p { margin: 4px 0 0; color: var(--ir-soft); font-size: .72rem; line-height: 1.45; }
.shortcut-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.shortcut-item { display: grid; grid-template-columns: 26px minmax(0, 1fr) 15px; align-items: center; gap: 9px; min-height: 70px; padding: 10px; border: 1px solid var(--ir-line); border-radius: 7px; color: inherit; text-decoration: none; }
.shortcut-item:hover { border-color: var(--ir-line-strong); background: var(--ir-row-hover); }.shortcut-item > svg { width: 23px; color: var(--ir-brand); }.shortcut-item > svg:last-child { width: 14px; }.shortcut-item strong, .shortcut-item span { display: block; }.shortcut-item strong { color: var(--ir-text); font-size: .78rem; }.shortcut-item span { margin-top: 3px; color: var(--ir-soft); font-size: .66rem; line-height: 1.3; }

@media (max-width: 1120px) {
  .home-signal-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .home-signal-item:nth-child(3n) { border-right: 0; }
  .home-main-grid { grid-template-columns: 1fr; }
  .shortcut-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .home-market-title { grid-template-columns: auto 1fr; }.home-market-title .ir-button { grid-column: 1 / -1; width: 100%; }
  .home-signal-grid { grid-template-columns: 1fr 1fr; }.home-signal-item:nth-child(3n) { border-right: 1px solid var(--ir-line); }.home-signal-item:nth-child(2n) { border-right: 0; }
  .home-lower-grid { grid-template-columns: 1fr; }.focus-row { grid-template-columns: 28px minmax(0, 1fr) 16px; }.focus-row span { grid-column: 2; }.focus-row strong { grid-column: 2; }.focus-row > svg:last-child { grid-column: 3; grid-row: 1 / span 2; }
  .shortcut-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-stock-table { min-width: 0; }
  .home-stock-table th:nth-child(1), .home-stock-table td:nth-child(1), .home-stock-table th:nth-child(5), .home-stock-table td:nth-child(5), .home-stock-table th:nth-child(6), .home-stock-table td:nth-child(6) { display: none; }
  .home-stock-table th:nth-child(2) { width: 38%; }.home-stock-table th:nth-child(3) { width: 25%; }.home-stock-table th:nth-child(4) { width: 37%; }
  .home-stock-table th, .home-stock-table td { padding-inline: 7px; }
}
@media (max-width: 480px) {
  .home-market-hero { padding: 13px; }.market-target { width: 46px; height: 46px; }.market-target svg { width: 24px; }
  .home-signal-grid { grid-template-columns: 1fr; }.home-signal-item, .home-signal-item:nth-child(3n), .home-signal-item:nth-child(2n) { border-right: 0; border-bottom: 1px solid var(--ir-line); }.home-signal-item:last-child { border-bottom: 0; }
  .topic-row { grid-template-columns: 28px minmax(0, 1fr) 50px; }.topic-row .ir-progress { grid-column: 2 / -1; margin-bottom: 8px; }
  .shortcut-grid { grid-template-columns: 1fr; }
}
</style>
