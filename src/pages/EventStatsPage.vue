<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { buildStockEventPerformance } from '../lib/stockEventPerformance';
import { formatDate, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';
import { createStockCodeMap, mergeStockUniverse } from '../lib/stockUniverse';

const { favoriteCodes } = useFavoriteStocks();
const { stockList, stockSearchList, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const query = ref('');
const selectedCode = ref('');
const detail = ref(null);
const isDetailLoading = ref(false);
const detailError = ref('');

const universe = computed(() => mergeStockUniverse(stockList.value, stockSearchList.value));
const stockMap = computed(() => createStockCodeMap(universe.value));
const favoriteMatches = computed(() => favoriteCodes.value.map((code) => stockMap.value.get(code)).filter(Boolean));
const searchMatches = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  if (!keyword) return [];
  return universe.value
    .filter((item) =>
      [item.code, item.name, item.industryName]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword)),
    )
    .slice(0, 10);
});
const selectedStock = computed(() => stockMap.value.get(selectedCode.value) ?? null);
const eventPerformance = computed(() => buildStockEventPerformance(detail.value));
const hasData = computed(() => Boolean(universe.value.length));
const eventOverviewCards = computed(() => {
  if (!eventPerformance.value.length) {
    return [];
  }

  const best5Day = [...eventPerformance.value]
    .filter((entry) => entry.metrics[5]?.averageReturn !== null)
    .sort((left, right) => (right.metrics[5]?.averageReturn ?? -Infinity) - (left.metrics[5]?.averageReturn ?? -Infinity))[0];
  const bestWinRate = [...eventPerformance.value]
    .filter((entry) => entry.metrics[5]?.winRate !== null)
    .sort((left, right) => (right.metrics[5]?.winRate ?? -Infinity) - (left.metrics[5]?.winRate ?? -Infinity))[0];
  const totalSamples = eventPerformance.value.reduce((sum, entry) => sum + (entry.sampleCount ?? 0), 0);

  return [
    {
      title: '事件後 5 日最強',
      value: best5Day ? formatPercent(best5Day.metrics[5]?.averageReturn) : '-',
      note: best5Day ? `${best5Day.title} 的平均反應最好` : '暫時沒有可比較樣本',
      tone: (best5Day?.metrics[5]?.averageReturn ?? 0) > 0 ? 'up' : (best5Day?.metrics[5]?.averageReturn ?? 0) < 0 ? 'down' : 'neutral',
    },
    {
      title: '5 日勝率最高',
      value: bestWinRate ? formatPercent(bestWinRate.metrics[5]?.winRate) : '-',
      note: bestWinRate ? `${bestWinRate.title} 在近幾次公布後較容易收紅` : '暫時沒有可比較樣本',
      tone: (bestWinRate?.metrics[5]?.winRate ?? 0) >= 60 ? 'up' : (bestWinRate?.metrics[5]?.winRate ?? 0) < 45 ? 'down' : 'neutral',
    },
    {
      title: '可參考事件樣本',
      value: formatNumber(totalSamples, 0),
      note: '近 8 次月營收與財報觀察窗合計樣本數',
      tone: 'neutral',
    },
  ];
});
const selectedSnapshotCards = computed(() => {
  if (!selectedStock.value) {
    return [];
  }

  return [
    {
      label: '產業',
      value: selectedStock.value.industryName || '台股個股',
      tone: 'neutral',
    },
    {
      label: '收盤',
      value: formatNumber(selectedStock.value.close),
      tone: 'neutral',
    },
    {
      label: '單日',
      value: formatPercent(selectedStock.value.changePercent),
      tone:
        (selectedStock.value.changePercent ?? 0) > 0 ? 'up' : (selectedStock.value.changePercent ?? 0) < 0 ? 'down' : 'neutral',
    },
    {
      label: '20 日',
      value: formatPercent(selectedStock.value.return20),
      tone: (selectedStock.value.return20 ?? 0) > 0 ? 'up' : (selectedStock.value.return20 ?? 0) < 0 ? 'down' : 'neutral',
    },
  ];
});

const pageSeo = computed(() => ({
  title: '事件後表現統計',
  description: '回看月營收與財報觀察窗後 3 / 5 / 10 日平均表現，幫助你判斷消息公布後是利多延續還是容易利多出盡。',
  routePath: '/event-stats',
  keywords: ['事件後表現', '月營收統計', '財報統計', '法說反應'],
}));

useSeoMeta(pageSeo);

onMounted(async () => {
  await loadGlobalData();
  if (favoriteCodes.value.length) {
    selectedCode.value = favoriteCodes.value[0];
  }
});

watch(
  () => selectedCode.value,
  async () => {
    await loadStockDetail();
  },
  { immediate: true },
);

async function loadStockDetail() {
  if (!selectedCode.value) {
    detail.value = null;
    return;
  }

  isDetailLoading.value = true;
  detailError.value = '';

  try {
    detail.value = await fetchJson(`data/stocks/${selectedCode.value}.json`);
  } catch (error) {
    detail.value = null;
    detailError.value = error instanceof Error ? error.message : '事件統計載入失敗';
  } finally {
    isDetailLoading.value = false;
  }
}

function selectStock(code) {
  selectedCode.value = String(code ?? '').trim();
  query.value = '';
}

function getMetricTone(value) {
  if (!Number.isFinite(value)) return 'neutral';
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'neutral';
}

function buildEventReading(entry) {
  const average5 = entry?.metrics?.[5]?.averageReturn ?? null;
  const average10 = entry?.metrics?.[10]?.averageReturn ?? null;
  const winRate5 = entry?.metrics?.[5]?.winRate ?? null;

  if (average5 === null || winRate5 === null) {
    return '樣本還不多，先把它當成參考，不要單獨拿來決定進出。';
  }

  if (average5 > 0 && winRate5 >= 60) {
    return '這類事件公布後通常偏向延續，若當天技術面同步轉強，短線可多留意 3 到 5 日反應。';
  }

  if (average5 < 0 && winRate5 < 45) {
    return '這類事件後常先震盪或回吐，若想進場，通常等拉回止穩會比第一時間追價更穩。';
  }

  if ((average10 ?? 0) > 0 && average5 <= 0) {
    return '前幾天反應不一定快，但拉長到 10 日仍有改善，這種比較像需要時間發酵的事件。';
  }

  return '事件後方向不算一致，最好和技術面、量價、籌碼一起交叉看，不要只看單一統計。';
}
</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isLoading || isDetailLoading"
      :error-message="detailError || errorMessage"
      :has-data="hasData"
      empty-message="事件後表現統計資料尚未整理完成。"
    />

    <template v-if="hasData">
      <section class="page-hero compact radar-page-hero event-stats-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Event Performance</span>
          <h1>事件後表現統計</h1>
          <p>不只看月營收、財報日期，直接回看過去 8 次事件後 3 / 5 / 10 日平均表現，幫你判斷這檔股常常是延續還是利多出盡。</p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">先選一檔股票</span>
            <span v-if="selectedStock" class="theme-observation-chip">{{ selectedStock.code }} {{ selectedStock.name }}</span>
          </div>
        </div>

        <aside class="radar-hero-board event-stats-hero-board">
          <div class="radar-spotlight-grid event-stats-hero-grid">
            <article
              v-for="card in eventOverviewCards.length ? eventOverviewCards : [{ title: '事件摘要', value: '等待選股', note: '先從左邊選一檔股票，頁面會自動整理月營收與財報事件反應。', tone: 'neutral' }]"
              :key="card.title"
              class="radar-spotlight-card event-stats-hero-card"
              :class="`is-${card.tone}`"
            >
              <span class="theme-spotlight-label">{{ card.title }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.note }}</p>
            </article>
          </div>
        </aside>
      </section>

      <section class="event-stats-stack">
        <section class="panel event-stats-filter event-stats-filter-bar">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">選股票</h2>
              <p class="panel-subtitle">可以從自選股挑，或直接搜尋代號 / 名稱。</p>
            </div>
          </div>

          <div class="event-stats-filter-grid">
            <div class="event-stats-filter-main">
              <label class="scanner-filter-field is-wide">
                <span>搜尋股票</span>
                <input v-model="query" type="text" placeholder="例如 2330、聯發科、CPO" />
              </label>

              <div v-if="favoriteMatches.length" class="event-stats-pick-group">
                <div class="event-stats-group-label">自選股快速帶入</div>
                <div class="tag-row">
                  <button
                    v-for="item in favoriteMatches"
                    :key="`fav-${item.code}`"
                    type="button"
                    class="keyword-pill button-pill"
                    @click="selectStock(item.code)"
                  >
                    {{ item.code }} {{ item.name }}
                  </button>
                </div>
              </div>

              <div v-if="searchMatches.length" class="event-stats-pick-group">
                <div class="event-stats-group-label">搜尋結果</div>
                <div class="event-stats-match-list">
                  <button
                    v-for="item in searchMatches"
                    :key="`match-${item.code}`"
                    type="button"
                    class="event-stats-match"
                    @click="selectStock(item.code)"
                  >
                    <strong>{{ item.code }} {{ item.name }}</strong>
                    <span>{{ item.industryName || '台股個股' }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="selectedSnapshotCards.length" class="sub-panel event-stats-selected-card">
              <div class="event-stats-selected-head">
                <div>
                  <strong>{{ selectedStock.code }} {{ selectedStock.name }}</strong>
                  <p class="muted">先看目前股價狀態，再往下對照事件後反應。</p>
                </div>
                <span class="meta-chip">目前觀察</span>
              </div>
              <div class="event-stats-selected-grid">
                <div
                  v-for="item in selectedSnapshotCards"
                  :key="item.label"
                  class="event-stats-selected-metric"
                >
                  <span>{{ item.label }}</span>
                  <strong :class="{ 'text-up': item.tone === 'up', 'text-down': item.tone === 'down' }">{{ item.value }}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel event-stats-result">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">{{ selectedStock ? `${selectedStock.code} ${selectedStock.name}` : '事件統計' }}</h2>
              <p class="panel-subtitle">看事件後的平均反應，比只記日期更有實戰價值。</p>
            </div>
            <RouterLink v-if="selectedStock" class="ghost-button" :to="createStockRoute(selectedStock.code)">看個股頁</RouterLink>
          </div>

          <div v-if="eventOverviewCards.length" class="event-stats-summary-grid">
            <article
              v-for="card in eventOverviewCards"
              :key="`summary-${card.title}`"
              class="sub-panel event-stats-summary-card"
              :class="`is-${card.tone}`"
            >
              <span>{{ card.title }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.note }}</p>
            </article>
          </div>

          <div v-if="eventPerformance.length" class="event-performance-grid">
            <article v-for="entry in eventPerformance" :key="entry.key" class="sub-panel event-performance-card">
              <div class="event-performance-head">
                <div>
                  <strong>{{ entry.title }}</strong>
                  <p class="muted">{{ entry.note }}</p>
                </div>
                <span class="meta-chip">{{ entry.sampleCount }} 次</span>
              </div>

              <div class="compact-grid event-performance-metric-grid">
                <div class="event-performance-metric">
                  <span>3 日平均</span>
                  <strong :class="{ 'text-up': (entry.metrics[3]?.averageReturn ?? 0) > 0, 'text-down': (entry.metrics[3]?.averageReturn ?? 0) < 0 }">
                    {{ formatPercent(entry.metrics[3]?.averageReturn) }}
                  </strong>
                </div>
                <div class="event-performance-metric">
                  <span>5 日平均</span>
                  <strong :class="{ 'text-up': (entry.metrics[5]?.averageReturn ?? 0) > 0, 'text-down': (entry.metrics[5]?.averageReturn ?? 0) < 0 }">
                    {{ formatPercent(entry.metrics[5]?.averageReturn) }}
                  </strong>
                </div>
                <div class="event-performance-metric">
                  <span>10 日平均</span>
                  <strong :class="{ 'text-up': (entry.metrics[10]?.averageReturn ?? 0) > 0, 'text-down': (entry.metrics[10]?.averageReturn ?? 0) < 0 }">
                    {{ formatPercent(entry.metrics[10]?.averageReturn) }}
                  </strong>
                </div>
                <div class="event-performance-metric">
                  <span>5 日勝率</span>
                  <strong>{{ formatPercent(entry.metrics[5]?.winRate) }}</strong>
                </div>
              </div>

              <div class="event-performance-reading">
                <span class="theme-spotlight-label">怎麼讀這組數字</span>
                <p>{{ buildEventReading(entry) }}</p>
              </div>

              <div class="table-wrap">
                <table class="data-table replay-table">
                  <thead>
                    <tr>
                      <th>事件日期</th>
                      <th>觀察起點</th>
                      <th>3 日</th>
                      <th>5 日</th>
                      <th>10 日</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="sample in entry.samples" :key="`${entry.key}-${sample.eventDate}`">
                      <td>{{ formatDate(sample.eventDate) }}</td>
                      <td>{{ formatDate(sample.tradeDate) }}</td>
                      <td :class="{ 'text-up': (sample.horizons[3]?.returnPercent ?? 0) > 0, 'text-down': (sample.horizons[3]?.returnPercent ?? 0) < 0 }">
                        {{ formatPercent(sample.horizons[3]?.returnPercent) }}
                      </td>
                      <td :class="{ 'text-up': (sample.horizons[5]?.returnPercent ?? 0) > 0, 'text-down': (sample.horizons[5]?.returnPercent ?? 0) < 0 }">
                        {{ formatPercent(sample.horizons[5]?.returnPercent) }}
                      </td>
                      <td :class="{ 'text-up': (sample.horizons[10]?.returnPercent ?? 0) > 0, 'text-down': (sample.horizons[10]?.returnPercent ?? 0) < 0 }">
                        {{ formatPercent(sample.horizons[10]?.returnPercent) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
          <div v-else class="empty-state compact">
            <strong>{{ selectedCode ? '事件樣本還不夠' : '先選一檔股票' }}</strong>
            <p>{{ selectedCode ? '這檔股票的歷史價格或事件樣本不足，等累積更多資料後會自動補齊。' : '可以從自選股點選，或用搜尋框挑一檔股票。' }}</p>
          </div>
        </section>
      </section>
    </template>
  </section>
</template>
