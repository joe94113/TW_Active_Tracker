import { computed, onBeforeUnmount, ref } from 'vue';
import { fetchLiveMarketOverview } from '../lib/liveStockApi';

const DEFAULT_REFRESH_MS = 60000;

function isDocumentVisible() {
  if (typeof document === 'undefined') {
    return true;
  }

  return document.visibilityState === 'visible';
}

function isTradingWindow(now = new Date()) {
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const day = localNow.getDay();

  if (day === 0 || day === 6) {
    return false;
  }

  const minutes = localNow.getHours() * 60 + localNow.getMinutes();
  return minutes >= 8 * 60 + 55 && minutes <= 13 * 60 + 45;
}

export function useLiveMarketOverview(baseMarketOverviewRef, options = {}) {
  const liveMarketOverview = ref(null);
  const isLiveLoading = ref(false);
  const liveErrorMessage = ref('');

  const refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_MS;
  let refreshPromise = null;
  let refreshTimer = null;

  async function refreshLiveMarketData(force = false) {
    if (refreshPromise && !force) {
      return refreshPromise;
    }

    isLiveLoading.value = true;
    liveErrorMessage.value = '';

    refreshPromise = (async () => {
      try {
        liveMarketOverview.value = await fetchLiveMarketOverview(baseMarketOverviewRef?.value ?? null);
        return liveMarketOverview.value;
      } catch (error) {
        liveErrorMessage.value = error instanceof Error ? error.message : '大盤即時資料載入失敗';
        return liveMarketOverview.value;
      } finally {
        isLiveLoading.value = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) {
      return;
    }

    refreshTimer = setInterval(() => {
      if (!isDocumentVisible() || !isTradingWindow()) {
        return;
      }

      refreshLiveMarketData();
    }, refreshIntervalMs);
  }

  const marketOverview = computed(() => {
    const baseMarketOverview = baseMarketOverviewRef?.value ?? null;
    const liveMarketData = liveMarketOverview.value;

    if (!baseMarketOverview) {
      return liveMarketData;
    }

    if (!liveMarketData) {
      return baseMarketOverview;
    }

    return {
      ...baseMarketOverview,
      ...liveMarketData,
      大盤摘要: {
        ...(baseMarketOverview.大盤摘要 ?? {}),
        ...(liveMarketData.大盤摘要 ?? {}),
      },
      盤中脈動: {
        ...(baseMarketOverview.盤中脈動 ?? {}),
        ...(liveMarketData.盤中脈動 ?? {}),
      },
      盤中走勢: liveMarketData.盤中走勢 ?? baseMarketOverview.盤中走勢 ?? null,
      即時狀態: liveMarketData.即時狀態 ?? baseMarketOverview.即時狀態 ?? null,
    };
  });

  const liveStatus = computed(() => marketOverview.value?.即時狀態 ?? null);

  onBeforeUnmount(() => {
    stopAutoRefresh();
  });

  return {
    marketOverview,
    liveStatus,
    isLiveLoading,
    liveErrorMessage,
    liveMarketOverview,
    refreshLiveMarketData,
    startAutoRefresh,
    stopAutoRefresh,
  };
}

export const use即時市場總覽 = useLiveMarketOverview;
