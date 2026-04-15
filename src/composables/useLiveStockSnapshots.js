import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { canUseRemoteJsonFetch } from '../lib/api';
import { fetchLiveStockSnapshots } from '../lib/liveStockApi';

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

function normalizeCodes(codes) {
  return [...new Set((codes ?? []).map((code) => String(code ?? '').trim().toUpperCase()).filter(Boolean))];
}

export function useLiveStockSnapshots(codeListRef, options = {}) {
  const snapshotMap = ref(new Map());
  const isLoading = ref(false);
  const errorMessage = ref('');

  const refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_MS;
  const codes = computed(() => normalizeCodes(codeListRef?.value ?? []));
  let refreshPromise = null;
  let refreshTimer = null;

  async function refreshSnapshots(force = false) {
    if (!canUseRemoteJsonFetch()) {
      snapshotMap.value = new Map();
      errorMessage.value = '';
      return snapshotMap.value;
    }

    if (!codes.value.length) {
      snapshotMap.value = new Map();
      errorMessage.value = '';
      return snapshotMap.value;
    }

    if (refreshPromise && !force) {
      return refreshPromise;
    }

    isLoading.value = true;
    errorMessage.value = '';

    refreshPromise = (async () => {
      try {
        const nextSnapshotMap = await fetchLiveStockSnapshots(codes.value);
        snapshotMap.value = nextSnapshotMap;
        return nextSnapshotMap;
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : '個股即時快照載入失敗';
        return snapshotMap.value;
      } finally {
        isLoading.value = false;
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
    if (!canUseRemoteJsonFetch()) {
      return;
    }

    if (refreshTimer) {
      return;
    }

    refreshTimer = setInterval(() => {
      if (!isDocumentVisible() || !isTradingWindow()) {
        return;
      }

      refreshSnapshots();
    }, refreshIntervalMs);
  }

  watch(
    codes,
    () => {
      if (!canUseRemoteJsonFetch()) {
        snapshotMap.value = new Map();
        errorMessage.value = '';
        return;
      }

      refreshSnapshots(true);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    stopAutoRefresh();
  });

  return {
    codes,
    snapshotMap,
    isLoading,
    errorMessage,
    refreshSnapshots,
    startAutoRefresh,
    stopAutoRefresh,
  };
}

export const use即時個股快照 = useLiveStockSnapshots;
