<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import DataFreshnessBadge from '../components/DataFreshnessBadge.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { buildMarketBuzz } from '../lib/marketBuzz';
import { formatDate, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';

const { dashboard, manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const themeHistory = ref(null);
const isHistoryLoading = ref(false);
const historyError = ref('');
const activeBuzzTab = ref('keywords');

const buzz = computed(() => buildMarketBuzz(dashboard.value?.題材雷達, themeHistory.value));
const hasData = computed(() => Boolean(buzz.value.hotKeywords.length || buzz.value.hotTopics.length));
const heroCards = computed(() => [
  {
    title: '最熱關鍵詞',
    value: buzz.value.summary?.hottestKeyword?.keyword ?? '等待更新',
    note:
      buzz.value.summary?.hottestKeyword
        ? `近況提及 ${formatNumber(buzz.value.summary.hottestKeyword.count, 0)} 次`
        : '先看市場最近在討論什麼',
  },
  {
    title: '最熱題材',
    value: buzz.value.summary?.hottestTopic?.title ?? '等待更新',
    note:
      buzz.value.summary?.hottestTopic
        ? `熱度 ${formatNumber(buzz.value.summary.hottestTopic.discussionHeat, 0)}`
        : '先看哪個題材最集中',
  },
  {
    title: '話題股',
    value: buzz.value.summary?.hottestStock ? `${buzz.value.summary.hottestStock.code} ${buzz.value.summary.hottestStock.name}` : '等待更新',
    note:
      buzz.value.summary?.hottestStock
        ? `${buzz.value.summary.hottestStock.topicTitle}｜20 日 ${formatPercent(buzz.value.summary.hottestStock.return20)}`
        : '先看哪檔最常被題材帶到',
  },
]);

const pageSeo = computed(() => ({
  title: '熱門新聞關鍵詞 + 市場熱度',
  description: '整理近期熱門新聞關鍵詞、題材熱度與話題股，幫你快速判斷市場最近在關注什麼。',
  routePath: '/market-buzz',
  keywords: ['熱門新聞', '市場熱度', '題材熱度', '關鍵詞', '話題股'],
}));

useSeoMeta(pageSeo);

onMounted(async () => {
  await loadGlobalData();
  await loadThemeHistory();
});

watch(
  () => manifest.value?.topicHistoryPath,
  async () => {
    await loadThemeHistory();
  },
);

async function loadThemeHistory() {
  const historyPath = manifest.value?.topicHistoryPath;
  if (!historyPath) return;

  isHistoryLoading.value = true;
  historyError.value = '';

  try {
    themeHistory.value = await fetchJson(historyPath);
  } catch (error) {
    historyError.value = error instanceof Error ? error.message : '市場熱度歷史載入失敗';
    themeHistory.value = null;
  } finally {
    isHistoryLoading.value = false;
  }
}

function getToneClass(value) {
  if ((value ?? 0) > 0) return 'text-up';
  if ((value ?? 0) < 0) return 'text-down';
  return '';
}

function setBuzzTab(tab) {
  activeBuzzTab.value = tab;
}
</script>

<template>
  <section class="page-shell market-buzz-page">
    <StatusCard
      :is-loading="isLoading || isHistoryLoading"
      :error-message="historyError || errorMessage"
      :has-data="hasData"
      empty-message="熱門新聞與市場熱度資料尚未整理完成。"
    />

    <template v-if="hasData">
      <section class="page-hero compact radar-page-hero market-buzz-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Market Buzz</span>
          <h1>熱門新聞關鍵詞 + 市場熱度</h1>
          <p class="page-subtitle">用近期新聞、題材熱度與題材輪動去抓市場正在關注的關鍵詞，再回頭找最受討論的題材與個股。</p>
          <div class="hero-summary-grid market-buzz-summary-grid">
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

        <aside class="radar-hero-board market-buzz-hero-board">
          <article class="theme-spotlight-card is-info">
            <span class="theme-spotlight-label">資料節奏</span>
            <strong>{{ formatDate(dashboard?.題材雷達?.marketDate ?? manifest?.generatedAt?.slice(0, 10)) }}</strong>
            <p>新聞只看近期資料，避免太久以前的話題混進來誤導節奏。</p>
            <DataFreshnessBadge
              :generated-at="dashboard?.generatedAt ?? manifest?.generatedAt"
              :market-date="dashboard?.題材雷達?.marketDate"
              size="compact"
            />
          </article>
        </aside>
      </section>

      <section class="panel market-tabs-panel market-buzz-main-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">新聞熱度切換</h2>
            <p class="panel-subtitle">先看市場正在反覆提到的關鍵詞，再切到題材熱度排行確認資金主線。</p>
          </div>
        </div>
        <div class="radar-tabbar market-section-tabbar" role="tablist" aria-label="市場熱度切換">
          <button
            type="button"
            class="radar-tab-button"
            :class="{ 'is-active': activeBuzzTab === 'keywords' }"
            :aria-selected="activeBuzzTab === 'keywords'"
            @click="setBuzzTab('keywords')"
          >
            <span>熱門關鍵詞</span>
            <small>{{ formatNumber(buzz.hotKeywords.length, 0) }} 組</small>
          </button>
          <button
            type="button"
            class="radar-tab-button"
            :class="{ 'is-active': activeBuzzTab === 'topics' }"
            :aria-selected="activeBuzzTab === 'topics'"
            @click="setBuzzTab('topics')"
          >
            <span>市場熱度排行</span>
            <small>{{ formatNumber(buzz.hotTopics.length, 0) }} 個</small>
          </button>
        </div>

        <article v-if="activeBuzzTab === 'keywords'" class="market-tab-content">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">熱門關鍵詞</h2>
              <p class="panel-subtitle">先看最近被反覆提到的字，再確認它對應的是哪個題材與哪些代表股。</p>
            </div>
            <span class="meta-chip">{{ formatNumber(buzz.hotKeywords.length, 0) }} 組</span>
          </div>

          <div class="market-buzz-keyword-grid">
            <article
              v-for="item in buzz.hotKeywords"
              :key="item.keyword"
              class="sub-panel market-buzz-keyword-card"
            >
              <div class="market-quote-head">
                <div>
                  <strong>{{ item.keyword }}</strong>
                  <p class="muted">{{ item.topics.join(' / ') }}</p>
                </div>
                <span class="status-badge is-info">提及 {{ formatNumber(item.count, 0) }}</span>
              </div>
              <div class="market-buzz-stock-row">
                <RouterLink
                  v-for="stock in item.representativeStocks"
                  :key="`${item.keyword}-${stock.code}`"
                  :to="createStockRoute(stock.code)"
                  class="meta-chip is-normal market-buzz-stock-chip"
                >
                  {{ stock.code }} {{ stock.name }}
                </RouterLink>
              </div>
            </article>
          </div>
        </article>

        <article v-else class="market-tab-content">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">市場熱度排行</h2>
              <p class="panel-subtitle">把新聞熱度、熱門股、法人與 ETF 曝光一起看，挑出目前最值得追蹤的題材。</p>
            </div>
            <span class="meta-chip">{{ formatNumber(buzz.hotTopics.length, 0) }} 個</span>
          </div>

          <div class="focus-card-list">
            <article
              v-for="topic in buzz.hotTopics.slice(0, 8)"
              :key="topic.slug"
              class="focus-card-item market-buzz-topic-card"
            >
              <div class="market-buzz-topic-head">
                <div>
                  <strong>{{ topic.title }}</strong>
                  <p class="muted">{{ topic.observation }}</p>
                </div>
                <span class="status-badge" :class="`is-${topic.tone}`">熱度 {{ formatNumber(topic.discussionHeat, 0) }}</span>
              </div>

              <div class="market-quote-metrics">
                <div>
                  <span>新聞</span>
                  <strong>{{ formatNumber(topic.newsCount, 0) }}</strong>
                </div>
                <div>
                  <span>熱門股</span>
                  <strong>{{ formatNumber(topic.hotCount, 0) }}</strong>
                </div>
                <div>
                  <span>法人 / ETF</span>
                  <strong>{{ formatNumber(topic.institutionalCount, 0) }} / {{ formatNumber(topic.etfCount, 0) }}</strong>
                </div>
              </div>

              <div class="market-buzz-stock-row">
                <RouterLink
                  v-for="stock in (topic.relatedStocks ?? []).slice(0, 4)"
                  :key="`${topic.slug}-${stock.code}`"
                  :to="createStockRoute(stock.code)"
                  class="meta-chip market-buzz-stock-chip"
                  :class="`is-${stock.changePercent > 0 ? 'up' : stock.changePercent < 0 ? 'down' : 'normal'}`"
                >
                  {{ stock.code }} {{ stock.name }} {{ formatPercent(stock.changePercent) }}
                </RouterLink>
              </div>
            </article>
          </div>
        </article>
      </section>
    </template>
  </section>
</template>
