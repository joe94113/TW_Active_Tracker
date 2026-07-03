<script setup>
import { computed, onMounted, ref } from 'vue';
import StatusCard from '../components/StatusCard.vue';
import { fetchOptionalJson } from '../lib/api';
import { formatDate, formatNumber } from '../lib/formatters';
import { useSeoMeta } from '../composables/useSeoMeta';

const DATA_PATH = '/data/influencers/serenity/summary.json';

const dataset = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');
const activeTimeframe = ref('day');
const activeStance = ref('all');

const timeframeOptions = [
  { key: 'day', label: '日' },
  { key: 'week', label: '週' },
  { key: 'month', label: '月' },
  { key: 'quarter', label: '季' },
];

const stanceOptions = [
  { key: 'all', label: '全部' },
  { key: 'bullish', label: '多頭' },
  { key: 'bearish', label: '空頭' },
  { key: 'neutral', label: '中立' },
];

const pageSeo = computed(() => ({
  title: 'Serenity 觀點雷達',
  description: '整理 Serenity 公開 X 貼文提及的 AI 與半導體供應鏈股票，追蹤多頭、空頭與中立觀點變化。',
  routePath: '/serenity-radar',
  keywords: ['Serenity', '美股', 'AI', '半導體', 'X API', '觀點雷達'],
}));

useSeoMeta(pageSeo);

const sourceStatus = computed(() => dataset.value?.source?.status ?? 'pending_token');
const sourceType = computed(() => dataset.value?.source?.type ?? 'x-api-v2');
const sourceDisplayName = computed(() =>
  sourceType.value === 'trackserenity-public-feed' ? 'TrackSerenity 公開資料' : 'X API',
);
const isReady = computed(() => sourceStatus.value === 'ready');
const timeframe = computed(() => dataset.value?.timeframes?.[activeTimeframe.value] ?? null);
const stats = computed(() => timeframe.value?.stats ?? {});
const timeframeStocks = computed(() => timeframe.value?.stocks ?? []);
const filteredStocks = computed(() => {
  if (activeStance.value === 'all') {
    return timeframeStocks.value;
  }

  return timeframeStocks.value.filter((item) => item.stance === activeStance.value);
});

const heroCards = computed(() => [
  {
    label: '提及股票',
    value: formatNumber(stats.value.mentionedStocks ?? 0),
    note: `${timeframe.value?.label ?? '日'}檢視`,
  },
  {
    label: '多頭 / 空頭',
    value: `${formatNumber(stats.value.bullish ?? 0)} / ${formatNumber(stats.value.bearish ?? 0)}`,
    note: `中立 ${formatNumber(stats.value.neutral ?? 0)}`,
  },
  {
    label: '來源貼文',
    value: formatNumber(stats.value.posts ?? 0),
    note: isReady.value ? `${sourceDisplayName.value}匯入` : '等待資料源',
  },
]);

const sourceStatusText = computed(() => {
  if (sourceStatus.value === 'ready') return `已連接 ${sourceDisplayName.value}`;
  if (sourceStatus.value === 'pending_token') return '等待 X API token';
  if (sourceStatus.value === 'access_required') return '等待 X API access';
  if (sourceStatus.value === 'invalid_token') return 'Bearer Token 無效';
  if (sourceStatus.value === 'credits_depleted') return 'X API credits 已用完';
  if (sourceStatus.value === 'forbidden') return 'X API 拒絕存取';
  return sourceStatus.value;
});

const sourceError = computed(() => dataset.value?.source?.error ?? null);
const setupTitle = computed(() => {
  if (sourceStatus.value === 'access_required') return 'X API access 尚未開通';
  if (sourceStatus.value === 'invalid_token') return 'Bearer Token 需要重新確認';
  if (sourceStatus.value === 'credits_depleted') return 'X API credits 已用完';
  if (sourceStatus.value === 'forbidden') return 'X API 權限不足';
  return '資料源待接上';
});
const setupMessage = computed(() => {
  if (sourceStatus.value === 'access_required') {
    return '這個 App 需要先掛到 X Developer Project，並取得可讀公開貼文的 API access。處理好後重新執行 npm run serenity:update。';
  }

  if (sourceStatus.value === 'invalid_token') {
    return '請重新複製 App-Only Authentication 的 Bearer Token，確認沒有多貼空白或使用到 OAuth 1.0 token。';
  }

  if (sourceStatus.value === 'credits_depleted') {
    return 'X API 已接受這個 Project/App，但目前 credits 不足。請到 X Developer Console 購買或補足 credits，或降低抓取頁數與頻率後再執行 npm run serenity:update。';
  }

  if (sourceStatus.value === 'forbidden') {
    return '目前 token 可以被識別，但 API 權限不足。請檢查 Developer Console 的 Project、App、plan 或 credits。';
  }

  return '這一頁已經準備好接官方 X API。設定 X_BEARER_TOKEN 後執行 npm run serenity:update，就會產生正式雷達資料。';
});

const recentPosts = computed(() => dataset.value?.recentPosts ?? []);
const performanceRows = computed(() => dataset.value?.performanceRows ?? []);
const sortedPerformanceRows = computed(() =>
  [...performanceRows.value].sort((left, right) => {
    const leftReturn = numberOrNull(left.returnSinceMention);
    const rightReturn = numberOrNull(right.returnSinceMention);

    if (leftReturn !== null && rightReturn !== null && leftReturn !== rightReturn) {
      return rightReturn - leftReturn;
    }

    if (leftReturn !== null) return -1;
    if (rightReturn !== null) return 1;

    return String(left.symbol ?? '').localeCompare(String(right.symbol ?? ''));
  }),
);
const quotedPerformanceCount = computed(
  () => performanceRows.value.filter((row) => numberOrNull(row.currentPrice) !== null).length,
);

onMounted(async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    dataset.value = await fetchOptionalJson(DATA_PATH);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Serenity 觀點資料讀取失敗';
  } finally {
    isLoading.value = false;
  }
});

function stanceLabel(value) {
  if (value === 'bullish') return '多頭';
  if (value === 'bearish') return '空頭';
  return '中立';
}

function stanceClass(value) {
  if (value === 'bullish') return 'is-bullish';
  if (value === 'bearish') return 'is-bearish';
  return 'is-neutral';
}

function latestHistory(stock) {
  return stock?.history?.[0] ?? null;
}

function formatRange(frame) {
  if (!frame?.startDate || !frame?.endDate) {
    return '尚未匯入';
  }

  return `${formatDate(frame.startDate)} - ${formatDate(frame.endDate)}`;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatPrice(value, currency) {
  const amount = numberOrNull(value);

  if (amount === null) {
    return '--';
  }

  const code = String(currency ?? '').trim();
  const upperCode = code.toUpperCase();
  const maximumFractionDigits = Math.abs(amount) >= 1000 ? 0 : 2;
  const standardCurrencies = new Set(['USD', 'KRW', 'CNY', 'SEK', 'EUR', 'JPY', 'TWD']);

  if (code === upperCode && standardCurrencies.has(upperCode)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: upperCode,
      maximumFractionDigits,
    }).format(amount);
  }

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(amount);

  return code ? `${formatted} ${code}` : formatted;
}

function formatSignedPercent(value) {
  const number = numberOrNull(value);

  if (number === null) {
    return '--';
  }

  const formatted = new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: Math.abs(number) >= 10 ? 0 : 1,
    minimumFractionDigits: Math.abs(number) >= 10 ? 0 : 1,
  }).format(Math.abs(number));

  if (number > 0) return `+${formatted}%`;
  if (number < 0) return `-${formatted}%`;
  return '0.0%';
}

function performanceClass(value) {
  const number = numberOrNull(value);

  if (number > 0) return 'is-bullish';
  if (number < 0) return 'is-bearish';
  return 'is-neutral';
}
</script>

<template>
  <section class="page-shell serenity-radar-page">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(dataset)"
      empty-message="Serenity 觀點資料尚未建立"
    />

    <template v-if="dataset">
      <section class="page-hero compact serenity-hero">
        <div class="hero-copy">
          <span class="hero-kicker">US AI Supply Chain Watch</span>
          <h1>Serenity 觀點雷達</h1>
          <p class="page-subtitle">
            追蹤 Serenity 公開貼文中提到的美股 AI / 半導體供應鏈標的，將每次提及整理為多頭、空頭或中立，並保留原文連結供回看。
          </p>

          <div class="hero-summary-grid serenity-summary-grid">
            <article
              v-for="card in heroCards"
              :key="card.label"
              class="hero-summary-card"
            >
              <span class="hero-summary-label">{{ card.label }}</span>
              <strong class="hero-summary-value">{{ card.value }}</strong>
              <p class="hero-summary-note">{{ card.note }}</p>
            </article>
          </div>
        </div>

        <aside class="serenity-source-card">
          <span class="source-pill" :class="{ 'is-ready': isReady }">{{ sourceStatusText }}</span>
          <strong>@{{ dataset.influencer?.handle }}</strong>
          <p>{{ dataset.influencer?.focus }}</p>
          <a
            class="source-link"
            :href="dataset.influencer?.profileUrl"
            target="_blank"
            rel="noreferrer"
          >
            開啟 X 個人頁
          </a>
          <small>更新：{{ dataset.generatedAt ? formatDate(dataset.generatedAt) : '尚未匯入' }}</small>
        </aside>
      </section>

      <section class="panel serenity-control-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">觀點時間軸</h2>
            <p class="panel-subtitle">目前區間：{{ formatRange(timeframe) }}</p>
          </div>
          <span class="meta-chip">{{ formatNumber(filteredStocks.length) }} 檔</span>
        </div>

        <div class="serenity-controls">
          <div class="serenity-segment" role="tablist" aria-label="時間區間">
            <button
              v-for="item in timeframeOptions"
              :key="item.key"
              type="button"
              :class="{ 'is-active': activeTimeframe === item.key }"
              @click="activeTimeframe = item.key"
            >
              {{ item.label }}
            </button>
          </div>

          <div class="serenity-segment" role="tablist" aria-label="觀點方向">
            <button
              v-for="item in stanceOptions"
              :key="item.key"
              type="button"
              :class="{ 'is-active': activeStance === item.key }"
              @click="activeStance = item.key"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </section>

      <section
        v-if="!isReady"
        class="panel serenity-setup-panel"
      >
        <div class="panel-header">
          <div>
            <h2 class="panel-title">{{ setupTitle }}</h2>
            <p class="panel-subtitle">{{ setupMessage }}</p>
          </div>
        </div>

        <div v-if="sourceError" class="serenity-error-note">
          <strong>{{ sourceError.title }}</strong>
          <p>{{ sourceError.detail }}</p>
          <a
            v-if="sourceError.registrationUrl"
            :href="sourceError.registrationUrl"
            target="_blank"
            rel="noreferrer"
          >
            開啟 X Project 說明
          </a>
        </div>

        <div class="serenity-compliance-grid">
          <article class="sub-panel">
            <strong>合規來源</strong>
            <p>使用 X API v2 user timeline，不做網頁 HTML 爬取，也不繞過 rate limit。</p>
          </article>
          <article class="sub-panel">
            <strong>內容保存</strong>
            <p>站內只保存摘要、分類、股票代號、貼文 ID、互動數與原文連結，不搬完整貼文。</p>
          </article>
          <article class="sub-panel">
            <strong>分類方式</strong>
            <p>第一版用關鍵字判斷多空，之後可以再接 LLM 做更細的語意判讀。</p>
          </article>
        </div>
      </section>

      <section
        v-if="isReady && sortedPerformanceRows.length"
        class="panel serenity-performance-panel"
      >
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Performance 參考表</h2>
            <p class="panel-subtitle">對照 TrackSerenity 追蹤的提及價、目前價與提及後報酬率。</p>
          </div>
          <span class="meta-chip">
            {{ formatNumber(quotedPerformanceCount) }} / {{ formatNumber(sortedPerformanceRows.length) }} 有現價
          </span>
        </div>

        <div class="serenity-performance-table-shell">
          <table class="serenity-performance-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Ticker</th>
                <th>Company</th>
                <th>提及日</th>
                <th>提及價</th>
                <th>目前價</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in sortedPerformanceRows"
                :key="`${row.symbol}-${row.mentionDate}`"
              >
                <td class="performance-rank">
                  {{ numberOrNull(row.returnSinceMention) !== null ? `#${index + 1}` : '--' }}
                </td>
                <td>
                  <div class="performance-symbol">
                    <strong>{{ row.symbol }}</strong>
                    <span>{{ row.exchange || 'US' }}</span>
                  </div>
                </td>
                <td class="performance-company">{{ row.company || '--' }}</td>
                <td>{{ formatDate(row.mentionDate) || '--' }}</td>
                <td>{{ formatPrice(row.mentionPrice, row.currency) }}</td>
                <td>
                  <div class="performance-price">
                    <strong>{{ formatPrice(row.currentPrice, row.currentCurrency || row.currency) }}</strong>
                    <span v-if="row.quoteSource">{{ row.quoteSource }}</span>
                  </div>
                </td>
                <td>
                  <strong class="performance-return" :class="performanceClass(row.returnSinceMention)">
                    {{ formatSignedPercent(row.returnSinceMention) }}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="performance-footnote">
          報酬率以 TrackSerenity 記錄的提及價到最新可得現價估算，僅供觀察提及後走勢，不代表原始觀點仍然有效。
        </p>
      </section>

      <section
        v-if="filteredStocks.length"
        class="serenity-stock-grid"
      >
        <article
          v-for="stock in filteredStocks"
          :key="stock.symbol"
          class="serenity-stock-card"
          :class="stanceClass(stock.stance)"
        >
          <div class="serenity-card-head">
            <div>
              <span class="ticker-symbol">{{ stock.symbol }}</span>
              <strong>{{ stanceLabel(stock.stance) }}</strong>
            </div>
            <span class="stance-badge" :class="stanceClass(stock.stance)">
              {{ formatNumber(stock.mentionCount) }} 次
            </span>
          </div>

          <div class="serenity-metrics">
            <div>
              <span>多頭</span>
              <strong>{{ formatNumber(stock.bullishCount) }}</strong>
            </div>
            <div>
              <span>空頭</span>
              <strong>{{ formatNumber(stock.bearishCount) }}</strong>
            </div>
            <div>
              <span>中立</span>
              <strong>{{ formatNumber(stock.neutralCount) }}</strong>
            </div>
          </div>

          <p class="serenity-summary">{{ latestHistory(stock)?.summary }}</p>

          <div class="serenity-history-list">
            <a
              v-for="item in stock.history.slice(0, 4)"
              :key="`${stock.symbol}-${item.postId}`"
              :href="item.postUrl"
              target="_blank"
              rel="noreferrer"
              class="serenity-history-item"
            >
              <span>{{ formatDate(item.date) }}</span>
              <strong :class="stanceClass(item.stance)">{{ stanceLabel(item.stance) }}</strong>
            </a>
          </div>
        </article>
      </section>

      <section
        v-else
        class="panel serenity-empty-panel"
      >
        <div class="panel-header">
          <div>
            <h2 class="panel-title">這個區間尚未偵測到股票</h2>
            <p class="panel-subtitle">可以切換週、月、季，或等待下一次 Serenity 資料匯入。</p>
          </div>
        </div>
      </section>

      <section
        v-if="recentPosts.length"
        class="panel serenity-recent-panel"
      >
        <div class="panel-header">
          <div>
            <h2 class="panel-title">最近提及紀錄</h2>
            <p class="panel-subtitle">每筆保留摘要與原文連結，方便回頭核對脈絡。</p>
          </div>
        </div>

        <div class="serenity-recent-list">
          <a
            v-for="post in recentPosts"
            :key="post.id"
            :href="post.postUrl"
            target="_blank"
            rel="noreferrer"
            class="serenity-recent-item"
          >
            <span>{{ formatDate(post.date) }}</span>
            <strong>{{ post.symbols.join(', ') }}</strong>
            <em :class="stanceClass(post.stance)">{{ stanceLabel(post.stance) }}</em>
          </a>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.serenity-radar-page {
  display: grid;
  gap: 18px;
}

.serenity-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
  align-items: stretch;
  gap: 18px;
  background:
    linear-gradient(135deg, rgba(11, 105, 155, 0.13), rgba(19, 136, 94, 0.09)),
    var(--surface-strong);
}

.serenity-summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.serenity-source-card,
.serenity-stock-card {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.serenity-source-card {
  display: grid;
  align-content: space-between;
  gap: 12px;
  padding: 20px;
}

.serenity-source-card strong {
  font-size: 1.6rem;
  color: var(--brand-deep);
}

.serenity-source-card p,
.serenity-source-card small,
.serenity-summary {
  margin: 0;
  color: var(--text-soft);
}

.source-pill,
.stance-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  border-radius: 999px;
  border: 1px solid var(--border);
  padding: 0.36rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 800;
}

.source-pill {
  color: #8a5a00;
  background: rgba(217, 119, 6, 0.12);
}

.source-pill.is-ready {
  color: var(--down);
  background: rgba(19, 136, 94, 0.12);
}

.source-link {
  width: fit-content;
  border-radius: 999px;
  padding: 0.58rem 0.9rem;
  background: rgba(11, 105, 155, 0.1);
  color: var(--brand-deep);
  font-weight: 800;
}

.serenity-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.serenity-segment {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface-muted);
}

.serenity-segment button {
  min-width: 58px;
  min-height: 36px;
  border: 0;
  border-radius: 10px;
  padding: 0.45rem 0.78rem;
  color: var(--text-soft);
  background: transparent;
  font-weight: 800;
  cursor: pointer;
}

.serenity-segment button.is-active {
  color: var(--brand-deep);
  background: var(--surface-strong);
  box-shadow: 0 8px 18px rgba(20, 41, 61, 0.08);
}

.serenity-performance-panel {
  overflow: hidden;
}

.serenity-performance-table-shell {
  margin-top: 14px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.serenity-performance-table {
  width: 100%;
  min-width: 840px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.92rem;
}

.serenity-performance-table th,
.serenity-performance-table td {
  padding: 12px 14px;
  text-align: left;
  vertical-align: middle;
}

.serenity-performance-table th {
  color: var(--text-soft);
  background: var(--surface-muted);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0;
  white-space: nowrap;
}

.serenity-performance-table td {
  border-top: 1px solid var(--border);
  color: var(--text);
}

.serenity-performance-table tbody tr:hover {
  background: rgba(11, 105, 155, 0.06);
}

.serenity-performance-table th:first-child,
.serenity-performance-table td:first-child {
  width: 76px;
  text-align: right;
}

.performance-rank {
  color: var(--text-soft);
  font-weight: 900;
  white-space: nowrap;
}

.performance-symbol,
.performance-price {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.performance-symbol strong {
  color: var(--brand-deep);
  font-size: 1.04rem;
}

.performance-symbol span,
.performance-price span,
.performance-footnote {
  color: var(--text-soft);
  font-size: 0.78rem;
}

.performance-company {
  min-width: 180px;
  max-width: 280px;
  line-height: 1.4;
  white-space: normal;
}

.performance-price strong,
.performance-return {
  white-space: nowrap;
}

.performance-return {
  font-size: 1rem;
}

.performance-footnote {
  margin: 10px 0 0;
}

.serenity-compliance-grid,
.serenity-stock-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.serenity-error-note {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
  border: 1px solid rgba(217, 119, 6, 0.2);
  border-radius: 14px;
  padding: 14px;
  background: rgba(217, 119, 6, 0.08);
}

.serenity-error-note strong {
  color: #8a5a00;
}

.serenity-error-note p {
  margin: 0;
  color: var(--text-soft);
}

.serenity-error-note a {
  width: fit-content;
  font-weight: 800;
  color: var(--brand-deep);
}

.serenity-compliance-grid .sub-panel {
  display: grid;
  gap: 8px;
}

.serenity-compliance-grid p {
  margin: 0;
  color: var(--text-soft);
}

.serenity-stock-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-left: 4px solid var(--neutral);
}

.serenity-stock-card.is-bullish {
  border-left-color: var(--up);
}

.serenity-stock-card.is-bearish {
  border-left-color: var(--down);
}

.serenity-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.serenity-card-head > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ticker-symbol {
  font-size: 1.8rem;
  font-weight: 900;
  line-height: 1;
  color: var(--brand-deep);
}

.stance-badge.is-bullish,
.is-bullish {
  color: var(--up);
}

.stance-badge.is-bearish,
.is-bearish {
  color: var(--down);
}

.stance-badge.is-neutral,
.is-neutral {
  color: var(--neutral);
}

.serenity-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.serenity-metrics div {
  display: grid;
  gap: 3px;
  border-radius: 12px;
  padding: 10px;
  background: var(--surface-muted);
}

.serenity-metrics span {
  color: var(--text-soft);
  font-size: 0.78rem;
}

.serenity-history-list,
.serenity-recent-list {
  display: grid;
  gap: 8px;
}

.serenity-history-item,
.serenity-recent-item {
  display: grid;
  grid-template-columns: minmax(80px, 0.8fr) minmax(56px, 0.6fr);
  gap: 10px;
  align-items: center;
  border-radius: 12px;
  padding: 9px 10px;
  background: var(--surface-muted);
}

.serenity-history-item span,
.serenity-recent-item span {
  color: var(--text-soft);
  font-size: 0.84rem;
}

.serenity-recent-item {
  grid-template-columns: 110px minmax(0, 1fr) 64px;
}

.serenity-recent-item em {
  font-style: normal;
  font-weight: 800;
}

html[data-theme="dark"] .serenity-hero {
  background:
    linear-gradient(135deg, rgba(99, 196, 255, 0.12), rgba(79, 209, 165, 0.1)),
    var(--surface-strong);
}

html[data-theme="dark"] .serenity-segment button.is-active,
html[data-theme="dark"] .source-link {
  color: var(--brand-deep);
}

html[data-theme="dark"] .serenity-performance-table tbody tr:hover {
  background: rgba(99, 196, 255, 0.08);
}

@media (max-width: 1080px) {
  .serenity-hero,
  .serenity-stock-grid,
  .serenity-compliance-grid {
    grid-template-columns: 1fr;
  }

  .serenity-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .serenity-summary-grid,
  .serenity-metrics {
    grid-template-columns: 1fr;
  }

  .serenity-controls {
    align-items: stretch;
  }

  .serenity-segment {
    width: 100%;
  }

  .serenity-segment button {
    flex: 1 1 64px;
  }

  .serenity-performance-table {
    min-width: 780px;
    font-size: 0.88rem;
  }

  .serenity-performance-table th,
  .serenity-performance-table td {
    padding: 10px 12px;
  }

  .serenity-recent-item,
  .serenity-history-item {
    grid-template-columns: 1fr;
  }
}
</style>
