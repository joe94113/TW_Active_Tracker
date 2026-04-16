<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useGlobalData } from './composables/useGlobalData';
import GlobalStockSearch from './components/GlobalStockSearch.vue';

const route = useRoute();
const { manifest, loadGlobalData } = useGlobalData();
const isCompactHeader = ref(false);
let mediaQuery = null;
let mediaQueryHandler = null;

const navigationItems = [
  { label: '首頁', path: '/' },
  { label: '選股', path: '/radar' },
  { label: '題材雷達', path: '/themes' },
  { label: '期貨籌碼', path: '/futures' },
  { label: 'ETF 重疊', path: '/etf-overlap' },
  { label: '主動式 ETF', path: '/etfs' },
];

function formatGeneratedAt(value) {
  if (!value) {
    return '資料整理中';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const generatedAtText = computed(() => formatGeneratedAt(manifest.value?.generatedAt));
const siteIconHref = `${import.meta.env.BASE_URL}favicon.svg`;

const footerStats = computed(() => [
  {
    label: '個股資料',
    value: manifest.value?.stockDetailCount ? `${manifest.value.stockDetailCount} 檔` : '整理中',
  },
  {
    label: '主動式 ETF',
    value: manifest.value?.trackedEtfs?.length ? `${manifest.value.trackedEtfs.length} 檔` : '整理中',
  },
  {
    label: '資料包整理',
    value: generatedAtText.value,
  },
]);

onMounted(() => {
  loadGlobalData();

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia('(max-width: 640px)');
    isCompactHeader.value = mediaQuery.matches;
    mediaQueryHandler = (event) => {
      isCompactHeader.value = event.matches;
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', mediaQueryHandler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(mediaQueryHandler);
    }
  }
});

onBeforeUnmount(() => {
  if (!mediaQuery || !mediaQueryHandler) {
    return;
  }

  if (typeof mediaQuery.removeEventListener === 'function') {
    mediaQuery.removeEventListener('change', mediaQueryHandler);
  } else if (typeof mediaQuery.removeListener === 'function') {
    mediaQuery.removeListener(mediaQueryHandler);
  }
});

function isActiveRoute(path) {
  if (path === '/') {
    return route.path === '/';
  }

  return route.path.startsWith(path);
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-topbar">
        <div class="brand-chip">
          <RouterLink class="brand-lockup" to="/">
            <span class="brand-mark" aria-hidden="true">
              <img class="brand-mark-image" :src="siteIconHref" alt="" />
            </span>
            <span class="brand-title">台股主動通</span>
          </RouterLink>
        </div>

        <nav
          v-if="!isCompactHeader"
          class="app-nav"
          aria-label="主要導覽"
        >
          <RouterLink
            v-for="item in navigationItems"
            :key="item.path"
            :to="item.path"
            class="nav-link"
            :class="{ 'is-active': isActiveRoute(item.path) }"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="app-toolbar">
          <GlobalStockSearch />
        </div>
      </div>
    </header>

    <main class="app-main">
      <RouterView />
    </main>

    <footer class="app-footer">
      <div class="footer-grid">
        <section class="footer-block">
          <RouterLink class="footer-brand" to="/">台股主動通</RouterLink>
          <p class="footer-text">
            把主動式 ETF、個股、法人籌碼和市場節奏整合在一起，讓你從首頁一路研究到個股頁，快速判斷隔日值得追蹤的標的。
          </p>
        </section>

        <section class="footer-block">
          <h2 class="footer-title">快速導覽</h2>
          <nav class="footer-links" aria-label="頁尾導覽">
            <RouterLink
              v-for="item in navigationItems"
              :key="`footer-${item.path}`"
              :to="item.path"
              class="footer-link"
            >
              {{ item.label }}
            </RouterLink>
          </nav>
        </section>

        <section class="footer-block">
          <h2 class="footer-title">資料概況</h2>
          <div class="footer-stat-list">
            <div v-for="item in footerStats" :key="item.label" class="footer-stat">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <p class="footer-note">資料來源以 TWSE OpenAPI、TWSE / TAIFEX 公開資料與投信揭露頁面為主，僅供研究參考。</p>
        </section>
      </div>
    </footer>

    <nav class="mobile-dock" aria-label="手機底部導覽">
      <RouterLink
        v-for="item in navigationItems"
        :key="`dock-${item.path}`"
        :to="item.path"
        class="mobile-dock-link"
        :class="{ 'is-active': isActiveRoute(item.path) }"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </div>
</template>
