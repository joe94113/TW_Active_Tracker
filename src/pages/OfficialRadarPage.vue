<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import InfoCard from '../components/InfoCard.vue';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { createStockRoute } from '../lib/stockRouting';
import { formatDate, formatNumber, formatPercent } from '../lib/formatters';

const { manifest, stockList, stockSearchList, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const stockUniverse = computed(() => (stockSearchList.value.length ? stockSearchList.value : stockList.value));

function normalizeDateKey(value) {
  const text = String(value ?? '').trim().replaceAll('/', '-');

  if (!text) return null;
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (/^\d{7}$/.test(text)) return `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}-${text.slice(5, 7)}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function getReferenceDateKey() {
  return normalizeDateKey(manifest.value?.generatedAt?.slice(0, 10)) ?? new Date().toISOString().slice(0, 10);
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
  if (item.hasAttentionWarning) return '注意股';
  return '觀察中';
}

function getAlertTone(item) {
  if (item.isUnderDisposition) return 'risk';
  if (item.hasChangedTrading || item.hasAttentionWarning) return 'warning';
  return item.selectionSignalTone ?? 'info';
}

const officialRiskRadar = computed(() =>
  stockUniverse.value
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
    ),
);

const upcomingDividendWatch = computed(() => {
  const referenceDate = getReferenceDateKey();

  return stockUniverse.value
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
    );
});

const radarSummaryCards = computed(() => [
  {
    title: '處置股票',
    value: formatNumber(stockUniverse.value.filter((item) => item.isUnderDisposition).length),
    description: '短線先避開追價，優先檢查撮合頻率與保證金調整。',
    status: 'risk',
  },
  {
    title: '變更交易',
    value: formatNumber(stockUniverse.value.filter((item) => item.hasChangedTrading).length),
    description: '代表交易方式異動，隔日操作前先看成交節奏是否受影響。',
    status: 'warning',
  },
  {
    title: '注意股',
    value: formatNumber(stockUniverse.value.filter((item) => item.hasAttentionWarning).length),
    description: '先確認是否只是短線爆量，別把注意股當成一定能追。',
    status: 'info',
  },
  {
    title: '21 日內除息',
    value: formatNumber(upcomingDividendWatch.value.length),
    description: '適合搭配殖利率、填息習性與籌碼一起看，不只看日期。',
    status: 'info',
  },
]);

const featuredRiskItems = computed(() => officialRiskRadar.value.slice(0, 12));
const highPriorityItems = computed(() => officialRiskRadar.value.filter((item) => item.priority >= 2).slice(0, 8));
const pageHasData = computed(() => Boolean(officialRiskRadar.value.length || upcomingDividendWatch.value.length));

const pageSeo = computed(() => ({
  title: '官方交易雷達',
  description: '把處置股、變更交易、注意股與即將除息事件集中整理，盤後先確認哪些股票需要避開、哪些事件值得提前觀察。',
  routePath: '/official-radar',
  keywords: ['官方交易雷達', '處置股', '注意股', '變更交易', '除息觀察'],
}));

useSeoMeta(pageSeo);

onMounted(() => {
  loadGlobalData();
});
</script>

<template>
  <div class="page-shell official-radar-page">
    <section class="panel official-radar-hero">
      <div>
        <p class="eyebrow">官方交易雷達</p>
        <h1 class="page-title">先看哪些股票要避開，再看哪些事件值得提前觀察</h1>
        <p class="page-subtitle">
          這頁把官方公告裡最容易影響隔日交易的資訊集中整理。先避開處置與交易異常，再回頭挑有機會的股票，會比只看漲幅安全很多。
        </p>
      </div>
      <div class="official-radar-hero-board">
        <span class="meta-chip">資料包 {{ formatDate(manifest?.generatedAt?.slice(0, 10)) }}</span>
        <span class="meta-chip is-soft">風險股 {{ formatNumber(officialRiskRadar.length) }} 檔</span>
        <span class="meta-chip is-soft">事件觀察 {{ formatNumber(upcomingDividendWatch.length) }} 檔</span>
      </div>
    </section>

    <StatusCard
      :loading="isLoading"
      :error-message="errorMessage"
      :has-data="pageHasData"
      empty-message="官方交易雷達資料尚未整理完成。"
    />

    <template v-if="pageHasData">
      <section class="card-grid compact-summary-grid official-radar-summary-grid">
        <InfoCard
          v-for="item in radarSummaryCards"
          :key="item.title"
          :title="item.title"
          :value="item.value"
          :description="item.description"
          :status="item.status"
        />
      </section>

      <section class="official-radar-layout">
        <div class="official-radar-main">
          <article class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">今天先避開的官方風險股</h2>
                <p class="panel-subtitle">依處置、變更交易、注意股的優先順序排序，先把不適合追價的名單看一遍。</p>
              </div>
              <span class="meta-chip">{{ formatNumber(featuredRiskItems.length) }} 檔</span>
            </div>

            <div v-if="featuredRiskItems.length" class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>股票</th>
                    <th>官方狀態</th>
                    <th>日變動</th>
                    <th>觀察重點</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in featuredRiskItems" :key="`risk-${item.code}`">
                    <td>
                      <RouterLink class="code-link" :to="createStockRoute(item.code)">{{ item.code }}</RouterLink>
                      <div class="muted">{{ item.name }}</div>
                    </td>
                    <td>
                      <span class="status-badge" :class="`is-${item.alertTone}`">{{ item.alertLabel }}</span>
                    </td>
                    <td :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                      {{ formatPercent(item.changePercent) }}
                    </td>
                    <td class="muted">{{ item.topSelectionSignalTitle ?? item.topSignalTitle ?? '先確認量能與撮合規則，再決定是否觀察。' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state">
              <strong>今天沒有明顯的官方風險股</strong>
              <p>代表這批官方公告沒有出現需要優先避開的名單，但還是要搭配量價與籌碼一起判斷。</p>
            </div>
          </article>

          <section class="dual-grid official-radar-secondary-grid">
            <article class="panel">
              <div class="panel-header">
                <div>
                  <h2 class="panel-title">高優先風險名單</h2>
                  <p class="panel-subtitle">只看處置與變更交易，這些通常比一般注意股更需要先避開。</p>
                </div>
              </div>
              <div v-if="highPriorityItems.length" class="focus-card-list">
                <RouterLink
                  v-for="item in highPriorityItems"
                  :key="`priority-${item.code}`"
                  :to="createStockRoute(item.code)"
                  class="focus-card-item is-clickable official-radar-row"
                >
                  <div>
                    <strong>{{ item.code }} {{ item.name }}</strong>
                    <p class="muted">{{ item.topSelectionSignalTitle ?? '優先確認隔日成交節奏與風險。' }}</p>
                  </div>
                  <div class="official-radar-side">
                    <span class="status-badge" :class="`is-${item.alertTone}`">{{ item.alertLabel }}</span>
                    <span :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                      {{ formatPercent(item.changePercent) }}
                    </span>
                  </div>
                </RouterLink>
              </div>
              <div v-else class="empty-state is-compact">
                <strong>今天沒有更高優先的異常交易名單</strong>
                <p>如果沒有處置或變更交易，代表這一塊相對單純，重點可以放回題材與技術面。</p>
              </div>
            </article>

            <article class="panel">
              <div class="panel-header">
                <div>
                  <h2 class="panel-title">21 日內事件觀察</h2>
                  <p class="panel-subtitle">把即將除息的股票先列出來，適合搭配殖利率、填息習性與法人籌碼一起看。</p>
                </div>
              </div>
              <div v-if="upcomingDividendWatch.length" class="focus-card-list">
                <RouterLink
                  v-for="item in upcomingDividendWatch.slice(0, 10)"
                  :key="`event-${item.code}`"
                  :to="createStockRoute(item.code)"
                  class="focus-card-item is-clickable official-radar-row"
                >
                  <div>
                    <strong>{{ item.code }} {{ item.name }}</strong>
                    <p class="muted">{{ item.topSelectionSignalTitle ?? '先確認殖利率與填息機率，再決定是否納入觀察。' }}</p>
                  </div>
                  <div class="official-radar-side">
                    <span class="meta-chip">{{ formatDate(item.nextEventDate) }}</span>
                    <span class="status-badge is-info">{{ item.dayOffset === 0 ? '今天' : `${item.dayOffset} 天後` }}</span>
                  </div>
                </RouterLink>
              </div>
              <div v-else class="empty-state is-compact">
                <strong>接下來 21 天沒有明顯事件要先看</strong>
                <p>如果沒有近期事件，代表可以把注意力放回題材輪動、起漲卡位和法人連買名單。</p>
              </div>
            </article>
          </section>
        </div>

        <aside class="panel official-radar-sidebar">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">怎麼用這頁</h2>
              <p class="panel-subtitle">先排除風險，再安排觀察，研究順序會更清楚。</p>
            </div>
          </div>
          <ol class="structured-list official-radar-guide-list">
            <li>先看處置與變更交易，這類股票通常不適合隔天直接追價。</li>
            <li>再看注意股，確認它是單純爆量，還是真的開始失控。</li>
            <li>最後看除息事件，挑有殖利率支撐、又沒有過熱的股票放進觀察清單。</li>
          </ol>
          <div class="official-radar-tip">
            <strong>判讀重點</strong>
            <p>官方提醒比較像避雷和排程工具，不是買進訊號。真正要不要買，還是要回到技術面、籌碼面和題材面一起確認。</p>
          </div>
        </aside>
      </section>
    </template>
  </div>
</template>
