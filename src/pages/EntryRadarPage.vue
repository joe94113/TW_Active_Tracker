<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import {
  ArrowRightIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  StarIcon,
} from '@heroicons/vue/24/outline';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { useTomorrowWatchCodes } from '../composables/useTomorrowWatchCodes';
import { fetchJson } from '../lib/api';
import { hasFiniteNumber, hasText, uniqueBy } from '../lib/dataAvailability';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';
import { createStockRoute } from '../lib/stockRouting';

const { manifest, isLoading: isGlobalLoading, errorMessage: globalError, loadGlobalData } = useGlobalData();
const { isWatched, toggleWatch } = useTomorrowWatchCodes();
const entryRadar = ref(null);
const isEntryLoading = ref(false);
const entryError = ref('');
const activeCategory = ref('all');
const activeSort = ref('score');
const selectedCode = ref('');

const categoryDefinitions = [
  { key: 'all', label: '全部' },
  { key: 'institutionalTurns', label: '法人先買' },
  { key: 'freshStarters', label: '量價轉強' },
  { key: 'nearBreakouts', label: '整理待突破' },
  { key: 'catchUpCandidates', label: '低檔回升' },
  { key: 'themeIgnition', label: '題材升溫' },
];

const allItems = computed(() => uniqueBy(
  Object.values(entryRadar.value?.sections ?? {}).flatMap((items) => Array.isArray(items) ? items : []),
  (item) => item.code,
));

const categories = computed(() => categoryDefinitions
  .map((category) => ({
    ...category,
    count: category.key === 'all'
      ? allItems.value.length
      : (entryRadar.value?.sections?.[category.key] ?? []).length,
  }))
  .filter((category) => category.key === 'all' || category.count > 0));

const categoryItems = computed(() => {
  const source = activeCategory.value === 'all'
    ? allItems.value
    : uniqueBy(entryRadar.value?.sections?.[activeCategory.value] ?? [], (item) => item.code);

  return [...source].sort((left, right) => {
    if (activeSort.value === 'foreign') return (right.foreign5Day ?? -Infinity) - (left.foreign5Day ?? -Infinity);
    if (activeSort.value === 'risk') return riskScore(left) - riskScore(right);
    return (right.score ?? right.healthScore ?? 0) - (left.score ?? left.healthScore ?? 0);
  });
});

const displayedItems = computed(() => categoryItems.value.slice(0, 7));
const topOpportunities = computed(() => [...allItems.value]
  .sort((left, right) => (right.score ?? right.healthScore ?? 0) - (left.score ?? left.healthScore ?? 0))
  .slice(0, 3));
const selectedItem = computed(() =>
  categoryItems.value.find((item) => item.code === selectedCode.value) ?? displayedItems.value[0] ?? topOpportunities.value[0] ?? null,
);
const hasData = computed(() => Boolean(entryRadar.value && allItems.value.length));
const effectiveError = computed(() => entryError.value || globalError.value);

const selectedReasons = computed(() => {
  const item = selectedItem.value;
  if (!item) return [];
  return [
    hasText(item.note) ? item.note : null,
    (item.foreign5Day ?? 0) > 0 ? `外資近 5 日買超 ${formatLots(item.foreign5Day)}` : null,
    (item.investmentTrust5Day ?? 0) > 0 ? `投信近 5 日買超 ${formatLots(item.investmentTrust5Day)}` : null,
    ...(item.metrics ?? []).map((metric) => `${metric.label} ${metric.value}`).filter(hasText),
    ...(item.tags ?? []).filter(hasText),
  ].filter(Boolean).slice(0, 3);
});

const selectedWarning = computed(() => {
  const item = selectedItem.value;
  if (!item) return null;
  if (hasText(item.topWarningTitle)) return item.topWarningTitle;
  if ((item.return20 ?? 0) > 25) return `近 20 日已上漲 ${formatPercent(item.return20)}，留意追高風險。`;
  return null;
});

watch(
  () => displayedItems.value.map((item) => item.code).join(','),
  () => {
    if (!displayedItems.value.some((item) => item.code === selectedCode.value)) {
      selectedCode.value = displayedItems.value[0]?.code ?? '';
    }
  },
  { immediate: true },
);

watch(
  () => manifest.value?.entryRadarPath,
  () => loadEntryRadar(),
);

useSeoMeta(computed(() => ({
  title: '卡位雷達',
  description: '找出可能提早轉強、值得先觀察的台股，並查看入選理由與風險。',
  routePath: '/entry-radar',
  keywords: ['卡位雷達', '法人先買', '量價轉強', '整理待突破', '台股觀察'],
})));

onMounted(async () => {
  await loadGlobalData();
  await loadEntryRadar();
});

async function loadEntryRadar() {
  const path = manifest.value?.entryRadarPath;
  if (!path) {
    entryRadar.value = null;
    return;
  }

  isEntryLoading.value = true;
  entryError.value = '';
  try {
    entryRadar.value = await fetchJson(path);
  } catch (error) {
    entryRadar.value = null;
    entryError.value = error instanceof Error ? error.message : '卡位雷達載入失敗';
  } finally {
    isEntryLoading.value = false;
  }
}

function riskScore(item) {
  return (item?.warningCount ?? 0) * 30 + Math.max(0, 60 - (item?.healthScore ?? 60));
}

function riskLabel(item) {
  const score = riskScore(item);
  if (score >= 60) return { label: '高', tone: 'risk' };
  if (score >= 25) return { label: '中', tone: 'warning' };
  return { label: '低', tone: 'safe' };
}

function signalLabel(item) {
  return item?.topSignalTitle ?? item?.label ?? item?.tags?.[0] ?? null;
}
</script>

<template>
  <section class="page-shell investor-page entry-redesign-page">
    <StatusCard
      :is-loading="isGlobalLoading || isEntryLoading"
      :error-message="effectiveError"
      :has-data="hasData"
      empty-message="目前沒有可用的卡位雷達資料。"
    />

    <template v-if="hasData">
      <header class="ir-page-heading">
        <div>
          <h1>卡位雷達</h1>
          <p>找出可能提早轉強、值得先觀察的股票。</p>
        </div>
        <span class="ir-badge">資料日 {{ formatDate(entryRadar.marketDate) }}</span>
      </header>

      <section v-if="topOpportunities.length" class="ir-surface ir-section entry-top-section">
        <div class="ir-section-head">
          <div>
            <h2>今日 {{ formatNumber(topOpportunities.length, 0) }} 個機會</h2>
            <p>先看目前資料中訊號最集中的股票。</p>
          </div>
        </div>
        <div class="entry-top-list">
          <button
            v-for="(item, index) in topOpportunities"
            :key="`top-${item.code}`"
            type="button"
            class="entry-top-row"
            :class="{ 'is-selected': selectedItem?.code === item.code }"
            @click="selectedCode = item.code"
          >
            <span class="ir-rank is-top">{{ index + 1 }}</span>
            <span class="entry-top-stock"><strong>{{ item.code }} {{ item.name }}</strong><small>{{ item.industryName || item.themeTitle }}</small></span>
            <span v-if="hasFiniteNumber(item.close)" class="ir-number entry-top-price">{{ formatNumber(item.close) }}</span>
            <span
              v-if="hasFiniteNumber(item.changePercent)"
              class="entry-top-change"
              :class="item.changePercent > 0 ? 'ir-text-up' : item.changePercent < 0 ? 'ir-text-down' : ''"
            >
              <ArrowTrendingUpIcon v-if="item.changePercent > 0" />
              <ArrowTrendingDownIcon v-else-if="item.changePercent < 0" />
              {{ formatPercent(Math.abs(item.changePercent)) }}
            </span>
            <span class="entry-top-reason">{{ item.note || signalLabel(item) }}</span>
            <span class="ir-status" :class="`is-${riskLabel(item).tone}`">風險 {{ riskLabel(item).label }}</span>
          </button>
        </div>
      </section>

      <section class="entry-controls">
        <div class="ir-tabs" role="tablist" aria-label="卡位雷達分類">
          <button
            v-for="category in categories"
            :key="category.key"
            type="button"
            class="ir-tab"
            :class="{ 'is-active': activeCategory === category.key }"
            @click="activeCategory = category.key"
          >
            {{ category.label }} {{ category.count }}
          </button>
        </div>
        <label class="entry-sort">
          <span>排序</span>
          <select v-model="activeSort" class="ir-select">
            <option value="score">綜合優先</option>
            <option value="foreign">法人買超</option>
            <option value="risk">風險較低</option>
          </select>
        </label>
      </section>

      <section class="entry-workspace">
        <div class="ir-surface entry-table-panel">
          <div v-if="displayedItems.length" class="ir-table-wrap">
            <table class="ir-table entry-table">
              <thead>
                <tr>
                  <th class="is-center">排名</th>
                  <th>股票</th>
                  <th class="is-number">今日漲跌</th>
                  <th class="is-number">外資 5 日</th>
                  <th class="is-number">成交量</th>
                  <th>轉強訊號</th>
                  <th class="is-center">風險</th>
                  <th class="is-center">追蹤</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in displayedItems"
                  :key="item.code"
                  :class="{ 'is-selected': selectedItem?.code === item.code }"
                  tabindex="0"
                  @click="selectedCode = item.code"
                  @keydown.enter="selectedCode = item.code"
                >
                  <td class="is-center"><span class="ir-rank" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</span></td>
                  <td>
                    <RouterLink :to="createStockRoute(item.code)" @click.stop>
                      <span class="ir-stock-code">{{ item.code }} {{ item.name }}</span>
                      <span v-if="item.industryName || item.themeTitle" class="ir-stock-name">{{ item.industryName || item.themeTitle }}</span>
                    </RouterLink>
                  </td>
                  <td class="is-number">
                    <span
                      v-if="hasFiniteNumber(item.changePercent)"
                      class="entry-table-change"
                      :class="item.changePercent > 0 ? 'ir-text-up' : item.changePercent < 0 ? 'ir-text-down' : ''"
                    >
                      <ArrowTrendingUpIcon v-if="item.changePercent > 0" />
                      <ArrowTrendingDownIcon v-else-if="item.changePercent < 0" />
                      {{ formatPercent(Math.abs(item.changePercent)) }}
                    </span>
                  </td>
                  <td class="is-number"><span v-if="hasFiniteNumber(item.foreign5Day)">{{ formatLots(item.foreign5Day) }}</span></td>
                  <td class="is-number"><span v-if="hasFiniteNumber(item.volume)">{{ formatLots(item.volume) }}</span></td>
                  <td><span v-if="signalLabel(item)">{{ signalLabel(item) }}</span></td>
                  <td class="is-center"><span class="ir-status" :class="`is-${riskLabel(item).tone}`">{{ riskLabel(item).label }}</span></td>
                  <td class="is-center">
                    <button
                      type="button"
                      class="ir-row-action"
                      :class="{ 'is-active': isWatched(item.code) }"
                      :aria-label="isWatched(item.code) ? `從明日觀察移除 ${item.name}` : `加入明日觀察 ${item.name}`"
                      @click.stop="toggleWatch(item.code)"
                    >
                      <StarIcon />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="ir-empty">
            <strong>這個分類目前沒有資料</strong>
            <span>可切換其他分類查看。</span>
          </div>
        </div>

        <aside class="ir-surface ir-section entry-detail-panel">
          <template v-if="selectedItem">
            <div class="entry-detail-heading">
              <div>
                <h2>{{ selectedItem.code }} {{ selectedItem.name }}</h2>
                <p>為什麼值得先看</p>
              </div>
              <button
                type="button"
                class="ir-icon-button"
                :class="{ 'is-active': isWatched(selectedItem.code) }"
                :aria-label="isWatched(selectedItem.code) ? '從明日觀察移除' : '加入明日觀察'"
                @click="toggleWatch(selectedItem.code)"
              >
                <StarIcon />
              </button>
            </div>

            <div v-if="hasText(selectedItem.note)" class="ir-data-note">
              <ArrowTrendingUpIcon class="ir-inline-icon" />
              <span>{{ selectedItem.note }}</span>
            </div>

            <section v-if="selectedReasons.length" class="entry-detail-section">
              <h3>支持理由</h3>
              <div class="entry-reason-list">
                <p v-for="reason in selectedReasons" :key="reason"><CheckCircleIcon />{{ reason }}</p>
              </div>
            </section>

            <section v-if="selectedWarning" class="entry-detail-section">
              <h3>風險提示</h3>
              <p class="entry-warning"><ExclamationTriangleIcon />{{ selectedWarning }}</p>
            </section>

            <button type="button" class="ir-button is-primary" @click="toggleWatch(selectedItem.code)">
              <StarIcon />{{ isWatched(selectedItem.code) ? '已加入明日觀察' : '加入明日觀察' }}
            </button>
            <RouterLink class="ir-button" :to="createStockRoute(selectedItem.code)">
              查看個股<ArrowRightIcon />
            </RouterLink>
          </template>
        </aside>
      </section>
    </template>
  </section>
</template>

<style scoped>
.entry-top-list,
.entry-detail-panel,
.entry-detail-section,
.entry-reason-list {
  display: grid;
}

.entry-top-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--ir-line);
  border-radius: 7px;
}

.entry-top-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  border: 0;
  border-right: 1px solid var(--ir-line);
  background: transparent;
  color: var(--ir-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.entry-top-row:last-child {
  border-right: 0;
}

.entry-top-row.is-selected {
  background: var(--ir-row-hover);
}

.entry-top-stock {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
}

.entry-top-price {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  font-weight: 900;
}

.entry-top-change {
  display: inline-flex;
  grid-column: 2;
  grid-row: 2;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  font-weight: 900;
}

.entry-top-change svg,
.entry-table-change svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.entry-table-change {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
}

.entry-top-stock strong,
.entry-top-stock small {
  display: block;
}

.entry-top-stock strong {
  overflow: hidden;
  color: var(--ir-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-top-stock small {
  margin-top: 2px;
  color: var(--ir-soft);
  font-size: 0.68rem;
}

.entry-top-reason {
  grid-column: 2 / -1;
  grid-row: 3;
  color: var(--ir-soft);
  font-size: 0.72rem;
  line-height: 1.45;
}

.entry-top-row > .ir-status {
  grid-column: 3;
  grid-row: 2;
}

.entry-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.entry-sort {
  display: flex;
  align-items: center;
  flex: 0 0 230px;
  gap: 8px;
  color: var(--ir-soft);
  font-size: 0.74rem;
  font-weight: 800;
}

.entry-sort .ir-select {
  min-height: 36px;
}

.entry-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 14px;
  align-items: start;
  width: 100%;
  min-width: 0;
}

.entry-table-panel {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.entry-table th:nth-child(1) { width: 62px; }
.entry-table th:nth-child(2) { width: 165px; }
.entry-table th:nth-child(3) { width: 100px; }
.entry-table th:nth-child(4) { width: 105px; }
.entry-table th:nth-child(5) { width: 105px; }
.entry-table th:nth-child(7) { width: 65px; }
.entry-table th:nth-child(8) { width: 56px; }

.entry-detail-panel {
  gap: 14px;
}

.entry-detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.entry-detail-heading h2,
.entry-detail-heading p,
.entry-detail-section h3,
.entry-reason-list p,
.entry-warning {
  margin: 0;
}

.entry-detail-heading h2 {
  color: var(--ir-text);
  font-size: 1.25rem;
}

.entry-detail-heading p {
  margin-top: 3px;
  color: var(--ir-soft);
  font-size: 0.78rem;
}

.entry-detail-section {
  gap: 8px;
}

.entry-detail-section h3 {
  color: var(--ir-text);
  font-size: 0.88rem;
}

.entry-reason-list {
  gap: 8px;
}

.entry-reason-list p,
.entry-warning {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: var(--ir-soft);
  font-size: 0.76rem;
  line-height: 1.5;
}

.entry-reason-list svg,
.entry-warning svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.entry-reason-list svg {
  color: var(--down);
}

.entry-warning svg {
  color: var(--large);
}

@media (max-width: 1100px) {
  .entry-top-list {
    grid-template-columns: 1fr;
  }

  .entry-top-row {
    border-right: 0;
    border-bottom: 1px solid var(--ir-line);
  }

  .entry-top-row:last-child {
    border-bottom: 0;
  }

  .entry-workspace {
    display: block;
  }

  .entry-detail-panel {
    margin-top: 14px;
  }
}

@media (max-width: 700px) {
  .entry-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .entry-sort {
    flex-basis: auto;
  }

  .entry-table {
    min-width: 0;
  }

  .entry-table th:nth-child(1), .entry-table td:nth-child(1),
  .entry-table th:nth-child(4), .entry-table td:nth-child(4),
  .entry-table th:nth-child(5), .entry-table td:nth-child(5),
  .entry-table th:nth-child(6), .entry-table td:nth-child(6) {
    display: none;
  }

  .entry-table th:nth-child(2) { width: 44%; }
  .entry-table th:nth-child(3) { width: 25%; }
  .entry-table th:nth-child(7) { width: 15%; }
  .entry-table th:nth-child(8) { width: 16%; }
  .entry-table th, .entry-table td { padding-inline: 7px; }
  .entry-table tbody tr.is-selected td:nth-child(2) { box-shadow: inset 3px 0 0 var(--ir-brand); }
}
</style>
