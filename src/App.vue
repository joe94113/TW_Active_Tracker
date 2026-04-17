<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useGlobalData } from './composables/useGlobalData';
import GlobalStockSearch from './components/GlobalStockSearch.vue';

const route = useRoute();
const { manifest, loadGlobalData } = useGlobalData();

const isCompactHeader = ref(false);
const isMoreMenuOpen = ref(false);
const desktopMoreMenuRef = ref(null);
const mobileMoreMenuRef = ref(null);

let mediaQuery = null;
let mediaQueryHandler = null;
let outsideClickHandler = null;

const primaryNavigationItems = [
  { label: '首頁', path: '/' },
  { label: '選股雷達', path: '/radar' },
  { label: '資金題材', path: '/themes' },
  { label: '主動式 ETF', path: '/etfs' },
];

const secondaryNavigationItems = [
  {
    label: '股票小教室',
    path: '/classroom',
    tag: '教學',
    description: '用簡單易懂的方式看懂 RSI、量價、均線、內外盤與期貨。',
  },
  {
    label: '期貨籌碼',
    path: '/futures',
    tag: '觀察',
    description: '集中查看小台、微台、法人未平倉與期貨日線節奏。',
  },
  {
    label: 'ETF 重疊',
    path: '/etf-overlap',
    tag: '交叉',
    description: '快速比對熱門 ETF 重疊持股，找出族群共識與集中方向。',
  },
];

const allNavigationItems = [...primaryNavigationItems, ...secondaryNavigationItems];

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

function isActiveRoute(path) {
  if (path === '/') {
    return route.path === '/';
  }

  return route.path.startsWith(path);
}

function closeMoreMenu() {
  isMoreMenuOpen.value = false;
}

function toggleMoreMenu() {
  isMoreMenuOpen.value = !isMoreMenuOpen.value;
}

const generatedAtText = computed(() => formatGeneratedAt(manifest.value?.generatedAt));
const siteIconHref = `${import.meta.env.BASE_URL}favicon.svg`;
const isMoreActive = computed(() => secondaryNavigationItems.some((item) => isActiveRoute(item.path)));

const footerStats = computed(() => [
  {
    label: '追蹤個股',
    value: manifest.value?.stockDetailCount ? `${manifest.value.stockDetailCount} 檔` : '資料整理中',
  },
  {
    label: '主動式 ETF',
    value: manifest.value?.trackedEtfs?.length ? `${manifest.value.trackedEtfs.length} 檔` : '資料整理中',
  },
  {
    label: '最近整理',
    value: generatedAtText.value,
  },
]);

onMounted(() => {
  loadGlobalData();

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia('(max-width: 900px)');
    isCompactHeader.value = mediaQuery.matches;
    mediaQueryHandler = (event) => {
      isCompactHeader.value = event.matches;
      isMoreMenuOpen.value = false;
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', mediaQueryHandler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(mediaQueryHandler);
    }
  }

  if (typeof document !== 'undefined') {
    outsideClickHandler = (event) => {
      if (!isMoreMenuOpen.value) {
        return;
      }

      const target = event.target;
      const insideDesktop = desktopMoreMenuRef.value?.contains(target);
      const insideMobile = mobileMoreMenuRef.value?.contains(target);

      if (!insideDesktop && !insideMobile) {
        isMoreMenuOpen.value = false;
      }
    };

    document.addEventListener('pointerdown', outsideClickHandler);
  }
});

onBeforeUnmount(() => {
  if (mediaQuery && mediaQueryHandler) {
    if (typeof mediaQuery.removeEventListener === 'function') {
      mediaQuery.removeEventListener('change', mediaQueryHandler);
    } else if (typeof mediaQuery.removeListener === 'function') {
      mediaQuery.removeListener(mediaQueryHandler);
    }
  }

  if (outsideClickHandler && typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', outsideClickHandler);
  }
});

watch(
  () => route.path,
  () => {
    isMoreMenuOpen.value = false;
  },
);
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

        <nav v-if="!isCompactHeader" class="app-nav" aria-label="主導覽">
          <RouterLink
            v-for="item in primaryNavigationItems"
            :key="item.path"
            :to="item.path"
            class="nav-link"
            :class="{ 'is-active': isActiveRoute(item.path) }"
          >
            {{ item.label }}
          </RouterLink>

          <div ref="desktopMoreMenuRef" class="more-menu">
            <button
              type="button"
              class="nav-link more-trigger"
              :class="{ 'is-active': isMoreActive || isMoreMenuOpen }"
              :aria-expanded="String(isMoreMenuOpen)"
              @click="toggleMoreMenu"
            >
              更多
            </button>

            <div v-if="isMoreMenuOpen" class="more-menu-panel more-menu-panel-desktop">
              <RouterLink
                v-for="item in secondaryNavigationItems"
                :key="`desktop-more-${item.path}`"
                :to="item.path"
                class="more-menu-card"
                :class="{ 'is-active': isActiveRoute(item.path) }"
                @click="closeMoreMenu"
              >
                <span class="more-menu-card-tag">{{ item.tag }}</span>
                <strong>{{ item.label }}</strong>
                <span>{{ item.description }}</span>
              </RouterLink>
            </div>
          </div>
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
      <div class="footer-topline">
        <div class="footer-identity">
          <RouterLink class="footer-brand" to="/">台股主動通</RouterLink>
          <p class="footer-text">把市場節奏、選股與研究入口整理成同一個工作台。</p>
        </div>

        <nav class="footer-link-row" aria-label="頁面導覽">
          <a
            class="footer-link footer-link-community"
            href="https://t.me/+ItoPt4GgiatlODRl"
            target="_blank"
            rel="noreferrer"
          >
            加入 Telegram 群組
          </a>
          <RouterLink
            v-for="item in allNavigationItems"
            :key="`footer-${item.path}`"
            :to="item.path"
            class="footer-link"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>

      <div class="footer-bottomline">
        <div class="footer-stat-pills">
          <div v-for="item in footerStats" :key="item.label" class="footer-stat-pill">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <p class="footer-note">
          資料來源涵蓋 TWSE、TAIFEX 與基金公司公開揭露資料，僅供研究參考，不構成投資建議。
        </p>
      </div>
    </footer>

    <nav class="mobile-dock" aria-label="手機底部導覽">
      <RouterLink
        v-for="item in primaryNavigationItems"
        :key="`dock-${item.path}`"
        :to="item.path"
        class="mobile-dock-link"
        :class="{ 'is-active': isActiveRoute(item.path) }"
      >
        {{ item.label }}
      </RouterLink>

      <div ref="mobileMoreMenuRef" class="mobile-more-menu">
        <button
          type="button"
          class="mobile-dock-link mobile-more-trigger"
          :class="{ 'is-active': isMoreActive || isMoreMenuOpen }"
          :aria-expanded="String(isMoreMenuOpen)"
          @click="toggleMoreMenu"
        >
          更多
        </button>

        <div v-if="isMoreMenuOpen" class="mobile-more-panel">
          <RouterLink
            v-for="item in secondaryNavigationItems"
            :key="`mobile-more-${item.path}`"
            :to="item.path"
            class="mobile-more-link"
            :class="{ 'is-active': isActiveRoute(item.path) }"
            @click="closeMoreMenu"
          >
            {{ item.label }}
          </RouterLink>
        </div>
      </div>
    </nav>
  </div>
</template>
