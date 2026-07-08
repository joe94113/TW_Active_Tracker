<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import DataFreshnessBadge from '../components/DataFreshnessBadge.vue';
import IndustryTreemapChart from '../components/IndustryTreemapChart.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { buildIndustryPulse } from '../lib/industryPulse';
import { formatAmount, formatDate, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';

const { dashboard, stockSearchList, manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const activePulseTab = ref('industries');
const activeHeatmapMetric = ref('change');
const heatmapMetricOptions = [
  {
    key: 'change',
    label: '漲跌幅',
    hint: '紅漲綠跌',
  },
  {
    key: 'trade',
    label: '成交值',
    hint: '資金集中',
  },
  {
    key: 'heat',
    label: '強度',
    hint: '綜合分數',
  },
  {
    key: 'volatility',
    label: '波動',
    hint: '平均震幅',
  },
];
const pulse = computed(() => buildIndustryPulse(stockSearchList.value, dashboard.value?.題材雷達));
const hasData = computed(() => Boolean(pulse.value.topIndustries.length || pulse.value.suddenMoves.length));
const strongestIndustry = computed(() => pulse.value.summary?.strongestIndustry ?? null);
const topSuddenMove = computed(() => pulse.value.summary?.topSuddenMove ?? null);
const marketDate = computed(() => dashboard.value?.市場總覽?.資料日期 ?? dashboard.value?.市場總覽?.盤後資料日期 ?? null);

const heroCards = computed(() => [
  {
    title: '升溫最快',
    value: strongestIndustry.value?.industryName ?? '等待新主線',
    note: strongestIndustry.value
      ? `平均漲幅 ${formatPercent(strongestIndustry.value.avgChangePercent)}｜成交值 ${formatAmount(strongestIndustry.value.totalTradeValue)}`
      : '今天還沒有明顯集中升溫的產業。',
  },
  {
    title: '瞬間波動股',
    value: topSuddenMove.value ? `${topSuddenMove.value.code} ${topSuddenMove.value.name}` : '等待新訊號',
    note: topSuddenMove.value
      ? `單日 ${formatPercent(topSuddenMove.value.changePercent)}｜成交值 ${formatAmount(topSuddenMove.value.tradeValue)}`
      : '目前沒有特別突出的瞬間波動股。',
  },
  {
    title: '追蹤產業',
    value: `${formatNumber(pulse.value.summary?.industryCount, 0)} 個`,
    note: '用盤後成交、技術面與題材交集整理產業升溫方向。',
  },
]);

const heatmapTiles = computed(() => {
  const maxTradeValue = Math.max(...pulse.value.topIndustries.map((industry) => Number(industry.totalTradeValue ?? 0)), 1);

  return pulse.value.topIndustries.slice(0, 12).map((industry, index) => {
    const metric = getHeatmapMetric(industry);
    const tradeWeight = Number(industry.totalTradeValue ?? 0) / maxTradeValue;
    const span =
      index <= 1 || tradeWeight >= 0.72
        ? 'is-large'
        : index <= 5 || tradeWeight >= 0.38
          ? 'is-medium'
          : 'is-small';
    const breadthPercent = industry.stockCount
      ? ((industry.advancingCount ?? 0) / industry.stockCount) * 100
      : 0;

    return {
      ...industry,
      rank: index + 1,
      span,
      breadthPercent,
      metricLabel: metric.label,
      metricValue: metric.value,
      metricText: metric.text,
      metricTone: metric.tone,
      metricColorValue: metric.colorValue,
      metricLegendLabel: metric.legendLabel,
      tone: getHeatmapTone(industry.avgChangePercent, industry.heatScore),
    };
  });
});

const heatmapSummaryCards = computed(() => {
  const strongest = heatmapTiles.value[0] ?? null;
  const broadest =
    [...heatmapTiles.value].sort((left, right) => (right.breadthPercent ?? 0) - (left.breadthPercent ?? 0))[0] ?? null;
  const moneyLeader =
    [...heatmapTiles.value].sort((left, right) => (right.totalTradeValue ?? 0) - (left.totalTradeValue ?? 0))[0] ?? null;

  return [
    {
      label: '強度主線',
      value: strongest?.industryName ?? '等待資料',
      note: strongest ? `平均漲跌 ${formatPercent(strongest.avgChangePercent)} / 強度 ${formatHeatScore(strongest.heatScore)}` : '產業強度整理中',
      tone: strongest?.tone ?? 'info',
    },
    {
      label: '廣度最佳',
      value: broadest?.industryName ?? '等待資料',
      note: broadest ? `上漲占比 ${formatPercent(broadest.breadthPercent, 0)}` : '產業廣度整理中',
      tone: broadest?.tone ?? 'info',
    },
    {
      label: '成交聚焦',
      value: moneyLeader?.industryName ?? '等待資料',
      note: moneyLeader ? `成交值 ${formatAmount(moneyLeader.totalTradeValue)}` : '成交值整理中',
      tone: moneyLeader?.tone ?? 'info',
    },
  ];
});

const pageSeo = computed(() => ({
  title: '產業即時動向 / 瞬間波動',
  description: '快速看今天哪些產業升溫、哪些股票突然放量波動，幫你找隔日優先觀察方向。',
  routePath: '/industry-pulse',
  keywords: ['產業即時動向', '瞬間波動', '產業升溫', '放量股', '熱門產業'],
}));

useSeoMeta(pageSeo);

onMounted(() => {
  loadGlobalData();
});

function getToneClass(value) {
  if ((value ?? 0) > 0) return 'text-up';
  if ((value ?? 0) < 0) return 'text-down';
  return '';
}

function getHeatmapTone(changePercent, heatScore) {
  if ((changePercent ?? 0) > 0.35 || (heatScore ?? 0) >= 38) return 'up';
  if ((changePercent ?? 0) < -0.35 || (heatScore ?? 0) <= 12) return 'down';
  return 'info';
}

function formatHeatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? formatNumber(Math.round(score)) : '-';
}

function getHeatmapMetric(industry) {
  if (activeHeatmapMetric.value === 'trade') {
    const value = Number(industry.totalTradeValue ?? 0);
    return {
      label: '成交值',
      value,
      text: formatAmount(value),
      tone: 'activity',
      colorValue: value,
      legendLabel: '成交值',
    };
  }

  if (activeHeatmapMetric.value === 'heat') {
    const value = Number(industry.heatScore ?? 0);
    return {
      label: '強度分數',
      value,
      text: formatHeatScore(value),
      tone: 'activity',
      colorValue: value,
      legendLabel: '強度',
    };
  }

  if (activeHeatmapMetric.value === 'volatility') {
    const value = Number(industry.avgAbsChangePercent ?? Math.abs(industry.avgChangePercent ?? 0));
    return {
      label: '平均波動',
      value,
      text: formatPercent(value),
      tone: 'activity',
      colorValue: value,
      legendLabel: '波動',
    };
  }

  const value = Number(industry.avgChangePercent ?? 0);
  return {
    label: '平均漲跌',
    value,
    text: formatPercent(value),
    tone: 'signed',
    colorValue: value,
    legendLabel: '漲跌幅',
  };
}

function setHeatmapMetric(metric) {
  if (heatmapMetricOptions.some((item) => item.key === metric)) {
    activeHeatmapMetric.value = metric;
  }
}

function setPulseTab(tab) {
  activePulseTab.value = tab;
}
</script>

<template>
  <section class="page-shell industry-pulse-page">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="hasData"
      empty-message="產業動向資料尚未整理完成。"
    />

    <template v-if="hasData">
      <section class="page-hero compact radar-page-hero industry-pulse-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Industry Pulse</span>
          <h1><span>產業即時動向 /</span><span> 瞬間波動</span></h1>
          <p class="page-subtitle">
            先看今天資金集中在哪些產業，再看哪些股票突然放量或波動加大，幫你把隔日優先觀察方向先排出來。
          </p>
          <div class="hero-summary-grid industry-pulse-summary-grid">
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

        <aside class="radar-hero-board industry-pulse-hero-board">
          <article class="theme-spotlight-card is-info">
            <span class="theme-spotlight-label">資料基準</span>
            <strong>{{ formatDate(marketDate ?? manifest?.generatedAt?.slice(0, 10)) }}</strong>
            <p>成交、技術面與題材交集每日重整，適合盤後先抓隔日可能轉強的方向。</p>
            <DataFreshnessBadge
              :generated-at="dashboard?.generatedAt ?? manifest?.generatedAt"
              :market-date="marketDate"
              size="compact"
            />
          </article>
        </aside>
      </section>

      <section class="panel industry-heatmap-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">市場產業熱力圖</h2>
            <p class="panel-subtitle">用平均漲跌、上漲家數占比與成交值權重，把今天資金最集中的產業放大呈現。</p>
          </div>
          <span class="meta-chip">{{ formatNumber(heatmapTiles.length, 0) }} 個產業</span>
        </div>

        <div class="industry-heatmap-toolbar" aria-label="熱力圖指標切換">
          <div class="industry-heatmap-segment" role="tablist" aria-label="熱力圖指標">
            <button
              v-for="option in heatmapMetricOptions"
              :key="option.key"
              type="button"
              :class="{ 'is-active': activeHeatmapMetric === option.key }"
              :aria-selected="activeHeatmapMetric === option.key"
              @click="setHeatmapMetric(option.key)"
            >
              <strong>{{ option.label }}</strong>
              <span>{{ option.hint }}</span>
            </button>
          </div>
          <p>
            面積固定代表成交值；顏色會依目前指標切換。漲跌幅使用台股慣例：紅色代表上漲，綠色代表下跌。
          </p>
        </div>

        <div class="industry-heatmap-summary">
          <article
            v-for="card in heatmapSummaryCards"
            :key="card.label"
            class="industry-heatmap-summary-card"
            :class="`is-${card.tone}`"
          >
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <p>{{ card.note }}</p>
          </article>
        </div>

        <IndustryTreemapChart :industries="heatmapTiles" />
      </section>

      <section class="panel market-tabs-panel industry-pulse-main-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">盤後動向切換</h2>
            <p class="panel-subtitle">先看資金集中到哪個產業，再切到瞬間波動股檢查個股異動。</p>
          </div>
        </div>
        <div class="radar-tabbar market-section-tabbar" role="tablist" aria-label="產業即時動向切換">
          <button
            type="button"
            class="radar-tab-button"
            :class="{ 'is-active': activePulseTab === 'industries' }"
            :aria-selected="activePulseTab === 'industries'"
            @click="setPulseTab('industries')"
          >
            <span>產業升溫排行</span>
            <small>{{ formatNumber(pulse.topIndustries.length, 0) }} 個</small>
          </button>
          <button
            type="button"
            class="radar-tab-button"
            :class="{ 'is-active': activePulseTab === 'moves' }"
            :aria-selected="activePulseTab === 'moves'"
            @click="setPulseTab('moves')"
          >
            <span>瞬間波動股</span>
            <small>{{ formatNumber(pulse.suddenMoves.length, 0) }} 檔</small>
          </button>
        </div>

        <article v-if="activePulseTab === 'industries'" class="market-tab-content">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">產業升溫排行</h2>
              <p class="panel-subtitle">用平均漲幅、成交值、題材曝光與雙法人 / ETF 交集，先抓出今天最強的產業方向。</p>
            </div>
            <span class="meta-chip">{{ formatNumber(pulse.topIndustries.length, 0) }} 個</span>
          </div>

          <div class="industry-pulse-card-grid">
            <article
              v-for="industry in pulse.topIndustries.slice(0, 10)"
              :key="industry.industryName"
              class="sub-panel industry-pulse-card"
            >
              <div class="market-quote-head">
                <div>
                  <strong>{{ industry.industryName }}</strong>
                  <p class="muted">{{ industry.stockCount }} 檔｜上漲 {{ industry.advancingCount }} / 下跌 {{ industry.decliningCount }}</p>
                </div>
                <span class="status-badge" :class="`is-${industry.tone}`">強度 {{ formatNumber(industry.heatScore, 0) }}</span>
              </div>

              <div class="market-quote-metrics">
                <div>
                  <span>平均漲幅</span>
                  <strong :class="getToneClass(industry.avgChangePercent)">{{ formatPercent(industry.avgChangePercent) }}</strong>
                </div>
                <div>
                  <span>20 日</span>
                  <strong :class="getToneClass(industry.avgReturn20)">{{ formatPercent(industry.avgReturn20) }}</strong>
                </div>
                <div>
                  <span>成交值</span>
                  <strong>{{ formatAmount(industry.totalTradeValue) }}</strong>
                </div>
              </div>

              <div class="industry-pulse-pill-row">
                <span class="meta-chip is-up">雙法人 {{ industry.dualBuyCount }}</span>
                <span class="meta-chip is-normal">ETF {{ industry.activeEtfCount }}</span>
                <span class="meta-chip is-info">雙增 {{ industry.dualGrowthCount }}</span>
              </div>

              <div class="focus-card-list compact industry-pulse-leader-list">
                <RouterLink
                  v-for="stock in industry.leaders.slice(0, 2)"
                  :key="`${industry.industryName}-${stock.code}`"
                  :to="createStockRoute(stock.code)"
                  class="focus-card-item is-clickable"
                >
                  <div>
                    <strong>{{ stock.code }} {{ stock.name }}</strong>
                    <p class="muted">{{ stock.topSignalTitle || stock.topSelectionSignalTitle || '先看量價與籌碼是否延續。' }}</p>
                  </div>
                  <span :class="getToneClass(stock.changePercent)">{{ formatPercent(stock.changePercent) }}</span>
                </RouterLink>
                <div class="industry-pulse-card-foot">
                  <span>產業共 {{ formatNumber(industry.stockCount, 0) }} 檔</span>
                  <strong>先列成交值前 {{ formatNumber(Math.min(industry.leaders.length, 2), 0) }} 檔</strong>
                </div>
              </div>
            </article>
          </div>
        </article>

        <article v-else class="market-tab-content">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">瞬間波動股</h2>
              <p class="panel-subtitle">把今天突然放量、波動加大的股票先列出來，方便你快速做隔日觀察。</p>
            </div>
            <span class="meta-chip">{{ formatNumber(pulse.suddenMoves.length, 0) }} 檔</span>
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>產業</th>
                  <th>單日</th>
                  <th>20 日</th>
                  <th>成交值</th>
                  <th>訊號</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="stock in pulse.suddenMoves"
                  :key="`pulse-surge-${stock.code}`"
                >
                  <td>
                    <RouterLink class="code-link" :to="createStockRoute(stock.code)">{{ stock.code }}</RouterLink>
                    <div class="muted">{{ stock.name }}</div>
                  </td>
                  <td>{{ stock.industryName || '-' }}</td>
                  <td :class="getToneClass(stock.changePercent)">{{ formatPercent(stock.changePercent) }}</td>
                  <td :class="getToneClass(stock.return20)">{{ formatPercent(stock.return20) }}</td>
                  <td>{{ formatAmount(stock.tradeValue) }}</td>
                  <td class="muted">{{ stock.topSignalTitle || stock.topSelectionSignalTitle || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </template>
  </section>
</template>
