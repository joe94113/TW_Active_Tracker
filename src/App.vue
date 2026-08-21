<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useGlobalData } from './composables/useGlobalData';
import GlobalStockSearch from './components/GlobalStockSearch.vue';
import DataFreshnessBadge from './components/DataFreshnessBadge.vue';
import { getDataFreshnessStatus } from './lib/dataFreshness';

const route = useRoute();
const { dashboard, manifest, loadGlobalData } = useGlobalData();

const isCompactHeader = ref(false);
const isMoreMenuOpen = ref(false);
const moreMenuQuery = ref('');
const recentMorePaths = ref([]);
const desktopMoreMenuRef = ref(null);
const desktopMoreTriggerRef = ref(null);
const desktopMoreSearchRef = ref(null);
const mobileMoreMenuRef = ref(null);
const themePreference = ref('system');
const resolvedTheme = ref('light');
const moreMenuPanelTop = ref(84);

let mediaQuery = null;
let mediaQueryHandler = null;
let outsideClickHandler = null;
let colorSchemeQuery = null;
let colorSchemeHandler = null;

const THEME_STORAGE_KEY = 'tw-active-tracker-theme';
const MORE_RECENT_STORAGE_KEY = 'tw-active-tracker-more-recent-paths';
const HEADER_COMPACT_QUERY = '(max-width: 900px)';
const INVESTOR_CENTER_PATHS = new Set([
  '/self-center',
  '/scanner',
  '/official-radar',
  '/themes',
  '/etfs',
]);

const primaryNavigationItems = [
  { label: '首頁', path: '/' },
  { label: '卡位雷達', path: '/entry-radar' },
  { label: '資金題材', path: '/themes' },
  { label: 'ETF 中心', path: '/etfs' },
];

const isInvestorCenterRoute = computed(() => INVESTOR_CENTER_PATHS.has(route.path));

const secondaryNavigationItems = [
  {
    label: '自選中心',
    path: '/self-center',
    tag: '自選',
    description: '集中查看自選股的漲跌、籌碼與健康狀況。',
  },
  {
    label: '條件掃描',
    path: '/scanner',
    tag: '選股',
    description: '用自訂條件或今日精選快速縮小名單。',
  },
  {
    label: '官方交易',
    path: '/official-radar',
    tag: '風險',
    description: '查看注意股、處置籌碼與近期事件。',
  },
  {
    label: '股票小教室',
    path: '/classroom',
    tag: '教學',
    description: '用簡單方式看懂量價、均線、籌碼與期貨。',
  },
  {
    label: '期貨籌碼',
    path: '/futures',
    tag: '觀察',
    description: '查看小台、微台與法人未平倉方向。',
  },
  {
    label: '國際市場',
    path: '/global-markets',
    tag: '全球',
    description: '查看美股、亞洲股市、原油、黃金與外匯。',
  },
  {
    label: '每日亞幣',
    path: '/asian-currency-watch',
    tag: '匯率',
    description: '查看亞幣、外資、NASDAQ 與美債殖利率。',
  },
  {
    label: '明日觀察',
    path: '/watchlist',
    tag: '盤後',
    description: '查看明日盤勢與優先觀察名單。',
  },
  {
    label: '事件統計',
    path: '/event-stats',
    tag: '統計',
    description: '查看月營收、法說、財報與除息後表現。',
  },
  {
    label: '勝率分點',
    path: '/broker-branches',
    tag: '分點',
    description: '查看近期表現較穩定的券商分點動向。',
  },
  {
    label: 'Serenity 觀點',
    path: '/serenity-radar',
    tag: '美股',
    description: '查看美股 AI 與半導體供應鏈觀點。',
  },
];

const allNavigationItems = [...primaryNavigationItems, ...secondaryNavigationItems];

const featuredMorePaths = ['/self-center', '/scanner', '/official-radar', '/global-markets'];

const moreMenuSections = [
  {
    title: '市場總覽',
    subtitle: '盤前盤後先看風向',
    paths: ['/global-markets', '/asian-currency-watch', '/futures', '/official-radar'],
  },
  {
    title: '個股工具',
    subtitle: '自選、選股與籌碼',
    paths: ['/self-center', '/scanner', '/broker-branches', '/watchlist'],
  },
  {
    title: '研究與紀錄',
    subtitle: '事件、教學與海外觀點',
    paths: ['/event-stats', '/classroom', '/serenity-radar'],
  },
];

const secondaryNavigationByPath = new Map(secondaryNavigationItems.map((item) => [item.path, item]));

function normalizeMorePath(path) {
  const text = String(path ?? '').trim();
  if (!text || text === '/') return null;

  const exact = secondaryNavigationByPath.get(text);
  if (exact) return exact.path;

  return secondaryNavigationItems.find((item) => text.startsWith(`${item.path}/`))?.path ?? null;
}

function readRecentMorePaths() {
  if (typeof window === 'undefined') return;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(MORE_RECENT_STORAGE_KEY) ?? '[]');
    recentMorePaths.value = Array.isArray(parsed)
      ? parsed.map(normalizeMorePath).filter(Boolean).slice(0, 3)
      : [];
  } catch {
    recentMorePaths.value = [];
  }
}

function rememberMorePath(path) {
  const normalizedPath = normalizeMorePath(path);
  if (!normalizedPath) return;

  recentMorePaths.value = [
    normalizedPath,
    ...recentMorePaths.value.filter((item) => item !== normalizedPath),
  ].slice(0, 3);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MORE_RECENT_STORAGE_KEY, JSON.stringify(recentMorePaths.value));
  }
}

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
  moreMenuQuery.value = '';
}

function updateMoreMenuPanelPosition() {
  if (typeof window === 'undefined') {
    return;
  }

  const rect = desktopMoreTriggerRef.value?.getBoundingClientRect();
  moreMenuPanelTop.value = Math.round((rect?.bottom ?? 74) + 10);
}

function toggleMoreMenu() {
  if (isMoreMenuOpen.value) {
    closeMoreMenu();
    return;
  }

  isMoreMenuOpen.value = true;

  if (!isCompactHeader.value) {
    nextTick(() => {
      updateMoreMenuPanelPosition();
      desktopMoreSearchRef.value?.focus();
    });
  }
}

function resolveSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(preference = themePreference.value) {
  const nextTheme = preference === 'system' ? resolveSystemTheme() : preference;
  resolvedTheme.value = nextTheme;

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = nextTheme;
  }
}

function toggleTheme() {
  themePreference.value = resolvedTheme.value === 'dark' ? 'light' : 'dark';

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference.value);
  }

  applyTheme();
}

const generatedAtText = computed(() => formatGeneratedAt(manifest.value?.generatedAt));
const siteIconHref = `${import.meta.env.BASE_URL}favicon.svg`;
const isMoreActive = computed(() => secondaryNavigationItems.some((item) => isActiveRoute(item.path)));
const themeToggleLabel = computed(() => (resolvedTheme.value === 'dark' ? '日間' : '夜間'));
const themeToggleHint = computed(() => (resolvedTheme.value === 'dark' ? '切換為淺色模式' : '切換為深色模式'));

provide('themeControl', {
  resolvedTheme,
  toggleTheme,
  themeToggleHint,
});

const globalMarketDate = computed(
  () =>
    dashboard.value?.市場總覽?.即時狀態?.marketDate ??
    dashboard.value?.市場總覽?.盤後資料日期 ??
    dashboard.value?.市場總覽?.資料日期 ??
    manifest.value?.generatedAtLocalDate ??
    null,
);
const globalDataFreshness = computed(() =>
  getDataFreshnessStatus({
    generatedAt: dashboard.value?.generatedAt ?? manifest.value?.generatedAt,
    marketDate: globalMarketDate.value,
  }),
);
const globalFreshnessMessage = computed(() => {
  if (globalDataFreshness.value.isStale) {
    return `目前資料停在 ${globalDataFreshness.value.marketDate ?? '未知日期'}，本頁僅供回看，不作為今日選股依據。`;
  }

  if (globalDataFreshness.value.isWarning) {
    return '資料尚在更新，請稍後再確認最新數值。';
  }

  return '資料已更新，內容僅供研究參考。';
});
const globalStatusItems = computed(() => [
  {
    label: '資料日',
    value: globalDataFreshness.value.marketDate ?? '整理中',
  },
  {
    label: '最近整理',
    value: generatedAtText.value,
  },
  {
    label: '資料用途',
    value: globalDataFreshness.value.isStale
      ? '歷史回看'
      : globalDataFreshness.value.isWarning
        ? '等待更新'
        : '今日可用',
  },
]);
const normalizedMoreMenuQuery = computed(() => moreMenuQuery.value.trim().toLowerCase());
const filteredSecondaryNavigationItems = computed(() => {
  const query = normalizedMoreMenuQuery.value;

  if (!query) {
    return secondaryNavigationItems;
  }

  return secondaryNavigationItems.filter((item) =>
    [item.label, item.tag, item.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
});
const filteredSecondaryNavigationPaths = computed(
  () => new Set(filteredSecondaryNavigationItems.value.map((item) => item.path)),
);
const featuredMoreItems = computed(() =>
  featuredMorePaths
    .map((path) => secondaryNavigationByPath.get(path))
    .filter((item) => item && filteredSecondaryNavigationPaths.value.has(item.path)),
);
const mobileRecentMoreItems = computed(() =>
  recentMorePaths.value
    .map((path) => secondaryNavigationByPath.get(path))
    .filter((item) => item && filteredSecondaryNavigationPaths.value.has(item.path)),
);
const recommendedMorePaths = computed(() => {
  if (route.path === '/') {
    return ['/self-center', '/scanner', '/global-markets'];
  }

  if (route.path.startsWith('/stocks/')) {
    return ['/self-center', '/scanner', '/official-radar'];
  }

  if (route.path.startsWith('/themes')) {
    return ['/scanner', '/official-radar', '/event-stats'];
  }

  if (route.path.startsWith('/serenity-radar')) {
    return ['/global-markets', '/themes', '/event-stats'];
  }

  if (route.path.startsWith('/global-markets')) {
    return ['/asian-currency-watch', '/futures', '/official-radar'];
  }

  if (route.path.startsWith('/asian-currency-watch')) {
    return ['/global-markets', '/futures', '/official-radar'];
  }

  return ['/scanner', '/global-markets', '/event-stats'];
});
const mobileRecommendedMoreItems = computed(() =>
  recommendedMorePaths.value
    .map((path) => secondaryNavigationByPath.get(path))
    .filter(
      (item) =>
        item &&
        filteredSecondaryNavigationPaths.value.has(item.path) &&
        !mobileRecentMoreItems.value.some((recentItem) => recentItem.path === item.path),
    )
    .slice(0, 3),
);
const moreMenuGroups = computed(() => {
  const assignedPaths = new Set();
  const groups = moreMenuSections
    .map((section) => {
      const items = section.paths
        .map((path) => secondaryNavigationByPath.get(path))
        .filter((item) => item && filteredSecondaryNavigationPaths.value.has(item.path));

      items.forEach((item) => assignedPaths.add(item.path));

      return {
        ...section,
        items,
      };
    })
    .filter((section) => section.items.length);

  const uncategorizedItems = filteredSecondaryNavigationItems.value.filter((item) => !assignedPaths.has(item.path));

  if (uncategorizedItems.length) {
    groups.push({
      title: '其他工具',
      subtitle: '其他可用頁面',
      items: uncategorizedItems,
    });
  }

  return groups;
});
const moreMenuPanelStyle = computed(() => ({
  '--more-menu-top': `${moreMenuPanelTop.value}px`,
}));

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

  if (typeof window !== 'undefined') {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      themePreference.value = storedTheme;
    }

    readRecentMorePaths();
    rememberMorePath(route.path);
  }
  applyTheme();

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia(HEADER_COMPACT_QUERY);
    isCompactHeader.value = mediaQuery.matches;
    mediaQueryHandler = (event) => {
      isCompactHeader.value = event.matches;
      closeMoreMenu();
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', mediaQueryHandler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(mediaQueryHandler);
    }

    colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    colorSchemeHandler = () => {
      if (themePreference.value === 'system') {
        applyTheme();
      }
    };

    if (typeof colorSchemeQuery.addEventListener === 'function') {
      colorSchemeQuery.addEventListener('change', colorSchemeHandler);
    } else if (typeof colorSchemeQuery.addListener === 'function') {
      colorSchemeQuery.addListener(colorSchemeHandler);
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
        closeMoreMenu();
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

  if (colorSchemeQuery && colorSchemeHandler) {
    if (typeof colorSchemeQuery.removeEventListener === 'function') {
      colorSchemeQuery.removeEventListener('change', colorSchemeHandler);
    } else if (typeof colorSchemeQuery.removeListener === 'function') {
      colorSchemeQuery.removeListener(colorSchemeHandler);
    }
  }

  if (outsideClickHandler && typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', outsideClickHandler);
  }
});

watch(
  () => route.path,
  () => {
    rememberMorePath(route.path);
    closeMoreMenu();
  },
);
</script>

<template>
  <div class="app-shell min-h-screen" :class="{ 'has-investor-center': isInvestorCenterRoute }">
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
              ref="desktopMoreTriggerRef"
              type="button"
              class="nav-link more-trigger"
              :class="{ 'is-active': isMoreActive || isMoreMenuOpen }"
              aria-haspopup="menu"
              :aria-expanded="String(isMoreMenuOpen)"
              @click="toggleMoreMenu"
            >
              更多
            </button>

            <div
              v-if="isMoreMenuOpen"
              class="more-menu-panel more-menu-panel-desktop"
              :style="moreMenuPanelStyle"
            >
              <div class="more-menu-panel-head">
              <div>
                <strong>工具總覽</strong>
                <span>快速找到想看的市場與選股頁面</span>
              </div>
                <span class="more-menu-count">{{ filteredSecondaryNavigationItems.length }} 個頁面</span>
              </div>

              <label class="more-menu-search">
                <span>搜尋</span>
                <input
                  ref="desktopMoreSearchRef"
                  v-model="moreMenuQuery"
                  type="search"
                  autocomplete="off"
                  aria-label="搜尋更多導覽"
                  placeholder="輸入 ETF、處置、分點、Serenity..."
                  @keydown.stop
                />
              </label>

              <div class="more-menu-scroll">
                <section v-if="featuredMoreItems.length" class="more-menu-featured" aria-label="常用頁面">
                  <RouterLink
                    v-for="item in featuredMoreItems"
                    :key="`desktop-more-featured-${item.path}`"
                    :to="item.path"
                    class="more-menu-featured-card"
                    :class="{ 'is-active': isActiveRoute(item.path) }"
                    @click="closeMoreMenu"
                  >
                    <span class="more-menu-card-tag">{{ item.tag }}</span>
                    <strong>{{ item.label }}</strong>
                  </RouterLink>
                </section>

                <div v-if="moreMenuGroups.length" class="more-menu-section-grid">
                  <section
                    v-for="group in moreMenuGroups"
                    :key="group.title"
                    class="more-menu-section"
                  >
                    <div class="more-menu-section-head">
                      <strong>{{ group.title }}</strong>
                      <span>{{ group.subtitle }}</span>
                    </div>

                    <div class="more-menu-section-links">
                      <RouterLink
                        v-for="item in group.items"
                        :key="`desktop-more-${group.title}-${item.path}`"
                        :to="item.path"
                        class="more-menu-card"
                        :class="{ 'is-active': isActiveRoute(item.path) }"
                        @click="closeMoreMenu"
                      >
                        <span class="more-menu-card-tag">{{ item.tag }}</span>
                        <span class="more-menu-card-copy">
                          <strong>{{ item.label }}</strong>
                          <span>{{ item.description }}</span>
                        </span>
                      </RouterLink>
                    </div>
                  </section>
                </div>

                <p v-else class="more-menu-empty">沒有找到符合的頁面</p>
              </div>
            </div>
          </div>
        </nav>

        <div class="app-toolbar">
          <GlobalStockSearch />
          <button
            type="button"
            class="theme-toggle"
            :aria-label="themeToggleHint"
            :title="themeToggleHint"
            :aria-pressed="String(resolvedTheme === 'dark')"
            @click="toggleTheme"
          >
            <span class="theme-toggle-icon" aria-hidden="true">
              <svg
                v-if="resolvedTheme === 'dark'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="4.2"></circle>
                <path d="M12 2.6v2.3M12 19.1v2.3M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.6 12h2.3M19.1 12h2.3M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"></path>
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M20.2 14.2A8.4 8.4 0 1 1 9.8 3.8a6.9 6.9 0 0 0 10.4 10.4Z"></path>
              </svg>
            </span>
            <span class="theme-toggle-label">{{ themeToggleLabel }}</span>
          </button>
        </div>
      </div>
    </header>

    <section
      v-if="manifest"
      class="global-data-status"
      :class="[`is-${globalDataFreshness.tone}`, { 'is-attention': globalDataFreshness.isWarning }]"
      aria-label="全站資料狀態"
    >
      <div class="global-data-status-copy">
        <span>資料狀態</span>
        <strong>{{ globalDataFreshness.label }}</strong>
        <p>{{ globalFreshnessMessage }}</p>
      </div>
      <div class="global-data-status-metrics" aria-label="資料狀態細節">
        <div v-for="item in globalStatusItems" :key="item.label" class="global-data-status-metric">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
      <div class="global-data-status-side">
        <DataFreshnessBadge
          :generated-at="dashboard?.generatedAt ?? manifest?.generatedAt"
          :market-date="globalMarketDate"
          size="compact"
        />
        <RouterLink class="global-data-status-link" to="/event-stats">查看更新紀錄</RouterLink>
      </div>
    </section>

    <main class="app-main mx-auto w-full">
      <RouterView />
    </main>

    <footer class="app-footer">
      <div class="footer-topline">
        <div class="footer-identity">
          <RouterLink class="footer-brand" to="/">台股主動通</RouterLink>
          <p class="footer-text">把每天要看的市場、選股與研究資料整理在一起。</p>
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
          <a
            class="footer-link footer-link-line"
            href="https://lin.ee/Ule2sZA"
            target="_blank"
            rel="noreferrer"
          >
            加入 LINE 官方帳號
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
          aria-haspopup="menu"
          :aria-expanded="String(isMoreMenuOpen)"
          @click="toggleMoreMenu"
        >
          更多
        </button>

        <div v-if="isMoreMenuOpen" class="mobile-more-panel" role="dialog" aria-label="工具導覽">
          <div class="mobile-more-panel-head">
            <div>
              <strong>工具導覽</strong>
              <span>{{ filteredSecondaryNavigationItems.length }} 個頁面</span>
            </div>
            <button type="button" class="mobile-more-close" aria-label="關閉工具導覽" @click="closeMoreMenu">
              關閉
            </button>
          </div>

          <label class="more-menu-search mobile-more-search">
            <span>搜尋</span>
            <input
              v-model="moreMenuQuery"
              type="search"
              autocomplete="off"
              aria-label="搜尋工具導覽"
              placeholder="輸入處置、ETF、分點..."
              @keydown.stop
            />
          </label>

          <div class="mobile-more-scroll">
            <section v-if="mobileRecentMoreItems.length" class="mobile-more-section is-priority">
              <div class="mobile-more-section-head">
                <strong>最近使用</strong>
                <span>先回到你剛剛用過的工具。</span>
              </div>
              <div class="mobile-more-link-grid">
                <RouterLink
                  v-for="item in mobileRecentMoreItems"
                  :key="`mobile-recent-${item.path}`"
                  :to="item.path"
                  class="mobile-more-card is-featured"
                  :class="{ 'is-active': isActiveRoute(item.path) }"
                  @click="closeMoreMenu"
                >
                  <span class="more-menu-card-tag">{{ item.tag }}</span>
                  <span class="mobile-more-card-copy">
                    <strong>{{ item.label }}</strong>
                    <small>{{ item.description }}</small>
                  </span>
                </RouterLink>
              </div>
            </section>

            <section v-if="mobileRecommendedMoreItems.length" class="mobile-more-section is-priority">
              <div class="mobile-more-section-head">
                <strong>接著可看</strong>
                <span>和目前內容相關的頁面。</span>
              </div>
              <div class="mobile-more-link-grid">
                <RouterLink
                  v-for="item in mobileRecommendedMoreItems"
                  :key="`mobile-recommended-${item.path}`"
                  :to="item.path"
                  class="mobile-more-card"
                  :class="{ 'is-active': isActiveRoute(item.path) }"
                  @click="closeMoreMenu"
                >
                  <span class="more-menu-card-tag">{{ item.tag }}</span>
                  <span class="mobile-more-card-copy">
                    <strong>{{ item.label }}</strong>
                    <small>{{ item.description }}</small>
                  </span>
                </RouterLink>
              </div>
            </section>

            <section v-if="featuredMoreItems.length" class="mobile-more-featured" aria-label="常用頁面">
              <RouterLink
                v-for="item in featuredMoreItems"
                :key="`mobile-featured-${item.path}`"
                :to="item.path"
                class="mobile-more-card is-featured"
                :class="{ 'is-active': isActiveRoute(item.path) }"
                @click="closeMoreMenu"
              >
                <span class="more-menu-card-tag">{{ item.tag }}</span>
                <strong>{{ item.label }}</strong>
              </RouterLink>
            </section>

            <section
              v-for="group in moreMenuGroups"
              :key="`mobile-group-${group.title}`"
              class="mobile-more-section"
            >
              <div class="mobile-more-section-head">
                <strong>{{ group.title }}</strong>
                <span>{{ group.subtitle }}</span>
              </div>
              <div class="mobile-more-link-grid">
                <RouterLink
                  v-for="item in group.items"
                  :key="`mobile-more-${group.title}-${item.path}`"
                  :to="item.path"
                  class="mobile-more-card"
                  :class="{ 'is-active': isActiveRoute(item.path) }"
                  @click="closeMoreMenu"
                >
                  <span class="more-menu-card-tag">{{ item.tag }}</span>
                  <span class="mobile-more-card-copy">
                    <strong>{{ item.label }}</strong>
                    <small>{{ item.description }}</small>
                  </span>
                </RouterLink>
              </div>
            </section>

            <p v-if="!moreMenuGroups.length" class="more-menu-empty">沒有找到符合的頁面</p>
          </div>
        </div>
      </div>
    </nav>
  </div>
</template>
