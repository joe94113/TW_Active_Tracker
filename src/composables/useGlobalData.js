import { computed, ref } from 'vue';
import { fetchJson } from '../lib/api';

const manifest = ref(null);
const dashboard = ref(null);
const overlap = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');

let loadPromise = null;

async function loadGlobalData() {
  if (loadPromise) return loadPromise;
  if (manifest.value && dashboard.value && overlap.value) return Promise.resolve();

  isLoading.value = true;
  errorMessage.value = '';

  loadPromise = (async () => {
    try {
      const manifestData = await fetchJson('data/manifest.json');
      const [dashboardData, overlapData] = await Promise.all([
        fetchJson(manifestData.dashboardPath ?? 'data/dashboard.json'),
        fetchJson(manifestData.overlapPath ?? 'data/etf-overlap.json'),
      ]);

      manifest.value = manifestData;
      dashboard.value = dashboardData;
      overlap.value = overlapData;
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
    stockList: computed(() => manifest.value?.trackedStocks ?? []),
  };
}

export const use全域資料 = useGlobalData;
