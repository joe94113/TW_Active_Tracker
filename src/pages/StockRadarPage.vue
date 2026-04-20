<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { formatAmount, formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';
import { buildStockRadar } from '../lib/stockRadar';
import { buildReplayOverview } from '../lib/stockReplay';
import { getThemeToneLabel } from '../lib/themeRadar';

const { manifest, dashboard, stockList, stockSearchList, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const replayHistory = ref(null);
const isReplayLoading = ref(false);
const replayError = ref('');

const themeRadar = computed(() => dashboard.value?.題材雷達 ?? null);
const radar = computed(() =>
  buildStockRadar({
    stockSummaries: stockList.value,
    stockSearchList: stockSearchList.value,
    themeRadar: themeRadar.value,
  }),
);
const replayOverview = computed(() => buildReplayOverview(replayHistory.value));
const replaySnapshots = computed(() => replayOverview.value.snapshots.slice(0, 8));

const spotlightCards = computed(() => [
  {
    key: 'breakout',
    label: '技術突破',
    value: formatNumber(radar.value.spotlight.breakoutCount, 0),
    note: '先抓技術面剛轉強、量價同步偏多的股票。',
  },
  {
    key: 'institutional',
    label: '籌碼偏多',
    value: formatNumber(radar.value.spotlight.institutionalCount, 0),
    note: '外資、投信或主動式 ETF 一起加分的名單。',
  },
  {
    key: 'squeeze',
    label: '整理待發',
    value: formatNumber(radar.value.spotlight.squeezeCount, 0),
    note: '量縮整理、斜率翻正，適合盯放量突破。',
  },
  {
    key: 'risk',
    label: '風險排除',
    value: formatNumber(radar.value.spotlight.riskCount, 0),
    note: '注意股、處置股、變更交易先列出來避開。',
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
    description: '偏向雙法人同步，或法人加上主動式 ETF 一起加分的股票。',
    emptyMessage: '今天沒有特別整齊的籌碼偏多名單。',
    items: radar.value.institutionalMomentum,
  },
  {
    key: 'squeeze',
    title: '整理待發',
    description: '近 20 日價格壓縮、短線斜率翻正，適合追蹤是否放量突破。',
    emptyMessage: '今天沒有特別明顯的整理待發名單。',
    items: radar.value.squeezeCandidates,
  },
  {
    key: 'value',
    title: '估值 / 股利支撐',
    description: '把殖利率、估值位階和股價位置一起看，方便找防守型標的。',
    emptyMessage: '今天沒有特別符合估值或股利支撐條件的名單。',
    items: radar.value.valuationSupport,
  },
  {
    key: 'risk',
    title: '風險排除',
    description: '注意股、處置股、變更交易先列出，避免追在最危險的地方。',
    emptyMessage: '今天沒有額外需要排除的名單。',
    items: radar.value.riskAlerts,
  },
]);

const pageSeo = computed(() => ({
  title: '選股雷達',
  description: '把技術突破、籌碼偏多、整理待發、估值支撐與題材輪動整理成同一頁，並加入每日選股回放，方便檢驗哪套規則最有效。',
  routePath: '/radar',
  keywords: ['選股雷達', '技術突破', '籌碼偏多', '整理待發', '題材輪動', '選股回放'],
}));

useSeoMeta(pageSeo);

void loadGlobalData();

onMounted(async () => {
  await loadReplayHistory();
});

watch(
  () => manifest.value?.stockRadarHistoryPath,
  async () => {
    await loadReplayHistory();
  },
);

async function loadReplayHistory() {
  const historyPath = manifest.value?.stockRadarHistoryPath;

  if (!historyPath) {
    return;
  }

  isReplayLoading.value = true;
  replayError.value = '';

  try {
    replayHistory.value = await fetchJson(historyPath);
  } catch (error) {
    replayHistory.value = null;
    replayError.value = error instanceof Error ? error.message : '選股回放載入失敗';
  } finally {
    isReplayLoading.value = false;
  }
}

function getSectionAnchor(sectionKey) {
  return `radar-${sectionKey}`;
}

function getStockMetrics(sectionKey, item) {
  switch (sectionKey) {
    case 'technical':
      return [
        { label: '20 日', value: formatPercent(item.return20) },
        { label: '單日', value: formatPercent(item.changePercent) },
        { label: '訊號', value: item.topSignalTitle ?? '技術轉強' },
      ];
    case 'institutional':
      return [
        { label: '外資 5 日', value: formatLots(item.foreign5Day) },
        { label: '投信 5 日', value: formatLots(item.investmentTrust5Day) },
        { label: '主動 ETF', value: `${formatNumber(item.activeEtfCount, 0)} 檔` },
      ];
    case 'squeeze':
      return [
        { label: '壓縮區間', value: formatPercent(item.metrics.rangePercent) },
        { label: '斜率', value: formatPercent(item.metrics.shortSlopePercent) },
        { label: '20 日', value: formatPercent(item.return20) },
      ];
    case 'value':
      return [
        { label: '殖利率', value: formatPercent(item.metrics.dividendYield) },
        { label: '本益比', value: formatNumber(item.metrics.peRatio, 2) },
        { label: '股價淨值比', value: formatNumber(item.metrics.pbRatio, 2) },
      ];
    case 'risk':
      return [
        { label: '20 日', value: formatPercent(item.return20) },
        { label: '單日', value: formatPercent(item.changePercent) },
        { label: '狀態', value: item.topSelectionSignalTitle ?? '風險提醒' },
      ];
    default:
      return [];
  }
}

function getStockCardTone(sectionKey, item) {
  if (sectionKey === 'risk') return 'risk';
  if (item.topSignalTone === 'up') return 'up';
  if (item.selectionSignalTone === 'risk') return 'risk';
  return 'info';
}

function getRiskBadge(item) {
  if (item.isUnderDisposition) return '處置股';
  if (item.hasChangedTrading) return '變更交易';
  if (item.hasAttentionWarning) return '注意股';
  return null;
}

function formatReplayPreview(items) {
  return (items ?? [])
    .slice(0, 3)
    .map((item) => `${item.code} ${item.name}`)
    .join('、');
}

function getReplayMetricClass(value) {
  if ((value ?? 0) > 0) return 'text-up';
  if ((value ?? 0) < 0) return 'text-down';
  return '';
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
            把技術突破、籌碼偏多、整理待發、估值支撐與風險排除整理成同一頁，再搭配題材輪動和每日回放，方便你盤後快速縮小選股範圍。
          </p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">資料日期 {{ formatDate(themeRadar?.marketDate) }}</span>
            <span class="theme-observation-chip">主線題材 {{ radar.spotlight.topTheme?.title ?? '等待題材重新聚焦' }}</span>
            <span class="theme-observation-chip">追蹤個股 {{ formatNumber(stockList.length, 0) }} 檔</span>
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
        <a class="section-chip" href="#radar-replay">選股回放</a>
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

                <div v-if="item.tags?.length" class="tag-row">
                  <span v-for="tag in item.tags.slice(0, 3)" :key="`${section.key}-${item.code}-${tag}`" class="keyword-pill">
                    {{ tag }}
                  </span>
                </div>
              </RouterLink>
            </div>

            <div v-else class="empty-state compact">
              <strong>{{ section.title }}今天沒有明顯名單</strong>
              <p>{{ section.emptyMessage }}</p>
            </div>
          </section>

          <section id="radar-replay" class="panel radar-section-panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">選股回放 / 模擬名單</h2>
                <p class="panel-subtitle">每天盤後把穩健型 / 積極型存一份，再回看 3 / 5 / 10 個交易日表現，確認哪套規則更適合目前盤勢。</p>
              </div>
              <span class="meta-chip">近 {{ formatNumber(replayOverview.snapshotCount, 0) }} 日</span>
            </div>

            <div v-if="replayOverview.snapshotCount" class="replay-overview-grid">
              <article v-for="horizon in [3, 5, 10]" :key="`stable-${horizon}`" class="sub-panel replay-summary-card">
                <p class="theme-brief-kicker">🛡 穩健型 {{ horizon }} 日</p>
                <strong :class="getReplayMetricClass(replayOverview.groups.stable[horizon].averageReturn)">
                  {{ formatPercent(replayOverview.groups.stable[horizon].averageReturn) }}
                </strong>
                <p class="muted">
                  勝率 {{ formatPercent(replayOverview.groups.stable[horizon].winRate) }} / 樣本 {{ formatNumber(replayOverview.groups.stable[horizon].sampleCount, 0) }}
                </p>
              </article>
              <article v-for="horizon in [3, 5, 10]" :key="`aggressive-${horizon}`" class="sub-panel replay-summary-card">
                <p class="theme-brief-kicker">🔥 積極型 {{ horizon }} 日</p>
                <strong :class="getReplayMetricClass(replayOverview.groups.aggressive[horizon].averageReturn)">
                  {{ formatPercent(replayOverview.groups.aggressive[horizon].averageReturn) }}
                </strong>
                <p class="muted">
                  勝率 {{ formatPercent(replayOverview.groups.aggressive[horizon].winRate) }} / 樣本 {{ formatNumber(replayOverview.groups.aggressive[horizon].sampleCount, 0) }}
                </p>
              </article>
            </div>

            <div v-if="replaySnapshots.length" class="table-wrap">
              <table class="data-table replay-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>穩健型</th>
                    <th>積極型</th>
                    <th>穩健 5 日</th>
                    <th>積極 5 日</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="snapshot in replaySnapshots" :key="snapshot.marketDate">
                    <td>{{ formatDate(snapshot.marketDate) }}</td>
                    <td>{{ formatReplayPreview(snapshot.stable) || '當日無名單' }}</td>
                    <td>{{ formatReplayPreview(snapshot.aggressive) || '當日無名單' }}</td>
                    <td :class="getReplayMetricClass(snapshot.summary?.stable?.horizons?.[5]?.averageReturn)">
                      {{ formatPercent(snapshot.summary?.stable?.horizons?.[5]?.averageReturn) }}
                    </td>
                    <td :class="getReplayMetricClass(snapshot.summary?.aggressive?.horizons?.[5]?.averageReturn)">
                      {{ formatPercent(snapshot.summary?.aggressive?.horizons?.[5]?.averageReturn) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else-if="!isReplayLoading && !replayError" class="empty-state compact">
              <strong>選股回放還在累積樣本</strong>
              <p>系統會在每天盤後把穩健型 / 積極型名單存下來，之後就能逐步回看 3 / 5 / 10 日表現。</p>
            </div>

            <div v-else-if="replayError" class="empty-state compact">
              <strong>選股回放暫時載入失敗</strong>
              <p>{{ replayError }}</p>
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
              <strong>題材輪動今天沒有明顯聚焦</strong>
              <p>等新聞、熱門股與主動式 ETF 資訊重新聚焦後，這裡會自動整理出龍頭與補漲股。</p>
            </div>
          </section>
        </div>

        <aside class="radar-sidebar">
          <article class="panel radar-sidebar-card radar-sidebar-card-sticky">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">使用節奏</h2>
                <p class="panel-subtitle">先看主線題材，再看技術 / 籌碼，最後用風險排除過濾隔日不適合追的標的。</p>
              </div>
            </div>
            <ol class="theme-playbook-list">
              <li>先看技術突破與籌碼偏多，找出當天最整齊的候選名單。</li>
              <li>再用整理待發確認有沒有量縮待突破、適合提前卡位的個股。</li>
              <li>接著回頭看題材輪動，確認是主線族群的龍頭還是補漲股。</li>
              <li>最後用風險排除過濾注意股、處置股與變更交易。</li>
            </ol>
          </article>

          <article class="panel radar-sidebar-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">資料範圍</h2>
                <p class="panel-subtitle">把站上可研究的個股、題材、風險提醒與每日回放整理在同一頁。</p>
              </div>
            </div>
            <div class="footer-stat-list">
              <div class="footer-stat">
                <span>追蹤個股</span>
                <strong>{{ formatNumber(stockList.length, 0) }} 檔</strong>
              </div>
              <div class="footer-stat">
                <span>搜尋池</span>
                <strong>{{ formatNumber(stockSearchList.length, 0) }} 檔</strong>
              </div>
              <div class="footer-stat">
                <span>資料日期</span>
                <strong>{{ formatDate(themeRadar?.marketDate) }}</strong>
              </div>
            </div>
            <p class="footer-note">
              選股回放會每天盤後更新一次，樣本越多，就越能看出哪種盤勢更適合穩健型或積極型規則。
            </p>
          </article>
        </aside>
      </section>
    </template>
  </section>
</template>
