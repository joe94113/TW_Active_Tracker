import { computed, ref, watch } from 'vue';

const STORAGE_KEY = 'tw-active-tracker.favorite-stocks';
const favoriteCodes = ref([]);

function readFavoriteStocks() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeFavoriteStocks(codes) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
}

favoriteCodes.value = readFavoriteStocks();

watch(
  favoriteCodes,
  (codes) => {
    writeFavoriteStocks(codes);
  },
  { deep: true },
);

export function useFavoriteStocks() {
  const favoriteSet = computed(() => new Set(favoriteCodes.value));

  function isFavorite(code) {
    return favoriteSet.value.has(String(code ?? '').trim());
  }

  function toggleFavorite(code) {
    const normalized = String(code ?? '').trim();
    if (!normalized) return;

    if (favoriteSet.value.has(normalized)) {
      favoriteCodes.value = favoriteCodes.value.filter((item) => item !== normalized);
      return;
    }

    favoriteCodes.value = [normalized, ...favoriteCodes.value.filter((item) => item !== normalized)].slice(0, 20);
  }

  function clearFavorites() {
    favoriteCodes.value = [];
  }

  return {
    favoriteCodes,
    favoriteSet,
    isFavorite,
    toggleFavorite,
    clearFavorites,
  };
}

export const use自選股 = useFavoriteStocks;
