import { ref, watch } from 'vue';
import { fetchOptionalJson } from '../lib/api';
import { fetchLiveFallbackStockDetail } from '../lib/liveStockApi';

export function useStockDetail(codeRef) {
  const detail = ref(null);
  const isLoading = ref(false);
  const errorMessage = ref('');

  async function load(code) {
    if (!code) return;

    isLoading.value = true;
    errorMessage.value = '';

    try {
      const staticDetail = await fetchOptionalJson(`data/stocks/${code}.json`);
      detail.value = staticDetail ?? (await fetchLiveFallbackStockDetail(code));
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '個股明細載入失敗';
      detail.value = null;
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
    detail,
    isLoading,
    errorMessage,
    load,
  };
}

export const use證券明細 = useStockDetail;
