<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useGlobalData } from './composables/useGlobalData';
import GlobalStockSearch from './components/GlobalStockSearch.vue';

const route = useRoute();
const { manifest, loadGlobalData } = useGlobalData();

const navigationItems = [
  { label: '首頁', path: '/' },
  { label: 'ETF 重疊', path: '/etf-overlap' },
  { label: '主動式 ETF', path: '/etfs' },
];

const currentSectionLabel = computed(() => {
  if (route.path.startsWith('/stocks/')) return '個股研究';
  if (route.path.startsWith('/etfs/')) return '主動式 ETF';
  if (route.path.startsWith('/etf-overlap')) return 'ETF 重疊';

  return '首頁';
});

function formatGeneratedAt(value) {
  if (!value) {
    return '資料載入中';
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

const generatedAtText = computed(() => {
  return formatGeneratedAt(manifest.value?.generatedAt);
});

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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 16.5V7.5"></path>
                <path d="M9.5 16.5V4.5"></path>
                <path d="M15 16.5v-6"></path>
                <path d="M20 16.5v-10"></path>
                <path d="M3 19h18"></path>
              </svg>
            </span>
            <span class="brand-title">台股主動通</span>
          </RouterLink>
        </div>

        <nav class="app-nav" aria-label="主要導覽">
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

        <GlobalStockSearch />

        <div class="app-header-side compact">
          <span class="meta-chip">目前頁面：{{ currentSectionLabel }}</span>
          <span class="meta-text">資料包整理：{{ generatedAtText }}</span>
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
            把大盤、ETF、個股與技術面整合在同一條研究路徑，讓你在盤後與隔日規劃時更快抓到重點。
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
          <h2 class="footer-title">資料節奏</h2>
          <div class="footer-stat-list">
            <div v-for="item in footerStats" :key="item.label" class="footer-stat">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <p class="footer-note">資料來源涵蓋 TWSE OpenAPI、ETF 公開揭露與行情圖表資料。</p>
        </section>
      </div>
    </footer>

    <nav class="mobile-dock" aria-label="手機快速導覽">
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
