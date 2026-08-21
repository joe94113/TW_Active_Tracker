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
const activeRadarTab = ref('technical');
const activeReplayDetail = ref({ groupKey: 'stable', horizon: 5 });

const themeRadar = computed(() => dashboard.value?.題材雷達 ?? null);
const radarSourceList = computed(() => (stockList.value.length ? stockList.value : stockSearchList.value));
const hasRadarData = computed(() => Boolean(radarSourceList.value.length));

const radar = computed(() =>
  buildStockRadar({
    stockSummaries: radarSourceList.value,
    stockSearchList: stockSearchList.value,
    themeRadar: themeRadar.value,
  }),
);
const replayOverview = computed(() => buildReplayOverview(replayHistory.value));
const replaySnapshots = computed(() => replayOverview.value.snapshots.slice(0, 8));
const replayDetailRows = computed(() => {
  const { groupKey, horizon } = activeReplayDetail.value;

  return (replayOverview.value.allSnapshots ?? replayOverview.value.snapshots)
    .flatMap((snapshot) =>
      (snapshot?.[groupKey] ?? [])
        .map((item) => ({
          ...item,
          marketDate: snapshot.marketDate,
          result: item?.horizons?.[horizon] ?? null,
        }))
        .filter((item) => Number.isFinite(Number(item.result?.returnPercent))),
    )
    .sort((left, right) => {
      const dateCompare = String(right.marketDate).localeCompare(String(left.marketDate));
      if (dateCompare !== 0) return dateCompare;
      return Number(right.result?.returnPercent ?? 0) - Number(left.result?.returnPercent ?? 0);
    });
});
const replayDetailLabel = computed(() => `${getReplayGroupLabel(activeReplayDetail.value.groupKey)} ${activeReplayDetail.value.horizon} 日樣本`);

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

const heroSummaryItems = computed(() => [
  {
    label: '資料日期',
    value: formatDate(themeRadar.value?.marketDate) ?? '等待更新',
    note: '盤後整包資料整理完成後，選股條件與回放會一起刷新。',
  },
  {
    label: '主線題材',
    value: radar.value.spotlight.topTheme?.title ?? '等待題材聚焦',
    note: radar.value.spotlight.topTheme?.observation ?? '先看題材、法人與量價有沒有站到同一邊。',
  },
  {
    label: '追蹤個股',
    value: `${formatNumber(radarSourceList.value.length, 0)} 檔`,
    note: '從全股票池裡先找出可交易、訊號乾淨、風險相對可控的名單。',
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
const activeStockSection = computed(
  () => stockSections.value.find((section) => section.key === activeRadarTab.value) ?? stockSections.value[0] ?? null,
);

const radarDecisionCards = computed(() =>
  stockSections.value
    .filter((section) => ['technical', 'institutional', 'squeeze', 'risk'].includes(section.key))
    .map((section) => {
      const firstStock = section.items[0] ?? null;
      const primaryMetric =
        section.key === 'institutional'
          ? `法人 ${formatLots(firstStock?.total5Day ?? firstStock?.foreign5Day)}`
          : section.key === 'risk'
            ? (firstStock ? getRiskBadge(firstStock) ?? '風險提醒' : '暫無風險')
            : formatPercent(firstStock?.return20);

      return {
        key: section.key,
        label: section.title,
        count: `${formatNumber(section.items.length, 0)} 檔`,
        title: firstStock ? `${firstStock.code} ${firstStock.name}` : section.emptyMessage,
        metric: firstStock ? primaryMetric : '暫無名單',
        note: firstStock?.note ?? section.description,
        tone: section.key === 'risk' ? 'risk' : getStockCardTone(section.key, firstStock ?? {}),
        route: firstStock ? createStockRoute(firstStock.code) : null,
        anchor: `#${getSectionAnchor(section.key)}`,
      };
    }),
);

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

function setActiveRadarTab(sectionKey) {
  activeRadarTab.value = sectionKey;
}

function setReplayDetail(groupKey, horizon) {
  activeReplayDetail.value = { groupKey, horizon };
}

function scrollToRadarPanel(panelId) {
  document.getElementById(panelId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
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

function getHealthTone(item) {
  if ((item?.healthScore ?? 0) >= 75) return 'up';
  if ((item?.healthScore ?? 0) <= 45) return 'down';
  return 'normal';
}

function getWarningTone(item) {
  if (item?.topWarningTone === 'risk') return 'risk';
  if (item?.topWarningTone === 'warning') return 'warning';
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

function getReplayGroupLabel(groupKey) {
  return groupKey === 'stable' ? '穩健型' : '積極型';
}

function isReplayDetailActive(groupKey, horizon) {
  return activeReplayDetail.value.groupKey === groupKey && activeReplayDetail.value.horizon === horizon;
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
      :has-data="hasRadarData"
      empty-message="選股雷達資料尚未整理完成。"
    />

    <template v-if="hasRadarData">
      <section class="page-hero compact radar-page-hero rounded-[2rem] border border-slate-200/70 bg-white/90 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.10)] ring-1 ring-white/80 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-950/78 dark:ring-slate-800/70">
        <div class="hero-copy space-y-5">
          <span class="hero-kicker">今日精選</span>
          <h1>選股雷達</h1>
          <p class="max-w-3xl text-balance leading-7 text-slate-600 dark:text-slate-300">
            把技術突破、籌碼偏多、整理待發、估值支撐與風險排除整理成同一頁，再搭配題材輪動和每日回放，方便你盤後快速縮小選股範圍。
          </p>
          <div class="hero-summary-grid">
            <article
              v-for="item in heroSummaryItems"
              :key="item.label"
              class="hero-summary-card rounded-[1.35rem] border border-slate-200/70 bg-white/85 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-white/70 dark:border-slate-700/60 dark:bg-slate-900/75 dark:ring-slate-800/70"
            >
              <span class="hero-summary-label">{{ item.label }}</span>
              <strong class="hero-summary-value">{{ item.value }}</strong>
              <p class="hero-summary-note">{{ item.note }}</p>
            </article>
          </div>
        </div>

        <aside class="radar-hero-board rounded-[1.6rem] border border-slate-200/70 bg-slate-50/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-white/70 dark:border-slate-700/60 dark:bg-slate-900/72 dark:ring-slate-800/70">
          <div class="radar-spotlight-grid">
            <article
              v-for="card in spotlightCards"
              :key="card.key"
              class="radar-spotlight-card rounded-[1.35rem] border border-slate-200/70 bg-white/85 shadow-[0_16px_36px_rgba(15,23,42,0.08)] ring-1 ring-white/70 dark:border-slate-700/60 dark:bg-slate-950/78 dark:ring-slate-800/70"
            >
              <span class="theme-spotlight-label">{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.note }}</p>
            </article>
          </div>
        </aside>
      </section>

      <section class="radar-decision-strip" aria-label="選股雷達決策摘要">
        <component
          :is="card.route ? RouterLink : 'a'"
          v-for="card in radarDecisionCards"
          :key="card.key"
          class="decision-card"
          :class="`is-${card.tone}`"
          :to="card.route ?? undefined"
          :href="card.route ? undefined : card.anchor"
        >
          <div class="decision-card-head">
            <span>{{ card.label }}</span>
            <small>{{ card.count }}</small>
          </div>
          <strong>{{ card.title }}</strong>
          <p class="decision-card-metric">{{ card.metric }}</p>
          <p>{{ card.note }}</p>
        </component>
      </section>

      <section class="panel radar-tab-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">選股類別切換</h2>
            <p class="panel-subtitle">先切到你今天想找的型態，再往下看明細，閱讀會比整頁往下翻輕鬆很多。</p>
          </div>
        </div>
        <div class="radar-tabbar" role="tablist" aria-label="選股雷達類別">
          <button
            v-for="section in stockSections"
            :key="section.key"
            type="button"
            class="radar-tab-button"
            :class="{ 'is-active': activeRadarTab === section.key }"
            :aria-selected="activeRadarTab === section.key"
            @click="setActiveRadarTab(section.key)"
          >
            <span>{{ section.title }}</span>
            <small>{{ formatNumber(section.items.length, 0) }} 檔</small>
          </button>
          <button type="button" class="section-chip" @click="scrollToRadarPanel('radar-replay')">歷史表現</button>
          <button type="button" class="section-chip" @click="scrollToRadarPanel('radar-themes')">題材輪動</button>
        </div>
      </section>

      <section class="radar-page-layout">
        <div class="radar-main-column">
          <section
            v-if="activeStockSection"
            :id="getSectionAnchor(activeStockSection.key)"
            class="panel radar-section-panel"
          >
            <div class="panel-header">
              <div>
                <h2 class="panel-title">{{ activeStockSection.title }}</h2>
                <p class="panel-subtitle">{{ activeStockSection.description }}</p>
              </div>
              <span class="meta-chip">{{ formatNumber(activeStockSection.items.length, 0) }} 檔</span>
            </div>

            <div v-if="activeStockSection.items.length" class="radar-stock-grid">
              <RouterLink
                v-for="item in activeStockSection.items"
                :key="`${activeStockSection.key}-${item.code}`"
                class="radar-stock-card"
                :class="`is-${getStockCardTone(activeStockSection.key, item)}`"
                :to="createStockRoute(item.code)"
              >
                <div class="radar-stock-head">
                  <div>
                    <strong>{{ item.code }} {{ item.name }}</strong>
                    <p class="muted">{{ item.industryName || '台股個股' }}</p>
                  </div>
                  <div class="radar-stock-side">
                    <div v-if="item.close !== null && item.close !== undefined" class="radar-stock-market">
                      <strong>{{ formatNumber(item.close) }}</strong>
                      <span :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                        {{ formatPercent(item.changePercent) }}
                      </span>
                    </div>
                    <span v-if="getRiskBadge(item)" class="status-badge is-risk">{{ getRiskBadge(item) }}</span>
                    <div v-else class="radar-stock-chip-stack">
                      <span class="meta-chip">{{ formatNumber(item.score, 0) }} 分</span>
                      <span v-if="item.healthScore" class="meta-chip" :class="`is-${getHealthTone(item)}`">體檢 {{ item.healthScore }}</span>
                    </div>
                  </div>
                </div>

                <p class="radar-stock-note">{{ item.note }}</p>

                <div v-if="item.topWarningTitle" class="entry-warning-chip-row">
                  <span class="status-badge" :class="`is-${getWarningTone(item)}`">{{ item.topWarningTitle }}</span>
                  <span class="muted">看到這個標記就先確認是不是已經追太快。</span>
                </div>

                <div class="radar-stock-metrics">
                  <div v-for="metric in getStockMetrics(activeStockSection.key, item)" :key="`${activeStockSection.key}-${item.code}-${metric.label}`">
                    <span>{{ metric.label }}</span>
                    <strong>{{ metric.value }}</strong>
                  </div>
                  <div>
                    <span>體檢等級</span>
                    <strong>{{ item.healthGrade ?? '-' }}</strong>
                  </div>
                </div>

                <div v-if="item.tags?.length" class="tag-row">
                  <span v-for="tag in item.tags.slice(0, 3)" :key="`${activeStockSection.key}-${item.code}-${tag}`" class="keyword-pill">
                    {{ tag }}
                  </span>
                </div>
              </RouterLink>
            </div>

            <div v-else class="empty-state compact">
              <strong>{{ activeStockSection.title }}今天沒有明顯名單</strong>
              <p>{{ activeStockSection.emptyMessage }}</p>
            </div>
          </section>

          <section id="radar-replay" class="panel radar-section-panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">歷史表現</h2>
                <p class="panel-subtitle">每天盤後把穩健型 / 積極型存一份，再回看 3 / 5 / 10 個交易日表現，確認哪套規則更適合目前盤勢。</p>
              </div>
              <span class="meta-chip">近 {{ formatNumber(replayOverview.snapshotCount, 0) }} 日</span>
            </div>

            <div v-if="replayOverview.snapshotCount" class="replay-overview-grid">
              <button
                v-for="horizon in [3, 5, 10]"
                :key="`stable-${horizon}`"
                type="button"
                class="sub-panel replay-summary-card replay-summary-button"
                :class="{ 'is-active': isReplayDetailActive('stable', horizon) }"
                @click="setReplayDetail('stable', horizon)"
              >
                <p class="theme-brief-kicker">穩健型 {{ horizon }} 日</p>
                <strong :class="getReplayMetricClass(replayOverview.groups.stable[horizon].averageReturn)">
                  {{ formatPercent(replayOverview.groups.stable[horizon].averageReturn) }}
                </strong>
                <p class="muted">
                  勝率 {{ formatPercent(replayOverview.groups.stable[horizon].winRate) }} / 樣本 {{ formatNumber(replayOverview.groups.stable[horizon].sampleCount, 0) }}
                </p>
                <span class="replay-card-cta">查看樣本</span>
              </button>
              <button
                v-for="horizon in [3, 5, 10]"
                :key="`aggressive-${horizon}`"
                type="button"
                class="sub-panel replay-summary-card replay-summary-button"
                :class="{ 'is-active': isReplayDetailActive('aggressive', horizon) }"
                @click="setReplayDetail('aggressive', horizon)"
              >
                <p class="theme-brief-kicker">積極型 {{ horizon }} 日</p>
                <strong :class="getReplayMetricClass(replayOverview.groups.aggressive[horizon].averageReturn)">
                  {{ formatPercent(replayOverview.groups.aggressive[horizon].averageReturn) }}
                </strong>
                <p class="muted">
                  勝率 {{ formatPercent(replayOverview.groups.aggressive[horizon].winRate) }} / 樣本 {{ formatNumber(replayOverview.groups.aggressive[horizon].sampleCount, 0) }}
                </p>
                <span class="replay-card-cta">查看樣本</span>
              </button>
            </div>

            <section v-if="replayOverview.snapshotCount" class="sub-panel replay-detail-panel">
              <div class="inline-panel-header">
                <div>
                  <p class="theme-brief-kicker">{{ getReplayGroupLabel(activeReplayDetail.groupKey) }}明細</p>
                  <h3>{{ replayDetailLabel }}</h3>
                  <p class="muted">依進場日期由近到遠排列，方便檢查每一筆樣本是否真的符合你的交易直覺。</p>
                </div>
                <span class="meta-chip">{{ formatNumber(replayDetailRows.length, 0) }} 筆</span>
              </div>
              <div v-if="replayDetailRows.length" class="table-wrap replay-detail-wrap">
                <table class="data-table replay-detail-table">
                  <thead>
                    <tr>
                      <th>進場日</th>
                      <th>股票</th>
                      <th>進場價</th>
                      <th>出場日</th>
                      <th>出場價</th>
                      <th>報酬</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in replayDetailRows" :key="`${activeReplayDetail.groupKey}-${activeReplayDetail.horizon}-${item.marketDate}-${item.code}`">
                      <td>{{ formatDate(item.marketDate) }}</td>
                      <td>
                        <RouterLink class="table-link" :to="createStockRoute(item.code)">
                          {{ item.code }} {{ item.name }}
                        </RouterLink>
                      </td>
                      <td>{{ formatNumber(item.entryClose, 2) }}</td>
                      <td>{{ formatDate(item.result?.exitDate) }}</td>
                      <td>{{ formatNumber(item.result?.exitClose, 2) }}</td>
                      <td :class="getReplayMetricClass(item.result?.returnPercent)">
                        {{ formatPercent(item.result?.returnPercent) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty-state compact">
                <strong>這個區間還沒有可回看的樣本</strong>
                <p>等資料累積到足夠交易日後，這裡會自動顯示個股明細。</p>
              </div>
            </section>

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
              <strong>歷史表現還在累積</strong>
              <p>每天盤後會保留穩健型與積極型名單，之後可回看 3、5、10 日表現。</p>
            </div>

            <div v-else-if="replayError" class="empty-state compact">
              <strong>歷史表現暫時載入失敗</strong>
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
