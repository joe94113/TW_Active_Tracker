import { onBeforeUnmount, watch, ref } from 'vue';
import { fetchLiveStockSnapshot } from '../lib/liveStockApi';

export function useLiveStockSnapshot(codeRef, options = {}) {
  const snapshot = ref(null);
  const isLoading = ref(false);
  const errorMessage = ref('');
  const refreshIntervalMs = options.refreshIntervalMs ?? 60000;
  let refreshHandle = null;

  async function loadSnapshot(code) {
    const normalizedCode = String(code ?? '').trim();

    if (!normalizedCode) {
      snapshot.value = null;
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      snapshot.value = await fetchLiveStockSnapshot(normalizedCode);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '即時行情載入失敗';
      snapshot.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  function startAutoRefresh() {
    if (refreshHandle || refreshIntervalMs <= 0) {
      return;
    }

    refreshHandle = window.setInterval(() => {
      loadSnapshot(codeRef.value);
    }, refreshIntervalMs);
  }

  function stopAutoRefresh() {
    if (!refreshHandle) {
      return;
    }

    window.clearInterval(refreshHandle);
    refreshHandle = null;
  }

  watch(
    () => codeRef.value,
    (code) => {
      loadSnapshot(code);
    },
    { immediate: true },
  );

  if (typeof window !== 'undefined') {
    startAutoRefresh();
  }

  onBeforeUnmount(() => {
    stopAutoRefresh();
  });

  return {
    snapshot,
    isLoading,
    errorMessage,
    refresh: () => loadSnapshot(codeRef.value),
  };
}
