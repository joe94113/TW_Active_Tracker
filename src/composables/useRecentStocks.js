import { computed, ref, watch } from 'vue';

const STORAGE_KEY = 'tw-active-tracker.recent-stocks';
const recentItems = ref([]);

function readRecentStocks() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw ?? '[]');

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        code: String(item?.code ?? '').trim(),
        name: String(item?.name ?? '').trim(),
        viewedAt: String(item?.viewedAt ?? '').trim(),
      }))
      .filter((item) => item.code);
  } catch {
    return [];
  }
}

function writeRecentStocks(items) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

recentItems.value = readRecentStocks();

watch(
  recentItems,
  (items) => {
    writeRecentStocks(items);
  },
  { deep: true },
);

export function useRecentStocks() {
  function pushRecentStock(stock) {
    const code = String(stock?.code ?? '').trim();

    if (!code) return;

    const nextItem = {
      code,
      name: String(stock?.name ?? '').trim() || code,
      viewedAt: new Date().toISOString(),
    };

    recentItems.value = [
      nextItem,
      ...recentItems.value.filter((item) => item.code !== code),
    ].slice(0, 10);
  }

  function clearRecentStocks() {
    recentItems.value = [];
  }

  return {
    recentItems: computed(() => recentItems.value),
    pushRecentStock,
    clearRecentStocks,
  };
}
