<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { createStockRoute } from '../lib/stockRouting';
import {
  formatAmount,
  formatDate,
  formatLots,
  formatNumber,
  formatPercent,
} from '../lib/formatters';

const { manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const highDividendFlow = ref(null);
const isFlowLoading = ref(false);
const flowError = ref('');

const hasData = computed(
  () =>
    Boolean(highDividendFlow.value) &&
    Boolean(
      highDividendFlow.value?.officialUniverse?.length ||
        highDividendFlow.value?.aggregateBuys?.length ||
        highDividendFlow.value?.aggregateSells?.length ||
        highDividendFlow.value?.trackedEtfs?.length,
    ),
);

const spotlightCards = computed(() => {
  const topBuy = highDividendFlow.value?.aggregateBuys?.[0] ?? null;
  const topSell = highDividendFlow.value?.aggregateSells?.[0] ?? null;

  return [
    {
      key: 'buy',
      label: '共識加碼',
      title: topBuy ? `${topBuy.code} ${topBuy.name}` : '等待新的高息買盤',
      description: topBuy
        ? `同時被 ${formatNumber(topBuy.etfCount, 0)} 檔高息 ETF 買進 / 加碼，近 20 日 ${formatPercent(topBuy.return20)}。`
        : '今天沒有明顯集中加碼的高息 ETF 股票。',
      meta: topBuy ? `權重合計 ${formatPercent(topBuy.weightDeltaTotal)}｜張數 ${formatLots(topBuy.sharesDeltaTotal)}` : '資料整理中',
      tone: 'up',
    },
    {
      key: 'sell',
      label: '共識減碼',
      title: topSell ? `${topSell.code} ${topSell.name}` : '等待新的減碼訊號',
      description: topSell
        ? `同時被 ${formatNumber(topSell.etfCount, 0)} 檔高息 ETF 減碼 / 剔除，短線先留意資金退場。`
        : '今天沒有明顯集中減碼的高息 ETF 股票。',
      meta: topSell ? `權重合計 ${formatPercent(topSell.weightDeltaTotal)}｜張數 ${formatLots(topSell.sharesDeltaTotal)}` : '資料整理中',
      tone: 'down',
    },
    {
      key: 'ready',
      label: '可比較 ETF',
      title: `${formatNumber(highDividendFlow.value?.comparisonReadyCount, 0)} 檔可比較`,
      description: '只統計已經拿到前一版與最新版持股、可以直接做買進 / 賣出比較的高息 ETF。',
      meta: `官方名單 ${formatNumber(highDividendFlow.value?.marketHighDividendEtfCount, 0)} 檔｜站上追蹤 ${formatNumber(highDividendFlow.value?.trackedHighDividendEtfCount, 0)} 檔`,
      tone: 'info',
    },
  ];
});

const pageSeo = computed(() => ({
  title: '高股息 ETF 換股雷達',
  description: '把官方高股息 ETF 名單、整體共識加碼 / 減碼與各檔 ETF 最近換股方向整理在同一頁，快速看高息資金最近在移往哪些台股。',
  routePath: '/high-dividend-etfs',
  keywords: ['高股息 ETF', '收益 ETF', 'ETF 換股', '高息 ETF', '台股主動通'],
}));

useSeoMeta(pageSeo);

onMounted(async () => {
  await loadGlobalData();
  await loadFlowData();
});

watch(
  () => manifest.value?.highDividendEtfFlowPath,
  async () => {
    await loadFlowData();
  },
);

async function loadFlowData() {
  const flowPath = manifest.value?.highDividendEtfFlowPath ?? 'data/etfs/high-dividend-flow.json';

  if (!flowPath) {
    return;
  }

  isFlowLoading.value = true;
  flowError.value = '';

  try {
    highDividendFlow.value = await fetchJson(flowPath);
  } catch (error) {
    highDividendFlow.value = null;
    flowError.value = error instanceof Error ? error.message : '高股息 ETF 換股資料載入失敗';
  } finally {
    isFlowLoading.value = false;
  }
}

function getStockTone(item, direction = 'buy') {
  if ((item?.changePercent ?? 0) > 0) {
    return 'up';
  }

  if ((item?.changePercent ?? 0) < 0) {
    return 'down';
  }

  return direction === 'buy' ? 'info' : 'warning';
}

function getTrackingLabel(item) {
  if (item?.isTracked) {
    return item?.comparisonReady ? '已追蹤' : '待比較';
  }

  return '官方名單';
}

function getTrackingTone(item) {
  if (item?.isTracked && item?.comparisonReady) {
    return 'up';
  }

  if (item?.isTracked) {
    return 'warning';
  }

  return 'info';
}

function formatTargetPrice(item) {
  if (item?.foreignTargetPrice === null || item?.foreignTargetPrice === undefined) {
    return '暫無';
  }

  const premium =
    item.foreignTargetPricePremium === null || item.foreignTargetPricePremium === undefined
      ? ''
      : ` / ${formatPercent(item.foreignTargetPricePremium)}`;
  const broker = item.foreignTargetBroker ? ` ${item.foreignTargetBroker}` : '';
  return `${formatNumber(item.foreignTargetPrice)}${premium}${broker}`;
}

function formatDisclosureRange(item) {
  if (!item?.comparisonReady) {
    return item?.disclosureDate ? `最新揭露 ${formatDate(item.disclosureDate)}` : '等待可比較揭露';
  }

  return `${formatDate(item.fromDisclosureDate)} → ${formatDate(item.toDisclosureDate)}`;
}

function getEtfTopList(items) {
  return (items ?? []).slice(0, 5);
}
</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isLoading || isFlowLoading"
      :error-message="flowError || errorMessage"
      :has-data="hasData"
      empty-message="高股息 ETF 換股資料尚未整理完成。"
    />

    <template v-if="hasData">
      <section class="page-hero compact theme-page-hero high-dividend-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">High Dividend ETF Flow</span>
          <h1>高股息 ETF 換股雷達</h1>
          <p>把官方高股息 / 收益型 ETF 名單、整體共識加碼 / 減碼與各檔 ETF 最近換股方向整理在同一頁，順著 ETF 換股方向找值得研究的台股。</p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">市場日 {{ formatDate(highDividendFlow.marketDate) }}</span>
            <span class="theme-observation-chip">最新揭露 {{ formatDate(highDividendFlow.latestDisclosureDate) }}</span>
            <span class="theme-observation-chip">官方名單 {{ formatNumber(highDividendFlow.marketHighDividendEtfCount, 0) }} 檔</span>
            <span class="theme-observation-chip">站上追蹤 {{ formatNumber(highDividendFlow.trackedHighDividendEtfCount, 0) }} 檔</span>
          </div>
        </div>

        <aside class="theme-hero-board">
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

      <section class="panel high-dividend-universe-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">官方高股息 ETF 名單</h2>
            <p class="panel-subtitle">先看台股市場有哪些高股息 / 收益型 ETF，再確認哪些已經能直接比較換股方向。</p>
          </div>
        </div>

        <div class="high-dividend-universe-grid">
          <article
            v-for="item in highDividendFlow.officialUniverse"
            :key="item.code"
            class="high-dividend-universe-card"
          >
            <div class="high-dividend-universe-head">
              <div>
                <strong>{{ item.code }} {{ item.name }}</strong>
                <p class="muted">{{ item.providerLabel || 'TWSE 官方 ETF 名單' }}</p>
              </div>
              <span class="status-badge" :class="`is-${getTrackingTone(item)}`">{{ getTrackingLabel(item) }}</span>
            </div>

            <div class="high-dividend-universe-metrics">
              <div>
                <span>成交值</span>
                <strong>{{ formatAmount(item.tradeValue) }}</strong>
              </div>
              <div>
                <span>成交量</span>
                <strong>{{ formatLots(item.tradeVolume) }}</strong>
              </div>
              <div>
                <span>均價</span>
                <strong>{{ formatNumber(item.averagePrice) }}</strong>
              </div>
              <div>
                <span>揭露</span>
                <strong>{{ formatDate(item.latestDisclosureDate) }}</strong>
              </div>
            </div>

            <p class="high-dividend-universe-note">{{ item.trackingStatus }}</p>
          </article>
        </div>
      </section>

      <section class="dual-grid high-dividend-overview-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">整體共識加碼</h2>
              <p class="panel-subtitle">把所有已追蹤高股息 ETF 最近新增 / 加碼的股票聚合，先看資金集中往哪裡補。</p>
            </div>
          </div>

          <div v-if="highDividendFlow.aggregateBuys?.length" class="high-dividend-stock-grid">
            <RouterLink
              v-for="item in highDividendFlow.aggregateBuys"
              :key="`buy-${item.code}`"
              class="high-dividend-stock-card"
              :class="`is-${getStockTone(item, 'buy')}`"
              :to="createStockRoute(item.code)"
            >
              <div class="high-dividend-stock-head">
                <div>
                  <strong>{{ item.code }} {{ item.name }}</strong>
                  <p class="muted">{{ item.industryName || '台股個股' }}</p>
                </div>
                <span class="meta-chip is-up">{{ formatNumber(item.etfCount, 0) }} 檔同步</span>
              </div>

              <p class="high-dividend-stock-note">
                權重合計 {{ formatPercent(item.weightDeltaTotal) }}，張數 {{ formatLots(item.sharesDeltaTotal) }}，
                先看 ETF 共識是不是正在把資金往這檔集中。
              </p>

              <div class="high-dividend-stock-metrics">
                <div>
                  <span>收盤</span>
                  <strong>{{ formatNumber(item.close) }}</strong>
                </div>
                <div>
                  <span>單日</span>
                  <strong :class="item.changePercent > 0 ? 'text-up' : item.changePercent < 0 ? 'text-down' : ''">
                    {{ formatPercent(item.changePercent) }}
                  </strong>
                </div>
                <div>
                  <span>20 日</span>
                  <strong>{{ formatPercent(item.return20) }}</strong>
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
                  <span>技術面</span>
                  <strong>{{ item.topSignalTitle || '技術面中性' }}</strong>
                </div>
                <div class="is-wide">
                  <span>外資目標價</span>
                  <strong>{{ formatTargetPrice(item) }}</strong>
                </div>
              </div>

              <div class="high-dividend-etf-chip-row">
                <span v-for="etf in item.etfs.slice(0, 3)" :key="`${item.code}-${etf.etfCode}`" class="theme-observation-chip">
                  {{ etf.etfCode }} {{ formatPercent(etf.weightDelta) }}
                </span>
              </div>
            </RouterLink>
          </div>
          <div v-else class="empty-state compact">
            <strong>今天沒有集中加碼訊號</strong>
            <p>目前已追蹤高股息 ETF 沒有明顯同向新增 / 加碼的台股。</p>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">整體共識減碼</h2>
              <p class="panel-subtitle">把所有已追蹤高股息 ETF 最近剔除 / 減碼的股票聚合，先避開資金明顯退場的位置。</p>
            </div>
          </div>

          <div v-if="highDividendFlow.aggregateSells?.length" class="high-dividend-stock-grid">
            <RouterLink
              v-for="item in highDividendFlow.aggregateSells"
              :key="`sell-${item.code}`"
              class="high-dividend-stock-card"
              :class="`is-${getStockTone(item, 'sell')}`"
              :to="createStockRoute(item.code)"
            >
              <div class="high-dividend-stock-head">
                <div>
                  <strong>{{ item.code }} {{ item.name }}</strong>
                  <p class="muted">{{ item.industryName || '台股個股' }}</p>
                </div>
                <span class="meta-chip is-down">{{ formatNumber(item.etfCount, 0) }} 檔同步</span>
              </div>

              <p class="high-dividend-stock-note">
                權重合計 {{ formatPercent(item.weightDeltaTotal) }}，張數 {{ formatLots(item.sharesDeltaTotal) }}，
                如果短線又剛好碰壓力，先留意是不是 ETF 在邊走邊退。
              </p>

              <div class="high-dividend-stock-metrics">
                <div>
                  <span>收盤</span>
                  <strong>{{ formatNumber(item.close) }}</strong>
                </div>
                <div>
                  <span>單日</span>
                  <strong :class="item.changePercent > 0 ? 'text-up' : item.changePercent < 0 ? 'text-down' : ''">
                    {{ formatPercent(item.changePercent) }}
                  </strong>
                </div>
                <div>
                  <span>20 日</span>
                  <strong>{{ formatPercent(item.return20) }}</strong>
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
                  <span>技術面</span>
                  <strong>{{ item.topSignalTitle || '技術面中性' }}</strong>
                </div>
                <div class="is-wide">
                  <span>外資目標價</span>
                  <strong>{{ formatTargetPrice(item) }}</strong>
                </div>
              </div>

              <div class="high-dividend-etf-chip-row">
                <span v-for="etf in item.etfs.slice(0, 3)" :key="`${item.code}-${etf.etfCode}`" class="theme-observation-chip">
                  {{ etf.etfCode }} {{ formatPercent(etf.weightDelta) }}
                </span>
              </div>
            </RouterLink>
          </div>
          <div v-else class="empty-state compact">
            <strong>今天沒有集中減碼訊號</strong>
            <p>目前已追蹤高股息 ETF 沒有明顯同向剔除 / 減碼的台股。</p>
          </div>
        </article>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">各 ETF 最近換股</h2>
            <p class="panel-subtitle">直接拆開看每一檔高股息 / 收益 ETF 最近在買什麼、賣什麼，方便找出共同方向和特色持股。</p>
          </div>
        </div>

        <div class="high-dividend-etf-grid">
          <article
            v-for="item in highDividendFlow.trackedEtfs"
            :key="item.code"
            class="high-dividend-etf-card"
          >
            <div class="high-dividend-etf-head">
              <div>
                <strong>{{ item.code }} {{ item.name }}</strong>
                <p class="muted">{{ item.providerLabel }}｜{{ formatDisclosureRange(item) }}</p>
              </div>
              <span class="status-badge" :class="item.comparisonReady ? 'is-up' : 'is-warning'">
                {{ item.comparisonReady ? '可比較' : '等待可比較揭露' }}
              </span>
            </div>

            <div class="high-dividend-etf-summary">
              <span class="theme-observation-chip">新增 {{ formatNumber(item.summary?.addedCount, 0) }}</span>
              <span class="theme-observation-chip">剔除 {{ formatNumber(item.summary?.removedCount, 0) }}</span>
              <span class="theme-observation-chip">加碼 {{ formatNumber(item.summary?.increasedCount, 0) }}</span>
              <span class="theme-observation-chip">減碼 {{ formatNumber(item.summary?.decreasedCount, 0) }}</span>
            </div>

            <div v-if="item.comparisonReady" class="high-dividend-etf-columns">
              <div class="high-dividend-etf-column">
                <h3>買進 / 加碼</h3>
                <ul v-if="getEtfTopList(item.topBuys).length" class="high-dividend-mini-list">
                  <li v-for="stock in getEtfTopList(item.topBuys)" :key="`${item.code}-buy-${stock.code}`">
                    <RouterLink :to="createStockRoute(stock.code)">
                      <strong>{{ stock.code }} {{ stock.name }}</strong>
                    </RouterLink>
                    <span>{{ formatPercent(stock.weightDelta) }} / {{ formatLots(stock.sharesDelta) }}</span>
                  </li>
                </ul>
                <p v-else class="muted">這次沒有明顯新增或加碼的台股。</p>
              </div>

              <div class="high-dividend-etf-column">
                <h3>賣出 / 減碼</h3>
                <ul v-if="getEtfTopList(item.topSells).length" class="high-dividend-mini-list">
                  <li v-for="stock in getEtfTopList(item.topSells)" :key="`${item.code}-sell-${stock.code}`">
                    <RouterLink :to="createStockRoute(stock.code)">
                      <strong>{{ stock.code }} {{ stock.name }}</strong>
                    </RouterLink>
                    <span>{{ formatPercent(stock.weightDelta) }} / {{ formatLots(stock.sharesDelta) }}</span>
                  </li>
                </ul>
                <p v-else class="muted">這次沒有明顯剔除或減碼的台股。</p>
              </div>
            </div>
            <div v-else class="empty-state compact">
              <strong>還沒有前一版可比較</strong>
              <p>先等這檔 ETF 連續兩次成功揭露持股，才會開始顯示買進 / 賣出清單。</p>
            </div>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>
