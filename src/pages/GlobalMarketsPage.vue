<script setup>
import { computed, onMounted } from 'vue';
import StatusCard from '../components/StatusCard.vue';
import DataFreshnessBadge from '../components/DataFreshnessBadge.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { formatDate, formatNumber, formatPercent } from '../lib/formatters';

const { globalMarkets, manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const hasData = computed(() => Boolean(globalMarkets.value?.sections?.some((section) => section.items?.length)));
const sections = computed(() => globalMarkets.value?.sections ?? []);
const heroCards = computed(() => [
  {
    title: '最強市場',
    value: globalMarkets.value?.summary?.strongest?.shortLabel ?? '等待更新',
    note:
      globalMarkets.value?.summary?.strongest?.changePercent !== null &&
      globalMarkets.value?.summary?.strongest?.changePercent !== undefined
        ? `單日 ${formatPercent(globalMarkets.value.summary.strongest.changePercent)}`
        : '先看國際股指誰最強',
  },
  {
    title: '最弱市場',
    value: globalMarkets.value?.summary?.weakest?.shortLabel ?? '等待更新',
    note:
      globalMarkets.value?.summary?.weakest?.changePercent !== null &&
      globalMarkets.value?.summary?.weakest?.changePercent !== undefined
        ? `單日 ${formatPercent(globalMarkets.value.summary.weakest.changePercent)}`
        : '先看風險資產是否同步轉弱',
  },
  {
    title: '波動最大',
    value: globalMarkets.value?.summary?.mostVolatile?.shortLabel ?? '等待更新',
    note:
      globalMarkets.value?.summary?.mostVolatile?.return5 !== null &&
      globalMarkets.value?.summary?.mostVolatile?.return5 !== undefined
        ? `5 日 ${formatPercent(globalMarkets.value.summary.mostVolatile.return5)}`
        : '用來判斷明天風險偏好',
  },
]);

const pageSeo = computed(() => ({
  title: '國際盤 / 原物料 / 外匯儀表板',
  description: '把美股、亞洲股市、原油、黃金與外匯放在同一頁，盤前先看國際風險偏好與隔日台股節奏。',
  routePath: '/global-markets',
  keywords: ['國際盤', '原物料', '外匯', '費半', '美元台幣', '隔日盤勢'],
}));

useSeoMeta(pageSeo);

onMounted(() => {
  loadGlobalData();
});

function getToneClass(item) {
  if ((item?.changePercent ?? 0) > 0) return 'text-up';
  if ((item?.changePercent ?? 0) < 0) return 'text-down';
  return '';
}
</script>

<template>
  <section class="page-shell global-markets-page">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="hasData"
      empty-message="國際市場資料尚未整理完成。"
    />

    <template v-if="hasData">
      <section class="page-hero compact radar-page-hero global-markets-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Global Markets Dashboard</span>
          <h1>國際盤 / 原物料 / 外匯儀表板</h1>
          <p class="page-subtitle">每天先看國際股指、原油、黃金與匯率，判斷明天台股偏多、偏保守，還是該先避開高波動。</p>
          <div class="hero-summary-grid global-markets-summary-grid">
            <article
              v-for="card in heroCards"
              :key="card.title"
              class="hero-summary-card"
            >
              <span class="hero-summary-label">{{ card.title }}</span>
              <strong class="hero-summary-value">{{ card.value }}</strong>
              <p class="hero-summary-note">{{ card.note }}</p>
            </article>
          </div>
        </div>

        <aside class="radar-hero-board global-markets-hero-board">
          <article class="theme-spotlight-card is-info">
            <span class="theme-spotlight-label">資料節奏</span>
            <strong>{{ formatDate(globalMarkets?.marketDate) }}</strong>
            <p>盤後會跟著每日資料包更新，適合盤前先看國際風向。</p>
            <DataFreshnessBadge
              :generated-at="globalMarkets?.generatedAt ?? manifest?.generatedAt"
              :market-date="globalMarkets?.marketDate"
              size="compact"
            />
          </article>
        </aside>
      </section>

      <section class="global-market-section-stack">
        <article
          v-for="section in sections"
          :key="section.key"
          class="panel"
        >
          <div class="panel-header">
            <div>
              <h2 class="panel-title">{{ section.title }}</h2>
              <p class="panel-subtitle">先看單日強弱，再看 5 日與 20 日方向，幫你判斷資金目前偏風險追價還是防守。</p>
            </div>
            <span class="meta-chip">{{ formatNumber(section.items.length, 0) }} 項</span>
          </div>

          <div class="global-market-grid">
            <article
              v-for="item in section.items"
              :key="item.symbol"
              class="sub-panel market-quote-card"
            >
              <div class="market-quote-head">
                <div>
                  <strong>{{ item.label }}</strong>
                  <p class="muted">{{ item.shortLabel }}</p>
                </div>
                <span class="status-badge" :class="`is-${item.status}`">{{ item.marketDate ? formatDate(item.marketDate) : '資料不足' }}</span>
              </div>

              <div class="market-quote-price">
                <strong>{{ formatNumber(item.close) }}</strong>
                <span :class="getToneClass(item)">{{ formatPercent(item.changePercent) }}</span>
              </div>

              <div class="market-quote-metrics">
                <div>
                  <span>單日</span>
                  <strong :class="getToneClass(item)">{{ formatPercent(item.changePercent) }}</strong>
                </div>
                <div>
                  <span>5 日</span>
                  <strong :class="getToneClass({ changePercent: item.return5 })">{{ formatPercent(item.return5) }}</strong>
                </div>
                <div>
                  <span>20 日</span>
                  <strong :class="getToneClass({ changePercent: item.return20 })">{{ formatPercent(item.return20) }}</strong>
                </div>
              </div>
            </article>
          </div>
        </article>
      </section>
    </template>
  </section>
</template>
