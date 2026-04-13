import { ref, watch } from 'vue';
import { fetchOptionalJson } from '../lib/api';
import { fetchLiveFallbackStockDetail } from '../lib/liveStockApi';

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function mergePreferDefined(baseValue, incomingValue) {
  if (incomingValue === null || incomingValue === undefined) {
    return baseValue;
  }

  if (Array.isArray(incomingValue)) {
    return incomingValue.length ? incomingValue : (Array.isArray(baseValue) ? baseValue : incomingValue);
  }

  if (isPlainObject(baseValue) && isPlainObject(incomingValue)) {
    const merged = { ...baseValue };

    Object.entries(incomingValue).forEach(([key, value]) => {
      merged[key] = key in merged ? mergePreferDefined(merged[key], value) : value;
    });

    return merged;
  }

  return incomingValue;
}

function mergeStockDetail(staticDetail, liveDetail) {
  if (!staticDetail) {
    return liveDetail;
  }

  const merged = mergePreferDefined(staticDetail, liveDetail);

  return {
    ...merged,
    kind: staticDetail.kind ?? liveDetail?.kind ?? merged.kind,
    generatedAt: liveDetail?.generatedAt ?? staticDetail.generatedAt ?? merged.generatedAt,
    priceDate: liveDetail?.priceDate ?? staticDetail.priceDate ?? merged.priceDate,
  };
}

export function useStockDetail(codeRef) {
  const detail = ref(null);
  const isLoading = ref(false);
  const isEnhancing = ref(false);
  const errorMessage = ref('');
  let activeRequestId = 0;

  async function enhance(code, staticDetail, requestId) {
    isEnhancing.value = true;

    try {
      const liveDetail = await fetchLiveFallbackStockDetail(code);

      if (requestId !== activeRequestId || !liveDetail) {
        return;
      }

      detail.value = mergeStockDetail(staticDetail, liveDetail);
    } catch (error) {
      if (requestId === activeRequestId && !detail.value) {
        errorMessage.value = error instanceof Error ? error.message : '個股資料補抓失敗';
      }
    } finally {
      if (requestId === activeRequestId) {
        isEnhancing.value = false;
      }
    }
  }

  async function load(code) {
    const normalizedCode = String(code ?? '').trim();

    if (!normalizedCode) {
      detail.value = null;
      errorMessage.value = '';
      isLoading.value = false;
      isEnhancing.value = false;
      return;
    }

    const requestId = ++activeRequestId;
    isLoading.value = true;
    isEnhancing.value = false;
    errorMessage.value = '';

    try {
      const staticDetail = await fetchOptionalJson(`data/stocks/${normalizedCode}.json`);

      if (requestId !== activeRequestId) {
        return;
      }

      if (staticDetail) {
        detail.value = staticDetail;
        isLoading.value = false;
        enhance(normalizedCode, staticDetail, requestId);
        return;
      }

      detail.value = await fetchLiveFallbackStockDetail(normalizedCode);
    } catch (error) {
      if (requestId === activeRequestId) {
        errorMessage.value = error instanceof Error ? error.message : '個股明細載入失敗';
        detail.value = null;
      }
    } finally {
      if (requestId === activeRequestId) {
        isLoading.value = false;
      }
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
    isEnhancing,
    errorMessage,
    load,
  };
}

export const use證券明細 = useStockDetail;
