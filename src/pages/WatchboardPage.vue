<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import DataFreshnessBadge from '../components/DataFreshnessBadge.vue';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import { useGlobalData } from '../composables/useGlobalData';
import { useLiveStockSnapshots } from '../composables/useLiveStockSnapshots';
import { useSeoMeta } from '../composables/useSeoMeta';
import { buildFavoriteWatchboard } from '../lib/watchboard';
import { formatAmount, formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';
import { mergeStockUniverse, createStockCodeMap } from '../lib/stockUniverse';

const { favoriteCodes } = useFavoriteStocks();
const { stockList, stockSearchList, dashboard, manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();
const { snapshotMap, isLoading: isSnapshotLoading, startAutoRefresh } = useLiveStockSnapshots(favoriteCodes, {
  refreshIntervalMs: 60000,
});

const stockUniverse = computed(() => mergeStockUniverse(stockList.value, stockSearchList.value));
const stockMap = computed(() => createStockCodeMap(stockUniverse.value));
const favoriteRows = computed(() =>
  favoriteCodes.value
    .map((code) => stockMap.value.get(code))
    .filter(Boolean),
);
const watchboard = computed(() => buildFavoriteWatchboard(favoriteRows.value, snapshotMap.value));
const hasData = computed(() => watchboard.value.rows.length > 0);
const priorityRows = computed(() => watchboard.value.rows.slice(0, 6));

const heroCards = computed(() => [
  {
    title: '追蹤股數',
    value: `${formatNumber(watchboard.value.summary.count, 0)} 檔`,
    note: '先把你每天真的會看的股票放進來。',
  },
  {
    title: '雙法人偏多',
    value: `${formatNumber(watchboard.value.summary.dualBuyCount, 0)} 檔`,
    note: '外資與投信同步偏多的股票。',
  },
  {
    title: '風險提醒',
    value: `${formatNumber(watchboard.value.summary.riskCount, 0)} 檔`,
    note: '有處置、注意或過熱訊號時會集中在這裡。',
  },
]);

const pageSeo = computed(() => ({
  title: '自選股即時看盤面板',
  description: '把自選股集中在同一頁看價格、漲跌、雙法人、題材與風險，盤中盤後都能快速掃描。',
  routePath: '/watchboard',
  keywords: ['自選股即時看盤', '自選股', '看盤面板', '雙法人', '追蹤清單'],
}));

useSeoMeta(pageSeo);

onMounted(async () => {
  await loadGlobalData();
  startAutoRefresh();
});

function getToneClass(value) {
  if ((value ?? 0) > 0) return 'text-up';
  if ((value ?? 0) < 0) return 'text-down';
  return '';
}
</script>

<template>
  <section class="page-shell watchboard-page">
    <StatusCard
      :is-loading="isLoading || isSnapshotLoading"
      :error-message="errorMessage"
      :has-data="hasData"
      empty-message="還沒有自選股。先在個股頁加入自選，這裡就會自動變成你的看盤面板。"
    />

    <template v-if="hasData">
      <section class="page-hero compact radar-page-hero watchboard-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Favorite Watchboard</span>
          <h1>自選股即時看盤面板</h1>
          <p class="page-subtitle">把價格、漲跌、雙法人、題材與風險放在同一頁，盤中先看優先追蹤，盤後再看哪幾檔值得留在名單裡。</p>
          <div class="hero-summary-grid watchboard-summary-grid">
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

        <aside class="radar-hero-board watchboard-hero-board">
          <article class="theme-spotlight-card is-info">
            <span class="theme-spotlight-label">即時狀態</span>
            <strong>{{ watchboard.summary.topIdea ? `${watchboard.summary.topIdea.code} ${watchboard.summary.topIdea.name}` : '等待更新' }}</strong>
            <p>若你有開啟遠端即時資料，這頁會在交易時段自動更新價格；否則會沿用最新資料包。</p>
            <DataFreshnessBadge
              :generated-at="dashboard?.generatedAt ?? manifest?.generatedAt"
              :market-date="dashboard?.市場總覽?.即時狀態?.marketDate ?? dashboard?.市場總覽?.資料日期"
              size="compact"
            />
          </article>
        </aside>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">先看這幾檔</h2>
            <p class="panel-subtitle">優先看雙法人偏多、技術面仍健康、而且目前沒有明顯風險提醒的股票。</p>
          </div>
          <span class="meta-chip">{{ formatNumber(priorityRows.length, 0) }} 檔</span>
        </div>

        <div class="radar-stock-grid">
          <RouterLink
            v-for="row in priorityRows"
            :key="`priority-${row.code}`"
            :to="createStockRoute(row.code)"
            class="radar-stock-card"
            :class="`is-${row.tone}`"
          >
            <div class="radar-stock-head">
              <div>
                <strong>{{ row.code }} {{ row.name }}</strong>
                <p class="muted">{{ row.industryName || row.themeTitle || '台股個股' }}</p>
              </div>
              <div class="radar-stock-chip-stack">
                <span v-if="row.dualBuy" class="meta-chip is-up">雙法人</span>
                <span v-if="row.riskCount" class="meta-chip is-warning">風險 {{ row.riskCount }}</span>
              </div>
            </div>

            <div class="market-quote-metrics">
              <div>
                <span>現價</span>
                <strong>{{ formatNumber(row.close) }}</strong>
              </div>
              <div>
                <span>單日</span>
                <strong :class="getToneClass(row.changePercent)">{{ formatPercent(row.changePercent) }}</strong>
              </div>
              <div>
                <span>20 日</span>
                <strong :class="getToneClass(row.return20)">{{ formatPercent(row.return20) }}</strong>
              </div>
              <div>
                <span>成交值</span>
                <strong>{{ formatAmount(row.dailyTradeValue) }}</strong>
              </div>
            </div>

            <p class="radar-stock-note">{{ row.topSignalTitle || row.topSelectionSignalTitle || '先看量價與雙法人是否延續。' }}</p>
          </RouterLink>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">全部自選股</h2>
            <p class="panel-subtitle">盤中看價格與漲跌，盤後再看法人、題材與風險有沒有改變。</p>
          </div>
          <span class="meta-chip">{{ formatNumber(watchboard.rows.length, 0) }} 檔</span>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>股票</th>
                <th>現價</th>
                <th>單日</th>
                <th>20 日</th>
                <th>雙法人</th>
                <th>成交量</th>
                <th>訊號</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in watchboard.rows"
                :key="`watchboard-row-${row.code}`"
              >
                <td>
                  <RouterLink class="code-link" :to="createStockRoute(row.code)">{{ row.code }}</RouterLink>
                  <div class="muted">{{ row.name }}</div>
                </td>
                <td>{{ formatNumber(row.close) }}</td>
                <td :class="getToneClass(row.changePercent)">{{ formatPercent(row.changePercent) }}</td>
                <td :class="getToneClass(row.return20)">{{ formatPercent(row.return20) }}</td>
                <td>{{ row.dualBuy ? '同步偏多' : '未同步' }}</td>
                <td>{{ formatLots(row.volume) }}</td>
                <td class="muted">{{ row.topSignalTitle || row.topSelectionSignalTitle || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
