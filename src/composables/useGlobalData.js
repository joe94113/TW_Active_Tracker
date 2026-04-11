import { computed, ref } from 'vue';
import { fetchJson } from '../lib/api';

const manifest = ref(null);
const dashboard = ref(null);
const overlap = ref(null);
const stockList = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');

let loadPromise = null;

async function loadGlobalData() {
  if (loadPromise) return loadPromise;
  if (manifest.value && dashboard.value && overlap.value && stockList.value.length) return Promise.resolve();

  isLoading.value = true;
  errorMessage.value = '';

  loadPromise = (async () => {
    try {
      const manifestData = await fetchJson('data/manifest.json');
      const [dashboardData, overlapData, stockIndexData] = await Promise.all([
        fetchJson(manifestData.dashboardPath ?? 'data/dashboard.json'),
        fetchJson(manifestData.overlapPath ?? 'data/etf-overlap.json'),
        fetchJson(manifestData.stockIndexPath ?? 'data/stocks/index.json'),
      ]);

      manifest.value = manifestData;
      dashboard.value = dashboardData;
      overlap.value = overlapData;
      stockList.value = stockIndexData;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '全域資料載入失敗';
      throw error;
    } finally {
      isLoading.value = false;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function useGlobalData() {
  return {
    manifest,
    dashboard,
    overlap,
    isLoading,
    errorMessage,
    loadGlobalData,
    trackedEtfs: computed(() => manifest.value?.trackedEtfs ?? []),
    etfOverviewList: computed(() => manifest.value?.latestOverview ?? []),
    stockList: computed(() => stockList.value),
  };
}

export const use全域資料 = useGlobalData;
