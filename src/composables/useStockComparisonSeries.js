import { ref, watch } from 'vue';
import { fetchOptionalJson } from '../lib/api';

const detailCache = new Map();

export function useStockComparisonSeries(codesRef) {
  const comparisonSeries = ref([]);
  const isLoading = ref(false);

  async function load(codes) {
    const normalizedCodes = [...new Set((codes ?? []).map((code) => String(code ?? '').trim()).filter(Boolean))];

    if (!normalizedCodes.length) {
      comparisonSeries.value = [];
      return;
    }

    isLoading.value = true;

    try {
      const items = await Promise.all(
        normalizedCodes.map(async (code) => {
          if (detailCache.has(code)) {
            return detailCache.get(code);
          }

          const detail = await fetchOptionalJson(`data/stocks/${code}.json`);

          if (!detail) {
            return null;
          }

          const payload = {
            code,
            name: detail.name ?? code,
            歷史資料: detail.歷史資料 ?? [],
            priceDate: detail.priceDate ?? null,
          };

          detailCache.set(code, payload);
          return payload;
        }),
      );

      comparisonSeries.value = items.filter(Boolean);
    } finally {
      isLoading.value = false;
    }
  }

  watch(
    () => codesRef.value,
    (codes) => {
      load(codes);
    },
    { deep: true, immediate: true },
  );

  return {
    comparisonSeries,
    isLoading,
    load,
  };
}
