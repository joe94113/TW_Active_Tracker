import { ref, watch } from 'vue';
import { fetchJson, fetchOptionalJson } from '../lib/api';

export function useEtfDetail(codeRef) {
  const latestSnapshot = ref(null);
  const diffData = ref(null);
  const marketData = ref(null);
  const isLoading = ref(false);
  const errorMessage = ref('');

  async function load(code) {
    if (!code) return;

    isLoading.value = true;
    errorMessage.value = '';

    try {
      const [latest, diff, market] = await Promise.all([
        fetchOptionalJson(`data/etfs/${code}/latest.json`),
        fetchOptionalJson(`data/etfs/${code}/diff-latest.json`),
        fetchJson(`data/etfs/${code}/market.json`),
      ]);

      latestSnapshot.value = latest;
      diffData.value = diff;
      marketData.value = market;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'ETF 明細載入失敗';
      latestSnapshot.value = null;
      diffData.value = null;
      marketData.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  watch(
    () => codeRef.value,
    (code) => {
      load(code);
    },
    { immediate: true },
  );

  return {
    latestSnapshot,
    diffData,
    marketData,
    isLoading,
    errorMessage,
    load,
  };
}

export const useETF明細 = useEtfDetail;
