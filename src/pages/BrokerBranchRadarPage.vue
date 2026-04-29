<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';

const { manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const brokerRadar = ref(null);
const isRadarLoading = ref(false);
const radarError = ref('');
const selectedBranchCode = ref('all');

const hasData = computed(
  () =>
    Boolean(brokerRadar.value) &&
    Boolean(
      brokerRadar.value?.recommendedStocks?.length ||
        brokerRadar.value?.recentBuyFocus?.length ||
        brokerRadar.value?.recentSellFocus?.length ||
        brokerRadar.value?.topBranches?.length,
    ),
);

const branchOptions = computed(() => {
  const branches = brokerRadar.value?.topBranches ?? [];
  return [
    { bno: 'all', name: '全部分點' },
    ...branches.map((branch) => ({
      bno: branch.bno,
      name: branch.name,
    })),
  ];
});

const selectedBranchDetail = computed(() => {
  if (selectedBranchCode.value === 'all') return null;
  return brokerRadar.value?.topBranches?.find((branch) => branch.bno === selectedBranchCode.value) ?? null;
});

const activeRecommendedStocks = computed(() => {
  const items = brokerRadar.value?.recommendedStocks ?? [];
  if (selectedBranchCode.value === 'all') return items;
  return items.filter((item) => item.branchCodes?.includes(selectedBranchCode.value));
});

const activeRecentBuyFocus = computed(() => {
  const items = brokerRadar.value?.recentBuyFocus ?? [];
  if (selectedBranchCode.value === 'all') return items;
  return items.filter((item) => item.branchCodes?.includes(selectedBranchCode.value));
});

const activeRecentSellFocus = computed(() => {
  const items = brokerRadar.value?.recentSellFocus ?? [];
  if (selectedBranchCode.value === 'all') return items;
  return items.filter((item) => item.branchCodes?.includes(selectedBranchCode.value));
});

const activeTopBranches = computed(() => {
  const items = brokerRadar.value?.topBranches ?? [];
  if (selectedBranchCode.value === 'all') return items;
  return items.filter((item) => item.bno === selectedBranchCode.value);
});

const activeObservations = computed(() => {
  if (selectedBranchCode.value === 'all') {
    return brokerRadar.value?.observations ?? [];
  }

  const branch = selectedBranchDetail.value;
  if (!branch) return [];

  return [
    `${branch.name} 最近偏多 ${formatNumber(branch.latestBuys?.length ?? 0)} 檔、偏空 ${formatNumber(branch.latestSells?.length ?? 0)} 檔。`,
    `這個分點近期命中 ${formatNumber(branch.candidateHits ?? 0)} 檔候選股，分點分數 ${formatBranchScore(branch.score)}。`,
    `先看它最近偏多名單，再對照技術面、外資 / 投信與題材有沒有站在同一邊。`,
  ];
});

const spotlightCards = computed(() => {
  const summary = brokerRadar.value?.summary ?? {};
  const branch = selectedBranchDetail.value;
  const recommendedCount = activeRecommendedStocks.value.length;
  const branchCount = activeTopBranches.value.length;
  const buyCount = activeRecentBuyFocus.value.length;
  const sellCount = activeRecentSellFocus.value.length;
  const isAllBranches = selectedBranchCode.value === 'all';
  const recommendedValue = isAllBranches ? (summary.recommendedCount ?? 0) : recommendedCount;
  const branchValue = isAllBranches ? (summary.branchCount ?? 0) : branchCount;
  const buyValue = isAllBranches ? (summary.recentBuyCount ?? 0) : buyCount;
  const sellValue = isAllBranches ? (summary.recentSellCount ?? 0) : sellCount;

  return [
    {
      key: 'recommended',
      label: '推薦觀察',
      value: `${formatNumber(recommendedValue)} 檔`,
      note:
        isAllBranches
          ? '先看高勝率分點、技術面和法人面一起偏多的名單。'
          : `這些是 ${branch?.name ?? '指定分點'} 最近偏多、而且站上條件也不差的股票。`,
    },
    {
      key: 'branches',
      label: '高勝率分點',
      value: `${formatNumber(branchValue)} 家`,
      note:
        isAllBranches
          ? '優先看最近在多檔候選股重複出現的分點。'
          : '切到單一分點時，這裡會只保留該分點的聚焦結果。',
    },
    {
      key: 'buy-focus',
      label: '偏多聚焦',
      value: `${formatNumber(buyValue)} 檔`,
      note:
        isAllBranches
          ? '整理最近高勝率分點正在偏多的台股。'
          : `直接看 ${branch?.name ?? '指定分點'} 最近明顯偏多的台股。`,
    },
    {
      key: 'sell-focus',
      label: '賣壓觀察',
      value: `${formatNumber(sellValue)} 檔`,
      note:
        isAllBranches
          ? '用來避開短線被高勝率分點同步調節的股票。'
          : `如果 ${branch?.name ?? '指定分點'} 最近在調節，這裡會先幫你列出來。`,
    },
  ];
});

const pageSeo = computed(() => ({
  title: '勝率分點雷達',
  description: '整理勝率較高的券商分點最近買賣了哪些台股，並直接給出值得觀察的推薦名單。',
  routePath: '/broker-branches',
  keywords: ['勝率分點', '券商分點', '分點雷達', '台股分點', '分點買賣超'],
}));

useSeoMeta(pageSeo);

onMounted(async () => {
  await loadGlobalData();
  await loadBrokerRadar();
});

watch(
  () => manifest.value?.brokerBranchRadarPath,
  async () => {
    await loadBrokerRadar();
  },
);

async function loadBrokerRadar() {
  const dataPath = manifest.value?.brokerBranchRadarPath ?? 'data/radar/broker-branches.json';

  isRadarLoading.value = true;
  radarError.value = '';

  try {
    brokerRadar.value = await fetchJson(dataPath);
    if (
      selectedBranchCode.value !== 'all' &&
      !brokerRadar.value?.topBranches?.some((branch) => branch.bno === selectedBranchCode.value)
    ) {
      selectedBranchCode.value = 'all';
    }
  } catch (error) {
    brokerRadar.value = null;
    radarError.value = error instanceof Error ? error.message : '勝率分點雷達載入失敗';
  } finally {
    isRadarLoading.value = false;
  }
}

function getRecommendationTone(item) {
  if (String(item?.recommendationLabel ?? '').includes('共振')) return 'up';
  if (String(item?.recommendationLabel ?? '').includes('賣壓')) return 'risk';
  return 'info';
}

function getSignalTone(item) {
  if (item?.topSignalTone === 'up') return 'up';
  if (item?.topSignalTone === 'down') return 'warning';
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
  const broker = item.foreignTargetBroker ? ` / ${item.foreignTargetBroker}` : '';

  return `${formatNumber(item.foreignTargetPrice)}${premium}${broker}`;
}

function formatBranchScore(value) {
  return `${formatNumber(value)} 分`;
}

function formatBranchReplayWinRate(stats) {
  const value = stats?.horizon5?.winRate;
  return value === null || value === undefined ? '樣本累積中' : formatPercent(value);
}

function formatBranchReplayAverage(stats) {
  const value = stats?.horizon5?.averageReturn;
  return value === null || value === undefined ? '樣本累積中' : formatPercent(value);
}

function formatBranchReplaySamples(stats) {
  const value = stats?.horizon5?.sampleCount ?? 0;
  return value ? `${formatNumber(value)} 筆` : '樣本累積中';
}

function getCoverageText(item) {
  const names = (item?.branchNames ?? []).slice(0, 3).join('、');
  return item?.branchCount ? `${formatNumber(item.branchCount)} 家分點：${names}` : '分點資料整理中';
}
</script>

<template>
  <section class="page-shell broker-radar-page">
    <StatusCard
      :is-loading="isLoading || isRadarLoading"
      :error-message="radarError || errorMessage"
      :has-data="hasData"
      empty-message="勝率分點雷達資料尚未整理完成。"
    />

    <template v-if="hasData">
      <section class="page-hero compact broker-radar-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Winning Broker Branch Radar</span>
          <h1>勝率分點雷達</h1>
          <p>
            先從站上偏強或值得追蹤的股票，回頭看哪些券商分點最近做得最好，再整理出它們正在偏多、偏空的台股。這頁不是單看分點買賣超，而是把分點績效、技術面、法人面和流動性一起看。
          </p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">資料日期 {{ formatDate(brokerRadar.marketDate) }}</span>
            <span class="theme-observation-chip">候選股 {{ formatNumber(brokerRadar.summary?.candidateStockCount ?? 0) }} 檔</span>
            <span class="theme-observation-chip">成功覆蓋 {{ formatNumber(brokerRadar.summary?.stockCoverageCount ?? 0) }} 檔</span>
            <span v-if="brokerRadar.historicalSummary?.snapshotCount" class="theme-observation-chip">
              分點回看 {{ formatNumber(brokerRadar.historicalSummary.snapshotCount) }} 個交易日
            </span>
            <span
              v-if="brokerRadar.historicalSummary?.bestWinRateBranch?.horizon5?.winRate !== null && brokerRadar.historicalSummary?.bestWinRateBranch?.horizon5?.winRate !== undefined"
              class="theme-observation-chip"
            >
              5 日勝率最佳 {{ brokerRadar.historicalSummary.bestWinRateBranch.name }}
              {{ formatPercent(brokerRadar.historicalSummary.bestWinRateBranch.horizon5.winRate) }}
            </span>
            <span
              v-for="(item, index) in brokerRadar.observations ?? []"
              :key="`broker-observation-${index}`"
              class="theme-observation-chip"
            >
              {{ item }}
            </span>
          </div>
        </div>

        <aside class="broker-radar-hero-board">
          <article v-for="card in spotlightCards" :key="card.key" class="theme-spotlight-card">
            <span class="theme-spotlight-label">{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <p>{{ card.note }}</p>
          </article>
        </aside>
      </section>

      <section class="panel broker-branch-filter-panel">
        <div class="broker-branch-filter-copy">
          <h2 class="panel-title">聚焦指定分點</h2>
          <p class="panel-subtitle">想直接看富邦-仁愛、凱基-台北或摩根大通最近在做什麼，可以先從這裡切。</p>
        </div>

        <div class="broker-branch-filter-controls">
          <label class="broker-branch-filter-select">
            <span>目前聚焦</span>
            <select v-model="selectedBranchCode">
              <option v-for="branch in branchOptions" :key="`branch-option-${branch.bno}`" :value="branch.bno">
                {{ branch.name }}
              </option>
            </select>
          </label>

          <div class="broker-branch-chip-row">
            <button
              v-for="branch in branchOptions.slice(0, 7)"
              :key="`branch-chip-${branch.bno}`"
              type="button"
              class="broker-branch-chip"
              :class="{ 'is-active': selectedBranchCode === branch.bno }"
              @click="selectedBranchCode = branch.bno"
            >
              {{ branch.name }}
            </button>
          </div>
        </div>
      </section>

      <section class="broker-radar-layout">
        <div class="broker-radar-main">
          <article class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">推薦可觀察</h2>
                <p class="panel-subtitle">先看分點偏多、技術面不差、法人也有跟上的名單，這些比較接近你隔日真的會拿來追蹤的股票。</p>
              </div>
              <span class="meta-chip">{{ formatNumber(activeRecommendedStocks.length) }} 檔</span>
            </div>

            <div class="broker-recommendation-grid">
              <RouterLink
                v-for="item in activeRecommendedStocks"
                :key="`recommend-${item.code}`"
                :to="createStockRoute(item.code)"
                class="broker-stock-card"
                :class="`is-${getRecommendationTone(item)}`"
              >
                <div class="broker-stock-head">
                  <div>
                    <strong>{{ item.code }} {{ item.name }}</strong>
                    <p class="muted">{{ item.industryName || item.themeTitle || '台股個股' }}</p>
                  </div>
                  <div class="broker-stock-price">
                    <strong>{{ formatNumber(item.close) }}</strong>
                    <span :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                      {{ formatPercent(item.changePercent) }}
                    </span>
                  </div>
                </div>

                <div class="entry-warning-chip-row">
                  <span class="status-badge" :class="`is-${getRecommendationTone(item)}`">{{ item.recommendationLabel }}</span>
                  <span v-if="item.topSignalTitle" class="status-badge" :class="`is-${getSignalTone(item)}`">{{ item.topSignalTitle }}</span>
                </div>

                <p class="broker-stock-note">{{ item.recommendationNote }}</p>
                <p class="broker-stock-note is-muted">{{ getCoverageText(item) }}</p>

                <div class="broker-stock-metrics">
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
                    <span>分點均績效</span>
                    <strong>{{ formatPercent(item.avgBranchPerformance) }}</strong>
                  </div>
                  <div class="is-wide">
                    <span>外資目標價</span>
                    <strong>{{ formatTargetPrice(item) }}</strong>
                  </div>
                </div>

                <div v-if="item.drivers?.length" class="tag-row">
                  <span v-for="driver in item.drivers.slice(0, 4)" :key="`${item.code}-${driver}`" class="keyword-pill">
                    {{ driver }}
                  </span>
                </div>
              </RouterLink>
            </div>
          </article>

          <section class="dual-grid broker-radar-focus-grid">
            <article class="panel">
              <div class="panel-header">
                <div>
                  <h2 class="panel-title">高勝率分點最近偏多</h2>
                  <p class="panel-subtitle">如果你想知道最近分點資金正在卡位什麼，先從這裡看會比較快。</p>
                </div>
              </div>

              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>股票</th>
                      <th>分點覆蓋</th>
                      <th>買賣超</th>
                      <th>20 日</th>
                      <th>外資 / 投信</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in activeRecentBuyFocus" :key="`buy-${item.code}`">
                      <td>
                        <RouterLink class="code-link" :to="createStockRoute(item.code)">{{ item.code }}</RouterLink>
                        <div class="muted">{{ item.name }}</div>
                      </td>
                      <td>
                        <strong>{{ formatNumber(item.branchCount) }} 家</strong>
                        <div class="muted">{{ item.branchNames.slice(0, 2).join('、') || '分點整理中' }}</div>
                      </td>
                      <td>
                        <strong>{{ formatLots(item.netLotsTotal) }}</strong>
                        <div class="muted">買 {{ formatLots(item.buyLotsTotal) }} / 賣 {{ formatLots(item.sellLotsTotal) }}</div>
                      </td>
                      <td :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
                        {{ formatPercent(item.return20) }}
                      </td>
                      <td class="muted">
                        外 {{ formatLots(item.foreign5Day) }} / 投 {{ formatLots(item.investmentTrust5Day) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article class="panel">
              <div class="panel-header">
                <div>
                  <h2 class="panel-title">高勝率分點最近偏空</h2>
                  <p class="panel-subtitle">用來避開短線容易被分點同步調節的股票，或先觀察支撐是不是守得住。</p>
                </div>
              </div>

              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>股票</th>
                      <th>分點覆蓋</th>
                      <th>買賣超</th>
                      <th>20 日</th>
                      <th>觀察</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in activeRecentSellFocus" :key="`sell-${item.code}`">
                      <td>
                        <RouterLink class="code-link" :to="createStockRoute(item.code)">{{ item.code }}</RouterLink>
                        <div class="muted">{{ item.name }}</div>
                      </td>
                      <td>
                        <strong>{{ formatNumber(item.branchCount) }} 家</strong>
                        <div class="muted">{{ item.branchNames.slice(0, 2).join('、') || '分點整理中' }}</div>
                      </td>
                      <td>
                        <strong class="text-down">{{ formatLots(item.netLotsTotal) }}</strong>
                        <div class="muted">買 {{ formatLots(item.buyLotsTotal) }} / 賣 {{ formatLots(item.sellLotsTotal) }}</div>
                      </td>
                      <td :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
                        {{ formatPercent(item.return20) }}
                      </td>
                      <td>
                        <span class="status-badge" :class="`is-${getRecommendationTone(item)}`">{{ item.recommendationLabel }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <article class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">高勝率分點排行榜</h2>
                <p class="panel-subtitle">不是只看哪家分點買最多，而是優先看近期在多檔候選股都做得不錯、而且最近還有動作的分點。</p>
              </div>
            </div>

            <div class="broker-branch-grid">
              <article v-for="branch in activeTopBranches" :key="branch.bno" class="broker-branch-card">
                <div class="broker-branch-head">
                  <div>
                    <strong>{{ branch.name }}</strong>
                    <p class="muted">候選股命中 {{ formatNumber(branch.candidateHits) }} 檔 / 分點分數 {{ formatBranchScore(branch.score) }}</p>
                    <p v-if="branch.historicalStats" class="muted">
                      近 {{ formatNumber(branch.historicalStats.recentPickCount ?? 0) }} 次偏多回看 · 5 日勝率
                      {{ formatBranchReplayWinRate(branch.historicalStats) }} · 平均
                      {{ formatBranchReplayAverage(branch.historicalStats) }}
                    </p>
                  </div>
                  <a class="ghost-button" :href="branch.sourceUrl" target="_blank" rel="noreferrer">查看分點</a>
                </div>

                <div class="broker-branch-metrics">
                  <div>
                    <span>平均績效</span>
                    <strong :class="{ 'text-up': (branch.avgPerformance ?? 0) > 0, 'text-down': (branch.avgPerformance ?? 0) < 0 }">
                      {{ formatPercent(branch.avgPerformance) }}
                    </strong>
                  </div>
                  <div>
                    <span>平均買賣超</span>
                    <strong>{{ formatLots(branch.avgNetLots) }}</strong>
                  </div>
                  <div>
                    <span>近期偏多</span>
                    <strong>{{ formatNumber(branch.latestBuys.length) }} 檔</strong>
                  </div>
                  <div>
                    <span>近期偏空</span>
                    <strong>{{ formatNumber(branch.latestSells.length) }} 檔</strong>
                  </div>
                  <div>
                    <span>近 20 次勝率</span>
                    <strong>{{ formatBranchReplayWinRate(branch.historicalStats) }}</strong>
                  </div>
                  <div>
                    <span>平均 5 日</span>
                    <strong :class="{ 'text-up': (branch.historicalStats?.horizon5?.averageReturn ?? 0) > 0, 'text-down': (branch.historicalStats?.horizon5?.averageReturn ?? 0) < 0 }">
                      {{ formatBranchReplayAverage(branch.historicalStats) }}
                    </strong>
                  </div>
                </div>

                <div class="broker-branch-columns">
                  <div class="broker-branch-column">
                    <h3>最近偏多</h3>
                    <div v-if="branch.latestBuys.length" class="broker-mini-list">
                      <RouterLink
                        v-for="stock in branch.latestBuys"
                        :key="`${branch.bno}-buy-${stock.code}`"
                        :to="createStockRoute(stock.code)"
                        class="broker-mini-item"
                      >
                        <div>
                          <strong>{{ stock.code }} {{ stock.stockName }}</strong>
                          <p class="muted">買賣超 {{ formatLots(stock.netLots) }} / 績效 {{ formatPercent(stock.performance) }}</p>
                        </div>
                        <span>{{ formatNumber(stock.currentPrice) }}</span>
                      </RouterLink>
                    </div>
                    <p v-else class="muted">這個分點目前沒有明顯偏多的台股名單。</p>
                  </div>

                  <div class="broker-branch-column">
                    <h3>最近偏空</h3>
                    <div v-if="branch.latestSells.length" class="broker-mini-list">
                      <RouterLink
                        v-for="stock in branch.latestSells"
                        :key="`${branch.bno}-sell-${stock.code}`"
                        :to="createStockRoute(stock.code)"
                        class="broker-mini-item"
                      >
                        <div>
                          <strong>{{ stock.code }} {{ stock.stockName }}</strong>
                          <p class="muted">買賣超 {{ formatLots(stock.netLots) }} / 績效 {{ formatPercent(stock.performance) }}</p>
                        </div>
                        <span>{{ formatNumber(stock.currentPrice) }}</span>
                      </RouterLink>
                    </div>
                    <p v-else class="muted">這個分點近期沒有明顯偏空的台股名單。</p>
                  </div>
                </div>
              </article>
            </div>
          </article>
        </div>

        <aside class="broker-radar-sidebar">
          <article class="panel broker-radar-sidebar-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">怎麼用這頁</h2>
                <p class="panel-subtitle">先看推薦，再看分點最近偏多 / 偏空，最後確認是不是和技術面、法人面一起站在同一邊。</p>
              </div>
            </div>
            <ol class="theme-playbook-list">
              <li>先用上方切換你想看的分點，像富邦-仁愛或凱基-台北。</li>
              <li>先看推薦可觀察，挑分點偏多又沒有太熱的股票。</li>
              <li>再看偏多表裡有沒有同時出現外資或投信偏多。</li>
              <li>偏空表則主要拿來避開追價，或等支撐明確後再看。</li>
            </ol>
          </article>

          <article class="panel broker-radar-sidebar-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">資料範圍</h2>
                <p class="panel-subtitle">先從站內候選股找出值得追蹤的股票，再回頭檢查高勝率分點最近是不是也在同一邊。</p>
              </div>
            </div>

            <div class="footer-stat-list">
              <div class="footer-stat">
                <span>候選股</span>
                <strong>{{ formatNumber(brokerRadar.summary?.candidateStockCount ?? 0) }} 檔</strong>
              </div>
              <div class="footer-stat">
                <span>成功覆蓋</span>
                <strong>{{ formatNumber(brokerRadar.summary?.stockCoverageCount ?? 0) }} 檔</strong>
              </div>
              <div class="footer-stat">
                <span>資料日期</span>
                <strong>{{ formatDate(brokerRadar.marketDate) }}</strong>
              </div>
              <div class="footer-stat">
                <span>目前聚焦</span>
                <strong>{{ selectedBranchDetail?.name ?? '全部分點' }}</strong>
              </div>
            </div>

            <p class="footer-note">
              分點資料適合拿來補強決策，不建議單看分點就直接追價。最好還是搭配題材、技術面和風險控管一起看。
            </p>
          </article>
        </aside>
      </section>
    </template>
  </section>
</template>
