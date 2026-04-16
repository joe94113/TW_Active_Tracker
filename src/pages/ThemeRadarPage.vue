<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import StatusCard from '../components/StatusCard.vue';
import { createStockRoute } from '../lib/stockRouting';
import {
  formatAmount,
  formatDate,
  formatNumber,
  formatPercent,
} from '../lib/formatters';
import { buildThemeMomentumTopics, getThemeToneLabel } from '../lib/themeRadar';

const { dashboard, isLoading, errorMessage, loadGlobalData } = useGlobalData();

onMounted(() => {
  loadGlobalData();
});

const themeRadar = computed(() => dashboard.value?.題材雷達 ?? null);
const topics = computed(() => buildThemeMomentumTopics(themeRadar.value, 6));
const observations = computed(() => themeRadar.value?.observations ?? []);
const topTopic = computed(() => topics.value[0] ?? null);
const featuredTopics = computed(() => topics.value.slice(0, 3));
const newsLeaderTopic = computed(() =>
  [...topics.value].sort((left, right) => (right.newsCount ?? 0) - (left.newsCount ?? 0) || (right.score ?? 0) - (left.score ?? 0))[0] ?? null,
);
const institutionalLeaderTopic = computed(() =>
  [...topics.value]
    .sort(
      (left, right) =>
        ((right.institutionalCount ?? 0) + (right.etfCount ?? 0)) -
          ((left.institutionalCount ?? 0) + (left.etfCount ?? 0)) ||
        (right.score ?? 0) - (left.score ?? 0),
    )[0] ?? null,
);
const spotlightCards = computed(() => [
  {
    key: 'top',
    label: '最強題材',
    title: topTopic.value?.title ?? '整理中',
    description: topTopic.value?.observation ?? '正在整理題材強度。',
    meta: topTopic.value
      ? `${formatNumber(topTopic.value.score)} 分 · 龍頭 ${formatNumber(topTopic.value.leaderStocks?.length ?? 0, 0)} 檔`
      : '等待資料同步',
    tone: topTopic.value?.tone ?? 'info',
  },
  {
    key: 'news',
    label: '新聞熱度',
    title: newsLeaderTopic.value?.title ?? '整理中',
    description: newsLeaderTopic.value?.observation ?? '正在比對近期新聞密度。',
    meta: newsLeaderTopic.value
      ? `${formatNumber(newsLeaderTopic.value.newsCount)} 則新聞 · 關鍵字 ${formatNumber(newsLeaderTopic.value.keywords?.length ?? 0, 0)} 個`
      : '等待資料同步',
    tone: newsLeaderTopic.value?.tone ?? 'info',
  },
  {
    key: 'institutional',
    label: '法人與 ETF',
    title: institutionalLeaderTopic.value?.title ?? '整理中',
    description: institutionalLeaderTopic.value?.observation ?? '正在比對雙法人與 ETF 曝光。',
    meta: institutionalLeaderTopic.value
      ? `法人偏多 ${formatNumber(institutionalLeaderTopic.value.institutionalCount)} 檔 · ETF 曝光 ${formatNumber(institutionalLeaderTopic.value.etfCount)} 檔`
      : '等待資料同步',
    tone: institutionalLeaderTopic.value?.tone ?? 'info',
  },
]);

const pageSeo = computed(() => ({
  title: '資金題材雷達',
  description: '把台股近期新聞熱度、盤面人氣、雙法人與主動式 ETF 資金暴露整成題材強度排行，拆開看龍頭股與補漲股。',
  routePath: '/themes',
  keywords: ['題材雷達', '資金輪動', '台股題材', '龍頭股', '補漲股', '選股'],
}));

useSeoMeta(pageSeo);

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
          <span class="hero-kicker">題材資金頁</span>
          <h1>資金題材雷達</h1>
          <p>
            把近期新聞熱度、熱門股、雙法人與主動式 ETF 曝光疊在一起，直接看目前資金正在轉進哪些題材，
            再往下拆出龍頭股和補漲股。
          </p>
          <div v-if="observations.length" class="theme-radar-summary">
            <span
              v-for="(item, index) in observations"
              :key="`theme-page-observation-${index}`"
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
              <span class="meta-text">已按強度排序整理</span>
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

      <section class="theme-page-layout">
        <aside class="theme-sidebar">
          <article class="panel theme-sidebar-card theme-sidebar-card-sticky">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">題材強度排行</h2>
                <p class="panel-subtitle">先看哪個題材最強，再決定今天要深挖哪一組股票。</p>
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
                  <span class="meta-chip">{{ formatNumber(topic.score) }} 分</span>
                </div>
              </a>
            </div>
          </article>

          <article class="panel theme-sidebar-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">研究節奏</h2>
                <p class="panel-subtitle">先看大方向，再回個股頁做確認，會比直接追新聞更穩。</p>
              </div>
            </div>
            <ol class="theme-playbook-list">
              <li>先看前三名題材，確認今天市場重心在哪裡。</li>
              <li>優先研究龍頭股，再找量價剛轉強的補漲股。</li>
              <li>搭配 20 日表現、雙法人與 ETF 曝光，過濾只有熱度沒有資金的股票。</li>
              <li>最後回個股頁檢查技術面、新聞與籌碼細節。</li>
            </ol>
            <div class="theme-page-links">
              <RouterLink class="ghost-button" to="/">回首頁</RouterLink>
              <RouterLink class="ghost-button" to="/etfs">查看主動式 ETF</RouterLink>
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
                  <p class="theme-brief-kicker">{{ topic.isEmerging ? '新題材偵測' : '優先關注' }}</p>
                  <h3>{{ topic.title }}</h3>
                </div>
                <div class="theme-card-badges">
                  <span v-if="topic.isEmerging" class="meta-chip">新題材</span>
                  <span class="status-badge" :class="`is-${topic.tone}`">{{ getThemeToneLabel(topic.tone) }}</span>
                </div>
              </div>
              <p class="theme-brief-summary">{{ topic.observation }}</p>
              <div class="theme-brief-metrics">
                <span>新聞 {{ formatNumber(topic.newsCount) }}</span>
                <span>人氣股 {{ formatNumber(topic.hotCount) }}</span>
                <span>法人偏多 {{ formatNumber(topic.institutionalCount) }}</span>
                <span>ETF 曝光 {{ formatNumber(topic.etfCount) }}</span>
              </div>
              <div class="theme-brief-links">
                <a class="ghost-button" :href="`#${getTopicAnchor(topic.slug)}`">直接看拆解</a>
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
                  <span v-if="topic.isEmerging" class="meta-chip">新題材</span>
                  <span class="status-badge" :class="`is-${topic.tone}`">{{ getThemeToneLabel(topic.tone) }}</span>
                  <span class="meta-chip">{{ formatNumber(topic.score) }} 分</span>
                </div>
              </div>

              <div class="theme-metrics">
                <span class="meta-chip">新聞 {{ formatNumber(topic.newsCount) }}</span>
                <span class="meta-chip">人氣股 {{ formatNumber(topic.hotCount) }}</span>
                <span class="meta-chip">法人偏多 {{ formatNumber(topic.institutionalCount) }}</span>
                <span class="meta-chip">ETF 曝光 {{ formatNumber(topic.etfCount) }}</span>
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
                      <p class="panel-subtitle">優先看市場已經明確押注的代表股。</p>
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
                        <span :class="{ 'text-up': (stock.changePercent ?? 0) > 0, 'text-down': (stock.changePercent ?? 0) < 0 }">
                          {{ formatPercent(stock.changePercent) }}
                        </span>
                      </div>
                      <div class="theme-stock-meta">
                        <span>20 日 {{ formatPercent(stock.return20) }}</span>
                        <span>法人 5 日 {{ formatAmount(stock.total5Day) }}</span>
                      </div>
                      <p v-if="stock.drivers?.length" class="theme-stock-drivers">{{ stock.drivers.join(' ・ ') }}</p>
                    </RouterLink>
                  </div>
                  <p v-else class="muted">目前沒有明確的龍頭股資料。</p>
                </article>

                <article class="sub-panel">
                  <div class="panel-header compact">
                    <div>
                      <h3 class="panel-title small">題材內補漲股</h3>
                      <p class="panel-subtitle">先找位階較低，但資金和消息開始靠近的標的。</p>
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
                        <span :class="{ 'text-up': (stock.changePercent ?? 0) > 0, 'text-down': (stock.changePercent ?? 0) < 0 }">
                          {{ formatPercent(stock.changePercent) }}
                        </span>
                      </div>
                      <div class="theme-stock-meta">
                        <span>20 日 {{ formatPercent(stock.return20) }}</span>
                        <span>法人 5 日 {{ formatAmount(stock.total5Day) }}</span>
                      </div>
                      <p v-if="stock.drivers?.length" class="theme-stock-drivers">{{ stock.drivers.join(' ・ ') }}</p>
                    </RouterLink>
                  </div>
                  <p v-else class="muted">目前沒有補漲股候選名單。</p>
                </article>

                <article class="sub-panel">
                  <div class="panel-header compact">
                    <div>
                      <h3 class="panel-title small">近期新聞</h3>
                      <p class="panel-subtitle">先看題材是否有持續被市場討論，而不是只有一天熱度。</p>
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
                        <template v-if="formatHeadlineTime(headline.publishedAt)">・{{ formatHeadlineTime(headline.publishedAt) }}</template>
                      </span>
                    </a>
                  </div>
                  <p v-else class="muted">目前沒有整理到這個題材的新聞。</p>
                </article>
              </section>
            </article>
          </section>
        </div>
      </section>
    </template>
  </section>
</template>
