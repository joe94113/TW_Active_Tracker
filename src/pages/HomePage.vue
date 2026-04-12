<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import { useFavoriteStocks } from '../composables/useFavoriteStocks';
import { useRecentStocks } from '../composables/useRecentStocks';
import StatusCard from '../components/StatusCard.vue';
import InfoCard from '../components/InfoCard.vue';
import IntradayChart from '../components/IntradayChart.vue';
import MiniTrendChart from '../components/MiniTrendChart.vue';
import TechnicalChart from '../components/TechnicalChart.vue';
import { createStockRoute, isStockCode } from '../lib/stockRouting';
import {
  formatAmount,
  formatDate,
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

onMounted(() => {
  loadGlobalData();
});

const marketOverview = computed(() => dashboard.value?.市場總覽 ?? null);
const institutionalHighlights = computed(() => dashboard.value?.法人追蹤 ?? null);
const futuresPositioning = computed(() => dashboard.value?.期貨籌碼 ?? null);
const activeEtfOverview = computed(() => dashboard.value?.主動ETF總覽 ?? null);
const marketSummary = computed(() => marketOverview.value?.大盤摘要 ?? {});
const intradayPulse = computed(() => marketOverview.value?.盤中脈動 ?? {});
const marketBreadth = computed(() => marketOverview.value?.市場廣度 ?? null);
const foreignOwnershipLeaders = computed(() => marketOverview.value?.外資持股焦點 ?? []);
const foreignIndustryLeaders = computed(() => marketOverview.value?.外資類股焦點 ?? null);
const hotStocks = computed(() => marketOverview.value?.熱門股 ?? []);

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
    description: `成交量 ${formatAmount(marketSummary.value.成交量)}`,
  },
  {
    title: '盤中更新',
    value: formatTime(intradayPulse.value.更新時間),
    description: `累計成交值 ${formatAmount(intradayPulse.value.累計成交值)}`,
  },
  {
    title: '主動式 ETF',
    value: `${manifest.value?.connectedCount ?? 0} / ${manifest.value?.trackedEtfs?.length ?? 0}`,
    description: `最新揭露 ${formatDate(manifest.value?.latestDisclosureDate)}`,
  },
]);

const heroPills = computed(() => [
  `市場情緒 ${marketBreadth.value?.市場情緒 ?? '整理中'}`,
  `追蹤個股 ${formatNumber(manifest.value?.stockDetailCount)}`,
  `熱門股 ${formatNumber(marketOverview.value?.熱門股?.length)}`,
  `ETF 風向球 ${formatNumber(activeEtfOverview.value?.已串接檔數)}`,
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
      const momentumScore =
        Math.abs(item.changePercent ?? 0) * 14 +
        Math.abs(item.return20 ?? 0) * 1.8 +
        (item.signalCount ?? 0) * 12 +
        ((item.total5Day ?? 0) > 0 ? 8 : 0);

      return {
        ...item,
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
        changePercent: stockMatch?.changePercent ?? null,
        return20: stockMatch?.return20 ?? null,
        total5Day: stockMatch?.total5Day ?? null,
        topSignalTitle: stockMatch?.topSignalTitle ?? null,
        topSignalTone: stockMatch?.topSignalTone ?? null,
        sparkline20: stockMatch?.sparkline20 ?? [],
        viewedAt: item.viewedAt,
      };
    })
    .filter((item) => item.code)
    .slice(0, 6),
);

const closeFocusCards = computed(() => [
  {
    title: '熱門股',
    subtitle: '先看成交量與價差集中的股票',
    items: hotStocks.value.slice(0, 3).map((item) => ({
      code: item.代號,
      name: item.名稱,
      value: `${formatPercent(item.漲跌幅)} / ${formatAmount(item.成交量)}`,
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

function getInstitutionalFlow(contract, identity) {
  return contract?.法人資料?.find((item) => item.身份別 === identity) ?? null;
}
</script>

<template>
  <section class="page-shell">
    <div class="page-hero">
      <div>
        <p class="page-text">
          先看大盤節奏，再看市場廣度、外資重倉與熱門股，最後一路點進個股頁，把技術面、籌碼面與財務面串成同一條研究路徑。
        </p>
        <div class="hero-feature-row">
          <span v-for="item in heroPills" :key="item" class="hero-feature-pill">{{ item }}</span>
        </div>
      </div>
    </div>

    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(dashboard)"
      empty-message="首頁資料尚未整理完成。"
    />

    <template v-if="dashboard">
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

      <section class="panel">
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

      <section class="panel">
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
                :class="item.topSignalTone ? `is-${item.topSignalTone}` : ''"
                :style="{ width: item.heatWidth }"
              ></span>
            </div>
            <div class="favorite-trend-block">
              <MiniTrendChart :values="item.sparkline20" :tone="item.topSignalTone ?? ((item.changePercent ?? 0) > 0 ? 'up' : (item.changePercent ?? 0) < 0 ? 'down' : 'normal')" />
              <div class="favorite-trend-meta">
                <strong :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
                  {{ formatPercent(item.return20) }}
                </strong>
                <span>自選熱度第 {{ item.rank }} 名</span>
              </div>
            </div>
            <div class="favorite-metrics">
              <span>產業 {{ item.industryName ?? '未分類' }}</span>
              <span :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                日變動 {{ formatPercent(item.changePercent) }}
              </span>
              <span>20 日 {{ formatPercent(item.return20) }}</span>
              <span>法人五日 {{ formatAmount(item.total5Day) }}</span>
              <span :class="['signal-pill', item.topSignalTone ? `is-${item.topSignalTone}` : '']">
                {{ item.topSignalTitle ?? '技術面整理中' }}
              </span>
            </div>
          </article>
        </div>
        <div v-else class="empty-state">
          <strong>先建立你的觀察清單</strong>
          <p>在個股頁或搜尋結果按下「加入自選」，常看的股票就會固定顯示在這裡。</p>
        </div>
      </section>

      <section class="panel">
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
              <MiniTrendChart
                :values="item.sparkline20"
                :tone="item.topSignalTone ?? ((item.changePercent ?? 0) > 0 ? 'up' : (item.changePercent ?? 0) < 0 ? 'down' : 'normal')"
              />
              <div class="favorite-trend-meta">
                <strong :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
                  {{ formatPercent(item.return20) }}
                </strong>
                <span>{{ item.topSignalTitle ?? '延續前次研究脈絡' }}</span>
              </div>
            </div>
            <div class="favorite-metrics">
              <span>產業 {{ item.industryName ?? '未分類' }}</span>
              <span :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                日變動 {{ formatPercent(item.changePercent) }}
              </span>
              <span>20 日 {{ formatPercent(item.return20) }}</span>
              <span>法人五日 {{ formatAmount(item.total5Day) }}</span>
            </div>
          </article>
        </div>
        <div v-else class="empty-state">
          <strong>最近瀏覽會出現在這裡</strong>
          <p>只要點進個股頁，我就會把最近研究過的股票整理成回訪入口。</p>
        </div>
      </section>

      <section class="panel">
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
              <small v-if="item.topSignalTitle" class="inline-signal-text" :class="{ 'text-up': item.topSignalTone === 'up', 'text-down': item.topSignalTone === 'down' }">
                {{ item.topSignalTitle }}
              </small>
            </span>
            <span class="search-row-actions">
              <span class="muted">
                {{
                  item.hasLocalDetail === false
                    ? '即時補資料'
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
              <p class="panel-subtitle">資料日期 {{ formatDate(marketOverview?.資料日期) }}</p>
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
              <p class="panel-subtitle">集中市場漲跌家數與漲跌停統計</p>
            </div>
            <span class="meta-chip">{{ marketBreadth?.市場情緒 ?? '尚無資料' }}</span>
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
          <p class="muted">當上漲家數明顯多於下跌家數時，代表盤勢不是只靠少數權值股撐住。</p>
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
                  <td>{{ formatAmount(item.外資持股數) }}</td>
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
              <h2 class="panel-title">熱門股</h2>
              <p class="panel-subtitle">當日成交人氣前段班</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>收盤價</th>
                  <th>漲跌幅</th>
                  <th>成交量</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in marketOverview?.熱門股 ?? []"
                  :key="item.代號"
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
                  <td>{{ formatAmount(item.成交量) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">強勢股</h2>
              <p class="panel-subtitle">量價一起轉強的上市股</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>收盤價</th>
                  <th>漲跌幅</th>
                  <th>成交值</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in marketOverview?.強勢股 ?? []"
                  :key="item.代號"
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
                  <td>{{ formatAmount(item.累計買超股數) }}</td>
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
                  <td>{{ formatAmount(item.累計買超股數) }}</td>
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
                  {{ formatAmount(item.外資買賣超) }}
                </td>
                <td :class="{ 'text-up': (item.投信買賣超 ?? 0) > 0, 'text-down': (item.投信買賣超 ?? 0) < 0 }">
                  {{ formatAmount(item.投信買賣超) }}
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
            <h2 class="panel-title">小台與微台籌碼面</h2>
            <p class="panel-subtitle">資料日期 {{ formatDate(futuresPositioning?.資料日期) }}</p>
          </div>
        </div>
        <div class="futures-grid">
          <article v-for="contract in futuresPositioning?.契約列表 ?? []" :key="contract.商品代碼" class="sub-panel">
            <div class="futures-card-head">
              <div>
                <h3>{{ contract.契約名稱 }}</h3>
                <p class="panel-subtitle">方向 {{ contract.方向 }}</p>
              </div>
              <span class="meta-chip">{{ contract.行情代碼 }}</span>
            </div>
            <div class="metric-line">
              <span>外資未平倉淨口數</span>
              <strong :class="{ 'text-up': (getInstitutionalFlow(contract, '外資')?.未平倉淨口數 ?? 0) > 0, 'text-down': (getInstitutionalFlow(contract, '外資')?.未平倉淨口數 ?? 0) < 0 }">
                {{ formatAmount(getInstitutionalFlow(contract, '外資')?.未平倉淨口數) }}
              </strong>
            </div>
            <div class="metric-line">
              <span>自營商未平倉淨口數</span>
              <strong :class="{ 'text-up': (getInstitutionalFlow(contract, '自營商')?.未平倉淨口數 ?? 0) > 0, 'text-down': (getInstitutionalFlow(contract, '自營商')?.未平倉淨口數 ?? 0) < 0 }">
                {{ formatAmount(getInstitutionalFlow(contract, '自營商')?.未平倉淨口數) }}
              </strong>
            </div>
            <ul class="bullet-list compact">
              <li v-for="item in contract.觀察建議 ?? []" :key="item">{{ item }}</li>
            </ul>
          </article>
        </div>
      </section>

      <TechnicalChart
        v-for="contract in futuresPositioning?.契約列表 ?? []"
        :key="`${contract.商品代碼}-chart`"
        :data="contract.技術面資料"
        :title="`${contract.契約名稱}走勢圖表`"
      />

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
