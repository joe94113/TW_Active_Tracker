<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';
import { buildTomorrowWatchlist } from '../lib/tomorrowWatchlist';
import { createStockCodeMap, mergeStockUniverse } from '../lib/stockUniverse';

const { manifest, dashboard, stockList, stockSearchList, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const replayHistory = ref(null);
const entryRadar = ref(null);
const isExtraLoading = ref(false);
const extraError = ref('');

const stockUniverse = computed(() => mergeStockUniverse(stockList.value, stockSearchList.value));
const stockMap = computed(() => createStockCodeMap(stockUniverse.value));
const watchlist = computed(() =>
  buildTomorrowWatchlist({
    dashboard: dashboard.value,
    replayHistory: replayHistory.value,
    entryRadar: entryRadar.value,
    stockMap: stockMap.value,
  }),
);

const hasData = computed(() => watchlist.value.sections.some((section) => section.items.length));
const pageSeo = computed(() => ({
  title: '隔日觀察清單',
  description: '把明日盤勢、穩健型 / 積極型名單與剛轉強個股整理成一頁，盤後直接知道隔天該先看哪些股票。',
  routePath: '/watchlist',
  keywords: ['隔日觀察清單', '盤後觀察', '穩健型', '積極型', '起漲卡位'],
}));

useSeoMeta(pageSeo);

onMounted(async () => {
  await loadGlobalData();
  await loadWatchlistData();
});

watch(
  () => [manifest.value?.stockRadarHistoryPath, manifest.value?.entryRadarPath],
  async () => {
    await loadWatchlistData();
  },
);

async function loadWatchlistData() {
  const historyPath = manifest.value?.stockRadarHistoryPath;
  const entryPath = manifest.value?.entryRadarPath;

  if (!historyPath && !entryPath) {
    return;
  }

  isExtraLoading.value = true;
  extraError.value = '';

  try {
    const [historyData, entryData] = await Promise.all([
      historyPath ? fetchJson(historyPath) : Promise.resolve(null),
      entryPath ? fetchJson(entryPath) : Promise.resolve(null),
    ]);
    replayHistory.value = historyData;
    entryRadar.value = entryData;
  } catch (error) {
    extraError.value = error instanceof Error ? error.message : '隔日觀察清單載入失敗';
    replayHistory.value = null;
    entryRadar.value = null;
  } finally {
    isExtraLoading.value = false;
  }
}

function getCardTone(item) {
  if ((item?.changePercent ?? 0) > 0) return 'up';
  if ((item?.changePercent ?? 0) < 0) return 'down';
  return item?.tone ?? 'info';
}
</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isLoading || isExtraLoading"
      :error-message="extraError || errorMessage"
      :has-data="hasData"
      empty-message="隔日觀察清單資料尚未整理完成。"
    />

    <template v-if="hasData">
      <section class="page-hero compact watchlist-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Tomorrow Watchlist</span>
          <h1>隔日觀察清單</h1>
          <p>先看盤後重點，再把穩健型、積極型與剛轉強名單整理成一頁，隔天開盤前就知道先盯哪些標的。</p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">資料日期 {{ formatDate(watchlist.marketDate) }}</span>
            <span v-if="watchlist.topTheme" class="theme-observation-chip">主線題材 {{ watchlist.topTheme }}</span>
            <span class="theme-observation-chip">穩健 {{ formatNumber(watchlist.sections[0]?.items.length, 0) }} 檔</span>
            <span class="theme-observation-chip">積極 {{ formatNumber(watchlist.sections[1]?.items.length, 0) }} 檔</span>
          </div>
        </div>

        <aside class="radar-hero-board">
          <div class="radar-spotlight-grid">
            <article v-for="(item, index) in watchlist.observations" :key="`watch-observation-${index}`" class="radar-spotlight-card">
              <span class="theme-spotlight-label">明日觀察</span>
              <strong>重點 {{ index + 1 }}</strong>
              <p>{{ item }}</p>
            </article>
          </div>
        </aside>
      </section>

      <nav class="mobile-section-nav radar-section-nav" aria-label="隔日觀察清單快速導覽">
        <a v-for="section in watchlist.sections" :key="section.key" class="section-chip" :href="`#watch-${section.key}`">
          {{ section.title }}
        </a>
      </nav>

      <section class="watchlist-grid">
        <article v-for="section in watchlist.sections" :id="`watch-${section.key}`" :key="section.key" class="panel watchlist-section">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">{{ section.title }}</h2>
              <p class="panel-subtitle">{{ section.note }}</p>
            </div>
            <span class="meta-chip">{{ formatNumber(section.items.length, 0) }} 檔</span>
          </div>

          <div v-if="section.items.length" class="radar-stock-grid">
            <RouterLink
              v-for="item in section.items"
              :key="`${section.key}-${item.code}`"
              :to="createStockRoute(item.code)"
              class="radar-stock-card"
              :class="`is-${getCardTone(item)}`"
            >
              <div class="radar-stock-head">
                <div>
                  <strong>{{ item.code }} {{ item.name }}</strong>
                  <p class="muted">{{ item.industryName || item.themeTitle || '台股個股' }}</p>
                </div>
                <div class="radar-stock-chip-stack">
                  <span v-if="item.rating" class="meta-chip">{{ item.rating }} 星</span>
                  <span v-if="item.label" class="meta-chip">{{ item.label }}</span>
                </div>
              </div>

              <p class="radar-stock-note">{{ item.detail || item.note }}</p>

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
            <strong>{{ section.title }}今天沒有明顯名單</strong>
            <p>{{ section.emptyMessage }}</p>
          </div>
        </article>
      </section>
    </template>
  </section>
</template>
