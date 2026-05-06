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
    value: globalMarkets.value?.summary?.strongest?.shortLabel ?? '等待資料',
    note:
      globalMarkets.value?.summary?.strongest?.changePercent !== null &&
      globalMarkets.value?.summary?.strongest?.changePercent !== undefined
        ? `單日 ${formatPercent(globalMarkets.value.summary.strongest.changePercent)}`
        : '先看今天最強的市場，方便判斷資金風向。',
  },
  {
    title: '最弱市場',
    value: globalMarkets.value?.summary?.weakest?.shortLabel ?? '等待資料',
    note:
      globalMarkets.value?.summary?.weakest?.changePercent !== null &&
      globalMarkets.value?.summary?.weakest?.changePercent !== undefined
        ? `單日 ${formatPercent(globalMarkets.value.summary.weakest.changePercent)}`
        : '先看今天最弱的市場，確認風險情緒是否擴散。',
  },
  {
    title: '波動最大',
    value: globalMarkets.value?.summary?.mostVolatile?.shortLabel ?? '等待資料',
    note:
      globalMarkets.value?.summary?.mostVolatile?.return5 !== null &&
      globalMarkets.value?.summary?.mostVolatile?.return5 !== undefined
        ? `5 日 ${formatPercent(globalMarkets.value.summary.mostVolatile.return5)}`
        : '波動大的標的適合拿來看情緒是否快速切換。',
  },
]);

const pageSeo = computed(() => ({
  title: '國際盤 / 原物料 / 外匯儀表板',
  description: '把美股指數、原物料、外匯與期貨整理成同一頁，方便盤前盤後快速比對全球市場強弱與風險偏好。',
  routePath: '/global-markets',
  keywords: ['國際盤', '原物料', '外匯', '全球股市', '市場儀表板', '盤前觀察'],
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

function getToneCardClass(item) {
  if ((item?.changePercent ?? 0) > 0) return 'is-up';
  if ((item?.changePercent ?? 0) < 0) return 'is-down';
  return 'is-flat';
}
</script>

<template>
  <section class="page-shell global-markets-page">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="hasData"
      empty-message="國際盤資料尚未整理完成。"
    />

    <template v-if="hasData">
      <section class="page-hero compact radar-page-hero global-markets-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Global Markets Dashboard</span>
          <h1>國際盤 / 原物料 / 外匯儀表板</h1>
          <p class="page-subtitle">
            把國際盤、原物料與外匯放在同一頁，先看哪個市場最強、哪個最弱，再看 5 日與 20 日方向，幫助你判讀隔日台股節奏。
          </p>
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
            <span class="theme-spotlight-label">資料日期</span>
            <strong>{{ formatDate(globalMarkets?.marketDate) }}</strong>
            <p>國際盤資料以最近一次更新為準，盤前可先用這裡確認全球風險偏好。</p>
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
              <p class="panel-subtitle">先比單日漲跌，再看 5 日與 20 日方向，判斷是短線反彈還是趨勢延續。</p>
            </div>
            <span class="meta-chip">{{ formatNumber(section.items.length, 0) }} 項</span>
          </div>

          <div class="global-market-grid">
            <article
              v-for="item in section.items"
              :key="item.symbol"
              class="sub-panel market-quote-card"
              :class="getToneCardClass(item)"
            >
              <div class="market-quote-head">
                <div>
                  <strong>{{ item.label }}</strong>
                  <p class="muted">{{ item.shortLabel }}</p>
                </div>
                <span class="status-badge" :class="`is-${item.status}`">{{ item.marketDate ? formatDate(item.marketDate) : '資料待補' }}</span>
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
