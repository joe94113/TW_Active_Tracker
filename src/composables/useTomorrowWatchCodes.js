import { computed, ref, watch } from 'vue';

const STORAGE_KEY = 'tw-active-tracker.tomorrow-watch-codes';
const watchCodes = ref(readCodes());

function readCodes() {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

watch(
  watchCodes,
  (codes) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
    }
  },
  { deep: true },
);

export function useTomorrowWatchCodes() {
  const watchCodeSet = computed(() => new Set(watchCodes.value));

  function isWatched(code) {
    return watchCodeSet.value.has(String(code ?? '').trim());
  }

  function toggleWatch(code) {
    const normalized = String(code ?? '').trim();
    if (!normalized) return;

    if (watchCodeSet.value.has(normalized)) {
      watchCodes.value = watchCodes.value.filter((item) => item !== normalized);
      return;
    }

    watchCodes.value = [normalized, ...watchCodes.value.filter((item) => item !== normalized)].slice(0, 20);
  }

  function removeWatch(code) {
    const normalized = String(code ?? '').trim();
    watchCodes.value = watchCodes.value.filter((item) => item !== normalized);
  }

  return {
    watchCodes,
    watchCodeSet,
    isWatched,
    toggleWatch,
    removeWatch,
  };
}
