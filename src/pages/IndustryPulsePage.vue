<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import DataFreshnessBadge from '../components/DataFreshnessBadge.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { buildIndustryPulse } from '../lib/industryPulse';
import { formatAmount, formatDate, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';

const { dashboard, stockSearchList, manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();

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
          <h1>產業即時動向 / 瞬間波動</h1>
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

      <section class="dual-grid industry-pulse-main-grid">
        <article class="panel">
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

              <div class="focus-card-list compact">
                <RouterLink
                  v-for="stock in industry.leaders"
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
              </div>
            </article>
          </div>
        </article>

        <article class="panel">
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
