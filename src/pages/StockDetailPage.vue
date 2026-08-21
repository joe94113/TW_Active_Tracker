<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import {
  ArrowLeftIcon,
  BookmarkIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  StarIcon,
} from '@heroicons/vue/24/outline';
import StatusCard from '../components/StatusCard.vue';
import HolderStructureChart from '../components/HolderStructureChart.vue';
import IntradayChart from '../components/IntradayChart.vue';
import StockNewsPanel from '../components/StockNewsPanel.vue';
import TechnicalChart from '../components/TechnicalChart.vue';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import { useGlobalData } from '../composables/useGlobalData';
import { useLiveStockSnapshot } from '../composables/useLiveStockSnapshot';
import { useSeoMeta } from '../composables/useSeoMeta';
import { useStockDetail } from '../composables/useStockDetail';
import { useTomorrowWatchCodes } from '../composables/useTomorrowWatchCodes';
import { getDataFreshnessStatus } from '../lib/dataFreshness';
import { hasFiniteNumber, hasItems, hasText, toFiniteNumber, uniqueBy } from '../lib/dataAvailability';
import { formatAmount, formatDate, formatLots, formatNumber, formatPercent, formatPriceDelta } from '../lib/formatters';
import { buildLargeHolderCostZone, buildStockEventCalendar } from '../lib/stockInsights';
import { buildOverheatWarnings, buildStockHealthScore } from '../lib/stockHealth';

const route = useRoute();
const stockCode = computed(() => String(route.params.code ?? '').trim());
const activeTab = ref('overview');

const { detail, isLoading, isEnhancing, errorMessage } = useStockDetail(stockCode);
const { snapshot, isLoading: isSnapshotLoading, refresh } = useLiveStockSnapshot(stockCode);
const { loadGlobalData } = useGlobalData();
const { isFavorite, toggleFavorite } = useFavoriteStocks();
const { isWatched, toggleWatch } = useTomorrowWatchCodes();

onMounted(loadGlobalData);

const latestSummary = computed(() => detail.value?.最新摘要 ?? {});
const latestIndicators = computed(() => detail.value?.最新指標 ?? {});
const institutional = computed(() => detail.value?.法人買賣 ?? null);
const institutionalDays = computed(() => institutional.value?.days ?? []);
const institutionalSummary = computed(() => institutional.value?.summary ?? {});
const priceRows = computed(() => detail.value?.歷史資料 ?? []);
const recentRows = computed(() => priceRows.value.slice(-5).reverse());

const displayQuote = computed(() => ({
  price: toFiniteNumber(snapshot.value?.lastPrice) ?? toFiniteNumber(latestSummary.value.close),
  change: toFiniteNumber(snapshot.value?.change) ?? toFiniteNumber(latestSummary.value.change),
  changePercent: toFiniteNumber(snapshot.value?.changePercent) ?? toFiniteNumber(latestSummary.value.changePercent),
  volume: toFiniteNumber(snapshot.value?.volumeShares) ?? toFiniteNumber(latestSummary.value.volume),
  marketDate: snapshot.value?.marketDate ?? detail.value?.priceDate ?? null,
  updatedAt: snapshot.value?.updatedAt ?? detail.value?.generatedAt ?? null,
  source: snapshot.value?.sourceLabel ?? detail.value?.資料來源?.[0] ?? null,
}));

const freshness = computed(() => getDataFreshnessStatus({
  generatedAt: displayQuote.value.updatedAt,
  marketDate: displayQuote.value.marketDate,
}));

const largeHolderCostZone = computed(() => buildLargeHolderCostZone(detail.value));
const health = computed(() => buildStockHealthScore(detail.value, {
  currentClose: displayQuote.value.price,
}));
const overheatWarnings = computed(() => buildOverheatWarnings(detail.value, {
  currentClose: displayQuote.value.price,
}));

const eventItems = computed(() => uniqueBy([
  ...buildStockEventCalendar(detail.value),
  ...(detail.value?.交易提醒?.alerts ?? []).map((item) => ({
    date: item.date,
    label: item.title,
    note: item.note ?? item.detail,
    tone: item.tone,
  })),
], (item) => `${item.date}-${item.label}`));

const tabs = computed(() => [
  { key: 'overview', label: '重點', show: true },
  { key: 'charts', label: '走勢', show: hasItems(detail.value?.歷史資料) || hasItems(detail.value?.盤中走勢?.points) },
  { key: 'chips', label: '法人籌碼', show: hasItems(detail.value?.法人買賣?.days) || hasItems(detail.value?.持股分散?.bands) },
  { key: 'valuation', label: '估值', show: Boolean(detail.value?.評價面 || detail.value?.財務資料) },
  { key: 'events', label: '事件', show: eventItems.value.length > 0 },
].filter((item) => item.show));

const decision = computed(() => {
  if (freshness.value.isStale) {
    return {
      title: '資料日回看：暫不做今日判斷',
      note: `目前最新可確認資料為 ${formatDate(displayQuote.value.marketDate)}，以下內容只用來回看當日狀態。`,
      tone: 'neutral',
    };
  }

  const total = health.value?.totalScore ?? 50;
  const risk = health.value?.sections?.find((item) => item.key === 'risk')?.score ?? 50;
  if (total >= 70 && risk >= 55) {
    return { title: '今日看法：偏多，但不宜追高', note: health.value.summary, tone: 'positive' };
  }
  if (total <= 48 || risk < 45) {
    return { title: '今日看法：偏弱，先等止穩', note: health.value.summary, tone: 'negative' };
  }
  return { title: '今日看法：中性，等訊號更明確', note: health.value.summary, tone: 'neutral' };
});

const supportingReasons = computed(() => {
  const items = [
    ...(detail.value?.觀察摘要 ?? []),
    ...(health.value?.sections ?? []).filter((item) => item.score >= 58).map((item) => item.summary),
  ];
  return [...new Set(items.filter(hasText))].slice(0, 3);
});

const riskReasons = computed(() => {
  const items = [
    ...overheatWarnings.value.map((item) => item.note ?? item.title),
    ...(detail.value?.technicalSignals ?? []).filter((item) => item.tone === 'down').map((item) => item.description ?? item.title),
  ];
  return [...new Set(items.filter(hasText))].slice(0, 3);
});

const actionReferences = computed(() => [
  hasFiniteNumber(latestIndicators.value.ma20 ?? latestIndicators.value.maMedium)
    ? { label: 'MA20 觀察線', value: formatNumber(latestIndicators.value.ma20 ?? latestIndicators.value.maMedium), tone: 'safe' }
    : null,
  hasFiniteNumber(latestIndicators.value.ma60 ?? latestIndicators.value.maLong)
    ? { label: 'MA60 中期線', value: formatNumber(latestIndicators.value.ma60 ?? latestIndicators.value.maLong), tone: 'info' }
    : null,
  largeHolderCostZone.value
    ? {
        label: '推估大戶成本帶',
        value: `${formatNumber(largeHolderCostZone.value.low)} - ${formatNumber(largeHolderCostZone.value.high)}`,
        tone: largeHolderCostZone.value.status === 'below' ? 'risk' : 'safe',
      }
    : null,
].filter(Boolean));

const institutionalRows = computed(() => [
  hasFiniteNumber(institutionalSummary.value.foreign5Day)
    ? { label: '外資近 5 日', value: institutionalSummary.value.foreign5Day }
    : null,
  hasFiniteNumber(institutionalSummary.value.investmentTrust5Day)
    ? { label: '投信近 5 日', value: institutionalSummary.value.investmentTrust5Day }
    : null,
  hasFiniteNumber(institutionalSummary.value.dealer5Day)
    ? { label: '自營商近 5 日', value: institutionalSummary.value.dealer5Day }
    : null,
  hasFiniteNumber(institutionalSummary.value.total5Day)
    ? { label: '三大法人合計', value: institutionalSummary.value.total5Day }
    : null,
].filter(Boolean));

const valuationRows = computed(() => {
  const valuation = detail.value?.評價面 ?? {};
  const monthly = detail.value?.財務資料?.月營收 ?? {};
  const income = detail.value?.財務資料?.綜合損益表 ?? {};
  const balance = detail.value?.財務資料?.資產負債表 ?? {};
  return [
    hasFiniteNumber(valuation.本益比) ? { label: '本益比', value: `${formatNumber(valuation.本益比)} 倍` } : null,
    hasFiniteNumber(valuation.殖利率) ? { label: '現金殖利率', value: formatPercent(valuation.殖利率) } : null,
    hasFiniteNumber(valuation.股價淨值比) ? { label: '股價淨值比', value: `${formatNumber(valuation.股價淨值比)} 倍` } : null,
    hasFiniteNumber(monthly.年增率) ? { label: '月營收年增', value: formatPercent(monthly.年增率), date: monthly.資料年月 } : null,
    hasFiniteNumber(income.每股盈餘) ? { label: '最新季 EPS', value: formatNumber(income.每股盈餘), date: `${income.年度 ?? ''} Q${income.季別 ?? ''}`.trim() } : null,
    hasFiniteNumber(balance.負債比) ? { label: '負債比', value: formatPercent(balance.負債比), date: balance.出表日期 } : null,
  ].filter(Boolean);
});

const companyTags = computed(() => [
  detail.value?.公司概況?.產業名稱,
  detail.value?.公司概況?.市場別,
].filter(hasText));

const dailyInstitutionRows = computed(() => institutionalDays.value.slice(0, 10));

useSeoMeta(() => ({
  title: detail.value?.name ? `${stockCode.value} ${detail.value.name} | 個股觀察` : '個股觀察',
  description: '整合價格、走勢、法人、持股與財務的個股觀察頁。',
}));
</script>

<template>
  <section class="investor-page stock-detail-redesign">
    <div class="stock-back-row">
      <RouterLink to="/entry-radar" class="ir-button"><ArrowLeftIcon />返回卡位雷達</RouterLink>
    </div>

    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(detail)"
      empty-message="找不到這檔股票的可確認資料。"
    />

    <template v-if="detail && !isLoading">
      <header class="stock-hero">
        <div class="stock-hero-main">
          <div>
            <div class="ir-stock-identity stock-title-row">
              <h1>{{ stockCode }} {{ detail.name }}</h1>
              <span v-for="tag in companyTags" :key="tag" class="ir-badge">{{ tag }}</span>
            </div>
            <p class="ir-muted">資料日 {{ formatDate(displayQuote.marketDate) }}<span v-if="displayQuote.source"> · {{ displayQuote.source }}</span></p>
          </div>

          <div v-if="hasFiniteNumber(displayQuote.price)" class="stock-price-block">
            <span>股價</span><strong>{{ formatNumber(displayQuote.price) }}</strong>
          </div>

          <div v-if="hasFiniteNumber(displayQuote.changePercent)" class="stock-price-block">
            <span>當日漲跌</span>
            <strong :class="displayQuote.changePercent >= 0 ? 'ir-text-up' : 'ir-text-down'">
              {{ formatPriceDelta(displayQuote.change) }} ({{ formatPercent(displayQuote.changePercent) }})
            </strong>
          </div>

          <div class="ir-action-row stock-hero-actions">
            <button type="button" class="ir-icon-button" :class="{ 'is-active': isFavorite(stockCode) }" :title="isFavorite(stockCode) ? '移出自選' : '加入自選'" @click="toggleFavorite(stockCode)"><StarIcon /></button>
            <button type="button" class="ir-button" :class="{ 'is-primary': isWatched(stockCode) }" @click="toggleWatch(stockCode)">
              <BookmarkIcon />{{ isWatched(stockCode) ? '已加入明日觀察' : '加入明日觀察' }}
            </button>
            <button type="button" class="ir-icon-button" title="更新即時價格" :disabled="isSnapshotLoading" @click="refresh"><ChartBarIcon /></button>
          </div>
        </div>

        <div class="stock-decision" :class="`is-${decision.tone}`">
          <div class="stock-decision-summary">
            <div class="decision-icon"><ChartBarIcon /></div>
            <div><h2>{{ decision.title }}</h2><p>{{ decision.note }}</p></div>
          </div>

          <section v-if="supportingReasons.length" class="decision-column">
            <strong>支持理由</strong>
            <p v-for="item in supportingReasons" :key="item"><CheckCircleIcon />{{ item }}</p>
          </section>

          <section v-if="riskReasons.length || freshness.isStale" class="decision-column">
            <strong>風險提醒</strong>
            <p v-for="item in riskReasons" :key="item"><ExclamationTriangleIcon />{{ item }}</p>
            <p v-if="freshness.isStale"><ExclamationTriangleIcon />資料已過期，不可當作當日追價依據。</p>
          </section>
        </div>
      </header>

      <nav class="ir-tabs stock-tabs" aria-label="個股分頁">
        <button v-for="tab in tabs" :key="tab.key" type="button" class="ir-tab" :class="{ 'is-active': activeTab === tab.key }" @click="activeTab = tab.key">{{ tab.label }}</button>
      </nav>

      <template v-if="activeTab === 'overview'">
        <div class="stock-overview-grid">
          <TechnicalChart v-if="priceRows.length" :data="detail" :holder-cost-zone="largeHolderCostZone" :title="`${detail.name} 股價走勢`" />

          <aside class="stock-side-stack">
            <section v-if="actionReferences.length" class="ir-surface ir-section">
              <div class="ir-section-head"><h2>行動參考</h2></div>
              <div class="ir-list">
                <div v-for="item in actionReferences" :key="item.label" class="ir-list-row action-reference-row">
                  <span>{{ item.label }}</span><strong :class="`ir-text-${item.tone}`">{{ item.value }}</strong>
                </div>
              </div>
              <p v-if="largeHolderCostZone" class="ir-note holder-zone-note">{{ largeHolderCostZone.note }}</p>
            </section>

            <section v-if="institutionalRows.length" class="ir-surface ir-section">
              <div class="ir-section-head"><div><h2>法人籌碼</h2><p>近 5 個有資料交易日，單位：股</p></div></div>
              <div class="ir-list">
                <div v-for="item in institutionalRows" :key="item.label" class="ir-list-row action-reference-row">
                  <span>{{ item.label }}</span><strong :class="item.value >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatAmount(item.value) }}</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div class="stock-bottom-grid">
          <section v-if="eventItems.length" class="ir-surface ir-section">
            <div class="ir-section-head"><h2>近期事件</h2></div>
            <div class="ir-list">
              <div v-for="item in eventItems.slice(0, 4)" :key="`${item.date}-${item.label}`" class="ir-list-row event-row">
                <CalendarDaysIcon /><div><strong>{{ item.label }}</strong><p v-if="item.note" class="ir-note">{{ item.note }}</p></div><time v-if="item.date">{{ formatDate(item.date) }}</time>
              </div>
            </div>
          </section>

          <section v-if="recentRows.length" class="ir-surface ir-section recent-table-section">
            <div class="ir-section-head"><h2>近 5 日關鍵變化</h2></div>
            <div class="ir-table-wrap">
              <table class="ir-table recent-price-table">
                <thead><tr><th>日期</th><th class="is-number">收盤</th><th class="is-number">漲跌</th><th class="is-number">成交量</th></tr></thead>
                <tbody>
                  <tr v-for="row in recentRows" :key="row.date">
                    <td>{{ formatDate(row.date) }}</td><td class="is-number">{{ formatNumber(row.close) }}</td>
                    <td class="is-number" :class="row.changePercent >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatPercent(row.changePercent) }}</td>
                    <td class="is-number">{{ formatLots(row.volume) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </template>

      <template v-else-if="activeTab === 'charts'">
        <TechnicalChart v-if="priceRows.length" :data="detail" :holder-cost-zone="largeHolderCostZone" :title="`${detail.name} 中期走勢`" />
        <IntradayChart v-if="detail?.盤中走勢?.points?.length" :data="detail.盤中走勢" :title="`${detail.name} 盤中走勢`" />
      </template>

      <template v-else-if="activeTab === 'chips'">
        <HolderStructureChart v-if="detail?.持股分散?.bands?.length" :data="detail.持股分散" />
        <section v-if="dailyInstitutionRows.length" class="ir-surface ir-section">
          <div class="ir-section-head"><div><h2>法人逐日買賣超</h2><p>單位：股</p></div></div>
          <div class="ir-table-wrap">
            <table class="ir-table chip-table">
              <thead><tr><th>日期</th><th class="is-number">外資</th><th class="is-number">投信</th><th class="is-number">自營商</th><th class="is-number">合計</th></tr></thead>
              <tbody>
                <tr v-for="row in dailyInstitutionRows" :key="row.date">
                  <td>{{ formatDate(row.date) }}</td>
                  <td class="is-number" :class="row.foreign >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatAmount(row.foreign) }}</td>
                  <td class="is-number" :class="row.investmentTrust >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatAmount(row.investmentTrust) }}</td>
                  <td class="is-number" :class="row.dealer >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatAmount(row.dealer) }}</td>
                  <td class="is-number" :class="row.total >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatAmount(row.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-else-if="activeTab === 'valuation'">
        <section v-if="valuationRows.length" class="ir-surface ir-section">
          <div class="ir-section-head"><div><h2>估值與基本面</h2><p>只列出目前有資料的項目</p></div></div>
          <div class="valuation-grid">
            <article v-for="item in valuationRows" :key="item.label" class="valuation-item">
              <span>{{ item.label }}</span><strong>{{ item.value }}</strong><small v-if="item.date">{{ item.date }}</small>
            </article>
          </div>
        </section>
        <section v-if="detail?.財務資料?.觀察摘要?.length" class="ir-surface ir-section">
          <div class="ir-section-head"><h2>財務觀察</h2></div>
          <div class="ir-list"><p v-for="item in detail.財務資料.觀察摘要" :key="item" class="ir-list-row">{{ item }}</p></div>
        </section>
      </template>

      <template v-else-if="activeTab === 'events'">
        <section v-if="eventItems.length" class="ir-surface ir-section">
          <div class="ir-section-head"><h2>公司與交易事件</h2></div>
          <div class="ir-list">
            <article v-for="item in eventItems" :key="`${item.date}-${item.label}`" class="ir-list-row event-detail-row">
              <time v-if="item.date">{{ formatDate(item.date) }}</time><div><strong>{{ item.label }}</strong><p v-if="item.note" class="ir-note">{{ item.note }}</p></div>
            </article>
          </div>
        </section>
        <StockNewsPanel :code="stockCode" :stock-name="detail.name" />
      </template>

      <p v-if="isEnhancing" class="ir-data-note">正在補充目前可取得的即時資料，已顯示區塊不會使用假數字。</p>
    </template>
  </section>
</template>

<style scoped>
.stock-detail-redesign { gap: 12px; }
.stock-back-row { min-height: 38px; }
.stock-hero { display: grid; gap: 12px; }
.stock-hero-main { display: grid; grid-template-columns: minmax(280px, 1.5fr) repeat(2, minmax(150px, .55fr)) auto; align-items: center; gap: 24px; padding: 4px 2px 10px; }
.stock-title-row { flex-wrap: wrap; gap: 9px; }
.stock-title-row h1 { margin: 0; color: var(--ir-text); font-size: clamp(1.55rem, 2.3vw, 2.15rem); line-height: 1.2; }
.stock-price-block { display: grid; gap: 4px; }
.stock-price-block span { color: var(--ir-soft); font-size: .74rem; font-weight: 800; }
.stock-price-block strong { color: var(--ir-text); font-size: 1.55rem; font-variant-numeric: tabular-nums; }
.stock-hero-actions { justify-content: flex-end; }
.stock-decision { display: grid; grid-template-columns: minmax(310px, 1.2fr) repeat(2, minmax(240px, 1fr)); border: 1px solid var(--ir-line); border-left: 4px solid var(--ir-brand); border-radius: 8px; background: var(--ir-surface); }
.stock-decision.is-positive { border-left-color: var(--up); }
.stock-decision.is-negative { border-left-color: var(--down); }
.stock-decision-summary, .decision-column { min-width: 0; padding: 18px 20px; }
.stock-decision-summary { display: flex; align-items: center; gap: 16px; }
.decision-icon { display: grid; width: 54px; height: 54px; flex: 0 0 auto; place-items: center; border: 2px solid currentColor; border-radius: 50%; color: var(--ir-brand); }
.decision-icon svg { width: 28px; }
.stock-decision-summary h2 { margin: 0 0 6px; color: var(--ir-text); font-size: 1.22rem; }
.stock-decision-summary p, .decision-column p { margin: 0; color: var(--ir-soft); font-size: .8rem; line-height: 1.5; }
.decision-column { border-left: 1px solid var(--ir-line); }
.decision-column > strong { display: block; margin-bottom: 8px; color: var(--ir-text); font-size: .8rem; }
.decision-column p { display: flex; align-items: flex-start; gap: 7px; margin-top: 7px; }
.decision-column svg { width: 16px; flex: 0 0 auto; color: var(--ir-brand); }
.stock-tabs { min-height: 48px; border-bottom: 1px solid var(--ir-line); }
.stock-tabs .ir-tab { min-width: 88px; border-width: 0 0 2px; border-radius: 0; }
.stock-overview-grid { display: grid; grid-template-columns: minmax(0, 2.15fr) minmax(280px, 1fr); gap: 12px; align-items: start; }
.stock-overview-grid :deep(.chart-info-strip), .stock-overview-grid :deep(.chart-toolbar), .stock-overview-grid :deep(.chart-parameter-panel) { display: none; }
.stock-side-stack { display: grid; gap: 12px; }
.action-reference-row { grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
.action-reference-row > span { color: var(--ir-soft); font-size: .78rem; }
.holder-zone-note { margin-top: 10px; }
.stock-bottom-grid { display: grid; grid-template-columns: minmax(280px, .8fr) minmax(0, 1.6fr); gap: 12px; }
.event-row { grid-template-columns: 20px minmax(0, 1fr) auto; align-items: start; }
.event-row > svg { width: 18px; color: var(--ir-brand); }
.event-row time, .event-detail-row time { color: var(--ir-soft); font-size: .74rem; white-space: nowrap; }
.recent-price-table { min-width: 520px; }
.valuation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); border: 1px solid var(--ir-line); border-radius: 7px; }
.valuation-item { display: grid; gap: 5px; padding: 16px; border-right: 1px solid var(--ir-line); }
.valuation-item:last-child { border-right: 0; }
.valuation-item span, .valuation-item small { color: var(--ir-soft); font-size: .72rem; }
.valuation-item strong { color: var(--ir-text); font-size: 1.2rem; }
.event-detail-row { grid-template-columns: 110px minmax(0, 1fr); }

@media (max-width: 1100px) {
  .stock-hero-main { grid-template-columns: 1fr 1fr; }
  .stock-hero-actions { justify-content: flex-start; }
  .stock-decision { grid-template-columns: 1fr 1fr; }
  .stock-decision-summary { grid-column: 1 / -1; }
  .stock-overview-grid { grid-template-columns: 1fr; }
  .stock-side-stack { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 720px) {
  .stock-hero-main { grid-template-columns: 1fr 1fr; gap: 14px; }
  .stock-hero-main > :first-child, .stock-hero-actions { grid-column: 1 / -1; }
  .stock-price-block strong { font-size: 1.22rem; }
  .stock-decision { grid-template-columns: 1fr; }
  .stock-decision-summary { grid-column: auto; align-items: flex-start; }
  .decision-column { border-top: 1px solid var(--ir-line); border-left: 0; }
  .stock-side-stack, .stock-bottom-grid { grid-template-columns: 1fr; }
  .valuation-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .valuation-item { border-bottom: 1px solid var(--ir-line); }
  .recent-price-table { min-width: 0; }
  .recent-price-table th:nth-child(4), .recent-price-table td:nth-child(4) { display: none; }
}

@media (max-width: 460px) {
  .stock-hero-main { grid-template-columns: 1fr; }
  .stock-hero-main > *, .stock-hero-actions { grid-column: auto; }
  .stock-hero-actions .ir-button { flex: 1; }
  .valuation-grid { grid-template-columns: 1fr; }
  .event-detail-row { grid-template-columns: 1fr; }
}
</style>
