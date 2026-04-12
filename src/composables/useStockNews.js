import { ref, watch } from 'vue';
import { fetchOptionalJson } from '../lib/api';

export function useStockNews(codeRef) {
  const news = ref(null);
  const isLoading = ref(false);
  const errorMessage = ref('');
  const hasLoaded = ref(false);

  watch(
    () => codeRef.value,
    () => {
      news.value = null;
      isLoading.value = false;
      errorMessage.value = '';
      hasLoaded.value = false;
    },
  );

  async function load() {
    const code = String(codeRef.value ?? '').trim();

    if (!code || isLoading.value) {
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      news.value = await fetchOptionalJson(`data/stocks/news/${code}.json`);
      hasLoaded.value = true;

      if (!news.value) {
        errorMessage.value = '目前沒有這檔股票的站內新聞整理。';
      } else if (news.value.errorMessage && !(news.value.items?.length)) {
        errorMessage.value = news.value.errorMessage;
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '新聞整理載入失敗';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    news,
    isLoading,
    errorMessage,
    hasLoaded,
    load,
  };
}
