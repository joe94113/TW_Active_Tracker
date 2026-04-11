<script setup>
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useGlobalData } from './composables/useGlobalData';

const route = useRoute();
const { manifest } = useGlobalData();

const navigationItems = [
  { label: '首頁', path: '/' },
  { label: 'ETF 重疊', path: '/etf-overlap' },
  { label: '主動式 ETF', path: '/etfs' },
];

const generatedAtText = computed(() => {
  if (!manifest.value) return '資料載入中';
  return `${manifest.value.generatedAtLocalDate} ${manifest.value.generatedAtLocalTime}`;
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
      <div class="brand-block">
        <p class="brand-kicker">大盤、籌碼、ETF、個股一站掌握</p>
        <RouterLink class="brand-title" to="/">台股主動通</RouterLink>
        <p class="brand-text">
          從市場熱度到個股節奏，把關鍵觀察濃縮在同一個介面，讓你更快找到值得追蹤的方向。
        </p>
      </div>

      <nav class="app-nav">
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

      <div class="app-meta">
        <span class="meta-text">最新整理：{{ generatedAtText }}</span>
      </div>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>
