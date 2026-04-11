<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useStockDetail } from '../composables/useStockDetail';
import { useStockComparisonSeries } from '../composables/useStockComparisonSeries';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import StatusCard from '../components/StatusCard.vue';
import InfoCard from '../components/InfoCard.vue';
import StockFinancialOverview from '../components/StockFinancialOverview.vue';
import IntradayChart from '../components/IntradayChart.vue';
import TechnicalChart from '../components/TechnicalChart.vue';
import HolderStructureChart from '../components/HolderStructureChart.vue';
import { createStockRoute } from '../lib/stockRouting';
import {
  formatDate,
  formatAmount,
  formatNumber,
  formatPercent,
  formatPriceDelta,
} from '../lib/formatters';

const route = useRoute();
const stockCode = ref(String(route.params.code ?? ''));

watch(
  () => route.params.code,
  (value) => {
    stockCode.value = String(value ?? '');
  },
);

const { detail, isLoading, errorMessage } = useStockDetail(stockCode);
const { isFavorite, toggleFavorite } = useFavoriteStocks();

const companyProfile = computed(() => detail.value?.公司概況 ?? null);
const holderDistribution = computed(() => detail.value?.持股分散 ?? null);
const institutionalFlows = computed(() => detail.value?.法人買賣 ?? null);
const marginSnapshot = computed(() => detail.value?.融資融券 ?? null);
const activeEtfExposure = computed(() => detail.value?.主動ETF曝光 ?? null);
const industryComparison = computed(() => detail.value?.同產業比較 ?? null);
const isTracked = computed(() => isFavorite(stockCode.value));
const comparisonCandidateCodes = computed(() =>
  (industryComparison.value?.leaders ?? [])
    .map((item) => item.code)
    .filter((code) => code && code !== stockCode.value)
    .slice(0, 5),
);
const {
  comparisonSeries,
  isLoading: isComparisonSeriesLoading,
} = useStockComparisonSeries(comparisonCandidateCodes);

const laggardText = computed(() =>
  (industryComparison.value?.laggards ?? [])
    .filter((item) => item.code !== stockCode.value)
    .map((item) => `${item.code} ${item.name}`)
    .join('、'),
);

const heroPills = computed(() => [
  companyProfile.value?.產業名稱 ?? '上市股票',
  `資料日 ${formatDate(detail.value?.priceDate)}`,
  `法人五日 ${formatAmount(institutionalFlows.value?.summary?.total5Day)}`,
  `ETF 持有 ${formatNumber(activeEtfExposure.value?.count)}`,
]);

const summaryCards = computed(() => {
  const latestSummary = detail.value?.最新摘要 ?? {};
  const holderSummary = holderDistribution.value ?? {};

  return [
    {
      title: '收盤價',
      value: formatNumber(latestSummary.close),
      description: `日變動 ${formatPriceDelta(latestSummary.change)} / ${formatPercent(latestSummary.changePercent)}`,
      status: (latestSummary.change ?? 0) > 0 ? 'up' : (latestSummary.change ?? 0) < 0 ? 'down' : 'normal',
    },
    {
      title: '20 日報酬',
      value: formatPercent(latestSummary.return20),
      description: `60 日報酬 ${formatPercent(latestSummary.return60)}`,
    },
    {
      title: '大戶持股比',
      value: formatPercent(holderSummary.largeHolderRatio),
      description: `400 張以上，較前次 ${formatPercent(holderSummary.largeHolderRatioDelta)}`,
    },
    {
      title: '散戶持股比',
      value: formatPercent(holderSummary.retailRatio),
      description: `10 張以下，較前次 ${formatPercent(holderSummary.retailRatioDelta)}`,
    },
  ];
});

const quickCards = computed(() => [
  {
    title: '五日法人合計',
    value: formatAmount(institutionalFlows.value?.summary?.total5Day),
    description: `外資 ${formatAmount(institutionalFlows.value?.summary?.foreign5Day)}`,
    status:
      (institutionalFlows.value?.summary?.total5Day ?? 0) > 0
        ? 'up'
        : (institutionalFlows.value?.summary?.total5Day ?? 0) < 0
          ? 'down'
          : 'normal',
  },
  {
    title: '融資餘額',
    value: formatAmount(marginSnapshot.value?.marginToday),
    description: `日增減 ${formatAmount(marginSnapshot.value?.marginChange)}`,
    status:
      (marginSnapshot.value?.marginChange ?? 0) > 0
        ? 'up'
        : (marginSnapshot.value?.marginChange ?? 0) < 0
          ? 'down'
          : 'normal',
  },
  {
    title: '融券餘額',
    value: formatAmount(marginSnapshot.value?.shortToday),
    description: `日增減 ${formatAmount(marginSnapshot.value?.shortChange)}`,
    status:
      (marginSnapshot.value?.shortChange ?? 0) > 0
        ? 'up'
        : (marginSnapshot.value?.shortChange ?? 0) < 0
          ? 'down'
          : 'normal',
  },
  {
    title: '主動 ETF 持有數',
    value: formatNumber(activeEtfExposure.value?.count),
    description:
      activeEtfExposure.value?.items?.[0]
        ? `最高權重 ${activeEtfExposure.value.items[0].etfName} ${formatPercent(activeEtfExposure.value.items[0].weight)}`
        : '目前不在已整理主動 ETF 核心持股',
  },
]);
</script>

<template>
  <section class="page-shell">
    <div class="page-hero compact">
      <div>
        <p class="page-kicker">個股明細</p>
        <h1 class="page-title">{{ detail?.name ?? stockCode }}</h1>
        <p class="page-text">
          這頁把個股技術面、法人買賣超、集保持股分級、官方估值與財務資料整合在一起，方便快速做盤後觀察。
        </p>
        <div class="hero-feature-row">
          <span v-for="item in heroPills" :key="item" class="hero-feature-pill">{{ item }}</span>
        </div>
      </div>
      <div class="hero-side-actions">
        <span class="meta-chip">代號 {{ stockCode }}</span>
        <button
          type="button"
          class="favorite-toggle hero-favorite-toggle"
          :class="{ 'is-active': isTracked }"
          @click="toggleFavorite(stockCode)"
        >
          {{ isTracked ? '已加入自選' : '加入自選' }}
        </button>
      </div>
    </div>

    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(detail)"
      empty-message="這檔個股目前沒有可顯示的靜態明細資料。"
    />

    <template v-if="detail">
      <section class="card-grid">
        <InfoCard
          v-for="item in summaryCards"
          :key="item.title"
          :title="item.title"
          :value="item.value"
          :description="item.description"
          :status="item.status"
        />
      </section>

      <section class="card-grid">
        <InfoCard
          v-for="item in quickCards"
          :key="`quick-${item.title}`"
          :title="item.title"
          :value="item.value"
          :description="item.description"
          :status="item.status"
        />
      </section>

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">同產業比較 / 同族群強弱</h2>
              <p class="panel-subtitle">
                {{ industryComparison?.industryName ?? companyProfile?.產業名稱 ?? '同產業資料整理中' }}
                <template v-if="industryComparison?.peerCount">・追蹤池共 {{ industryComparison.peerCount }} 檔</template>
              </p>
            </div>
          </div>

          <template v-if="industryComparison">
            <div class="comparison-stat-grid">
              <article class="comparison-stat-card">
                <p class="comparison-stat-label">20 日相對排名</p>
                <p class="comparison-stat-value">
                  {{ formatNumber(industryComparison.rank20Day) }} / {{ formatNumber(industryComparison.peerCount) }}
                </p>
                <p class="comparison-stat-note">族群平均 20 日報酬 {{ formatPercent(industryComparison.averageReturn20) }}</p>
              </article>

              <article class="comparison-stat-card">
                <p class="comparison-stat-label">單日強弱排序</p>
                <p class="comparison-stat-value">
                  {{ formatNumber(industryComparison.rankDaily) }} / {{ formatNumber(industryComparison.peerCount) }}
                </p>
                <p class="comparison-stat-note">族群平均日變動 {{ formatPercent(industryComparison.averageChangePercent) }}</p>
              </article>
            </div>

            <ul class="bullet-list compact">
              <li v-for="item in industryComparison.觀察摘要 ?? []" :key="item">{{ item }}</li>
              <li v-if="laggardText">目前相對落後的同族群標的有：{{ laggardText }}</li>
            </ul>
          </template>

          <p v-else class="muted">這檔個股目前還沒有足夠的同產業追蹤資料可以比較。</p>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">同族群領先名單</h2>
              <p class="panel-subtitle">依近 20 日報酬排序，搭配單日強弱與法人五日淨流向</p>
            </div>
          </div>

          <div v-if="industryComparison?.leaders?.length" class="table-wrap">
            <table class="data-table compact-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>20 日</th>
                  <th>日變動</th>
                  <th>法人五日</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in industryComparison.leaders"
                  :key="item.code"
                  :class="{ 'comparison-row-active': item.code === stockCode }"
                >
                  <td><RouterLink class="code-link" :to="createStockRoute(item.code)">{{ item.code }}</RouterLink></td>
                  <td>{{ item.name }}</td>
                  <td :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
                    {{ formatPercent(item.return20) }}
                  </td>
                  <td :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                    {{ formatPercent(item.changePercent) }}
                  </td>
                  <td :class="{ 'text-up': (item.total5Day ?? 0) > 0, 'text-down': (item.total5Day ?? 0) < 0 }">
                    {{ formatAmount(item.total5Day) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-else class="muted">同族群比較清單尚未建立完成。</p>
        </article>
      </section>

      <IntradayChart
        v-if="detail?.盤中走勢"
        :data="detail.盤中走勢"
        title="個股盤中分時圖"
      />

      <TechnicalChart
        :data="detail"
        :comparison-series="comparisonSeries"
        :comparison-loading="isComparisonSeriesLoading"
        title="個股技術分析圖表"
      />

      <HolderStructureChart
        v-if="detail?.持股分散"
        :data="detail.持股分散"
        title="個股大戶 / 散戶拆解圖表"
      />

      <StockFinancialOverview :data="detail" />

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">籌碼觀察</h2>
              <p class="panel-subtitle">最近 {{ detail?.法人買賣?.days?.length ?? 0 }} 個有資料交易日</p>
            </div>
          </div>
          <ul class="bullet-list">
            <li v-for="item in detail?.觀察摘要 ?? []" :key="item">{{ item }}</li>
          </ul>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">融資融券觀察</h2>
              <p class="panel-subtitle">信用交易籌碼快照 {{ formatDate(detail?.融資融券?.date) }}</p>
            </div>
          </div>
          <ul class="bullet-list compact">
            <li>融資餘額：{{ formatAmount(detail?.融資融券?.marginToday) }}</li>
            <li>融資使用率：{{ formatPercent(detail?.融資融券?.marginUsage) }}</li>
            <li>融券餘額：{{ formatAmount(detail?.融資融券?.shortToday) }}</li>
            <li>券資比：{{ formatPercent(detail?.融資融券?.shortToMarginRatio) }}</li>
            <li v-for="item in detail?.融資融券?.觀察摘要 ?? []" :key="item">{{ item }}</li>
            <li v-if="!(detail?.融資融券?.觀察摘要?.length)">這檔個股目前沒有可用的融資融券補充資料。</li>
          </ul>
        </article>
      </section>

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">主動 ETF 持有曝光</h2>
              <p class="panel-subtitle">目前有 {{ detail?.主動ETF曝光?.count ?? 0 }} 檔已整理 ETF 持有</p>
            </div>
          </div>
          <div v-if="detail?.主動ETF曝光?.items?.length" class="table-wrap">
            <table class="data-table compact-table">
              <thead>
                <tr>
                  <th>ETF</th>
                  <th>權重</th>
                  <th>排名</th>
                  <th>揭露日</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in detail?.主動ETF曝光?.items ?? []" :key="`${item.etfCode}-${item.rank}`">
                  <td>{{ item.etfCode }} {{ item.etfName }}</td>
                  <td>{{ formatPercent(item.weight) }}</td>
                  <td>#{{ formatNumber(item.rank) }}</td>
                  <td>{{ formatDate(item.disclosureDate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="muted">這檔個股目前不在已整理主動式 ETF 的核心持股清單裡。</p>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">持股分散摘要</h2>
              <p class="panel-subtitle">TDCC 最新週資料 {{ formatDate(detail?.持股分散?.date) }}</p>
            </div>
          </div>
          <ul class="bullet-list compact">
            <li>大戶定義：400 張以上，持股比 {{ formatPercent(detail?.持股分散?.largeHolderRatio) }}</li>
            <li>散戶定義：10 張以下，持股比 {{ formatPercent(detail?.持股分散?.retailRatio) }}</li>
            <li>級距合計人數：{{ formatAmount(detail?.持股分散?.totalHolders) }}</li>
            <li>集保庫存比：{{ formatPercent(detail?.持股分散?.totalRatio) }}</li>
          </ul>
        </article>
      </section>

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">近五日法人序列</h2>
              <p class="panel-subtitle">外資、投信、自營商</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>外資</th>
                  <th>投信</th>
                  <th>自營商</th>
                  <th>三大法人</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in detail?.法人買賣?.days ?? []" :key="item.date">
                  <td>{{ formatDate(item.date) }}</td>
                  <td :class="{ 'text-up': (item.foreign ?? 0) > 0, 'text-down': (item.foreign ?? 0) < 0 }">{{ formatAmount(item.foreign) }}</td>
                  <td :class="{ 'text-up': (item.investmentTrust ?? 0) > 0, 'text-down': (item.investmentTrust ?? 0) < 0 }">{{ formatAmount(item.investmentTrust) }}</td>
                  <td :class="{ 'text-up': (item.dealer ?? 0) > 0, 'text-down': (item.dealer ?? 0) < 0 }">{{ formatAmount(item.dealer) }}</td>
                  <td :class="{ 'text-up': (item.total ?? 0) > 0, 'text-down': (item.total ?? 0) < 0 }">{{ formatAmount(item.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">持股分級細項</h2>
              <p class="panel-subtitle">最新 TDCC 級距資料</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>級距</th>
                  <th>人數</th>
                  <th>股數</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in detail?.持股分散?.bands ?? []" :key="item.level">
                  <td>{{ item.label }}</td>
                  <td>{{ formatAmount(item.holders) }}</td>
                  <td>{{ formatAmount(item.shares) }}</td>
                  <td>{{ formatPercent(item.ratio) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </template>
  </section>
</template>
