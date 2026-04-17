<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useStockDetail } from '../composables/useStockDetail';
import { useStockComparisonSeries } from '../composables/useStockComparisonSeries';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import { useLiveStockSnapshot } from '../composables/useLiveStockSnapshot';
import { useRecentStocks } from '../composables/useRecentStocks';
import { useSeoMeta } from '../composables/useSeoMeta';
import StatusCard from '../components/StatusCard.vue';
import InfoCard from '../components/InfoCard.vue';
import StockFinancialOverview from '../components/StockFinancialOverview.vue';
import IntradayChart from '../components/IntradayChart.vue';
import TechnicalChart from '../components/TechnicalChart.vue';
import HolderStructureChart from '../components/HolderStructureChart.vue';
import StockNewsPanel from '../components/StockNewsPanel.vue';
import { createStockRoute } from '../lib/stockRouting';
import { buildKeyPriceZones, buildStockEventCalendar, buildSupportResistance } from '../lib/stockInsights';
import { buildStockEventPerformance } from '../lib/stockEventPerformance';
import { buildPageUrl, createBreadcrumbJsonLd } from '../lib/seo';
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

const { detail, isLoading, isEnhancing, errorMessage } = useStockDetail(stockCode);
const { isFavorite, toggleFavorite } = useFavoriteStocks();
const { snapshot: liveSnapshot, isLoading: isLiveSnapshotLoading } = useLiveStockSnapshot(stockCode, { refreshIntervalMs: 45000 });
const { recentItems, pushRecentStock } = useRecentStocks();

const companyProfile = computed(() => detail.value?.公司概況 ?? null);
const holderDistribution = computed(() => detail.value?.持股分散 ?? null);
const institutionalFlows = computed(() => detail.value?.法人買賣 ?? null);
const marginSnapshot = computed(() => detail.value?.融資融券 ?? null);
const activeEtfExposure = computed(() => detail.value?.主動ETF曝光 ?? null);
const industryComparison = computed(() => detail.value?.同產業比較 ?? null);
const selectionSignals = computed(() => detail.value?.交易提醒 ?? null);
const foreignTargetPrice = computed(() => detail.value?.foreignTargetPrice ?? null);
const isTracked = computed(() => isFavorite(stockCode.value));
const technicalSignals = computed(() => detail.value?.technicalSignals ?? []);
const foreignTargetPriceItems = computed(() => foreignTargetPrice.value?.items ?? []);
const selectionAlertItems = computed(() => selectionSignals.value?.alerts ?? []);
const latestIndicators = computed(() => detail.value?.最新指標 ?? {});
const indicatorSettings = computed(() => detail.value?.indicatorSettings ?? {});
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
  `資料日 ${formatDate(liveSnapshot.value?.marketDate ?? detail.value?.priceDate)}`,
  `法人五日 ${formatAmount(institutionalFlows.value?.summary?.total5Day)}`,
  `ETF 持有 ${formatNumber(activeEtfExposure.value?.count)}`,
]);

const displayQuote = computed(() => {
  const latestSummary = detail.value?.最新摘要 ?? {};

  return {
    close: liveSnapshot.value?.lastPrice ?? latestSummary.close ?? null,
    change: liveSnapshot.value?.change ?? latestSummary.change ?? null,
    changePercent: liveSnapshot.value?.changePercent ?? latestSummary.changePercent ?? null,
    return20: latestSummary.return20 ?? null,
    return60: latestSummary.return60 ?? null,
    volume: liveSnapshot.value?.volume ?? latestSummary.volume ?? null,
  };
});

const heroAlertSignals = computed(() => technicalSignals.value.slice(0, 3));
const isLiveFallback = computed(() => detail.value?.kind === 'live');
const liveSnapshotCards = computed(() => [
  {
    title: '即時成交',
    value: formatNumber(liveSnapshot.value?.lastPrice),
    description: `${formatPriceDelta(liveSnapshot.value?.change)} / ${formatPercent(liveSnapshot.value?.changePercent)}`,
    status:
      (liveSnapshot.value?.change ?? 0) > 0
        ? 'up'
        : (liveSnapshot.value?.change ?? 0) < 0
          ? 'down'
          : 'normal',
  },
  {
    title: '今日區間',
    value: `${formatNumber(liveSnapshot.value?.low)} - ${formatNumber(liveSnapshot.value?.high)}`,
    description: `開盤 ${formatNumber(liveSnapshot.value?.open)}`,
  },
  {
    title: '累計量',
    value: formatAmount(liveSnapshot.value?.volume),
    description: `更新 ${formatDate(liveSnapshot.value?.marketDate)}`,
  },
]);

const keyPriceZones = computed(() => buildKeyPriceZones(detail.value));
const supportResistance = computed(() => buildSupportResistance(detail.value));
const stockEventCalendar = computed(() => buildStockEventCalendar(detail.value));
const stockEventPerformance = computed(() => buildStockEventPerformance(detail.value));
const recentViewedStocks = computed(() =>
  recentItems.value
    .filter((item) => item.code && item.code !== stockCode.value)
    .slice(0, 6),
);

const stockSeo = computed(() => {
  const stockName = detail.value?.name ?? companyProfile.value?.公司名稱 ?? stockCode.value;
  const industryName = companyProfile.value?.產業名稱 ? `${companyProfile.value.產業名稱}個股` : '台股個股';
  const signalText = technicalSignals.value.slice(0, 3).join('、');
  const priceDateText = detail.value?.priceDate ? `資料截至 ${formatDate(detail.value.priceDate)}。` : '';
  const description = `${stockName}（${stockCode.value}）${industryName}研究頁，整合技術分析、法人籌碼、持股分級、財務面、關鍵價位與最近新聞。${signalText ? ` 目前重點訊號：${signalText}。` : ''}${priceDateText}`;

  return {
    title: `${stockName} ${stockCode.value} 技術分析與籌碼面`,
    description,
    routePath: `/stocks/${stockCode.value}`,
    keywords: [stockCode.value, stockName, '台股', '技術分析', '法人籌碼', '財務分析', '支撐壓力', '外資目標價'],
    jsonLd: [
      createBreadcrumbJsonLd([
        { name: '台股主動通', url: buildPageUrl('/') },
        { name: stockName, url: buildPageUrl(`/stocks/${stockCode.value}`) },
      ]),
    ],
  };
});

useSeoMeta(stockSeo);

const summaryCards = computed(() => {
  const latestSummary = displayQuote.value;
  const holderSummary = holderDistribution.value ?? {};

  return [
    {
      title: liveSnapshot.value?.lastPrice ? '最新價' : '收盤價',
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

const technicalQuickCards = computed(() => {
  const latestSummary = detail.value?.最新摘要 ?? {};
  const maMedium = latestIndicators.value.maMedium ?? latestIndicators.value.ma20 ?? null;
  const maLong = latestIndicators.value.maLong ?? latestIndicators.value.ma60 ?? null;
  const rsi = latestIndicators.value.rsi ?? latestIndicators.value.rsi14 ?? null;
  const kValue = latestIndicators.value.stochasticK ?? latestIndicators.value.k9 ?? null;
  const dValue = latestIndicators.value.stochasticD ?? latestIndicators.value.d9 ?? null;
  const macdHist = latestIndicators.value.macdHist ?? null;

  const movingAverageDescription =
    latestSummary.close !== null && maMedium !== null && maLong !== null
      ? latestSummary.close > maMedium && maMedium > maLong
        ? '收盤仍站在中長均之上'
        : latestSummary.close < maMedium && maMedium < maLong
          ? '收盤落在中長均之下'
          : '股價與中長均線交錯整理'
      : '均線資料整理中';

  return [
    {
      title: '均線位置',
      value:
        maMedium !== null && maLong !== null
          ? `MA${indicatorSettings.value.maMediumPeriod ?? 20} / MA${indicatorSettings.value.maLongPeriod ?? 60}`
          : '-',
      description: movingAverageDescription,
      status:
        latestSummary.close !== null && maMedium !== null && maLong !== null
          ? latestSummary.close > maMedium && maMedium > maLong
            ? 'up'
            : latestSummary.close < maMedium && maMedium < maLong
              ? 'down'
              : 'normal'
          : 'normal',
    },
    {
      title: `RSI${indicatorSettings.value.rsiPeriod ?? 14}`,
      value: formatNumber(rsi),
      description: rsi !== null ? (rsi >= 70 ? '偏熱區' : rsi <= 30 ? '偏低區' : '中性區間') : 'RSI 資料整理中',
      status: rsi !== null ? (rsi <= 30 ? 'up' : rsi >= 70 ? 'down' : 'normal') : 'normal',
    },
    {
      title: 'KD 指標',
      value: `K ${formatNumber(kValue)} / D ${formatNumber(dValue)}`,
      description:
        kValue !== null && dValue !== null
          ? kValue > dValue
            ? 'K 值在 D 值上方'
            : kValue < dValue
              ? 'K 值在 D 值下方'
              : 'K、D 交會'
          : 'KD 資料整理中',
      status:
        kValue !== null && dValue !== null
          ? kValue > dValue
            ? 'up'
            : kValue < dValue
              ? 'down'
              : 'normal'
          : 'normal',
    },
    {
      title: 'MACD 柱體',
      value: formatNumber(macdHist),
      description:
        macdHist !== null
          ? macdHist > 0
            ? '動能仍偏多'
            : macdHist < 0
              ? '動能偏弱'
              : '多空分水嶺'
          : 'MACD 資料整理中',
      status: macdHist !== null ? (macdHist > 0 ? 'up' : macdHist < 0 ? 'down' : 'normal') : 'normal',
    },
  ];
});

const technicalNarrative = computed(() => {
  const latestSummary = detail.value?.最新摘要 ?? {};
  const maMedium = latestIndicators.value.maMedium ?? latestIndicators.value.ma20 ?? null;
  const maLong = latestIndicators.value.maLong ?? latestIndicators.value.ma60 ?? null;
  const macdHist = latestIndicators.value.macdHist ?? null;
  const narratives = [];

  if (latestSummary.close !== null && maMedium !== null && maLong !== null) {
    if (latestSummary.close > maMedium && maMedium > maLong) {
      narratives.push('價格結構目前維持在中長均線之上，波段節奏仍偏強。');
    } else if (latestSummary.close < maMedium && maMedium < maLong) {
      narratives.push('價格結構仍壓在中長均線下方，若沒有新量能配合，隔日容易先走整理。');
    } else {
      narratives.push('價格正在均線密集區整理，後續比較需要看量價與族群同步性。');
    }
  }

  if (macdHist !== null) {
    narratives.push(macdHist > 0 ? 'MACD 柱體仍在正值區，短線動能還沒完全退潮。': macdHist < 0 ? 'MACD 柱體仍在負值區，搶短時要留意反彈後再度轉弱。': 'MACD 柱體貼近零軸，代表方向感還不夠明確。');
  }

  if (technicalSignals.value.length) {
    narratives.push(`目前最值得先看的是「${technicalSignals.value[0].title}」訊號。`);
  }

  return narratives.slice(0, 3);
});

function getPriceZoneTone(role) {
  if (role === 'support') return 'support';
  if (role === 'resistance') return 'resistance';
  return 'reference';
}

function getPriceZoneLabel(role) {
  if (role === 'support') return '支撐觀察';
  if (role === 'resistance') return '壓力觀察';
  return '目前參考';
}

function getEventStatusLabel(status) {
  if (status === 'recent') return '最近事件';
  if (status === 'upcoming') return '接下來';
  return '參考點';
}

function getEventStatusTone(status) {
  if (status === 'recent') return 'recent';
  if (status === 'upcoming') return 'upcoming';
  return 'event-reference';
}

function getSelectionAlertTone(tone) {
  if (tone === 'risk') return 'risk';
  if (tone === 'warning') return 'warning';
  return 'info';
}

function formatEventDistance(dateText) {
  const targetDate = new Date(`${dateText}T00:00:00`);

  if (Number.isNaN(targetDate.getTime())) {
    return '日期整理中';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((targetDate.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) {
    return '今天';
  }

  if (diffDays > 0) {
    return `${diffDays} 天後`;
  }

  return `${Math.abs(diffDays)} 天前`;
}

function formatViewedAt(dateText) {
  const viewedDate = new Date(dateText);

  if (Number.isNaN(viewedDate.getTime())) {
    return '剛剛';
  }

  return viewedDate.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

watch(
  () => detail.value?.code,
  (code) => {
    if (!code) return;
    pushRecentStock({
      code,
      name: detail.value?.name ?? stockCode.value,
    });
  },
  { immediate: true },
);
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
        <span
          v-if="liveSnapshot?.lastPrice"
          class="meta-chip"
          :class="{ 'text-up': (liveSnapshot?.change ?? 0) > 0, 'text-down': (liveSnapshot?.change ?? 0) < 0 }"
        >
          即時 {{ formatNumber(liveSnapshot.lastPrice) }}
        </span>
        <span v-if="isEnhancing" class="meta-chip">補抓遠端日線中</span>
        <button
          type="button"
          class="favorite-toggle hero-favorite-toggle"
          :class="{ 'is-active': isTracked }"
          @click="toggleFavorite(stockCode)"
        >
          {{ isTracked ? '已加入自選' : '加入自選' }}
        </button>
        <div v-if="heroAlertSignals.length" class="hero-alert-stack">
          <article
            v-for="signal in heroAlertSignals"
            :key="`hero-${signal.key}`"
            class="hero-alert-card"
            :class="signal.tone ? `is-${signal.tone}` : ''"
          >
            <strong>{{ signal.title }}</strong>
            <p>{{ signal.description }}</p>
          </article>
        </div>
      </div>
    </div>

    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(detail)"
      empty-message="這檔個股目前沒有可顯示的靜態明細資料。"
    />

    <template v-if="detail">
      <nav class="mobile-section-nav stock-mobile-nav" aria-label="個股研究捷徑">
        <a class="mobile-section-link" href="#quote">報價</a>
        <a class="mobile-section-link" href="#signals">技術</a>
        <a class="mobile-section-link" href="#chart">圖表</a>
        <a class="mobile-section-link" href="#news">新聞</a>
        <a class="mobile-section-link" href="#financials">財務</a>
      </nav>

      <section id="quote" v-if="isLiveFallback || liveSnapshot?.lastPrice" class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">即時快照</h2>
            <p class="panel-subtitle">
              {{ isLiveFallback ? '這檔股票來自即時補資料，部分籌碼與財務欄位仍會逐步補齊。' : '盤中用即時行情校正靜態資料，避免只看收盤後快照。' }}
            </p>
          </div>
          <span class="meta-chip">{{ isLiveSnapshotLoading ? '更新中' : (liveSnapshot?.updatedAt ? liveSnapshot.updatedAt.replace('T', ' ').slice(5, 16) : '即時資料') }}</span>
        </div>

        <section class="card-grid compact-summary-grid">
          <InfoCard
            v-for="item in liveSnapshotCards"
            :key="`live-${item.title}`"
            :title="item.title"
            :value="item.value"
            :description="item.description"
            :status="item.status"
          />
        </section>
      </section>

      <section class="card-grid compact-summary-grid">
        <InfoCard
          v-for="item in summaryCards"
          :key="item.title"
          :title="item.title"
          :value="item.value"
          :description="item.description"
          :status="item.status"
        />
      </section>

      <section class="card-grid compact-summary-grid">
        <InfoCard
          v-for="item in quickCards"
          :key="`quick-${item.title}`"
          :title="item.title"
          :value="item.value"
          :description="item.description"
          :status="item.status"
        />
      </section>

      <section id="signals" class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">技術分析快讀</h2>
            <p class="panel-subtitle">先看結構、再看指標與訊號，不用先打開完整圖表也能快速判斷強弱。</p>
          </div>
        </div>

        <section class="card-grid stock-technical-cards">
          <InfoCard
            v-for="item in technicalQuickCards"
            :key="`technical-${item.title}`"
            :title="item.title"
            :value="item.value"
            :description="item.description"
            :status="item.status"
          />
        </section>

        <div v-if="technicalSignals.length" class="stock-technical-signal-list">
          <article
            v-for="signal in technicalSignals"
            :key="signal.key"
            class="stock-technical-signal"
            :class="signal.tone ? `is-${signal.tone}` : ''"
          >
            <div class="stock-technical-signal-head">
              <strong>{{ signal.title }}</strong>
              <span class="meta-chip">{{ signal.importance >= 3 ? '高優先' : signal.importance === 2 ? '留意' : '觀察' }}</span>
            </div>
            <p>{{ signal.description }}</p>
          </article>
        </div>

        <ul v-if="technicalNarrative.length" class="bullet-list compact">
          <li v-for="item in technicalNarrative" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="dual-grid">
        <article class="panel insight-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">交易提醒</h2>
              <p class="panel-subtitle">把官方公告裡對隔日交易最有影響的風險與事件先拉出來。</p>
            </div>
            <span v-if="selectionSignals?.asOfDate" class="meta-chip">資料日 {{ formatDate(selectionSignals.asOfDate) }}</span>
          </div>

          <div v-if="selectionAlertItems.length" class="selection-alert-list">
            <article
              v-for="item in selectionAlertItems"
              :key="item.key"
              class="selection-alert-card"
              :class="`is-${getSelectionAlertTone(item.tone)}`"
            >
              <div class="selection-alert-head">
                <strong>{{ item.title }}</strong>
                <span class="status-badge" :class="`is-${getSelectionAlertTone(item.tone)}`">{{ item.badgeLabel }}</span>
              </div>
              <p>{{ item.note }}</p>
              <p v-if="item.detail" class="muted">{{ item.detail }}</p>
              <div class="selection-alert-foot">
                <span>{{ item.date ? formatDate(item.date) : '官方公告整理' }}</span>
                <span v-if="item.footnote">{{ item.footnote }}</span>
              </div>
            </article>
          </div>
          <div v-else class="empty-state compact">
            <strong>目前沒有額外交易提醒</strong>
            <p>若官方公告出現處置、注意累計、變更交易或除權息事件，這裡會自動補上。</p>
          </div>
        </article>

        <article class="panel insight-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">事件日曆</h2>
              <p class="panel-subtitle">把月營收、季報、股利事件與 ETF 揭露時間拉出來，方便預先安排觀察。</p>
            </div>
          </div>

          <div v-if="stockEventCalendar.length" class="event-list">
            <article v-for="item in stockEventCalendar" :key="item.key" class="event-item">
              <div class="event-main">
                <div class="price-zone-head">
                  <strong>{{ item.label }}</strong>
                  <span class="status-badge" :class="`is-${getEventStatusTone(item.status)}`">{{ getEventStatusLabel(item.status) }}</span>
                </div>
                <p class="event-note">{{ item.note }}</p>
              </div>
              <div class="event-side">
                <strong class="event-date">{{ formatDate(item.date) }}</strong>
                <span class="muted">{{ formatEventDistance(item.date) }}</span>
              </div>
            </article>
          </div>
          <div v-else class="empty-state compact">
            <strong>事件日曆還沒有足夠資料</strong>
            <p>月營收、季報、股利事件或 ETF 揭露資料補齊後會顯示在這裡。</p>
          </div>
        </article>
      </section>

      <section class="dual-grid">
        <article class="panel insight-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">關鍵價位區</h2>
              <p class="panel-subtitle">把近期高低點和中長均線拉在一起，先看隔日容易有反應的位置。</p>
            </div>
          </div>

          <div v-if="keyPriceZones.length" class="price-zone-list">
            <article
              v-for="item in keyPriceZones"
              :key="item.key"
              class="price-zone-card"
              :class="`is-${getPriceZoneTone(item.role)}`"
            >
              <div class="price-zone-head">
                <strong>{{ item.label }}</strong>
                <span class="status-badge" :class="`is-${getPriceZoneTone(item.role)}`">{{ getPriceZoneLabel(item.role) }}</span>
              </div>
              <p class="price-zone-value">{{ formatNumber(item.value) }}</p>
            </article>
          </div>
          <div v-else class="empty-state compact">
            <strong>關鍵價位還在整理</strong>
            <p v-if="isEnhancing">正在補抓遠端日線資料，抓到完整 K 線後會自動補上價位區。</p>
            <p v-else>通常是目前只有即時報價，還沒有抓到足夠的日線歷史，所以暫時無法建立價位區。</p>
          </div>
        </article>

        <article class="panel insight-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">支撐壓力帶</h2>
              <p class="panel-subtitle">用價位加上緩衝區間，幫你先看明天容易測試的支撐與壓力。</p>
            </div>
          </div>

          <div class="support-resistance-grid">
            <section class="support-resistance-column">
              <div class="support-resistance-head">
                <strong>上方壓力</strong>
                <span class="muted">靠近上緣時留意追價風險</span>
              </div>
              <div v-if="supportResistance.resistances.length" class="support-resistance-list">
                <article
                  v-for="item in supportResistance.resistances"
                  :key="`resistance-${item.key}`"
                  class="support-resistance-item is-resistance"
                >
                  <div class="price-zone-head">
                    <strong>{{ item.label }}</strong>
                    <span class="meta-chip">{{ formatPercent(item.distancePercent) }}</span>
                  </div>
                  <p class="support-resistance-value">{{ formatNumber(item.low) }} - {{ formatNumber(item.high) }}</p>
                </article>
              </div>
              <p v-else class="muted">
                {{ isEnhancing ? '正在補抓遠端日線資料，完成後會自動回填上方壓力。' : '目前沒有足夠的上方壓力資料，通常代表這次載入的是即時快照或日線樣本不足。' }}
              </p>
            </section>

            <section class="support-resistance-column">
              <div class="support-resistance-head">
                <strong>下方支撐</strong>
                <span class="muted">回測區間時留意量能是否守住</span>
              </div>
              <div v-if="supportResistance.supports.length" class="support-resistance-list">
                <article
                  v-for="item in supportResistance.supports"
                  :key="`support-${item.key}`"
                  class="support-resistance-item is-support"
                >
                  <div class="price-zone-head">
                    <strong>{{ item.label }}</strong>
                    <span class="meta-chip">{{ formatPercent(item.distancePercent) }}</span>
                  </div>
                  <p class="support-resistance-value">{{ formatNumber(item.low) }} - {{ formatNumber(item.high) }}</p>
                </article>
              </div>
              <p v-else class="muted">
                {{ isEnhancing ? '正在補抓遠端日線資料，完成後會自動回填下方支撐。' : '目前沒有足夠的下方支撐資料，通常代表這次載入的是即時快照或日線樣本不足。' }}
              </p>
            </section>
          </div>
        </article>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">外資目標價摘要</h2>
            <p class="panel-subtitle">
              從近 {{ foreignTargetPrice?.recentDays ?? 7 }} 天新聞整理券商／外資喊價，先看市場對這檔股票的預期區間。
            </p>
          </div>
          <span class="meta-chip">新聞整理</span>
        </div>

        <template v-if="foreignTargetPrice?.itemCount">
          <section class="comparison-stat-grid">
            <article class="comparison-stat-card">
              <p class="comparison-stat-label">最新目標價</p>
              <p class="comparison-stat-value">{{ formatNumber(foreignTargetPrice.latestTargetPrice) }}</p>
              <p class="comparison-stat-note">
                {{ foreignTargetPrice.latestBroker ?? '市場摘要' }}
              </p>
            </article>

            <article class="comparison-stat-card">
              <p class="comparison-stat-label">目標價區間</p>
              <p class="comparison-stat-value">
                {{ formatNumber(foreignTargetPrice.lowestTargetPrice) }} - {{ formatNumber(foreignTargetPrice.highestTargetPrice) }}
              </p>
              <p class="comparison-stat-note">近 {{ foreignTargetPrice.recentDays }} 天新聞提及</p>
            </article>

            <article class="comparison-stat-card">
              <p class="comparison-stat-label">平均目標價</p>
              <p class="comparison-stat-value">{{ formatNumber(foreignTargetPrice.averageTargetPrice) }}</p>
              <p class="comparison-stat-note">共 {{ formatNumber(foreignTargetPrice.itemCount, 0) }} 則目標價敘述</p>
            </article>

            <article class="comparison-stat-card">
              <p class="comparison-stat-label">相對現價空間</p>
              <p
                class="comparison-stat-value"
                :class="{
                  'text-up': (foreignTargetPrice.premiumToClose ?? 0) > 0,
                  'text-down': (foreignTargetPrice.premiumToClose ?? 0) < 0,
                }"
              >
                {{ formatPercent(foreignTargetPrice.premiumToClose) }}
              </p>
              <p class="comparison-stat-note">以最新目標價對照目前顯示股價</p>
            </article>
          </section>

          <ul class="bullet-list compact">
            <li>{{ foreignTargetPrice.note }}</li>
            <li>資料來自近 {{ foreignTargetPrice.recentDays }} 天新聞整理，屬市場資訊摘要，不代表官方共識目標價。</li>
          </ul>

          <div class="table-wrap">
            <table class="data-table compact-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>券商 / 外資</th>
                  <th>目標價</th>
                  <th>動作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in foreignTargetPriceItems" :key="`${item.link}-${item.targetPrice}`">
                  <td>{{ formatDate(item.publishedAt) }}</td>
                  <td>{{ item.broker }}</td>
                  <td>{{ formatNumber(item.targetPrice) }}</td>
                  <td>{{ item.action }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <div v-else class="empty-state compact">
          <strong>近期沒有可參考的外資目標價整理</strong>
          <p>近 {{ foreignTargetPrice?.recentDays ?? 7 }} 天新聞裡若出現券商或外資明確喊價，這裡會自動補上。</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">事件後表現統計</h2>
            <p class="panel-subtitle">不只看事件日期，直接回看過去 8 次月營收 / 財報觀察窗之後的 3 / 5 / 10 日平均表現。</p>
          </div>
          <span class="meta-chip">歷史回放</span>
        </div>

        <div v-if="stockEventPerformance.length" class="event-performance-grid">
          <article v-for="entry in stockEventPerformance" :key="entry.key" class="sub-panel event-performance-card">
            <div class="event-performance-head">
              <div>
                <strong>{{ entry.title }}</strong>
                <p class="muted">{{ entry.note }}</p>
              </div>
              <span class="meta-chip">樣本 {{ formatNumber(entry.sampleCount, 0) }}</span>
            </div>

            <div class="comparison-stat-grid compact-grid">
              <article v-for="horizon in [3, 5, 10]" :key="`${entry.key}-${horizon}`" class="comparison-stat-card">
                <p class="comparison-stat-label">{{ horizon }} 日平均</p>
                <p
                  class="comparison-stat-value"
                  :class="{
                    'text-up': (entry.metrics[horizon]?.averageReturn ?? 0) > 0,
                    'text-down': (entry.metrics[horizon]?.averageReturn ?? 0) < 0,
                  }"
                >
                  {{ formatPercent(entry.metrics[horizon]?.averageReturn) }}
                </p>
                <p class="comparison-stat-note">
                  勝率 {{ formatPercent(entry.metrics[horizon]?.winRate) }} / 樣本 {{ formatNumber(entry.metrics[horizon]?.sampleCount, 0) }}
                </p>
              </article>
            </div>

            <div class="table-wrap">
              <table class="data-table compact-table">
                <thead>
                  <tr>
                    <th>事件日期</th>
                    <th>觀察起點</th>
                    <th>3 日</th>
                    <th>5 日</th>
                    <th>10 日</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="sample in entry.samples" :key="`${entry.key}-${sample.eventDate}`">
                    <td>{{ formatDate(sample.eventDate) }}</td>
                    <td>{{ formatDate(sample.tradeDate) }}</td>
                    <td :class="{ 'text-up': (sample.horizons[3]?.returnPercent ?? 0) > 0, 'text-down': (sample.horizons[3]?.returnPercent ?? 0) < 0 }">
                      {{ formatPercent(sample.horizons[3]?.returnPercent) }}
                    </td>
                    <td :class="{ 'text-up': (sample.horizons[5]?.returnPercent ?? 0) > 0, 'text-down': (sample.horizons[5]?.returnPercent ?? 0) < 0 }">
                      {{ formatPercent(sample.horizons[5]?.returnPercent) }}
                    </td>
                    <td :class="{ 'text-up': (sample.horizons[10]?.returnPercent ?? 0) > 0, 'text-down': (sample.horizons[10]?.returnPercent ?? 0) < 0 }">
                      {{ formatPercent(sample.horizons[10]?.returnPercent) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>
        <div v-else class="empty-state compact">
          <strong>事件後表現樣本還不夠</strong>
          <p>如果這檔股票的歷史價格或事件樣本不夠，這裡會先保留空白；等累積更多資料後會自動補齊。</p>
        </div>
      </section>

      <section id="news" class="page-section-anchor">
        <StockNewsPanel :code="stockCode" :stock-name="detail?.name ?? stockCode" />
      </section>

      <section v-if="recentViewedStocks.length" class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">最近瀏覽</h2>
            <p class="panel-subtitle">回看你最近研究過的股票，不用再重找一次。</p>
          </div>
        </div>

        <div class="recent-stocks-grid compact">
          <article
            v-for="item in recentViewedStocks"
            :key="`recent-${item.code}`"
            class="favorite-card recent-stock-card"
          >
            <div class="recent-stock-head">
              <div class="favorite-title-block">
                <p class="ticker-code">{{ item.code }}</p>
                <RouterLink class="favorite-title" :to="createStockRoute(item.code)">{{ item.name }}</RouterLink>
              </div>
              <span class="recent-stock-time">最後查看 {{ formatViewedAt(item.viewedAt) }}</span>
            </div>
            <div class="favorite-metrics">
              <span>快速回到個股頁</span>
              <span class="signal-pill">延續剛剛的研究脈絡</span>
            </div>
          </article>
        </div>
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

      <section id="chart" class="page-section-anchor chart-stack">
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
      </section>

      <HolderStructureChart
        v-if="detail?.持股分散"
        :data="detail.持股分散"
        title="個股大戶 / 散戶拆解圖表"
      />

      <section id="financials" class="page-section-anchor">
        <StockFinancialOverview :data="detail" />
      </section>

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
