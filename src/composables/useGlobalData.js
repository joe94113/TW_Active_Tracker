import { computed, ref } from 'vue';
import { fetchJson } from '../lib/api';

const manifest = ref(null);
const dashboard = ref(null);
const overlap = ref(null);
const stockList = ref([]);
const stockSearchList = ref([]);
const earningsCalendar = ref(null);
const productEvents = ref(null);
const insiderHoldings = ref(null);
const signalConfidenceStats = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');

let loadPromise = null;

async function fetchJsonOptional(path) {
  try {
    return await fetchJson(path);
  } catch (error) {
    console.warn(`[useGlobalData] skip optional data ${path}:`, error?.message ?? error);
    return null;
  }
}

async function loadGlobalData() {
  if (loadPromise) return loadPromise;
  if (manifest.value && dashboard.value && overlap.value && stockList.value.length && stockSearchList.value.length) return Promise.resolve();

  isLoading.value = true;
  errorMessage.value = '';

  loadPromise = (async () => {
    try {
      const manifestData = await fetchJson('data/manifest.json');
      const [
        dashboardData,
        overlapData,
        stockIndexData,
        stockSearchData,
        earningsData,
        productEventsData,
        insiderData,
        signalConfidenceData,
      ] = await Promise.all([
        fetchJson(manifestData.dashboardPath ?? 'data/dashboard.json'),
        fetchJson(manifestData.overlapPath ?? 'data/etf-overlap.json'),
        fetchJson(manifestData.stockIndexPath ?? 'data/stocks/index.json'),
        fetchJson(manifestData.stockSearchPath ?? 'data/stocks/search.json'),
        fetchJsonOptional(manifestData.earningsCalendarPath ?? 'data/calendar/earnings.json'),
        fetchJsonOptional(manifestData.productEventsPath ?? 'data/calendar/product-events.json'),
        fetchJsonOptional(manifestData.insiderHoldingsPath ?? 'data/insider/holdings.json'),
        fetchJsonOptional(manifestData.signalConfidencePath ?? 'data/radar/signal-confidence.json'),
      ]);

      manifest.value = manifestData;
      dashboard.value = dashboardData;
      overlap.value = overlapData;
      stockList.value = stockIndexData;
      stockSearchList.value = stockSearchData;
      earningsCalendar.value = earningsData;
      productEvents.value = productEventsData;
      insiderHoldings.value = insiderData;
      signalConfidenceStats.value = signalConfidenceData;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Global data load failed';
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
    stockSearchList: computed(() => stockSearchList.value),
    earningsCalendar: computed(() => earningsCalendar.value),
    productEvents: computed(() => productEvents.value),
    insiderHoldings: computed(() => insiderHoldings.value),
    signalConfidenceStats: computed(() => signalConfidenceStats.value),
  };
}

export const use全域資料 = useGlobalData;
