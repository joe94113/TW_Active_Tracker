<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import {
  ArrowRightIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BookmarkIcon,
  CheckCircleIcon,
  EllipsisVerticalIcon,
  ExclamationTriangleIcon,
  StarIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { useTomorrowWatchCodes } from '../composables/useTomorrowWatchCodes';
import { fetchJson } from '../lib/api';
import { getDataFreshnessStatus } from '../lib/dataFreshness';
import { hasFiniteNumber, hasText, toFiniteNumber, uniqueBy } from '../lib/dataAvailability';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { buildTomorrowWatchlist } from '../lib/tomorrowWatchlist';
import { createStockCodeMap, mergeStockUniverse } from '../lib/stockUniverse';

const {
  manifest,
  dashboard,
  globalMarkets,
  stockList,
  stockSearchList,
  isLoading,
  errorMessage,
  loadGlobalData,
} = useGlobalData();
const { watchCodes, isWatched, removeWatch } = useTomorrowWatchCodes();

const replayHistory = ref(null);
const entryRadar = ref(null);
const isExtraLoading = ref(false);
const extraError = ref('');
const activeTab = ref('all');
const sortKey = ref('default');
const selectedCode = ref('');
const visibleCount = ref(6);
const dismissedCodes = ref(new Set());

const stockUniverse = computed(() => mergeStockUniverse(stockList.value, stockSearchList.value));
const stockMap = computed(() => createStockCodeMap(stockUniverse.value));
const generatedWatchlist = computed(() => buildTomorrowWatchlist({
  dashboard: dashboard.value,
  replayHistory: replayHistory.value,
  entryRadar: entryRadar.value,
  stockMap: stockMap.value,
}));

const generatedRows = computed(() => generatedWatchlist.value.sections.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    category: section.key,
    categoryLabel: section.title.replace('觀察', '').trim(),
  })),
));

const manualRows = computed(() => watchCodes.value.map((code) => {
  const item = stockMap.value.get(String(code));
  if (!item || !hasFiniteNumber(item.close)) return null;
  return {
    ...item,
    code: String(code),
    category: 'manual',
    categoryLabel: '自選加入',
    detail: item.topSignalTitle ? `目前訊號：${item.topSignalTitle}` : null,
  };
}).filter(Boolean));

const allRows = computed(() => uniqueBy([
  ...manualRows.value,
  ...generatedRows.value,
], (item) => String(item.code))
  .filter((item) => !dismissedCodes.value.has(String(item.code)))
  .filter((item) => hasText(String(item.code)) && hasText(item.name) && hasFiniteNumber(item.close)));

const tabs = computed(() => [
  { key: 'all', label: '全部', count: allRows.value.length },
  { key: 'stable', label: '穩健', count: allRows.value.filter((item) => item.category === 'stable').length },
  { key: 'aggressive', label: '積極', count: allRows.value.filter((item) => item.category === 'aggressive').length },
  { key: 'fresh', label: '剛轉強', count: allRows.value.filter((item) => item.category === 'fresh').length },
  { key: 'manual', label: '自選加入', count: allRows.value.filter((item) => item.category === 'manual').length },
].filter((item) => item.key === 'all' || item.count > 0));

const filteredRows = computed(() => {
  const rows = activeTab.value === 'all'
    ? [...allRows.value]
    : allRows.value.filter((item) => item.category === activeTab.value);
  if (sortKey.value === 'foreign') return rows.sort((a, b) => (b.foreign5Day ?? -Infinity) - (a.foreign5Day ?? -Infinity));
  if (sortKey.value === 'change') return rows.sort((a, b) => (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity));
  if (sortKey.value === 'risk') return rows.sort((a, b) => riskLevel(a) - riskLevel(b));
  return rows;
});
const visibleRows = computed(() => filteredRows.value.slice(0, visibleCount.value));
const selected = computed(() => allRows.value.find((item) => String(item.code) === selectedCode.value) ?? visibleRows.value[0] ?? null);

watch(visibleRows, (rows) => {
  if (!rows.some((item) => String(item.code) === selectedCode.value)) selectedCode.value = rows[0]?.code ?? '';
}, { immediate: true });
watch([activeTab, sortKey], () => { visibleCount.value = 6; });

const marketDate = computed(() => generatedWatchlist.value.marketDate
  ?? entryRadar.value?.marketDate
  ?? dashboard.value?.市場總覽?.資料日期
  ?? null);
const freshness = computed(() => getDataFreshnessStatus({
  generatedAt: dashboard.value?.generatedAt ?? manifest.value?.generatedAt,
  marketDate: marketDate.value,
}));
const pageTitle = computed(() => freshness.value.isStale ? '明日觀察名單：歷史回看' : '明日觀察名單');
const marketNote = computed(() => generatedWatchlist.value.observations?.[0]
  ?? (generatedWatchlist.value.topTheme ? `主線題材：${generatedWatchlist.value.topTheme}` : null));

const selectedTriggers = computed(() => getTriggers(selected.value));
const selectedNoChase = computed(() => getNoChase(selected.value));
const selectedStop = computed(() => getStop(selected.value));
const selectedReasons = computed(() => getReasons(selected.value));
const selectedRisk = computed(() => getRiskNote(selected.value));

const marketItemMap = computed(() => new Map(
  (globalMarkets.value?.sections ?? []).flatMap((section) => section.items ?? []).map((item) => [item.symbol, item]),
));
const latestForeignFlow = computed(() => [...(dashboard.value?.法人追蹤?.每日法人合計 ?? [])]
  .sort((a, b) => String(b.日期 ?? '').localeCompare(String(a.日期 ?? '')))[0] ?? null);
const morningChecklist = computed(() => {
  const twd = marketItemMap.value.get('USDTWD=X');
  const nasdaq = marketItemMap.value.get('^IXIC');
  const treasury = marketItemMap.value.get('^TNX');
  return [
    latestForeignFlow.value && hasFiniteNumber(latestForeignFlow.value.外資買賣超)
      ? { label: '外資買賣超', note: `最新 ${formatLots(latestForeignFlow.value.外資買賣超)}，開盤前再看是否延續。` }
      : null,
    twd && hasFiniteNumber(twd.changePercent)
      ? { label: '美元 / 台幣', note: `${formatNumber(twd.close)}，當日 ${formatPercent(twd.changePercent)}，留意台幣方向是否延續。` }
      : null,
    nasdaq && hasFiniteNumber(nasdaq.changePercent)
      ? { label: 'NASDAQ', note: `當日 ${formatPercent(nasdaq.changePercent)}，開盤前再確認電子股氣氛。` }
      : null,
    treasury && hasFiniteNumber(treasury.close)
      ? { label: '美國 10 年債', note: `${formatNumber(treasury.close)}%，留意成長股評價壓力。` }
      : null,
  ].filter(Boolean);
});

useSeoMeta({
  title: '明日觀察名單',
  description: '把卡位雷達、穩健型與積極型標的整理成可執行的隔日觀察清單。',
});

onMounted(async () => {
  await loadGlobalData();
  await loadWatchlistData();
});

watch(() => [manifest.value?.stockRadarHistoryPath, manifest.value?.entryRadarPath], loadWatchlistData);

async function loadWatchlistData() {
  const historyPath = manifest.value?.stockRadarHistoryPath;
  const entryPath = manifest.value?.entryRadarPath;
  if (!historyPath && !entryPath) return;
  isExtraLoading.value = true;
  extraError.value = '';
  try {
    const [historyData, entryData] = await Promise.all([
      historyPath ? fetchJson(historyPath) : Promise.resolve(null),
      entryPath ? fetchJson(entryPath) : Promise.resolve(null),
    ]);
    replayHistory.value = historyData;
    entryRadar.value = entryData;
  } catch (error) {
    extraError.value = error instanceof Error ? error.message : '明日觀察名單暫時無法載入。';
  } finally {
    isExtraLoading.value = false;
  }
}

function getTriggers(item) {
  if (!item) return [];
  return [
    hasFiniteNumber(item.ma20) ? `收盤站穩 MA20 ${formatNumber(item.ma20)}` : null,
    hasText(item.topSignalTitle) ? `「${item.topSignalTitle}」訊號繼續` : null,
    hasFiniteNumber(item.foreign5Day) && item.foreign5Day > 0 ? `外資近 5 日維持買超 ${formatLots(item.foreign5Day)}` : null,
  ].filter(Boolean).slice(0, 2);
}

function getStop(item) {
  if (!item) return null;
  if (hasFiniteNumber(item.ma20)) return `收盤跌破 MA20 ${formatNumber(item.ma20)} 且未站回`;
  if (hasFiniteNumber(item.ma60)) return `收盤跌破 MA60 ${formatNumber(item.ma60)} 且未站回`;
  return null;
}

function getNoChase(item) {
  if (!item) return null;
  if (hasFiniteNumber(item.return20) && item.return20 >= 30) return `近 20 日已上漲 ${formatPercent(item.return20)}，避免再追高。`;
  if (hasFiniteNumber(item.changePercent) && item.changePercent >= 7) return `當日已上漲 ${formatPercent(item.changePercent)}，隔日需先等量價穩定。`;
  return null;
}

function getReasons(item) {
  if (!item) return [];
  return [...new Set([
    item.detail,
    item.note,
    item.topSignalTitle,
    hasFiniteNumber(item.foreign5Day) ? `外資近 5 日 ${item.foreign5Day >= 0 ? '買超' : '賣超'} ${formatLots(Math.abs(item.foreign5Day))}` : null,
    hasFiniteNumber(item.investmentTrust5Day) ? `投信近 5 日 ${item.investmentTrust5Day >= 0 ? '買超' : '賣超'} ${formatLots(Math.abs(item.investmentTrust5Day))}` : null,
  ].filter(hasText))].slice(0, 3);
}

function getRiskNote(item) {
  if (!item) return null;
  const warning = item.warnings?.[0];
  if (hasText(warning)) return warning;
  if (hasText(warning?.note ?? warning?.title)) return warning.note ?? warning.title;
  if (item.isUnderDisposition) return '目前為處置相關標的，交易節奏與流動性風險較高。';
  if (hasFiniteNumber(item.return20) && item.return20 >= 35) return `近 20 日漲幅已達 ${formatPercent(item.return20)}，追價容錯率較低。`;
  return null;
}

function riskLevel(item) {
  if (item?.isUnderDisposition || item?.hasChangedTrading || (item?.warnings?.length ?? 0) >= 2) return 3;
  if (item?.hasAttentionWarning || item?.hasMarginSurge || (toFiniteNumber(item?.return20) ?? 0) >= 35) return 2;
  return 1;
}

function riskLabel(item) {
  const level = riskLevel(item);
  if (level === 3) return { label: '高', tone: 'risk' };
  if (level === 2) return { label: '中高', tone: 'warning' };
  return { label: '低', tone: 'safe' };
}

function dismiss(item) {
  if (!item) return;
  const next = new Set(dismissedCodes.value);
  next.add(String(item.code));
  dismissedCodes.value = next;
  if (isWatched(item.code)) removeWatch(item.code);
}
</script>

<template>
  <section class="investor-page tomorrow-redesign">
    <StatusCard
      :is-loading="isLoading || isExtraLoading"
      :error-message="extraError || errorMessage"
      :has-data="Boolean(allRows.length)"
      empty-message="目前還沒有可確認的觀察標的。"
    />

    <template v-if="!(isLoading || isExtraLoading || extraError || errorMessage) && allRows.length">
      <header class="tomorrow-heading">
        <div><h1>{{ pageTitle }}</h1><p>把今天找到的機會，整理成下一個交易日可執行的觀察清單。</p></div>
        <div class="tomorrow-summary ir-surface">
          <div><span>資料日</span><strong>{{ formatDate(marketDate) }}</strong></div>
          <div><span>觀察檔數</span><strong>{{ allRows.length }} 檔</strong></div>
          <div v-if="marketNote"><span>盤勢備註</span><strong>{{ marketNote }}</strong></div>
        </div>
        <RouterLink to="/entry-radar" class="ir-button"><BookmarkIcon />從卡位雷達加入</RouterLink>
      </header>

      <p v-if="freshness.isStale" class="ir-data-note is-warning">這份名單停在 {{ formatDate(marketDate) }}，現在只做歷史回看，不視為明日的新建議。</p>

      <div v-if="allRows.length" class="tomorrow-layout">
        <section class="ir-surface watchlist-workspace">
          <div class="watchlist-toolbar">
            <div class="ir-tabs">
              <button v-for="tab in tabs" :key="tab.key" type="button" class="ir-tab" :class="{ 'is-active': activeTab === tab.key }" @click="activeTab = tab.key">{{ tab.label }} {{ tab.count }}</button>
            </div>
            <label class="sort-field"><span>排序</span><select v-model="sortKey" class="ir-select"><option value="default">預設</option><option value="risk">低風險優先</option><option value="foreign">外資買超優先</option><option value="change">當日漲幅優先</option></select></label>
          </div>

          <div v-if="visibleRows.length" class="ir-table-wrap">
            <table class="ir-table tomorrow-table">
              <thead><tr><th>股票</th><th>類型</th><th class="is-number">收盤 / 漲跌</th><th>觀察理由</th><th>確認條件</th><th>失效條件</th><th class="is-center">風險</th><th class="is-center">操作</th></tr></thead>
              <tbody>
                <tr v-for="item in visibleRows" :key="item.code" :class="{ 'is-selected': selected?.code === item.code }" @click="selectedCode = item.code">
                  <td><RouterLink :to="`/stocks/${item.code}`"><strong class="ir-stock-code">{{ item.code }} {{ item.name }}</strong><span v-if="item.industryName" class="ir-stock-name">{{ item.industryName }}</span></RouterLink></td>
                  <td><span class="ir-status is-info">{{ item.categoryLabel }}</span></td>
                  <td class="is-number"><strong>{{ formatNumber(item.close) }}</strong><span v-if="hasFiniteNumber(item.changePercent)" class="ir-cell-note" :class="item.changePercent >= 0 ? 'ir-text-up' : 'ir-text-down'">{{ formatPercent(item.changePercent) }}</span></td>
                  <td><span v-if="getReasons(item)[0]">{{ getReasons(item)[0] }}</span></td>
                  <td><span v-if="getTriggers(item)[0]">{{ getTriggers(item)[0] }}</span></td>
                  <td><span v-if="getStop(item)">{{ getStop(item) }}</span></td>
                  <td class="is-center"><span class="ir-status" :class="`is-${riskLabel(item).tone}`">{{ riskLabel(item).label }}</span></td>
                  <td class="is-center"><button type="button" class="ir-row-action" title="移出本次名單" @click.stop="dismiss(item)"><EllipsisVerticalIcon /></button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="ir-empty"><strong>這個分類目前沒有可顯示的標的</strong><span>可切回全部或從卡位雷達加入。</span></div>

          <button v-if="filteredRows.length > visibleRows.length" type="button" class="ir-button load-more" @click="visibleCount += 6">顯示更多</button>
          <p class="ir-note watchlist-footnote">確認與失效條件只使用現有均線與技術訊號；無資料時不自行填價格。</p>
        </section>

        <aside class="tomorrow-side">
          <section v-if="selected" class="ir-surface ir-section selected-plan">
            <div class="selected-plan-head"><StarIcon /><div><h2>{{ selected.code }} {{ selected.name }}</h2><p>{{ selected.categoryLabel }} · 明日怎麼看</p></div><button type="button" class="ir-icon-button" title="移出名單" @click="dismiss(selected)"><TrashIcon /></button></div>

            <article v-if="selectedTriggers.length" class="plan-block is-positive"><ArrowTrendingUpIcon /><div><strong>出現這個情況再留意</strong><p v-for="item in selectedTriggers" :key="item">{{ item }}</p></div></article>
            <article v-if="selectedNoChase" class="plan-block is-warning"><ExclamationTriangleIcon /><div><strong>這個位置不要追</strong><p>{{ selectedNoChase }}</p></div></article>
            <article v-if="selectedStop" class="plan-block is-negative"><ArrowTrendingDownIcon /><div><strong>跌破這裡先放棄</strong><p>{{ selectedStop }}</p></div></article>

            <div v-if="selectedReasons.length" class="selected-copy"><strong>觀察理由</strong><p>{{ selectedReasons.join('；') }}</p></div>
            <div v-if="selectedRisk" class="selected-copy"><strong>主要風險</strong><p>{{ selectedRisk }}</p></div>
            <RouterLink :to="`/stocks/${selected.code}`" class="ir-button is-primary">查看個股<ArrowRightIcon /></RouterLink>
          </section>

          <section v-if="morningChecklist.length" class="ir-surface ir-section">
            <div class="ir-section-head"><h2>開盤前再確認</h2></div>
            <div class="ir-list">
              <div v-for="item in morningChecklist" :key="item.label" class="ir-list-row checklist-row"><CheckCircleIcon /><div><strong>{{ item.label }}</strong><p>{{ item.note }}</p></div></div>
            </div>
          </section>
        </aside>
      </div>

      <div v-else class="ir-empty ir-surface"><strong>目前沒有可確認的觀察標的</strong><span>可先到卡位雷達查看最新候選股。</span></div>
    </template>
  </section>
</template>

<style scoped>
.tomorrow-redesign { gap: 12px; }
.tomorrow-heading { display: grid; grid-template-columns: minmax(260px, .9fr) minmax(430px, 1.5fr) auto; align-items: center; gap: 16px; padding: 2px; }
.tomorrow-heading h1 { margin: 0; color: var(--ir-text); font-size: clamp(1.55rem, 2.1vw, 2rem); }.tomorrow-heading > div > p { margin: 5px 0 0; color: var(--ir-soft); font-size: .82rem; }
.tomorrow-summary { display: grid; grid-template-columns: .65fr .5fr minmax(220px, 1.2fr); min-height: 76px; }
.tomorrow-summary > div { display: grid; align-content: center; gap: 5px; padding: 12px 16px; border-right: 1px solid var(--ir-line); }.tomorrow-summary > div:last-child { border-right: 0; }.tomorrow-summary span { color: var(--ir-soft); font-size: .7rem; }.tomorrow-summary strong { color: var(--ir-text); font-size: .82rem; line-height: 1.35; }
.tomorrow-layout { display: grid; grid-template-columns: minmax(0, 1.75fr) minmax(320px, 1fr); gap: 12px; align-items: start; }
.watchlist-workspace { min-width: 0; overflow: hidden; }.watchlist-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 13px; border-bottom: 1px solid var(--ir-line); }.sort-field { display: grid; grid-template-columns: auto 150px; align-items: center; gap: 7px; color: var(--ir-soft); font-size: .72rem; }.sort-field .ir-select { min-height: 36px; }
.tomorrow-table { min-width: 1040px; }.tomorrow-table th:nth-child(1) { width: 150px; }.tomorrow-table th:nth-child(2) { width: 90px; }.tomorrow-table th:nth-child(3) { width: 112px; }.tomorrow-table th:nth-child(4), .tomorrow-table th:nth-child(5), .tomorrow-table th:nth-child(6) { width: 175px; }.tomorrow-table th:nth-child(7), .tomorrow-table th:nth-child(8) { width: 66px; }.tomorrow-table tbody tr { cursor: pointer; }.tomorrow-table td { line-height: 1.4; }
.load-more { margin: 12px auto; }.watchlist-footnote { padding: 0 13px 13px; }
.tomorrow-side { display: grid; gap: 12px; }.selected-plan { display: grid; gap: 10px; }.selected-plan-head { display: grid; grid-template-columns: 24px minmax(0, 1fr) 38px; align-items: center; gap: 9px; }.selected-plan-head > svg { width: 21px; color: var(--ir-brand); }.selected-plan-head h2 { margin: 0; color: var(--ir-text); font-size: 1.02rem; }.selected-plan-head p { margin: 3px 0 0; color: var(--ir-soft); font-size: .72rem; }
.plan-block { display: grid; grid-template-columns: 23px minmax(0, 1fr); gap: 10px; padding: 13px; border: 1px solid var(--ir-line); border-left: 3px solid var(--ir-brand); border-radius: 7px; background: var(--ir-surface-muted); }.plan-block > svg { width: 20px; }.plan-block strong { color: var(--ir-text); font-size: .8rem; }.plan-block p { margin: 5px 0 0; color: var(--ir-soft); font-size: .76rem; line-height: 1.45; }.plan-block.is-positive { border-left-color: #23b58a; }.plan-block.is-positive > svg { color: #23b58a; }.plan-block.is-warning { border-left-color: var(--large); }.plan-block.is-warning > svg { color: var(--large); }.plan-block.is-negative { border-left-color: #f06f5e; }.plan-block.is-negative > svg { color: #f06f5e; }
.selected-copy { padding-top: 9px; border-top: 1px solid var(--ir-line); }.selected-copy strong { color: var(--ir-text); font-size: .75rem; }.selected-copy p { margin: 4px 0 0; color: var(--ir-soft); font-size: .75rem; line-height: 1.5; }.checklist-row { grid-template-columns: 20px minmax(0, 1fr); }.checklist-row > svg { width: 18px; color: var(--ir-brand); }.checklist-row p { margin: 3px 0 0; color: var(--ir-soft); font-size: .72rem; line-height: 1.45; }

@media (max-width: 1180px) { .tomorrow-heading { grid-template-columns: 1fr auto; }.tomorrow-summary { grid-column: 1 / -1; grid-row: 2; }.tomorrow-layout { grid-template-columns: 1fr; }.tomorrow-side { grid-template-columns: 1fr 1fr; } }
@media (max-width: 760px) { .tomorrow-heading { grid-template-columns: 1fr; }.tomorrow-heading > .ir-button { width: 100%; }.tomorrow-summary { grid-column: auto; grid-row: auto; grid-template-columns: 1fr 1fr; }.tomorrow-summary > div:last-child { grid-column: 1 / -1; border-top: 1px solid var(--ir-line); }.watchlist-toolbar { align-items: stretch; flex-direction: column; }.sort-field { grid-template-columns: auto 1fr; }.tomorrow-side { grid-template-columns: 1fr; }.tomorrow-table { min-width: 0; }.tomorrow-table th:nth-child(1) { width: 42%; }.tomorrow-table th:nth-child(2) { width: 22%; }.tomorrow-table th:nth-child(3) { width: 24%; }.tomorrow-table th:nth-child(8) { width: 12%; }.tomorrow-table th:nth-child(4), .tomorrow-table td:nth-child(4), .tomorrow-table th:nth-child(5), .tomorrow-table td:nth-child(5), .tomorrow-table th:nth-child(6), .tomorrow-table td:nth-child(6), .tomorrow-table th:nth-child(7), .tomorrow-table td:nth-child(7) { display: none; }.tomorrow-table th, .tomorrow-table td { padding-inline: 7px; } }
@media (max-width: 460px) { .tomorrow-summary { grid-template-columns: 1fr; }.tomorrow-summary > div, .tomorrow-summary > div:last-child { grid-column: auto; border-right: 0; border-bottom: 1px solid var(--ir-line); }.tomorrow-summary > div:last-child { border-bottom: 0; }.selected-plan-head { grid-template-columns: 22px minmax(0, 1fr) 38px; } }
</style>
