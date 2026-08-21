<script setup>
import { computed, defineAsyncComponent, onMounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { FunnelIcon } from '@heroicons/vue/24/outline';
import InvestorCenterHeader from '../components/InvestorCenterHeader.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';
import { buildStockRadar } from '../lib/stockRadar';

const StockScannerPage = defineAsyncComponent(() => import('./StockScannerPage.vue'));
const StockRadarPage = defineAsyncComponent(() => import('./StockRadarPage.vue'));

const route = useRoute();
const { dashboard, manifest, stockList, stockSearchList, loadGlobalData } = useGlobalData();

const allowedViews = new Set(['custom', 'recommended']);
const activeView = computed(() => {
  const requested = String(route.query.view ?? '');
  return allowedViews.has(requested) ? requested : 'custom';
});
const sourceStocks = computed(() => (stockList.value.length ? stockList.value : stockSearchList.value));
const radar = computed(() =>
  buildStockRadar({
    stockSummaries: sourceStocks.value,
    stockSearchList: stockSearchList.value,
    themeRadar: dashboard.value?.題材雷達 ?? null,
  }),
);
const recommendedCount = computed(
  () =>
    new Set(
      [
        ...(radar.value?.technicalBreakouts ?? []),
        ...(radar.value?.institutionalMomentum ?? []),
        ...(radar.value?.squeezeCandidates ?? []),
        ...(radar.value?.valuationSupport ?? []),
      ]
        .map((item) => item?.code)
        .filter(Boolean),
    ).size,
);
const mobileRecommendations = computed(() => {
  const candidates = [
    { label: '技術突破', items: radar.value?.technicalBreakouts ?? [] },
    { label: '籌碼偏多', items: radar.value?.institutionalMomentum ?? [] },
    { label: '整理待發', items: radar.value?.squeezeCandidates ?? [] },
    { label: '估值支撐', items: radar.value?.valuationSupport ?? [] },
  ]
    .flatMap((group) => group.items.map((item) => ({ ...item, recommendationLabel: group.label })))
    .sort(
      (left, right) =>
        Number(right.score ?? right.healthScore ?? 0) - Number(left.score ?? left.healthScore ?? 0),
    );

  const seen = new Set();
  return candidates
    .filter((item) => {
      if (!item.code || seen.has(item.code)) return false;
      seen.add(item.code);
      return true;
    })
    .slice(0, 3);
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
    key: 'custom',
    label: '自訂條件',
    to: { path: '/scanner', query: { ...route.query, view: 'custom' } },
  },
  {
    key: 'recommended',
    label: '系統推薦',
    to: { path: '/scanner', query: { ...route.query, view: 'recommended' } },
  },
]);
const summary = computed(() => {
  if (!sourceStocks.value.length) return '';
  if (activeView.value === 'recommended') {
    return `完整名單有 ${recommendedCount.value} 檔，先比較入選原因與追價風險。`;
  }
  return `目前可掃描 ${sourceStocks.value.length} 檔股票，條件可自由調整。`;
});

function getRecommendationRisk(item) {
  if (item.topWarningTitle) return item.topWarningTitle;
  if (item.isUnderDisposition) return '處置股';
  if (item.hasChangedTrading) return '變更交易';
  if (item.hasAttentionWarning) return '注意股';
  if (Number(item.changePercent ?? 0) >= 6) return '漲幅偏大';
  return item.recommendationLabel;
}

onMounted(() => {
  loadGlobalData();
});
</script>

<template>
  <section class="page-shell investor-center-page stock-scanner-center-page">
    <InvestorCenterHeader
      title="條件掃描"
      :icon="FunnelIcon"
      :tabs="tabs"
      :active-key="activeView"
      :market-date="marketDate"
      :generated-at="manifest?.generatedAt"
      :summary="summary"
    />

    <div class="investor-center-content stock-scanner-center-content" :class="`is-${activeView}`">
      <StockScannerPage v-if="activeView === 'custom'" />
      <template v-else>
        <section v-if="mobileRecommendations.length" class="mobile-system-picks" aria-labelledby="mobile-system-picks-title">
          <h2 id="mobile-system-picks-title">
            今日 <strong>{{ mobileRecommendations.length }}</strong> 個機會
          </h2>

          <div class="mobile-system-pick-list">
            <RouterLink
              v-for="(item, index) in mobileRecommendations"
              :key="`mobile-recommendation-${item.code}`"
              class="mobile-system-pick"
              :to="createStockRoute(item.code)"
            >
              <span class="mobile-system-rank" :class="{ 'is-first': index === 0 }">{{ index + 1 }}</span>
              <div class="mobile-system-pick-body">
                <div class="mobile-system-pick-head">
                  <strong>{{ item.code }} {{ item.name }}</strong>
                  <div class="mobile-system-market">
                    <strong>{{ formatNumber(item.close) }}</strong>
                    <span :class="{ 'text-up': Number(item.changePercent ?? 0) > 0, 'text-down': Number(item.changePercent ?? 0) < 0 }">
                      {{ formatPercent(item.changePercent) }}
                    </span>
                  </div>
                </div>
                <p>{{ item.note || `${item.recommendationLabel}訊號較明顯。` }}</p>
                <span class="mobile-system-risk">{{ getRecommendationRisk(item) }}</span>
              </div>
            </RouterLink>
          </div>
        </section>

        <StockRadarPage class="stock-radar-full-view" />
      </template>
    </div>
  </section>
</template>
