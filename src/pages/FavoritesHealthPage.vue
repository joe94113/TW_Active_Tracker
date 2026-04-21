<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { buildEventPerformanceOverview } from '../lib/eventStats';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { buildSummaryHealthScore, buildSummaryOverheatWarnings } from '../lib/stockHealth';
import { createStockRoute } from '../lib/stockRouting';
import { createStockCodeMap, mergeStockUniverse } from '../lib/stockUniverse';

const { favoriteCodes } = useFavoriteStocks();
const { stockList, stockSearchList, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const detailMap = ref(new Map());
const isDetailLoading = ref(false);
const detailError = ref('');

const universe = computed(() => mergeStockUniverse(stockList.value, stockSearchList.value));
const stockMap = computed(() => createStockCodeMap(universe.value));
const favoriteSummaries = computed(() =>
  favoriteCodes.value
    .map((code) => stockMap.value.get(code))
    .filter(Boolean)
    .map((item) => {
      const health = buildSummaryHealthScore(item);
      const warnings = buildSummaryOverheatWarnings(item);
      const eventOverview = buildEventPerformanceOverview(detailMap.value.get(item.code));

      return {
        ...item,
        healthScore: health.totalScore,
        healthGrade: health.grade,
        healthTone: health.tone,
        warnings,
        eventOverview,
      };
    }),
);
const favoritesOverviewCards = computed(() => {
  if (!favoriteSummaries.value.length) {
    return [];
  }

  const healthiest = [...favoriteSummaries.value].sort((left, right) => (right.healthScore ?? 0) - (left.healthScore ?? 0))[0];
  const overheatedCount = favoriteSummaries.value.filter((item) => item.warnings.some((warning) => warning.tone === 'risk' || warning.tone === 'warning')).length;
  const eventPositiveCount = favoriteSummaries.value.filter((item) => (item.eventOverview?.some((entry) => (entry.metrics?.[5]?.averageReturn ?? 0) > 0) ?? false)).length;

  return [
    {
      title: '體檢最佳',
      value: healthiest ? `${healthiest.code} ${healthiest.name}` : '-',
      note: healthiest ? `目前體檢 ${healthiest.healthScore} 分，適合優先追蹤` : '等待自選股資料',
      tone: healthiest?.healthScore >= 75 ? 'up' : 'neutral',
    },
    {
      title: '過熱留意',
      value: `${formatNumber(overheatedCount, 0)} 檔`,
      note: '短線偏熱、公告風險或追價壓力較高的自選股數量',
      tone: overheatedCount > 0 ? 'warning' : 'neutral',
    },
    {
      title: '事件統計偏正面',
      value: `${formatNumber(eventPositiveCount, 0)} 檔`,
      note: '近 8 次月營收 / 財報事件後，5 日平均反應仍偏正面的自選股',
      tone: eventPositiveCount > 0 ? 'up' : 'neutral',
    },
  ];
});

const hasData = computed(() => favoriteCodes.value.length > 0);

const pageSeo = computed(() => ({
  title: '自選股健檢中心',
  description: '集中看自選股的體檢分數、風險提醒、法人方向與事件後表現統計，不用一檔一檔點進去。',
  routePath: '/favorites-health',
  keywords: ['自選股健檢', '股票體檢', '事件後表現', '自選股中心'],
}));

useSeoMeta(pageSeo);

onMounted(async () => {
  await loadGlobalData();
  await loadFavoriteDetails();
});

watch(
  () => favoriteCodes.value.join(','),
  async () => {
    await loadFavoriteDetails();
  },
);

async function loadFavoriteDetails() {
  if (!favoriteCodes.value.length) {
    detailMap.value = new Map();
    return;
  }

  isDetailLoading.value = true;
  detailError.value = '';

  try {
    const entries = await Promise.all(
      favoriteCodes.value.map(async (code) => {
        try {
          const detail = await fetchJson(`data/stocks/${code}.json`);
          return [code, detail];
        } catch {
          return [code, null];
        }
      }),
    );

    detailMap.value = new Map(entries.filter(([, detail]) => detail));
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : '自選股健檢載入失敗';
  } finally {
    isDetailLoading.value = false;
  }
}

function getHealthTone(item) {
  if ((item?.healthScore ?? 0) >= 75) return 'up';
  if ((item?.healthScore ?? 0) <= 45) return 'down';
  return 'normal';
}

function getWarningTone(item) {
  const tone = item?.warnings?.[0]?.tone;
  if (tone === 'risk') return 'risk';
  if (tone === 'warning') return 'warning';
  return 'info';
}
</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isLoading || isDetailLoading"
      :error-message="detailError || errorMessage"
      :has-data="hasData"
      empty-message="還沒有自選股，先到個股頁加進自選股後，這裡就會自動整理健檢中心。"
    />

    <template v-if="hasData">
      <section class="page-hero compact radar-page-hero favorites-health-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Favorites Health Center</span>
          <h1>自選股健檢中心</h1>
          <p>把自選股的體檢分數、過熱提醒、法人方向與事件後表現統計整理在同一頁，盤後快速知道誰該續抱、誰先不要追。</p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">自選股 {{ formatNumber(favoriteCodes.length, 0) }} 檔</span>
            <span class="theme-observation-chip">已載入明細 {{ formatNumber(detailMap.size, 0) }} 檔</span>
          </div>
        </div>

        <aside class="radar-hero-board favorites-health-hero-board">
          <div class="radar-spotlight-grid favorites-health-hero-grid">
            <article
              v-for="card in favoritesOverviewCards"
              :key="card.title"
              class="radar-spotlight-card favorites-health-hero-card"
              :class="`is-${card.tone}`"
            >
              <span class="theme-spotlight-label">{{ card.title }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.note }}</p>
            </article>
          </div>
        </aside>
      </section>

      <section class="radar-page-layout favorites-health-layout">
        <div class="radar-main-column">
          <section class="panel radar-section-panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">自選股總覽</h2>
                <p class="panel-subtitle">先看體檢、過熱提醒與法人方向，再決定隔日追蹤順序。</p>
              </div>
            </div>

            <div class="radar-stock-grid">
              <RouterLink
                v-for="item in favoriteSummaries"
                :key="item.code"
                :to="createStockRoute(item.code)"
                class="radar-stock-card"
                :class="`is-${getHealthTone(item)}`"
              >
                <div class="radar-stock-head">
                  <div>
                    <strong>{{ item.code }} {{ item.name }}</strong>
                    <p class="muted">{{ item.industryName || '台股個股' }}</p>
                  </div>
                  <div class="radar-stock-chip-stack">
                    <span class="meta-chip" :class="`is-${getHealthTone(item)}`">體檢 {{ item.healthScore }}</span>
                    <span class="meta-chip">{{ item.healthGrade }}</span>
                  </div>
                </div>

                <div v-if="item.warnings.length" class="entry-warning-chip-row">
                  <span class="status-badge" :class="`is-${getWarningTone(item)}`">{{ item.warnings[0].title }}</span>
                  <span class="muted">先確認是不是已經太熱或有公告風險。</span>
                </div>

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

                <div v-if="item.eventOverview.length" class="favorites-event-preview">
                  <article v-for="entry in item.eventOverview" :key="`${item.code}-${entry.key}`" class="sub-panel favorites-event-card">
                    <strong>{{ entry.title }}</strong>
                    <p class="muted">{{ entry.sampleCount }} 次樣本</p>
                    <div class="compact-grid">
                      <div>
                        <span>3 日</span>
                        <strong :class="{ 'text-up': (entry.metrics[3]?.averageReturn ?? 0) > 0, 'text-down': (entry.metrics[3]?.averageReturn ?? 0) < 0 }">
                          {{ formatPercent(entry.metrics[3]?.averageReturn) }}
                        </strong>
                      </div>
                      <div>
                        <span>5 日</span>
                        <strong :class="{ 'text-up': (entry.metrics[5]?.averageReturn ?? 0) > 0, 'text-down': (entry.metrics[5]?.averageReturn ?? 0) < 0 }">
                          {{ formatPercent(entry.metrics[5]?.averageReturn) }}
                        </strong>
                      </div>
                    </div>
                  </article>
                </div>
              </RouterLink>
            </div>
          </section>
        </div>

        <aside class="radar-sidebar">
          <article class="panel radar-sidebar-card radar-sidebar-card-sticky">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">怎麼用</h2>
                <p class="panel-subtitle">先看體檢與過熱提醒，再用事件統計確認這檔股票平常對消息的反應。</p>
              </div>
            </div>
            <ol class="theme-playbook-list">
              <li>先挑體檢分數高、而且沒有過熱提醒的自選股。</li>
              <li>如果外資 / 投信也同步偏多，隔天優先排進觀察名單。</li>
              <li>再看事件後表現統計，確認這檔股票對月營收或財報消息是偏正面還是容易利多出盡。</li>
            </ol>
          </article>
        </aside>
      </section>
    </template>
  </section>
</template>
