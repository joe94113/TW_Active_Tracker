<script setup>
import { computed, defineAsyncComponent, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ShieldExclamationIcon } from '@heroicons/vue/24/outline';
import InvestorCenterHeader from '../components/InvestorCenterHeader.vue';
import { useGlobalData } from '../composables/useGlobalData';

const OfficialRadarPage = defineAsyncComponent(() => import('./OfficialRadarPage.vue'));
const DispositionRadarPage = defineAsyncComponent(() => import('./DispositionRadarPage.vue'));

const route = useRoute();
const { dashboard, manifest, stockList, stockSearchList, loadGlobalData } = useGlobalData();

const allowedViews = new Set(['risk', 'disposition', 'events']);
const activeView = computed(() => {
  const requested = String(route.query.view ?? '');
  return allowedViews.has(requested) ? requested : 'risk';
});
const stockUniverse = computed(() => (stockSearchList.value.length ? stockSearchList.value : stockList.value));
const riskCount = computed(
  () =>
    stockUniverse.value.filter(
      (item) => item.isUnderDisposition || item.hasChangedTrading || item.hasAttentionWarning,
    ).length,
);
const upcomingEventCount = computed(() => {
  const referenceText = String(manifest.value?.generatedAt ?? '').slice(0, 10);
  const referenceDate = new Date(`${referenceText}T00:00:00+08:00`);
  if (Number.isNaN(referenceDate.getTime())) return 0;

  return stockUniverse.value.filter((item) => {
    const eventText = String(item.nextExDividendDate ?? '').trim().replaceAll('/', '-');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventText)) return false;
    const eventDate = new Date(`${eventText}T00:00:00+08:00`);
    const days = Math.round((eventDate.getTime() - referenceDate.getTime()) / 86400000);
    return days >= 0 && days <= 21;
  }).length;
});
const marketDate = computed(
  () =>
    dashboard.value?.市場總覽?.資料日期 ??
    dashboard.value?.市場總覽?.盤後資料日期 ??
    manifest.value?.generatedAtLocalDate ??
    '',
);
const tabs = computed(() => [
  {
    key: 'risk',
    label: '風險名單',
    to: { path: '/official-radar', query: { ...route.query, view: 'risk' } },
  },
  {
    key: 'disposition',
    label: '處置籌碼',
    to: { path: '/official-radar', query: { ...route.query, view: 'disposition' } },
  },
  {
    key: 'events',
    label: '近期事件',
    to: { path: '/official-radar', query: { ...route.query, view: 'events' } },
  },
]);
const summary = computed(() => {
  if (!stockUniverse.value.length || activeView.value === 'disposition') return '';
  if (activeView.value === 'events') {
    return upcomingEventCount.value
      ? `接下來 21 天有 ${upcomingEventCount.value} 檔除息事件值得留意。`
      : '接下來 21 天沒有已整理的除息事件。';
  }
  return riskCount.value
    ? `目前有 ${riskCount.value} 檔列入官方提醒，先確認交易限制。`
    : '目前沒有股票列入官方提醒。';
});

onMounted(() => {
  loadGlobalData();
});
</script>

<template>
  <section class="page-shell investor-center-page official-center-page">
    <InvestorCenterHeader
      title="官方交易"
      :icon="ShieldExclamationIcon"
      :tabs="tabs"
      :active-key="activeView"
      :market-date="marketDate"
      :generated-at="manifest?.generatedAt"
      :summary="summary"
      summary-tone="warning"
    />

    <div class="investor-center-content official-center-content" :class="`is-${activeView}`">
      <DispositionRadarPage v-if="activeView === 'disposition'" />
      <OfficialRadarPage v-else />
    </div>
  </section>
</template>
