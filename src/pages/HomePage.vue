<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import { useLiveMarketOverview } from '../composables/useLiveMarketOverview';
import { useLiveStockSnapshots } from '../composables/useLiveStockSnapshots';
import { useRecentStocks } from '../composables/useRecentStocks';
import { useSeoMeta } from '../composables/useSeoMeta';
import StatusCard from '../components/StatusCard.vue';
import InfoCard from '../components/InfoCard.vue';
import IntradayChart from '../components/IntradayChart.vue';
import TechnicalChart from '../components/TechnicalChart.vue';
import { createStockRoute, isStockCode } from '../lib/stockRouting';
import {
  formatAmount,
  formatDate,
  formatLots,
  formatNumber,
  formatPercent,
  formatSignedNumber,
  formatTime,
} from '../lib/formatters';

const router = useRouter();
const { dashboard, manifest, stockList, stockSearchList, etfOverviewList, isLoading, errorMessage, loadGlobalData } = useGlobalData();
const { favoriteCodes, isFavorite, toggleFavorite, clearFavorites } = useFavoriteStocks();
const { recentItems, clearRecentStocks } = useRecentStocks();
const searchQuery = ref('');
const rankingView = ref('live');
const staticMarketOverview = computed(() => dashboard.value?.市場總覽 ?? null);
const {
  marketOverview,
  liveStatus,
  refreshLiveMarketData,
  startAutoRefresh,
  stopAutoRefresh,
} = useLiveMarketOverview(staticMarketOverview);
const watchedLiveCodes = computed(() => [
  ...favoriteCodes.value,
  ...recentItems.value.map((item) => item.code),
  ...(marketOverview.value?.熱門股 ?? []).map((item) => item.代號),
  ...(marketOverview.value?.強勢股 ?? []).map((item) => item.代號),
  ...(marketOverview.value?.成交排行 ?? []).map((item) => item.代號),
]);
const {
  snapshotMap: liveSnapshotMap,
  refreshSnapshots,
  startAutoRefresh: startLiveSnapshotAutoRefresh,
  stopAutoRefresh: stopLiveSnapshotAutoRefresh,
} = useLiveStockSnapshots(watchedLiveCodes);

onMounted(() => {
  loadGlobalData();
  refreshLiveMarketData();
  startAutoRefresh();
  refreshSnapshots();
  startLiveSnapshotAutoRefresh();
});

onBeforeUnmount(() => {
  stopAutoRefresh();
  stopLiveSnapshotAutoRefresh();
});

const institutionalHighlights = computed(() => dashboard.value?.法人追蹤 ?? null);
const activeEtfOverview = computed(() => dashboard.value?.主動ETF總覽 ?? null);
const marketSummary = computed(() => marketOverview.value?.大盤摘要 ?? {});
const intradayPulse = computed(() => marketOverview.value?.盤中脈動 ?? {});
const marketBreadth = computed(() => marketOverview.value?.市場廣度 ?? null);
const foreignOwnershipLeaders = computed(() => marketOverview.value?.外資持股焦點 ?? []);
const foreignIndustryLeaders = computed(() => marketOverview.value?.外資類股焦點 ?? null);
const hotStocks = computed(() => marketOverview.value?.熱門股 ?? []);
const strongStocks = computed(() => marketOverview.value?.強勢股 ?? []);
const turnoverRanks = computed(() => marketOverview.value?.成交排行 ?? []);
const closeMarketDate = computed(() => marketOverview.value?.盤後資料日期 ?? marketOverview.value?.資料日期 ?? null);
const liveMarketDate = computed(() => liveStatus.value?.marketDate ?? marketOverview.value?.資料日期 ?? null);
const marketBreadthDate = computed(() => marketBreadth.value?.資料日期 ?? null);
const marketBreadthIsLiveDay = computed(() => Boolean(liveMarketDate.value) && marketBreadthDate.value === liveMarketDate.value);
const marketBreadthBadge = computed(() => {
  if (marketBreadthIsLiveDay.value) {
    return marketBreadth.value?.市場情緒 ?? '最近同步';
  }

  if (marketBreadthDate.value) {
    return `盤後統計 ${formatDate(marketBreadthDate.value)}`;
  }

  return '尚無資料';
});

const marketBreadthHint = computed(() =>
  marketBreadthIsLiveDay.value
    ? '當上漲家數明顯多於下跌家數時，代表盤勢不是只靠少數權值股撐住。'
    : '市場廣度目前仍採最近一次盤後統計，盤中請搭配指數與成交節奏一起看。',
);
const marketLiveTimeLabel = computed(() => {
  const timeText = intradayPulse.value?.更新時間 ?? liveStatus.value?.updatedTime ?? null;
  return timeText ? formatTime(timeText) : null;
});
const marketObservationSubtitle = computed(() => {
  if (liveMarketDate.value && closeMarketDate.value && liveMarketDate.value !== closeMarketDate.value) {
    const liveLabel = marketLiveTimeLabel.value ? `${formatDate(liveMarketDate.value)} ${marketLiveTimeLabel.value}` : formatDate(liveMarketDate.value);
    return `盤中即時 ${liveLabel}，盤後摘要基底 ${formatDate(closeMarketDate.value)}`;
  }

  if (liveMarketDate.value && marketLiveTimeLabel.value) {
    return `盤中即時 ${formatDate(liveMarketDate.value)} ${marketLiveTimeLabel.value}`;
  }

  return closeMarketDate.value ? `盤後資料日期 ${formatDate(closeMarketDate.value)}` : '資料整理中';
});
const rankingLiveBadge = computed(() => {
  if (rankingView.value !== 'live') {
    return closeMarketDate.value ? `盤後 ${formatDate(closeMarketDate.value)}` : '盤後整理';
  }

  const parts = [];

  if (marketLiveTimeLabel.value) {
    parts.push(`即時 ${marketLiveTimeLabel.value}`);
  }

  const baselineDate = marketOverview.value?.排行基準日期 ?? closeMarketDate.value;

  if (baselineDate) {
    parts.push(`榜單基底 ${formatDate(baselineDate)}`);
  }

  return parts.join(' / ') || '盤中即時';
});

const homeSeo = computed(() => ({
  title: '台股大盤、熱門股與主動式 ETF 風向球',
  description: `整合台股大盤即時走勢、熱門股排行、主動式 ETF 風向球與法人觀察。追蹤 ${stockList.value.length || 0} 檔個股與 ${etfOverviewList.value.length || 0} 檔主動式 ETF。`,
  routePath: '/',
  keywords: ['台股大盤', '熱門股', '主動式ETF', 'ETF持股異動', '法人觀察', '台股即時'],
}));

useSeoMeta(homeSeo);

function getLiveSnapshot(code) {
  return liveSnapshotMap.value.get(String(code ?? '').trim().toUpperCase()) ?? null;
}

function mergeSnapshotIntoStock(item, fieldName = '代號') {
  const snapshot = getLiveSnapshot(item?.[fieldName]);

  if (!snapshot) {
    return item;
  }

  return {
    ...item,
    名稱: snapshot.shortName ?? item.名稱 ?? item.name,
    收盤價: snapshot.lastPrice ?? item.收盤價,
    漲跌值: snapshot.change ?? item.漲跌值,
    漲跌幅: snapshot.changePercent ?? item.漲跌幅,
    成交量: snapshot.volumeShares ?? item.成交量,
    即時更新時間: snapshot.updatedAt ?? null,
    即時來源: snapshot.sourceLabel ?? null,
  };
}

const liveHotStocks = computed(() => hotStocks.value.map((item) => mergeSnapshotIntoStock(item)));
const liveStrongStocks = computed(() => strongStocks.value.map((item) => mergeSnapshotIntoStock(item)));
const liveTurnoverRanks = computed(() => turnoverRanks.value.map((item) => mergeSnapshotIntoStock(item)));
const rankingGroups = computed(() => {
  const isLive = rankingView.value === 'live';

  return [
    {
      key: 'hot',
      title: '熱門股',
      subtitle: isLive ? '榜單基底採最近同步，價格與量能即時更新' : '盤後成交人氣前段班',
      metricLabel: '成交量',
      items: isLive ? liveHotStocks.value : hotStocks.value,
      metricValue: (item) => formatLots(item.成交量),
    },
    {
      key: 'strong',
      title: '強勢股',
      subtitle: isLive ? '強勢股清單沿用最近篩選，盤中行情即時覆蓋' : '量價一起轉強的上市股',
      metricLabel: '成交值',
      items: isLive ? liveStrongStocks.value : strongStocks.value,
      metricValue: (item) => formatAmount(item.成交值),
    },
    {
      key: 'turnover',
      title: '成交排行',
      subtitle: isLive ? '成交值大戶用即時快照補價格與量能' : '盤後成交值前段班',
      metricLabel: '成交值',
      items: isLive ? liveTurnoverRanks.value : turnoverRanks.value,
      metricValue: (item) => formatAmount(item.成交值),
    },
  ];
});

const summaryCards = computed(() => [
  {
    title: '加權指數',
    value: formatNumber(marketSummary.value.加權指數),
    description: `漲跌 ${formatSignedNumber(marketSummary.value.漲跌點數)} / ${formatPercent(marketSummary.value.漲跌幅)}`,
    status:
      (marketSummary.value.漲跌點數 ?? 0) > 0 ? 'up' : (marketSummary.value.漲跌點數 ?? 0) < 0 ? 'down' : 'normal',
  },
  {
    title: '成交值',
    value: formatAmount(marketSummary.value.成交值),
    description: `成交量 ${formatLots(marketSummary.value.成交量)}`,
  },
  {
    title: '盤中更新',
    value: formatTime(intradayPulse.value.更新時間),
    description: `${liveStatus.value?.updatedAt ? '即時覆蓋' : '最近同步'}・累計成交值 ${formatAmount(intradayPulse.value.累計成交值)}`,
  },
  {
    title: '主動式 ETF',
    value: `${manifest.value?.connectedCount ?? 0} / ${manifest.value?.trackedEtfs?.length ?? 0}`,
    description: `最新揭露 ${formatDate(manifest.value?.latestDisclosureDate)}`,
  },
]);

const marketBreadthCards = computed(() => [
  {
    label: '上漲家數',
    value: formatNumber(marketBreadth.value?.股票市場?.上漲),
    statusClass: 'text-up',
  },
  {
    label: '下跌家數',
    value: formatNumber(marketBreadth.value?.股票市場?.下跌),
    statusClass: 'text-down',
  },
  {
    label: '漲停 / 跌停',
    value: `${formatNumber(marketBreadth.value?.股票市場?.漲停)} / ${formatNumber(marketBreadth.value?.股票市場?.跌停)}`,
    statusClass: '',
  },
  {
    label: '強弱比',
    value: formatNumber(marketBreadth.value?.強弱比),
    statusClass: '',
  },
]);

const filteredStocks = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();

  if (!keyword) {
    return stockList.value.slice(0, 8);
  }

  const sourceList = stockSearchList.value.length ? stockSearchList.value : stockList.value;

  return sourceList
    .filter((item) => [item.code, item.name].some((field) => String(field ?? '').toLowerCase().includes(keyword)))
    .slice(0, 8);
});

const canDirectLookup = computed(() => {
  const normalizedCode = searchQuery.value.trim();

  return isStockCode(normalizedCode) && !filteredStocks.value.some((item) => item.code === normalizedCode);
});

const favoriteStocks = computed(() =>
  favoriteCodes.value
    .map((code) => stockList.value.find((item) => item.code === code))
    .filter(Boolean)
    .map((item) => {
      const snapshot = getLiveSnapshot(item.code);
      const changePercent = snapshot?.changePercent ?? item.changePercent ?? 0;
      const momentumScore =
        Math.abs(changePercent) * 14 +
        Math.abs(item.return20 ?? 0) * 1.8 +
        (item.signalCount ?? 0) * 12 +
        ((item.total5Day ?? 0) > 0 ? 8 : 0);

      return {
        ...item,
        livePrice: snapshot?.lastPrice ?? item.close ?? null,
        changePercent: snapshot?.changePercent ?? item.changePercent ?? null,
        changeValue: snapshot?.change ?? item.change ?? null,
        volume: snapshot?.volumeShares ?? item.volume ?? null,
        liveUpdatedAt: snapshot?.updatedAt ?? null,
        displaySignalTitle: item.topSelectionSignalTitle ?? item.topSignalTitle ?? null,
        displaySignalTone: item.selectionSignalTone ?? item.topSignalTone ?? null,
        momentumScore,
      };
    })
    .sort((left, right) => (right.momentumScore ?? 0) - (left.momentumScore ?? 0))
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      heatWidth: `${Math.max(14, Math.min(100, item.momentumScore ?? 0))}%`,
    })),
);

const recentViewedStocks = computed(() =>
  recentItems.value
    .map((item) => {
      const stockMatch =
        stockList.value.find((candidate) => candidate.code === item.code) ??
        stockSearchList.value.find((candidate) => candidate.code === item.code);

      return {
        code: item.code,
        name: stockMatch?.name ?? item.name,
        industryName: stockMatch?.industryName ?? null,
        changePercent: getLiveSnapshot(item.code)?.changePercent ?? stockMatch?.changePercent ?? null,
        changeValue: getLiveSnapshot(item.code)?.change ?? stockMatch?.change ?? null,
        livePrice: getLiveSnapshot(item.code)?.lastPrice ?? stockMatch?.close ?? null,
        return20: stockMatch?.return20 ?? null,
        total5Day: stockMatch?.total5Day ?? null,
        topSignalTitle: stockMatch?.topSignalTitle ?? null,
        topSignalTone: stockMatch?.topSignalTone ?? null,
        displaySignalTitle: stockMatch?.topSelectionSignalTitle ?? stockMatch?.topSignalTitle ?? null,
        displaySignalTone: stockMatch?.selectionSignalTone ?? stockMatch?.topSignalTone ?? null,
        liveUpdatedAt: getLiveSnapshot(item.code)?.updatedAt ?? null,
        viewedAt: item.viewedAt,
      };
    })
    .filter((item) => item.code)
    .slice(0, 6),
);

const stockSelectionUniverse = computed(() => (stockSearchList.value.length ? stockSearchList.value : stockList.value));

function normalizeDateKey(value) {
  const text = String(value ?? '').trim().replaceAll('/', '-');

  if (!text) {
    return null;
  }

  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  if (/^\d{7}$/.test(text)) {
    return `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}-${text.slice(5, 7)}`;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function getReferenceDateKey() {
  return normalizeDateKey(liveMarketDate.value) ?? normalizeDateKey(manifest.value?.generatedAt?.slice(0, 10)) ?? new Date().toISOString().slice(0, 10);
}

function getDateOffset(referenceDateText, targetDateText) {
  const referenceDate = new Date(`${referenceDateText}T00:00:00+08:00`);
  const targetDate = new Date(`${targetDateText}T00:00:00+08:00`);

  if (Number.isNaN(referenceDate.getTime()) || Number.isNaN(targetDate.getTime())) {
    return null;
  }

  return Math.round((targetDate.getTime() - referenceDate.getTime()) / 86400000);
}

function getAlertPriority(item) {
  if (item.isUnderDisposition) return 3;
  if (item.hasChangedTrading) return 2;
  if (item.hasAttentionWarning) return 1;
  return 0;
}

function getAlertLabel(item) {
  if (item.isUnderDisposition) return '處置中';
  if (item.hasChangedTrading) return '變更交易';
  if (item.hasAttentionWarning) return '注意累計';
  return '觀察';
}

function getAlertTone(item) {
  if (item.isUnderDisposition) return 'risk';
  if (item.hasChangedTrading || item.hasAttentionWarning) return 'warning';
  return item.selectionSignalTone ?? 'info';
}

const officialRiskRadar = computed(() =>
  stockSelectionUniverse.value
    .filter((item) => item.isUnderDisposition || item.hasChangedTrading || item.hasAttentionWarning)
    .map((item) => ({
      ...item,
      alertLabel: getAlertLabel(item),
      alertTone: getAlertTone(item),
      priority: getAlertPriority(item),
    }))
    .sort((left, right) =>
      (right.priority ?? 0) - (left.priority ?? 0) ||
      (right.selectionSignalCount ?? 0) - (left.selectionSignalCount ?? 0) ||
      Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0) ||
      String(left.code).localeCompare(String(right.code)),
    )
    .slice(0, 8),
);

const upcomingDividendWatch = computed(() => {
  const referenceDate = getReferenceDateKey();

  return stockSelectionUniverse.value
    .map((item) => {
      const eventDate = normalizeDateKey(item.nextExDividendDate);
      const dayOffset = eventDate ? getDateOffset(referenceDate, eventDate) : null;

      return {
        ...item,
        nextEventDate: eventDate,
        dayOffset,
      };
    })
    .filter((item) => item.nextEventDate && item.dayOffset !== null && item.dayOffset >= 0 && item.dayOffset <= 21)
    .sort((left, right) =>
      (left.dayOffset ?? Infinity) - (right.dayOffset ?? Infinity) ||
      String(left.nextEventDate).localeCompare(String(right.nextEventDate)) ||
      String(left.code).localeCompare(String(right.code)),
    )
    .slice(0, 8);
});

const officialRadarSummary = computed(() => ({
  dispositions: stockSelectionUniverse.value.filter((item) => item.isUnderDisposition).length,
  changedTrading: stockSelectionUniverse.value.filter((item) => item.hasChangedTrading).length,
  attentionWarnings: stockSelectionUniverse.value.filter((item) => item.hasAttentionWarning).length,
}));

const closeFocusCards = computed(() => [
  {
    title: '熱門股',
    subtitle: liveStatus.value?.updatedAt ? '榜單採最近一次整理，盤中價格與量能即時更新' : '先看成交量與價差集中的股票',
    items: liveHotStocks.value.slice(0, 3).map((item) => ({
      code: item.代號,
      name: item.名稱,
      value: `${formatPercent(item.漲跌幅)} / ${formatLots(item.成交量)}`,
      tone: (item.漲跌幅 ?? 0) > 0 ? 'up' : (item.漲跌幅 ?? 0) < 0 ? 'down' : 'normal',
    })),
  },
  {
    title: 'ETF 異動',
    subtitle: '主動式 ETF 最新換股節奏',
    items: etfOverviewList.value
      .filter((item) => item.detailAvailability === 'full')
      .sort(
        (left, right) =>
          ((right.changeSummary?.totalChangeCount ?? 0) ||
            (right.changeSummary?.addedCount ?? 0) +
              (right.changeSummary?.removedCount ?? 0) +
              (right.changeSummary?.increasedCount ?? 0) +
              (right.changeSummary?.decreasedCount ?? 0)) -
          ((left.changeSummary?.totalChangeCount ?? 0) ||
            (left.changeSummary?.addedCount ?? 0) +
              (left.changeSummary?.removedCount ?? 0) +
              (left.changeSummary?.increasedCount ?? 0) +
              (left.changeSummary?.decreasedCount ?? 0)),
      )
      .slice(0, 3)
      .map((item) => ({
        code: item.code,
        name: item.name,
        value: item.changeSummary?.comparisonReady === false
          ? '首日建檔'
          : `變動 ${formatNumber(
              (item.changeSummary?.totalChangeCount ?? 0) ||
                (item.changeSummary?.addedCount ?? 0) +
                  (item.changeSummary?.removedCount ?? 0) +
                  (item.changeSummary?.increasedCount ?? 0) +
                  (item.changeSummary?.decreasedCount ?? 0),
            )} 檔`,
        tone:
          ((item.changeSummary?.totalChangeCount ?? 0) ||
            (item.changeSummary?.addedCount ?? 0) +
              (item.changeSummary?.removedCount ?? 0) +
              (item.changeSummary?.increasedCount ?? 0) +
              (item.changeSummary?.decreasedCount ?? 0)) > 0
            ? 'up'
            : 'normal',
      })),
  },
  {
    title: '法人連買',
    subtitle: '盤後先看資金連續流向',
    items: [
      ...(institutionalHighlights.value?.外資連買 ?? []).slice(0, 2).map((item) => ({
        code: item.代號,
        name: item.名稱,
        value: `外資連買 ${formatNumber(item.連買天數)} 天`,
        tone: 'up',
      })),
      ...(institutionalHighlights.value?.投信連買 ?? []).slice(0, 1).map((item) => ({
        code: item.代號,
        name: item.名稱,
        value: `投信連買 ${formatNumber(item.連買天數)} 天`,
        tone: 'up',
      })),
    ],
  },
]);

function openStockDetail(code) {
  if (!isStockCode(code)) return;
  router.push(createStockRoute(code));
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

</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(dashboard)"
      empty-message="首頁資料尚未整理完成。"
    />

    <template v-if="dashboard">
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

      <nav class="mobile-section-nav home-mobile-nav" aria-label="首頁快速導覽">
        <a class="mobile-section-link" href="#close-focus">盤後重點</a>
        <a class="mobile-section-link" href="#official-radar">官方提醒</a>
        <a class="mobile-section-link" href="#favorites">自選股</a>
        <a class="mobile-section-link" href="#stock-search">搜尋</a>
        <a class="mobile-section-link" href="#market-ranking">排行</a>
      </nav>

      <section id="close-focus" class="panel home-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">盤後重點卡</h2>
            <p class="panel-subtitle">把熱門股、ETF 異動與法人連買整合在一起，收盤後先看這一區。</p>
          </div>
        </div>

        <section class="triple-grid">
          <article
            v-for="card in closeFocusCards"
            :key="card.title"
            class="focus-card"
          >
            <div class="focus-card-head">
              <div>
                <h3>{{ card.title }}</h3>
                <p class="panel-subtitle">{{ card.subtitle }}</p>
              </div>
            </div>
            <div class="focus-card-list">
              <div
                v-for="item in card.items"
                :key="`${card.title}-${item.code}`"
                class="focus-card-item"
              >
                <div>
                  <strong>{{ item.code }} {{ item.name }}</strong>
                </div>
                <span :class="{ 'text-up': item.tone === 'up', 'text-down': item.tone === 'down' }">{{ item.value }}</span>
              </div>
            </div>
          </article>
        </section>
      </section>

      <section id="official-radar" class="panel home-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">官方交易雷達</h2>
            <p class="panel-subtitle">把處置、注意累計、變更交易與即將除息的股票先整理好，隔日選股時更快避開風險或提前排事件。</p>
          </div>
          <span class="meta-chip">資料日 {{ formatDate(liveMarketDate ?? manifest?.generatedAt?.slice(0, 10)) }}</span>
        </div>

        <section class="triple-grid">
          <article class="focus-card official-radar-card">
            <div class="focus-card-head">
              <div>
                <h3>盤後風險雷達</h3>
                <p class="panel-subtitle">先看真正會影響隔日下單節奏的官方提醒。</p>
              </div>
            </div>
            <div class="official-radar-summary">
              <span class="status-badge is-risk">處置 {{ formatNumber(officialRadarSummary.dispositions) }}</span>
              <span class="status-badge is-warning">變更交易 {{ formatNumber(officialRadarSummary.changedTrading) }}</span>
              <span class="status-badge is-info">注意累計 {{ formatNumber(officialRadarSummary.attentionWarnings) }}</span>
            </div>
            <div v-if="officialRiskRadar.length" class="focus-card-list">
              <div
                v-for="item in officialRiskRadar.slice(0, 4)"
                :key="`risk-${item.code}`"
                class="focus-card-item"
              >
                <div>
                  <strong>{{ item.code }} {{ item.name }}</strong>
                  <p class="muted">{{ item.topSelectionSignalTitle ?? '官方公告提醒' }}</p>
                </div>
                <span class="status-badge" :class="`is-${item.alertTone}`">{{ item.alertLabel }}</span>
              </div>
            </div>
            <p v-else class="muted">目前沒有新的處置、變更交易或注意累計提醒。</p>
          </article>

          <article class="focus-card official-radar-card">
            <div class="focus-card-head">
              <div>
                <h3>注意 / 處置排行</h3>
                <p class="panel-subtitle">先看風險優先級，再決定隔日要不要碰。</p>
              </div>
            </div>
            <div v-if="officialRiskRadar.length" class="focus-card-list">
              <button
                v-for="item in officialRiskRadar.slice(0, 5)"
                :key="`risk-rank-${item.code}`"
                type="button"
                class="focus-card-item official-radar-row"
                @click="openStockDetail(item.code)"
              >
                <div>
                  <strong>{{ item.code }} {{ item.name }}</strong>
                  <p class="muted">{{ item.topSelectionSignalTitle ?? '官方公告提醒' }}</p>
                </div>
                <div class="official-radar-side">
                  <span class="status-badge" :class="`is-${item.alertTone}`">{{ item.alertLabel }}</span>
                  <span :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                    {{ formatPercent(item.changePercent) }}
                  </span>
                </div>
              </button>
            </div>
            <p v-else class="muted">今天目前沒有需要優先避開的官方風險標的。</p>
          </article>

          <article class="focus-card official-radar-card">
            <div class="focus-card-head">
              <div>
                <h3>即將除息 / 事件接近</h3>
                <p class="panel-subtitle">先把股利事件排進研究節奏，避免隔日價位誤判。</p>
              </div>
            </div>
            <div v-if="upcomingDividendWatch.length" class="focus-card-list">
              <button
                v-for="item in upcomingDividendWatch.slice(0, 5)"
                :key="`dividend-${item.code}`"
                type="button"
                class="focus-card-item official-radar-row"
                @click="openStockDetail(item.code)"
              >
                <div>
                  <strong>{{ item.code }} {{ item.name }}</strong>
                  <p class="muted">{{ item.topSelectionSignalTitle ?? '股利事件接近' }}</p>
                </div>
                <div class="official-radar-side">
                  <span class="meta-chip">{{ formatDate(item.nextEventDate) }}</span>
                  <span class="status-badge is-info">{{ item.dayOffset === 0 ? '今天' : `${item.dayOffset} 天後` }}</span>
                </div>
              </button>
            </div>
            <p v-else class="muted">未來 21 天內沒有抓到新的除權息事件。</p>
          </article>
        </section>
      </section>

      <section id="favorites" class="panel home-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">自選股</h2>
            <p class="panel-subtitle">把常看的股票放在首頁，回來就能直接看重點。</p>
          </div>
          <button
            v-if="favoriteStocks.length"
            type="button"
            class="ghost-button"
            @click="clearFavorites"
          >
            清空自選
          </button>
        </div>

        <div v-if="favoriteStocks.length" class="favorites-grid">
          <article
            v-for="item in favoriteStocks"
            :key="`favorite-${item.code}`"
            class="favorite-card"
          >
            <div class="favorite-card-head">
              <div class="favorite-title-block">
                <span class="favorite-rank-badge">#{{ item.rank }}</span>
                <p class="ticker-code">{{ item.code }}</p>
                <RouterLink class="favorite-title" :to="createStockRoute(item.code)">{{ item.name }}</RouterLink>
              </div>
              <button type="button" class="favorite-toggle is-active" @click="toggleFavorite(item.code)">已追蹤</button>
            </div>
            <div class="favorite-heat-strip">
              <span
                class="favorite-heat-fill"
                :class="item.displaySignalTone ? `is-${item.displaySignalTone}` : ''"
                :style="{ width: item.heatWidth }"
              ></span>
            </div>
            <div class="favorite-trend-block">
              <div class="favorite-trend-meta">
                <strong :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
                  {{ formatPercent(item.return20) }}
                </strong>
                <span>{{ item.liveUpdatedAt ? `即時價 ${formatNumber(item.livePrice)}` : `自選熱度第 ${item.rank} 名` }}</span>
              </div>
            </div>
            <div class="favorite-metrics">
              <span>產業 {{ item.industryName ?? '未分類' }}</span>
              <span :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                日變動 {{ formatPercent(item.changePercent) }}
              </span>
              <span>20 日 {{ formatPercent(item.return20) }}</span>
              <span>法人五日 {{ formatLots(item.total5Day) }}</span>
              <span :class="['signal-pill', item.displaySignalTone ? `is-${item.displaySignalTone}` : '']">
                {{ item.displaySignalTitle ?? '技術面整理中' }}
              </span>
            </div>
          </article>
        </div>
        <div v-else class="empty-state">
          <strong>先建立你的觀察清單</strong>
          <p>在個股頁或搜尋結果按下「加入自選」，常看的股票就會固定顯示在這裡。</p>
        </div>
      </section>

      <section id="recent-viewed" class="panel home-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">最近瀏覽</h2>
            <p class="panel-subtitle">剛剛看過的股票會先留在這裡，方便回頭接著研究。</p>
          </div>
          <button
            v-if="recentViewedStocks.length"
            type="button"
            class="ghost-button"
            @click="clearRecentStocks"
          >
            清空最近瀏覽
          </button>
        </div>

        <div v-if="recentViewedStocks.length" class="recent-stocks-grid">
          <article
            v-for="item in recentViewedStocks"
            :key="`home-recent-${item.code}`"
            class="favorite-card recent-stock-card"
          >
            <div class="recent-stock-head">
              <div class="favorite-title-block">
                <p class="ticker-code">{{ item.code }}</p>
                <RouterLink class="favorite-title" :to="createStockRoute(item.code)">{{ item.name }}</RouterLink>
              </div>
              <span class="recent-stock-time">最後查看 {{ formatViewedAt(item.viewedAt) }}</span>
            </div>
            <div class="favorite-trend-block">
              <div class="favorite-trend-meta">
                <strong :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
                  {{ formatPercent(item.return20) }}
                </strong>
                <span>{{ item.liveUpdatedAt ? `即時價 ${formatNumber(item.livePrice)}` : (item.displaySignalTitle ?? '延續前次研究脈絡') }}</span>
              </div>
            </div>
            <div class="favorite-metrics">
              <span>產業 {{ item.industryName ?? '未分類' }}</span>
              <span :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                日變動 {{ formatPercent(item.changePercent) }}
              </span>
              <span>20 日 {{ formatPercent(item.return20) }}</span>
              <span>法人五日 {{ formatLots(item.total5Day) }}</span>
              <span :class="['signal-pill', item.displaySignalTone ? `is-${item.displaySignalTone}` : '']">
                {{ item.displaySignalTitle ?? '延續前次研究脈絡' }}
              </span>
            </div>
          </article>
        </div>
        <div v-else class="empty-state">
          <strong>最近瀏覽會出現在這裡</strong>
          <p>只要點進個股頁，我就會把最近研究過的股票整理成回訪入口。</p>
        </div>
      </section>

      <section id="stock-search" class="panel home-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">個股快速搜尋</h2>
            <p class="panel-subtitle">輸入代號或名稱，快速打開個股頁。</p>
          </div>
          <span class="meta-chip">已整理 {{ manifest?.stockDetailCount ?? 0 }} 檔</span>
        </div>
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="輸入代號或名稱，例如 2330、台積電"
        />
        <ul v-if="filteredStocks.length" class="stack-list search-result-list">
          <li v-for="item in filteredStocks" :key="item.code">
            <RouterLink class="code-link" :to="createStockRoute(item.code)">{{ item.code }}</RouterLink>
            <span>
              {{ item.name }}
              <span
                v-if="item.topSelectionSignalTitle || item.topSignalTitle"
                class="signal-pill inline-signal-chip"
                :class="(item.selectionSignalTone ?? item.topSignalTone) ? `is-${item.selectionSignalTone ?? item.topSignalTone}` : ''"
              >
                {{ item.topSelectionSignalTitle ?? item.topSignalTitle }}
              </span>
            </span>
            <span class="search-row-actions">
              <span class="muted">
                {{
                  item.hasLocalDetail === false
                    ? '即時補資料'
                    : item.isUnderDisposition
                      ? '處置中'
                      : item.hasChangedTrading
                        ? '變更交易'
                        : item.hasAttentionWarning
                          ? '注意累計'
                    : item.activeEtfCount
                      ? `${item.activeEtfCount} 檔 ETF 持有`
                      : '查看個股頁'
                }}
                <template v-if="item.return20 !== null && item.return20 !== undefined">・20 日 {{ formatPercent(item.return20) }}</template>
              </span>
              <button
                type="button"
                class="favorite-toggle"
                :class="{ 'is-active': isFavorite(item.code) }"
                @click="item.hasLocalDetail === false ? openStockDetail(item.code) : toggleFavorite(item.code)"
              >
                {{ item.hasLocalDetail === false ? '前往查看' : (isFavorite(item.code) ? '已追蹤' : '加入自選') }}
              </button>
            </span>
          </li>
        </ul>
        <button
          v-if="canDirectLookup"
          type="button"
          class="ghost-button"
          @click="openStockDetail(searchQuery.trim())"
        >
          直接查詢 {{ searchQuery.trim() }} 即時資料
        </button>
        <p v-else class="muted">找不到符合的個股，試試代號前幾碼、完整公司名稱，或直接輸入 4 碼代號查詢。</p>
      </section>

      <IntradayChart
        v-if="marketOverview?.盤中走勢"
        :data="marketOverview.盤中走勢"
        title="加權指數盤中分時圖"
      />

      <TechnicalChart
        v-if="marketOverview?.技術面資料"
        :data="marketOverview.技術面資料"
        title="加權指數盤勢圖表"
      />

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">大盤觀察</h2>
              <p class="panel-subtitle">{{ marketObservationSubtitle }}</p>
            </div>
          </div>
          <ul class="bullet-list">
            <li v-for="item in marketOverview?.觀察摘要 ?? []" :key="item">{{ item }}</li>
          </ul>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">市場廣度</h2>
              <p class="panel-subtitle">
                {{ marketBreadthIsLiveDay ? '集中市場漲跌家數與漲跌停統計' : '集中市場盤後統計，盤中先看指數與量價節奏' }}
              </p>
            </div>
            <span class="meta-chip">{{ marketBreadthBadge }}</span>
          </div>
          <div class="breadth-grid">
            <article
              v-for="item in marketBreadthCards"
              :key="item.label"
              class="breadth-stat-card"
            >
              <p class="comparison-stat-label">{{ item.label }}</p>
              <p class="comparison-stat-value" :class="item.statusClass">{{ item.value }}</p>
            </article>
          </div>
          <p class="muted">{{ marketBreadthHint }}</p>
        </article>
      </section>

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">盤中脈動</h2>
              <p class="panel-subtitle">盤中成交與委買賣節奏</p>
            </div>
          </div>
          <div class="metric-line">
            <span>累計委買張數</span>
            <strong>{{ formatAmount(intradayPulse.累計委買張數) }}</strong>
          </div>
          <div class="metric-line">
            <span>累計委賣張數</span>
            <strong>{{ formatAmount(intradayPulse.累計委賣張數) }}</strong>
          </div>
          <div class="metric-line">
            <span>累計成交張數</span>
            <strong>{{ formatAmount(intradayPulse.累計成交張數) }}</strong>
          </div>
          <div class="metric-line">
            <span>累計成交值</span>
            <strong>{{ formatAmount(intradayPulse.累計成交值) }}</strong>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">近五日大盤節奏</h2>
              <p class="panel-subtitle">成交值、指數與交易熱度</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table compact-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>指數</th>
                  <th>漲跌</th>
                  <th>成交值</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in marketOverview?.近五日節奏 ?? []" :key="item.日期">
                  <td>{{ formatDate(item.日期) }}</td>
                  <td>{{ formatNumber(item.指數) }}</td>
                  <td :class="{ 'text-up': (item.漲跌點數 ?? 0) > 0, 'text-down': (item.漲跌點數 ?? 0) < 0 }">
                    {{ formatSignedNumber(item.漲跌點數) }}
                  </td>
                  <td>{{ formatAmount(item.成交值) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">外資持股比前段班</h2>
              <p class="panel-subtitle">集中市場外資及陸資持股前 20 名</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table compact-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>持股比</th>
                  <th>尚可投資比</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in foreignOwnershipLeaders"
                  :key="item.代號"
                  :class="{ 'clickable-row': isStockCode(item.代號) }"
                  :tabindex="isStockCode(item.代號) ? 0 : undefined"
                  @click="openStockDetail(item.代號)"
                  @keydown.enter="openStockDetail(item.代號)"
                >
                  <td>
                    <RouterLink v-if="isStockCode(item.代號)" class="code-link" :to="createStockRoute(item.代號)">
                      {{ item.代號 }}
                    </RouterLink>
                    <span v-else>{{ item.代號 }}</span>
                  </td>
                  <td>{{ item.名稱 }}</td>
                  <td>{{ formatPercent(item.外資持股比) }}</td>
                  <td>{{ formatPercent(item.尚可投資比) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">外資類股布局</h2>
              <p class="panel-subtitle">外資持股比最高的產業群</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table compact-table">
              <thead>
                <tr>
                  <th>產業</th>
                  <th>上市檔數</th>
                  <th>持股比</th>
                  <th>外資持股數</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in foreignIndustryLeaders?.高比重類股 ?? []" :key="item.產業名稱">
                  <td>{{ item.產業名稱 }}</td>
                  <td>{{ formatNumber(item.上市檔數) }}</td>
                  <td>{{ formatPercent(item.外資持股比) }}</td>
                  <td>{{ formatLots(item.外資持股數) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section id="market-ranking" class="panel home-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">盤面排行</h2>
            <p class="panel-subtitle">
              {{ rankingView === 'live' ? '盤中即時看價格與量能變化，榜單基底仍沿用最近一次整理。' : '盤後用完整榜單回頭整理資金流向與強勢結構。' }}
            </p>
          </div>
          <div class="range-tabs">
            <button
              type="button"
              class="range-tab"
              :class="{ 'is-active': rankingView === 'live' }"
              @click="rankingView = 'live'"
            >
              盤中即時榜
            </button>
            <button
              type="button"
              class="range-tab"
              :class="{ 'is-active': rankingView === 'close' }"
              @click="rankingView = 'close'"
            >
              盤後整理榜
            </button>
          </div>
        </div>
        <section class="triple-grid">
          <article
            v-for="group in rankingGroups"
            :key="`${rankingView}-${group.key}`"
            class="sub-panel"
          >
            <div class="panel-header">
              <div>
                <h3 class="sub-panel-title">{{ group.title }}</h3>
                <p class="panel-subtitle">{{ group.subtitle }}</p>
              </div>
              <span class="meta-chip">
                {{ rankingLiveBadge }}
              </span>
            </div>
            <div class="table-wrap">
              <table class="data-table compact-table ranking-table">
                <thead>
                  <tr>
                    <th>代號</th>
                    <th>名稱</th>
                    <th>價格</th>
                    <th>漲跌幅</th>
                    <th>{{ group.metricLabel }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in group.items"
                    :key="`${group.key}-${item.代號}`"
                    class="clickable-row"
                    tabindex="0"
                    @click="openStockDetail(item.代號)"
                    @keydown.enter="openStockDetail(item.代號)"
                  >
                    <td><RouterLink class="code-link" :to="createStockRoute(item.代號)">{{ item.代號 }}</RouterLink></td>
                    <td><RouterLink class="code-link" :to="createStockRoute(item.代號)">{{ item.名稱 }}</RouterLink></td>
                    <td>{{ formatNumber(item.收盤價) }}</td>
                    <td :class="{ 'text-up': (item.漲跌幅 ?? 0) > 0, 'text-down': (item.漲跌幅 ?? 0) < 0 }">
                      {{ formatPercent(item.漲跌幅) }}
                    </td>
                    <td>{{ group.metricValue(item) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </section>

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">外資連買</h2>
              <p class="panel-subtitle">連續買超標的</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>連買天數</th>
                  <th>累計買超</th>
                  <th>觀察</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in institutionalHighlights?.外資連買 ?? []"
                  :key="item.代號"
                  class="clickable-row"
                  tabindex="0"
                  @click="openStockDetail(item.代號)"
                  @keydown.enter="openStockDetail(item.代號)"
                >
                  <td><RouterLink class="code-link" :to="createStockRoute(item.代號)">{{ item.代號 }}</RouterLink></td>
                  <td><RouterLink class="code-link" :to="createStockRoute(item.代號)">{{ item.名稱 }}</RouterLink></td>
                  <td>{{ item.連買天數 }}</td>
                  <td>{{ formatLots(item.累計買超股數) }}</td>
                  <td>{{ item.其他法人態度 }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">投信連買</h2>
              <p class="panel-subtitle">內資偏愛股</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>連買天數</th>
                  <th>累計買超</th>
                  <th>觀察</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in institutionalHighlights?.投信連買 ?? []"
                  :key="item.代號"
                  class="clickable-row"
                  tabindex="0"
                  @click="openStockDetail(item.代號)"
                  @keydown.enter="openStockDetail(item.代號)"
                >
                  <td><RouterLink class="code-link" :to="createStockRoute(item.代號)">{{ item.代號 }}</RouterLink></td>
                  <td><RouterLink class="code-link" :to="createStockRoute(item.代號)">{{ item.名稱 }}</RouterLink></td>
                  <td>{{ item.連買天數 }}</td>
                  <td>{{ formatLots(item.累計買超股數) }}</td>
                  <td>{{ item.其他法人態度 }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">土洋對作</h2>
            <p class="panel-subtitle">外資與投信站在不同邊</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>代號</th>
                <th>名稱</th>
                <th>外資</th>
                <th>投信</th>
                <th>結論</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in institutionalHighlights?.土洋對作 ?? []"
                :key="item.代號"
                class="clickable-row"
                tabindex="0"
                @click="openStockDetail(item.代號)"
                @keydown.enter="openStockDetail(item.代號)"
              >
                <td><RouterLink class="code-link" :to="createStockRoute(item.代號)">{{ item.代號 }}</RouterLink></td>
                <td><RouterLink class="code-link" :to="createStockRoute(item.代號)">{{ item.名稱 }}</RouterLink></td>
                <td :class="{ 'text-up': (item.外資買賣超 ?? 0) > 0, 'text-down': (item.外資買賣超 ?? 0) < 0 }">
                  {{ formatLots(item.外資買賣超) }}
                </td>
                <td :class="{ 'text-up': (item.投信買賣超 ?? 0) > 0, 'text-down': (item.投信買賣超 ?? 0) < 0 }">
                  {{ formatLots(item.投信買賣超) }}
                </td>
                <td>{{ item.結論 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">主動式 ETF 快覽</h2>
            <p class="panel-subtitle">已整理 {{ activeEtfOverview?.已串接檔數 ?? 0 }} 檔完整成分資料</p>
          </div>
          <RouterLink class="action-link" to="/etfs">查看全部 ETF</RouterLink>
        </div>
        <div class="tag-row">
          <span v-for="item in activeEtfOverview?.已串接ETF ?? []" :key="item.code" class="ticker-pill">
            <RouterLink :to="`/etfs/${item.code}`">{{ item.code }} {{ item.name }}</RouterLink>
          </span>
        </div>
      </section>
    </template>
  </section>
</template>
