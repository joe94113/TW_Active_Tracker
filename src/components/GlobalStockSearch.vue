<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import { searchRemoteStocks } from '../lib/liveStockApi';
import { createStockRoute, isStockCode } from '../lib/stockRouting';
import { formatNumber, formatPercent } from '../lib/formatters';

const router = useRouter();
const route = useRoute();
const { stockSearchList, loadGlobalData } = useGlobalData();

const hostRef = ref(null);
const query = ref('');
const isOpen = ref(false);
const isRemoteLoading = ref(false);
const remoteMatches = ref([]);

let searchTimer = null;
let handleOutsideClick = null;

onMounted(() => {
  loadGlobalData();

  handleOutsideClick = (event) => {
    if (!hostRef.value?.contains(event.target)) {
      isOpen.value = false;
    }
  };

  window.addEventListener('pointerdown', handleOutsideClick);
});

watch(
  () => route.fullPath,
  () => {
    isOpen.value = false;
    query.value = '';
  },
);

const normalizedQuery = computed(() => query.value.trim().toLowerCase());

const localMatches = computed(() => {
  if (!normalizedQuery.value) {
    return [];
  }

  return stockSearchList.value
    .filter((item) => [item.code, item.name].some((field) => String(field ?? '').toLowerCase().includes(normalizedQuery.value)))
    .slice(0, 6)
    .map((item) => ({
      ...item,
      searchSource: item.hasLocalDetail ? '站內完整資料' : '站內索引',
      hasLocalDetail: Boolean(item.hasLocalDetail),
    }));
});

const mergedMatches = computed(() => {
  const localCodes = new Set(localMatches.value.map((item) => item.code));

  return [...localMatches.value, ...remoteMatches.value.filter((item) => !localCodes.has(item.code))].slice(0, 8);
});

const directLookup = computed(() => {
  const normalizedCode = query.value.trim();

  if (!isStockCode(normalizedCode)) {
    return null;
  }

  if (mergedMatches.value.some((item) => item.code === normalizedCode)) {
    return null;
  }

  return {
    code: normalizedCode,
    name: `直接查看 ${normalizedCode}`,
    searchSource: '輸入代號前往',
    hasLocalDetail: false,
  };
});

watch(normalizedQuery, (keyword) => {
  if (searchTimer) {
    window.clearTimeout(searchTimer);
    searchTimer = null;
  }

  if (keyword.length < 2) {
    remoteMatches.value = [];
    isRemoteLoading.value = false;
    return;
  }

  if (stockSearchList.value.length) {
    remoteMatches.value = [];
    isRemoteLoading.value = false;
    return;
  }

  searchTimer = window.setTimeout(async () => {
    isRemoteLoading.value = true;

    try {
      remoteMatches.value = (await searchRemoteStocks(keyword, { limit: 8 })).map((item) => ({
        ...item,
        searchSource: '即時 API 搜尋',
        hasLocalDetail: false,
      }));
    } catch {
      remoteMatches.value = [];
    } finally {
      isRemoteLoading.value = false;
    }
  }, 180);
});

onBeforeUnmount(() => {
  if (searchTimer) {
    window.clearTimeout(searchTimer);
  }

  if (handleOutsideClick) {
    window.removeEventListener('pointerdown', handleOutsideClick);
  }
});

function openResult(item) {
  router.push(createStockRoute(item.code));
  isOpen.value = false;
  query.value = '';
}

function submitSearch() {
  const normalizedCode = query.value.trim();

  if (isStockCode(normalizedCode)) {
    openResult({ code: normalizedCode });
    return;
  }

  if (mergedMatches.value.length) {
    openResult(mergedMatches.value[0]);
  }
}
</script>

<template>
  <div ref="hostRef" class="global-search">
    <div class="global-search-box" :class="{ 'is-open': isOpen }">
      <span class="global-search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M20 20l-3.2-3.2"></path>
        </svg>
      </span>
      <input
        v-model="query"
        class="global-search-input"
        type="search"
        placeholder="搜尋代號或股票名稱"
        @focus="isOpen = true"
        @keydown.enter.prevent="submitSearch"
        @keydown.esc="isOpen = false"
      />
      <button
        v-if="query"
        type="button"
        class="global-search-clear"
        @click="query = ''"
      >
        清除
      </button>
    </div>

    <div
      v-if="isOpen && (query.trim() || mergedMatches.length || isRemoteLoading || directLookup)"
      class="global-search-menu"
    >
      <button
        v-for="item in mergedMatches"
        :key="`${item.searchSource}-${item.code}`"
        type="button"
        class="global-search-result"
        @click="openResult(item)"
      >
        <div class="global-search-main">
          <strong>{{ item.code }} {{ item.name }}</strong>
          <div class="global-search-meta">
            <span class="global-search-source">{{ item.searchSource }}</span>
            <span
              v-if="item.topSelectionSignalTitle"
              class="global-search-chip"
              :class="item.selectionSignalTone ? `is-${item.selectionSignalTone}` : 'is-info'"
            >
              {{ item.topSelectionSignalTitle }}
            </span>
            <span
              v-else-if="item.topSignalTitle"
              class="global-search-chip"
              :class="item.topSignalTone ? `is-${item.topSignalTone}` : 'is-normal'"
            >
              {{ item.topSignalTitle }}
            </span>
          </div>
        </div>
        <div class="global-search-side">
          <span v-if="item.return20 !== null && item.return20 !== undefined" :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
            {{ formatPercent(item.return20) }}
          </span>
          <span v-else-if="item.close !== null && item.close !== undefined">{{ formatNumber(item.close) }}</span>
        </div>
      </button>

      <button
        v-if="directLookup"
        type="button"
        class="global-search-result is-direct"
        @click="openResult(directLookup)"
      >
        <div class="global-search-main">
          <strong>{{ directLookup.name }}</strong>
          <span class="global-search-source">{{ directLookup.searchSource }}</span>
        </div>
      </button>

      <p v-if="isRemoteLoading" class="global-search-status">正在補抓遠端資料…</p>
      <p v-else-if="query.trim().length >= 2 && !mergedMatches.length && !directLookup" class="global-search-status">
        找不到符合結果，試著輸入 4 碼代號，或改用股票名稱關鍵字。
      </p>
    </div>
  </div>
</template>
