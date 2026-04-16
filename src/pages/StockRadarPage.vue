<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import StatusCard from '../components/StatusCard.vue';
import { formatAmount, formatDate, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';
import { buildStockRadar } from '../lib/stockRadar';
import { getThemeToneLabel } from '../lib/themeRadar';

const { dashboard, stockList, stockSearchList, isLoading, errorMessage, loadGlobalData } = useGlobalData();

onMounted(() => {
  loadGlobalData();
});

const themeRadar = computed(() => dashboard.value?.題材雷達 ?? null);
const radar = computed(() =>
  buildStockRadar({
    stockSummaries: stockList.value,
    stockSearchList: stockSearchList.value,
    themeRadar: themeRadar.value,
  }),
);

const spotlightCards = computed(() => [
  {
    key: 'breakout',
    label: '技術突破',
    value: formatNumber(radar.value.spotlight.breakoutCount, 0),
    note: '先看技術與價格結構剛轉強的股票。',
  },
  {
    key: 'institutional',
    label: '籌碼偏多',
    value: formatNumber(radar.value.spotlight.institutionalCount, 0),
    note: '外資、投信和主動式 ETF 同步加分。',
  },
  {
    key: 'squeeze',
    label: '整理待發',
    value: formatNumber(radar.value.spotlight.squeezeCount, 0),
    note: '量價壓縮後開始抬頭，適合盯突破。',
  },
  {
    key: 'risk',
    label: '風險排除',
    value: formatNumber(radar.value.spotlight.riskCount, 0),
    note: '先把處置、注意或變更交易的標的排除。',
  },
]);

const stockSections = computed(() => [
  {
    key: 'technical',
    title: '技術突破',
    description: '先抓技術面轉強、價差與訊號同步偏多的股票。',
    emptyMessage: '今天沒有特別明顯的技術突破名單。',
    items: radar.value.technicalBreakouts,
  },
  {
    key: 'institutional',
    title: '籌碼偏多',
    description: '偏向雙法人同步、或法人加上主動式 ETF 一起加分的股票。',
    emptyMessage: '今天沒有特別整齊的籌碼偏多名單。',
    items: radar.value.institutionalMomentum,
  },
  {
    key: 'squeeze',
    title: '整理待發',
    description: '近 20 日價格壓縮、短線斜率翻正，適合追蹤是否放量突破。',
    emptyMessage: '今天沒有夠乾淨的整理待發名單。',
    items: radar.value.squeezeCandidates,
  },
  {
    key: 'value',
    title: '估值 / 股利支撐',
    description: '用殖利率、本益比與股價淨值比篩出偏防守型選擇。',
    emptyMessage: '今天沒有明顯兼具估值或股利支撐的名單。',
    items: radar.value.valuationSupport,
  },
  {
    key: 'risk',
    title: '風險排除',
    description: '這些股票短線要先避開，或至少降低追價意願。',
    emptyMessage: '目前沒有官方提醒特別集中的風險股。',
    items: radar.value.riskAlerts,
  },
]);

const pageSeo = computed(() => ({
  title: '選股雷達',
  description: '把技術突破、籌碼偏多、整理待發、題材輪動與風險排除整理成同一頁的台股選股工作台。',
  routePath: '/radar',
  keywords: ['選股雷達', '技術突破', '籌碼偏多', '整理待發', '題材輪動', '風險排除'],
}));

useSeoMeta(pageSeo);

function getSectionAnchor(sectionKey) {
  return `radar-${sectionKey}`;
}

function getStockMetrics(sectionKey, item) {
  switch (sectionKey) {
    case 'technical':
      return [
        { label: '20日', value: formatPercent(item.return20) },
        { label: '單日', value: formatPercent(item.changePercent) },
        { label: '訊號', value: item.topSignalTitle ?? '技術轉強' },
      ];
    case 'institutional':
      return [
        { label: '外資5日', value: formatAmount(item.foreign5Day) },
        { label: '投信5日', value: formatAmount(item.investmentTrust5Day) },
        { label: 'ETF', value: `${formatNumber(item.activeEtfCount, 0)} 檔` },
      ];
    case 'squeeze':
      return [
        { label: '壓縮幅度', value: formatPercent(item.metrics.rangePercent) },
        { label: '短斜率', value: formatPercent(item.metrics.shortSlopePercent) },
        { label: '20日', value: formatPercent(item.return20) },
      ];
    case 'value':
      return [
        { label: '殖利率', value: formatPercent(item.metrics.dividendYield) },
        { label: '本益比', value: formatNumber(item.metrics.peRatio, 2) },
        { label: '股價淨值比', value: formatNumber(item.metrics.pbRatio, 2) },
      ];
    case 'risk':
      return [
        { label: '20日', value: formatPercent(item.return20) },
        { label: '單日', value: formatPercent(item.changePercent) },
        { label: '提醒', value: item.topSelectionSignalTitle ?? '官方提醒' },
      ];
    default:
      return [];
  }
}

function getStockCardTone(sectionKey, item) {
  if (sectionKey === 'risk') {
    return 'risk';
  }

  return item.topSignalTone === 'up' ? 'up' : item.selectionSignalTone === 'risk' ? 'risk' : 'info';
}

function getRiskBadge(item) {
  if (item.isUnderDisposition) {
    return '處置股';
  }

  if (item.hasChangedTrading) {
    return '變更交易';
  }

  if (item.hasAttentionWarning) {
    return '注意股';
  }

  return null;
}
</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(stockList.length)"
      empty-message="選股雷達資料尚未整理完成。"
    />

    <template v-if="stockList.length">
      <section class="page-hero compact radar-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Selection Radar</span>
          <h1>選股雷達</h1>
          <p>
            先看技術突破與籌碼偏多，再往整理待發與題材輪動找下一棒，最後用風險排除把不該追的股票先剔掉。
          </p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">資料日期 {{ formatDate(themeRadar?.marketDate) }}</span>
            <span class="theme-observation-chip">題材熱區 {{ radar.spotlight.topTheme?.title ?? '等待下一波輪動' }}</span>
            <span class="theme-observation-chip">已整理個股 {{ formatNumber(stockList.length, 0) }} 檔</span>
          </div>
        </div>

        <aside class="radar-hero-board">
          <div class="radar-spotlight-grid">
            <article v-for="card in spotlightCards" :key="card.key" class="radar-spotlight-card">
              <span class="theme-spotlight-label">{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.note }}</p>
            </article>
          </div>
        </aside>
      </section>

      <nav class="mobile-section-nav radar-section-nav" aria-label="選股雷達快速導覽">
        <a
          v-for="section in stockSections"
          :key="section.key"
          class="section-chip"
          :href="`#${getSectionAnchor(section.key)}`"
        >
          {{ section.title }}
        </a>
        <a class="section-chip" href="#radar-themes">題材輪動</a>
      </nav>

      <section class="radar-page-layout">
        <div class="radar-main-column">
          <section
            v-for="section in stockSections"
            :id="getSectionAnchor(section.key)"
            :key="section.key"
            class="panel radar-section-panel"
          >
            <div class="panel-header">
              <div>
                <h2 class="panel-title">{{ section.title }}</h2>
                <p class="panel-subtitle">{{ section.description }}</p>
              </div>
            </div>

            <div v-if="section.items.length" class="radar-stock-grid">
              <RouterLink
                v-for="item in section.items"
                :key="`${section.key}-${item.code}`"
                class="radar-stock-card"
                :class="`is-${getStockCardTone(section.key, item)}`"
                :to="createStockRoute(item.code)"
              >
                <div class="radar-stock-head">
                  <div>
                    <strong>{{ item.code }} {{ item.name }}</strong>
                    <p class="muted">{{ item.industryName || '台股個股' }}</p>
                  </div>
                  <div class="radar-stock-side">
                    <span v-if="getRiskBadge(item)" class="status-badge is-risk">{{ getRiskBadge(item) }}</span>
                    <span v-else class="meta-chip">{{ formatNumber(item.score, 0) }} 分</span>
                  </div>
                </div>

                <p class="radar-stock-note">{{ item.note }}</p>

                <div class="radar-stock-metrics">
                  <div v-for="metric in getStockMetrics(section.key, item)" :key="`${section.key}-${item.code}-${metric.label}`">
                    <span>{{ metric.label }}</span>
                    <strong>{{ metric.value }}</strong>
                  </div>
                </div>

                <div v-if="item.tags.length" class="tag-row">
                  <span v-for="tag in item.tags.slice(0, 3)" :key="`${section.key}-${item.code}-${tag}`" class="keyword-pill">
                    {{ tag }}
                  </span>
                </div>
              </RouterLink>
            </div>

            <div v-else class="empty-state compact">
              <strong>{{ section.title }}目前沒有特別突出的清單</strong>
              <p>{{ section.emptyMessage }}</p>
            </div>
          </section>

          <section id="radar-themes" class="panel radar-section-panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">題材輪動</h2>
                <p class="panel-subtitle">把目前最熱的題材拆成龍頭股與補漲股，方便從族群內挑標的。</p>
              </div>
            </div>

            <div v-if="radar.themeRotation.length" class="radar-theme-grid">
              <article v-for="topic in radar.themeRotation" :key="topic.slug" class="sub-panel radar-theme-card">
                <div class="theme-card-head">
                  <div>
                    <p class="theme-brief-kicker">題材輪動</p>
                    <h3>{{ topic.title }}</h3>
                  </div>
                  <div class="theme-card-badges">
                    <span class="status-badge" :class="`is-${topic.tone}`">{{ getThemeToneLabel(topic.tone) }}</span>
                    <span class="meta-chip">{{ formatNumber(topic.score) }} 分</span>
                  </div>
                </div>

                <p class="theme-brief-summary">{{ topic.observation }}</p>

                <div class="radar-theme-columns">
                  <div class="radar-theme-block">
                    <h4>龍頭股</h4>
                    <div class="theme-stock-list">
                      <RouterLink
                        v-for="stock in topic.leaders"
                        :key="`${topic.slug}-leader-${stock.code}`"
                        class="theme-stock-item"
                        :to="createStockRoute(stock.code)"
                      >
                        <div class="theme-stock-main">
                          <strong>{{ stock.code }} {{ stock.name }}</strong>
                          <div class="theme-stock-drivers">
                            <span v-for="driver in (stock.drivers ?? []).slice(0, 2)" :key="`${topic.slug}-leader-driver-${stock.code}-${driver}`">
                              {{ driver }}
                            </span>
                          </div>
                        </div>
                        <div class="theme-stock-meta">
                          <span>{{ formatPercent(stock.return20) }}</span>
                          <span>{{ formatPercent(stock.changePercent) }}</span>
                        </div>
                      </RouterLink>
                    </div>
                  </div>

                  <div class="radar-theme-block">
                    <h4>補漲股</h4>
                    <div class="theme-stock-list">
                      <RouterLink
                        v-for="stock in topic.catchUps"
                        :key="`${topic.slug}-catchup-${stock.code}`"
                        class="theme-stock-item"
                        :to="createStockRoute(stock.code)"
                      >
                        <div class="theme-stock-main">
                          <strong>{{ stock.code }} {{ stock.name }}</strong>
                          <div class="theme-stock-drivers">
                            <span v-for="driver in (stock.drivers ?? []).slice(0, 2)" :key="`${topic.slug}-catchup-driver-${stock.code}-${driver}`">
                              {{ driver }}
                            </span>
                          </div>
                        </div>
                        <div class="theme-stock-meta">
                          <span>{{ formatPercent(stock.return20) }}</span>
                          <span>{{ formatPercent(stock.changePercent) }}</span>
                        </div>
                      </RouterLink>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <div v-else class="empty-state compact">
              <strong>題材輪動暫時沒有明顯主軸</strong>
              <p>等新聞熱度、籌碼與 ETF 曝光更集中時，這裡會自動補上。</p>
            </div>
          </section>
        </div>

        <aside class="radar-sidebar">
          <article class="panel radar-sidebar-card radar-sidebar-card-sticky">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">使用節奏</h2>
                <p class="panel-subtitle">先縮小清單，再回到個股頁做技術、籌碼與新聞確認。</p>
              </div>
            </div>
            <ol class="theme-playbook-list">
              <li>先從技術突破與籌碼偏多的交集開始挑。</li>
              <li>再看整理待發名單，提前布局可能的下一波突破。</li>
              <li>如果題材正在轉強，優先看龍頭股，再找補漲股。</li>
              <li>最後用風險排除，把處置、注意與變更交易先濾掉。</li>
            </ol>
          </article>

          <article class="panel radar-sidebar-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">資料範圍</h2>
                <p class="panel-subtitle">這頁主要是用已整理個股池快速掃描，不取代個股頁的完整研究。</p>
              </div>
            </div>
            <div class="footer-stat-list">
              <div class="footer-stat">
                <span>整理個股</span>
                <strong>{{ formatNumber(stockList.length, 0) }} 檔</strong>
              </div>
              <div class="footer-stat">
                <span>搜尋全市場</span>
                <strong>{{ formatNumber(stockSearchList.length, 0) }} 檔</strong>
              </div>
              <div class="footer-stat">
                <span>題材日期</span>
                <strong>{{ formatDate(themeRadar?.marketDate) }}</strong>
              </div>
            </div>
            <p class="footer-note">
              題材輪動與風險提醒每天跟著資料包更新；個股細節仍建議進一步打開個股頁確認。
            </p>
          </article>
        </aside>
      </section>
    </template>
  </section>
</template>
