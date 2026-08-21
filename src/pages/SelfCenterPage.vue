<script setup>
import { computed, defineAsyncComponent, onMounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { FunnelIcon, StarIcon } from '@heroicons/vue/24/outline';
import GlobalStockSearch from '../components/GlobalStockSearch.vue';
import InvestorCenterHeader from '../components/InvestorCenterHeader.vue';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import { useGlobalData } from '../composables/useGlobalData';

const WatchboardPage = defineAsyncComponent(() => import('./WatchboardPage.vue'));
const FavoritesHealthPage = defineAsyncComponent(() => import('./FavoritesHealthPage.vue'));

const route = useRoute();
const { favoriteCodes } = useFavoriteStocks();
const { dashboard, manifest, loadGlobalData } = useGlobalData();

const allowedViews = new Set(['watch', 'health']);
const activeView = computed(() => {
  const requested = String(route.query.view ?? '');
  return allowedViews.has(requested) ? requested : 'watch';
});
const hasFavorites = computed(() => favoriteCodes.value.length > 0);
const marketDate = computed(
  () =>
    dashboard.value?.市場總覽?.資料日期 ??
    dashboard.value?.市場總覽?.盤後資料日期 ??
    manifest.value?.generatedAtLocalDate ??
    '',
);
const tabs = computed(() => [
  {
    key: 'watch',
    label: '即時看盤',
    to: { path: '/self-center', query: { ...route.query, view: 'watch' } },
  },
  {
    key: 'health',
    label: '健康檢查',
    to: { path: '/self-center', query: { ...route.query, view: 'health' } },
  },
]);
const summary = computed(() =>
  hasFavorites.value ? `目前自選 ${favoriteCodes.value.length} 檔，先看漲跌與風險提醒。` : '',
);

onMounted(() => {
  loadGlobalData();
});
</script>

<template>
  <section class="page-shell investor-center-page self-center-page">
    <InvestorCenterHeader
      title="自選中心"
      :icon="StarIcon"
      :tabs="tabs"
      :active-key="activeView"
      :market-date="marketDate"
      :generated-at="manifest?.generatedAt"
      :summary="summary"
    />

    <section v-if="!hasFavorites" class="investor-center-empty">
      <h2>建立你的自選名單</h2>
      <p>搜尋股票後，在個股頁加入自選，這裡就會顯示看盤與健康檢查。</p>
      <GlobalStockSearch class="self-center-search" />
      <RouterLink class="investor-center-action" :to="{ path: '/scanner', query: { view: 'recommended' } }">
        <FunnelIcon aria-hidden="true" />
        先看今日精選
      </RouterLink>
    </section>

    <div v-else class="investor-center-content self-center-content" :class="`is-${activeView}`">
      <WatchboardPage v-if="activeView === 'watch'" />
      <FavoritesHealthPage v-else />
    </div>
  </section>
</template>
