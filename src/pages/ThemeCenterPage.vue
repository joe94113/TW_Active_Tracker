<script setup>
import { computed, defineAsyncComponent, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { BoltIcon } from '@heroicons/vue/24/outline';
import InvestorCenterHeader from '../components/InvestorCenterHeader.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { formatNumber, formatPercent } from '../lib/formatters';
import { buildIndustryPulse } from '../lib/industryPulse';

const ThemeRadarPage = defineAsyncComponent(() => import('./ThemeRadarPage.vue'));
const IndustryPulsePage = defineAsyncComponent(() => import('./IndustryPulsePage.vue'));
const MarketBuzzPage = defineAsyncComponent(() => import('./MarketBuzzPage.vue'));

const route = useRoute();
const { dashboard, manifest, stockSearchList, loadGlobalData } = useGlobalData();

const allowedViews = new Set(['topics', 'industry', 'news']);
const activeView = computed(() => {
  const requested = String(route.query.view ?? '');
  return allowedViews.has(requested) ? requested : 'topics';
});
const topics = computed(() => dashboard.value?.題材雷達?.topics ?? []);
const topTopic = computed(() => topics.value[0] ?? null);
const hottestNewsTopic = computed(
  () => [...topics.value].sort((left, right) => Number(right.newsCount ?? 0) - Number(left.newsCount ?? 0))[0] ?? null,
);
const industryPulse = computed(() => buildIndustryPulse(stockSearchList.value, dashboard.value?.題材雷達));
const strongestIndustry = computed(() => industryPulse.value?.summary?.strongestIndustry ?? null);
const marketDate = computed(
  () =>
    dashboard.value?.市場總覽?.資料日期 ??
    dashboard.value?.市場總覽?.盤後資料日期 ??
    manifest.value?.generatedAtLocalDate ??
    '',
);
const tabs = computed(() => [
  {
    key: 'topics',
    label: '題材排行',
    to: { path: '/themes', query: { ...route.query, view: 'topics' } },
  },
  {
    key: 'industry',
    label: '產業熱度',
    to: { path: '/themes', query: { ...route.query, view: 'industry' } },
  },
  {
    key: 'news',
    label: '新聞熱度',
    to: { path: '/themes', query: { ...route.query, view: 'news' } },
  },
]);
const summary = computed(() => {
  if (activeView.value === 'industry' && strongestIndustry.value) {
    return `${strongestIndustry.value.industryName} 目前較強，平均漲跌 ${formatPercent(strongestIndustry.value.avgChangePercent)}。`;
  }
  if (activeView.value === 'news' && hottestNewsTopic.value) {
    return `${hottestNewsTopic.value.title}的新聞較集中，共 ${formatNumber(hottestNewsTopic.value.newsCount)} 則。`;
  }
  if (topTopic.value) {
    return `${topTopic.value.title} 目前排名第一，題材分數 ${formatNumber(topTopic.value.score)}。`;
  }
  return '';
});

onMounted(() => {
  loadGlobalData();
});
</script>

<template>
  <section class="page-shell investor-center-page theme-center-page">
    <InvestorCenterHeader
      title="資金題材"
      :icon="BoltIcon"
      :tabs="tabs"
      :active-key="activeView"
      :market-date="marketDate"
      :generated-at="manifest?.generatedAt"
      :summary="summary"
      summary-tone="up"
    />

    <div class="investor-center-content theme-center-content" :class="`is-${activeView}`">
      <ThemeRadarPage v-if="activeView === 'topics'" />
      <IndustryPulsePage v-else-if="activeView === 'industry'" />
      <MarketBuzzPage v-else />
    </div>
  </section>
</template>
