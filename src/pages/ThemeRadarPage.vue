<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import StatusCard from '../components/StatusCard.vue';
import { fetchJson } from '../lib/api';
import { createStockRoute } from '../lib/stockRouting';
import {
  formatAmount,
  formatDate,
  formatLots,
  formatNumber,
  formatPercent,
} from '../lib/formatters';
import { buildThemeHistoryOverview } from '../lib/themeHistory';
import { getThemeToneLabel } from '../lib/themeRadar';

const { manifest, dashboard, isLoading, errorMessage, loadGlobalData } = useGlobalData();
const themeHistory = ref(null);
const isHistoryLoading = ref(false);
const historyError = ref('');
const selectedWindow = ref(5);
const historyWindows = [5, 10, 20];

const themeRadar = computed(() => dashboard.value?.題材雷達 ?? null);
const topics = computed(() => themeRadar.value?.topics ?? []);
const topTopic = computed(() => topics.value[0] ?? null);
const featuredTopics = computed(() => topics.value.slice(0, 3));
const historyOverview = computed(() => buildThemeHistoryOverview(themeHistory.value, topics.value));
const selectedHistoryTrend = computed(() => historyOverview.value.trendsByWindow[selectedWindow.value] ?? {
  warming: [],
  cooling: [],
  previousLeader: null,
});

const spotlightCards = computed(() => {
  const newsLeader = [...topics.value]
    .sort((left, right) => (right.newsCount ?? 0) - (left.newsCount ?? 0) || (right.score ?? 0) - (left.score ?? 0))[0] ?? null;
  const capitalLeader = [...topics.value]
    .sort(
      (left, right) =>
        ((right.institutionalCount ?? 0) + (right.etfCount ?? 0)) -
          ((left.institutionalCount ?? 0) + (left.etfCount ?? 0)) ||
        (right.score ?? 0) - (left.score ?? 0),
    )[0] ?? null;

  return [
    {
      key: 'top',
      label: '今日主線',
      title: topTopic.value?.title ?? '等待新的主線',
      description: topTopic.value?.observation ?? '今天還沒有很明確的主線題材。',
      meta: topTopic.value
        ? `分數 ${formatNumber(topTopic.value.score, 0)}｜龍頭 ${topTopic.value.leaderStocks?.[0]?.code ?? '-'}`
        : '資料整理中',
      tone: topTopic.value?.tone ?? 'info',
    },
    {
      key: 'news',
      label: '新聞熱度',
      title: newsLeader?.title ?? '等待新的催化',
      description: newsLeader?.observation ?? '近期新聞熱度尚未集中。',
      meta: newsLeader
        ? `新聞 ${formatNumber(newsLeader.newsCount, 0)} 則｜關鍵字 ${formatNumber(newsLeader.keywords?.length ?? 0, 0)} 個`
        : '資料整理中',
      tone: newsLeader?.tone ?? 'info',
    },
    {
      key: 'capital',
      label: '法人 / ETF',
      title: capitalLeader?.title ?? '等待資金聚焦',
      description: capitalLeader?.observation ?? '法人與 ETF 曝光還沒有明顯集中。',
      meta: capitalLeader
        ? `法人 ${formatNumber(capitalLeader.institutionalCount, 0)} 檔｜ETF ${formatNumber(capitalLeader.etfCount, 0)} 檔`
        : '資料整理中',
      tone: capitalLeader?.tone ?? 'info',
    },
  ];
});

const pageSeo = computed(() => ({
  title: '資金題材雷達',
  description: '用題材強度排行、題材輪動歷史、龍頭股與補漲股比較表快速判斷台股近期資金主線。',
  routePath: '/themes',
  keywords: ['資金題材雷達', '題材輪動', 'CPO', 'PCB', 'ABF 載板', '補漲股', '龍頭股'],
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

  if (!historyPath) {
    return;
  }

  isHistoryLoading.value = true;
  historyError.value = '';

  try {
    themeHistory.value = await fetchJson(historyPath);
  } catch (error) {
    historyError.value = error instanceof Error ? error.message : '題材輪動歷史載入失敗';
    themeHistory.value = null;
  } finally {
    isHistoryLoading.value = false;
  }
}

function getTopicAnchor(slug) {
  return `topic-${slug}`;
}

function formatHeadlineTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatTargetPrice(stock) {
  if (stock?.foreignTargetPrice === null || stock?.foreignTargetPrice === undefined) {
    return '暫無';
  }

  const premium = stock.foreignTargetPricePremium;
  const premiumText = premium === null || premium === undefined ? '' : ` / ${formatPercent(premium)}`;
  const brokerText = stock.foreignTargetBroker ? ` ${stock.foreignTargetBroker}` : '';
  return `${formatNumber(stock.foreignTargetPrice)}${premiumText}${brokerText}`;
}

function formatChangeTone(value) {
  const number = Number(value ?? 0);

  if (number > 0) {
    return 'text-up';
  }

  if (number < 0) {
    return 'text-down';
  }

  return '';
}
</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(themeRadar)"
      empty-message="題材雷達資料尚未整理完成。"
    />

    <template v-if="themeRadar">
      <section class="page-hero compact theme-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Theme Radar</span>
          <h1>資金題材雷達</h1>
          <p>聚焦近期主線、輪動變化、龍頭股、補漲股與籌碼確認。</p>
          <div v-if="themeRadar.observations?.length" class="theme-radar-summary">
            <span
              v-for="(item, index) in themeRadar.observations"
              :key="`theme-observation-${index}`"
              class="theme-observation-chip"
            >
              {{ item }}
            </span>
          </div>
        </div>

        <aside class="theme-hero-board">
          <div class="theme-hero-board-meta">
            <div class="hero-stat-card">
              <span class="hero-stat-label">資料日</span>
              <strong>{{ formatDate(themeRadar.marketDate) }}</strong>
            </div>
            <div class="hero-stat-card">
              <span class="hero-stat-label">題材數</span>
              <strong>{{ formatNumber(topics.length, 0) }}</strong>
              <span class="meta-text">目前主線與支線題材</span>
            </div>
            <div class="hero-stat-card">
              <span class="hero-stat-label">歷史快照</span>
              <strong>{{ formatNumber(historyOverview.snapshotCount, 0) }}</strong>
              <span class="meta-text">用近 5 / 10 / 20 日看輪動</span>
            </div>
          </div>
          <div class="theme-spotlight-grid">
            <article
              v-for="card in spotlightCards"
              :key="card.key"
              class="theme-spotlight-card"
              :class="`is-${card.tone}`"
            >
              <span class="theme-spotlight-label">{{ card.label }}</span>
              <strong>{{ card.title }}</strong>
              <p>{{ card.description }}</p>
              <span class="theme-spotlight-meta">{{ card.meta }}</span>
            </article>
          </div>
        </aside>
      </section>

      <section class="panel theme-history-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">題材輪動歷史</h2>
            <p class="panel-subtitle">近 5 / 10 / 20 日輪動變化</p>
          </div>
          <div class="range-tabs">
            <button
              v-for="windowSize in historyWindows"
              :key="`theme-history-window-${windowSize}`"
              type="button"
              class="range-tab"
              :class="{ 'is-active': selectedWindow === windowSize }"
              @click="selectedWindow = windowSize"
            >
              {{ windowSize }} 日
            </button>
          </div>
        </div>

        <div v-if="historyError" class="empty-state compact">
          <strong>題材輪動歷史載入失敗</strong>
          <p>{{ historyError }}</p>
        </div>
        <div v-else-if="isHistoryLoading" class="empty-state compact">
          <strong>題材輪動歷史整理中</strong>
          <p>正在讀取近 5 / 10 / 20 日的題材輪動快照。</p>
        </div>
        <template v-else-if="historyOverview.snapshotCount">
          <section class="theme-history-summary-grid">
            <article class="sub-panel theme-history-summary-card">
              <span class="theme-spotlight-label">目前主線</span>
              <strong>{{ topTopic?.title ?? '等待新的主線' }}</strong>
              <p>
                {{
                  selectedHistoryTrend.previousLeader
                    ? `相較 ${selectedWindow} 日前的 ${selectedHistoryTrend.previousLeader.title ?? '舊主線'}，目前主線 ${topTopic?.slug === selectedHistoryTrend.previousLeader.slug ? '仍維持延續' : '已經切換' }。`
                    : '歷史快照還不夠長，先從近幾日輪動開始觀察。'
                }}
              </p>
            </article>

            <article class="sub-panel theme-history-summary-card">
              <span class="theme-spotlight-label">{{ selectedWindow }} 日升溫</span>
              <strong>{{ selectedHistoryTrend.warming[0]?.title ?? '暫無明顯升溫' }}</strong>
              <p>
                {{
                  selectedHistoryTrend.warming[0]
                    ? `分數變化 ${formatNumber(selectedHistoryTrend.warming[0].deltas[selectedWindow], 0)}，龍頭 ${selectedHistoryTrend.warming[0].leaderCode ?? '-'}。`
                    : '目前沒有足夠的升溫資料。'
                }}
              </p>
            </article>

            <article class="sub-panel theme-history-summary-card">
              <span class="theme-spotlight-label">{{ selectedWindow }} 日降溫</span>
              <strong>{{ selectedHistoryTrend.cooling[0]?.title ?? '暫無明顯降溫' }}</strong>
              <p>
                {{
                  selectedHistoryTrend.cooling[0]
                    ? `分數變化 ${formatNumber(selectedHistoryTrend.cooling[0].deltas[selectedWindow], 0)}，適合留意是否換到補漲題材。`
                    : '目前沒有足夠的降溫資料。'
                }}
              </p>
            </article>
          </section>

          <div class="table-wrap">
            <table class="data-table theme-history-table">
              <thead>
                <tr>
                  <th>題材</th>
                  <th>目前分數</th>
                  <th>5 日</th>
                  <th>10 日</th>
                  <th>20 日</th>
                  <th>龍頭股</th>
                  <th>輪動狀態</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in historyOverview.rows" :key="`theme-history-row-${row.slug}`">
                  <td>
                    <div class="table-primary">
                      <strong>{{ row.title }}</strong>
                    </div>
                  </td>
                  <td>{{ formatNumber(row.currentScore, 0) }}</td>
                  <td :class="formatChangeTone(row.deltas[5])">{{ row.deltas[5] === null ? '—' : formatNumber(row.deltas[5], 0) }}</td>
                  <td :class="formatChangeTone(row.deltas[10])">{{ row.deltas[10] === null ? '—' : formatNumber(row.deltas[10], 0) }}</td>
                  <td :class="formatChangeTone(row.deltas[20])">{{ row.deltas[20] === null ? '—' : formatNumber(row.deltas[20], 0) }}</td>
                  <td>{{ row.leaderCode ? `${row.leaderCode} ${row.leaderName}` : '暫無' }}</td>
                  <td>
                    <span class="status-badge" :class="`is-${row.trendTone}`">{{ row.trendLabel }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>

      <section class="theme-page-layout">
        <aside class="theme-sidebar">
          <article class="panel theme-sidebar-card theme-sidebar-card-sticky">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">題材強度排行</h2>
                <p class="panel-subtitle">依強度排序</p>
              </div>
            </div>
            <div class="theme-ranking-list">
              <a
                v-for="(topic, index) in topics"
                :key="`ranking-${topic.slug}`"
                class="theme-ranking-item"
                :href="`#${getTopicAnchor(topic.slug)}`"
              >
                <div class="theme-ranking-head">
                  <span class="theme-ranking-order">#{{ index + 1 }}</span>
                  <div>
                    <strong>{{ topic.title }}</strong>
                    <p class="muted">{{ topic.observation }}</p>
                  </div>
                </div>
                <div class="theme-ranking-side">
                  <span class="status-badge" :class="`is-${topic.tone}`">{{ getThemeToneLabel(topic.tone) }}</span>
                  <span class="meta-chip">{{ formatNumber(topic.score, 0) }} 分</span>
                </div>
              </a>
            </div>
          </article>

          <article class="panel theme-sidebar-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">研究節奏</h2>
                <p class="panel-subtitle">主線 / 龍頭 / 補漲</p>
              </div>
            </div>
            <ol class="theme-playbook-list">
              <li>先看題材輪動歷史，確認是不是剛升溫而不是已經走完。</li>
              <li>主線題材先看龍頭股，再找同題材中還沒完全發酵的補漲股。</li>
              <li>如果新聞熱，但法人與 ETF 還沒跟上，先列觀察，不急著追。</li>
              <li>最後回到個股頁確認技術面、籌碼面、外資目標價與交易提醒。</li>
            </ol>
            <div class="theme-page-links">
              <RouterLink class="ghost-button" to="/">回首頁</RouterLink>
              <RouterLink class="ghost-button" to="/radar">看選股雷達</RouterLink>
            </div>
          </article>
        </aside>

        <div class="theme-main-column">
          <section class="theme-brief-grid">
            <article
              v-for="topic in featuredTopics"
              :key="`brief-${topic.slug}`"
              class="sub-panel theme-brief-card"
            >
              <div class="theme-card-head">
                <div>
                  <p class="theme-brief-kicker">題材速覽</p>
                  <h3>{{ topic.title }}</h3>
                </div>
                <div class="theme-card-badges">
                  <span class="status-badge" :class="`is-${topic.tone}`">{{ getThemeToneLabel(topic.tone) }}</span>
                  <span class="meta-chip">{{ formatNumber(topic.score, 0) }} 分</span>
                </div>
              </div>
              <p class="theme-brief-summary">{{ topic.observation }}</p>
              <div class="theme-brief-metrics">
                <span>新聞 {{ formatNumber(topic.newsCount, 0) }}</span>
                <span>熱門股 {{ formatNumber(topic.hotCount, 0) }}</span>
                <span>法人 {{ formatNumber(topic.institutionalCount, 0) }}</span>
                <span>ETF {{ formatNumber(topic.etfCount, 0) }}</span>
              </div>
              <div class="theme-brief-links">
                <a class="ghost-button" :href="`#${getTopicAnchor(topic.slug)}`">看題材拆解</a>
              </div>
            </article>
          </section>

          <section class="theme-topic-stack">
            <article
              v-for="topic in topics"
              :id="getTopicAnchor(topic.slug)"
              :key="topic.slug"
              class="panel theme-topic-panel"
            >
              <div class="theme-topic-header">
                <div class="theme-topic-header-copy">
                  <span class="theme-topic-kicker">題材拆解</span>
                  <h2 class="panel-title">{{ topic.title }}</h2>
                  <p class="panel-subtitle">{{ topic.observation }}</p>
                </div>
                <div class="theme-card-badges">
                  <span class="status-badge" :class="`is-${topic.tone}`">{{ getThemeToneLabel(topic.tone) }}</span>
                  <span class="meta-chip">{{ formatNumber(topic.score, 0) }} 分</span>
                </div>
              </div>

              <div class="theme-metrics">
                <span class="meta-chip">新聞 {{ formatNumber(topic.newsCount, 0) }}</span>
                <span class="meta-chip">熱門股 {{ formatNumber(topic.hotCount, 0) }}</span>
                <span class="meta-chip">法人 {{ formatNumber(topic.institutionalCount, 0) }}</span>
                <span class="meta-chip">ETF {{ formatNumber(topic.etfCount, 0) }}</span>
                <span class="meta-chip">龍頭 {{ formatNumber(topic.leaderStocks?.length ?? 0, 0) }}</span>
                <span class="meta-chip">補漲 {{ formatNumber(topic.catchUpStocks?.length ?? 0, 0) }}</span>
              </div>

              <div v-if="topic.keywords?.length" class="theme-keywords">
                <span
                  v-for="keyword in topic.keywords.slice(0, 8)"
                  :key="`${topic.slug}-${keyword.keyword}`"
                  class="theme-keyword-chip"
                >
                  {{ keyword.keyword }}
                </span>
              </div>

              <section class="theme-topic-content-grid">
                <article class="sub-panel">
                  <div class="panel-header compact">
                    <div>
                      <h3 class="panel-title small">題材內龍頭股</h3>
                      <p class="panel-subtitle">龍頭股</p>
                    </div>
                  </div>
                  <div v-if="topic.leaderStocks?.length" class="theme-stock-list">
                    <RouterLink
                      v-for="stock in topic.leaderStocks"
                      :key="`${topic.slug}-leader-${stock.code}`"
                      class="theme-stock-item"
                      :to="createStockRoute(stock.code)"
                    >
                      <div class="theme-stock-main">
                        <strong>{{ stock.code }} {{ stock.name }}</strong>
                        <div class="theme-stock-drivers">
                          <span
                            v-for="driver in (stock.drivers ?? []).slice(0, 3)"
                            :key="`${topic.slug}-leader-driver-${stock.code}-${driver}`"
                          >
                            {{ driver }}
                          </span>
                        </div>
                      </div>
                      <div class="theme-stock-meta">
                        <span :class="formatChangeTone(stock.return20)">{{ formatPercent(stock.return20) }}</span>
                        <span :class="formatChangeTone(stock.changePercent)">{{ formatPercent(stock.changePercent) }}</span>
                      </div>
                    </RouterLink>
                  </div>
                  <p v-else class="muted">目前還沒有足夠的龍頭股資料。</p>
                </article>

                <article class="sub-panel">
                  <div class="panel-header compact">
                    <div>
                      <h3 class="panel-title small">題材內補漲股</h3>
                      <p class="panel-subtitle">補漲股</p>
                    </div>
                  </div>
                  <div v-if="topic.catchUpStocks?.length" class="theme-stock-list">
                    <RouterLink
                      v-for="stock in topic.catchUpStocks"
                      :key="`${topic.slug}-catchup-${stock.code}`"
                      class="theme-stock-item"
                      :to="createStockRoute(stock.code)"
                    >
                      <div class="theme-stock-main">
                        <strong>{{ stock.code }} {{ stock.name }}</strong>
                        <div class="theme-stock-drivers">
                          <span
                            v-for="driver in (stock.drivers ?? []).slice(0, 3)"
                            :key="`${topic.slug}-catchup-driver-${stock.code}-${driver}`"
                          >
                            {{ driver }}
                          </span>
                        </div>
                      </div>
                      <div class="theme-stock-meta">
                        <span :class="formatChangeTone(stock.return20)">{{ formatPercent(stock.return20) }}</span>
                        <span :class="formatChangeTone(stock.changePercent)">{{ formatPercent(stock.changePercent) }}</span>
                      </div>
                    </RouterLink>
                  </div>
                  <p v-else class="muted">目前還沒有明確的補漲股候選。</p>
                </article>

                <article class="sub-panel">
                  <div class="panel-header compact">
                    <div>
                      <h3 class="panel-title small">近期題材新聞</h3>
                      <p class="panel-subtitle">近期相關新聞</p>
                    </div>
                  </div>
                  <div v-if="topic.headlines?.length" class="theme-headline-list">
                    <a
                      v-for="headline in topic.headlines"
                      :key="`${topic.slug}-${headline.link}`"
                      :href="headline.link"
                      class="theme-headline-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <strong>{{ headline.title }}</strong>
                      <span class="muted">
                        {{ headline.source ?? 'Google News' }}
                        <template v-if="formatHeadlineTime(headline.publishedAt)">｜{{ formatHeadlineTime(headline.publishedAt) }}</template>
                      </span>
                    </a>
                  </div>
                  <p v-else class="muted">近期還沒有足夠的題材新聞。</p>
                </article>
              </section>

              <section class="sub-panel theme-compare-panel">
                <div class="panel-header compact">
                  <div>
                    <h3 class="panel-title small">同題材個股比較表</h3>
                    <p class="panel-subtitle">漲幅 / 成交值 / 法人 / 技術 / 目標價</p>
                  </div>
                </div>

                <div class="table-wrap">
                  <table class="data-table theme-compare-table">
                    <thead>
                      <tr>
                        <th>股票</th>
                        <th>20 日</th>
                        <th>成交值</th>
                        <th>外資 5 日</th>
                        <th>投信 5 日</th>
                        <th>技術面</th>
                        <th>外資目標價</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="stock in topic.relatedStocks.slice(0, 8)" :key="`${topic.slug}-compare-${stock.code}`">
                        <td>
                          <RouterLink class="table-link" :to="createStockRoute(stock.code)">
                            {{ stock.code }} {{ stock.name }}
                          </RouterLink>
                        </td>
                        <td :class="formatChangeTone(stock.return20)">{{ formatPercent(stock.return20) }}</td>
                        <td>{{ formatAmount(stock.turnover) }}</td>
                        <td :class="formatChangeTone(stock.foreign5Day)">{{ formatLots(stock.foreign5Day) }}</td>
                        <td :class="formatChangeTone(stock.investmentTrust5Day)">{{ formatLots(stock.investmentTrust5Day) }}</td>
                        <td>
                          <span class="status-badge" :class="`is-${stock.topSignalTone || 'info'}`">
                            {{ stock.topSignalTitle ?? '觀察中' }}
                          </span>
                        </td>
                        <td>{{ formatTargetPrice(stock) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </article>
          </section>
        </div>
      </section>
    </template>
  </section>
</template>
