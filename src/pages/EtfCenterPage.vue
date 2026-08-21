<script setup>
import { computed, defineAsyncComponent, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ChartPieIcon } from '@heroicons/vue/24/outline';
import InvestorCenterHeader from '../components/InvestorCenterHeader.vue';
import { useGlobalData } from '../composables/useGlobalData';

const EtfListPage = defineAsyncComponent(() => import('./EtfListPage.vue'));
const EtfOverlapPage = defineAsyncComponent(() => import('./EtfOverlapPage.vue'));
const HighDividendEtfFlowPage = defineAsyncComponent(() => import('./HighDividendEtfFlowPage.vue'));

const route = useRoute();
const { dashboard, manifest, overlap, trackedEtfs, loadGlobalData } = useGlobalData();

const allowedViews = new Set(['list', 'overlap', 'dividend']);
const activeView = computed(() => {
  const requested = String(route.query.view ?? '');
  return allowedViews.has(requested) ? requested : 'list';
});
const marketDate = computed(
  () =>
    dashboard.value?.市場總覽?.資料日期 ??
    dashboard.value?.市場總覽?.盤後資料日期 ??
    manifest.value?.generatedAtLocalDate ??
    '',
);
const overlapCount = computed(() => overlap.value?.共同持股?.length ?? 0);
const tabs = computed(() => [
  {
    key: 'list',
    label: 'ETF 清單',
    to: { path: '/etfs', query: { ...route.query, view: 'list' } },
  },
  {
    key: 'overlap',
    label: '持股重疊',
    to: { path: '/etfs', query: { ...route.query, view: 'overlap' } },
  },
  {
    key: 'dividend',
    label: '高股息換股',
    to: { path: '/etfs', query: { ...route.query, view: 'dividend' } },
  },
]);
const summary = computed(() => {
  if (activeView.value === 'overlap' && overlapCount.value) {
    return `目前有 ${overlapCount.value} 檔共同持股，可比較重疊程度。`;
  }
  if (activeView.value === 'list' && trackedEtfs.value.length) {
    return `目前收錄 ${trackedEtfs.value.length} 檔 ETF，可直接查看持股與最新異動。`;
  }
  return '';
});

onMounted(() => {
  loadGlobalData();
});
</script>

<template>
  <section class="page-shell investor-center-page etf-center-page">
    <InvestorCenterHeader
      title="ETF 中心"
      :icon="ChartPieIcon"
      :tabs="tabs"
      :active-key="activeView"
      :market-date="marketDate"
      :generated-at="manifest?.generatedAt"
      :summary="summary"
    />

    <div class="investor-center-content etf-center-content" :class="`is-${activeView}`">
      <EtfListPage v-if="activeView === 'list'" />
      <EtfOverlapPage v-else-if="activeView === 'overlap'" />
      <HighDividendEtfFlowPage v-else />
    </div>
  </section>
</template>
