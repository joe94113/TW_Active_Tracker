<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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

const primaryNavigationItems = [
  { label: '首頁', path: '/' },
  { label: '卡位雷達', path: '/entry-radar' },
  { label: '資金題材', path: '/themes' },
  { label: '主動式 ETF', path: '/etfs' },
];

const secondaryNavigationItems = [
  {
    label: '選股雷達',
    path: '/radar',
    tag: '選股',
    description: '把技術突破、籌碼偏多、整理待發與風險排除集中整理成選股工作台。',
  },
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

secondaryNavigationItems.push({
  label: '高息 ETF',
  path: '/high-dividend-etfs',
  tag: '換股',
  description: '集中看高股息 / 收益型 ETF 最近在買進或賣出哪些台股，順著 ETF 換股方向找標的。',
});

secondaryNavigationItems.push(
  {
    label: '自選看盤',
    path: '/watchboard',
    tag: '自選',
    description: '把自選股集中在同一頁，看價格、雙法人、題材與風險，盤中盤後都能快速掃描。',
  },
  {
    label: '產業脈動',
    path: '/industry-pulse',
    tag: '產業',
    description: '先看哪個產業升溫，再看哪些股票今天突然放量或波動加大。',
  },
  {
    label: '國際盤',
    path: '/global-markets',
    tag: '全球',
    description: '把美股、亞洲股市、原油、黃金與外匯放在同一頁，盤前先看全球風向。',
  },
  {
    label: '每日亞幣',
    path: '/asian-currency-watch',
    tag: '匯率',
    description: '集中看日圓、韓元、人民幣、台幣、外資、NASDAQ 與美債殖利率。',
  },
  {
    label: '新聞熱度',
    path: '/market-buzz',
    tag: '熱度',
    description: '整理近期熱門新聞關鍵詞、題材熱度與話題股，快速抓市場最近在看什麼。',
  },
  {
    label: '隔日觀察',
    path: '/watchlist',
    tag: '盤後',
    description: '把明日盤勢、穩健型、積極型與剛轉強名單整理在同一頁。',
  },
  {
    label: '自選健檢',
    path: '/favorites-health',
    tag: '自選',
    description: '集中看自選股的健康分數、過熱風險、五日籌碼與事件表現。',
  },
  {
    label: '條件掃描',
    path: '/scanner',
    tag: '掃描',
    description: '用外資、投信、題材、健康度與隔日觀察條件快速篩選台股。',
  },
  {
    label: '事件統計',
    path: '/event-stats',
    tag: '統計',
    description: '整理月營收、法說、財報與除息後的歷史反應，幫助判斷交易節奏。',
  },
);

secondaryNavigationItems.push({
  label: '處置股雷達',
  path: '/disposition-radar',
  tag: '處置',
  description: '對比進處置前 10 天與處置期間的主力買賣超，辨識真吃貨、護盤套牢與倒貨股。',
});

secondaryNavigationItems.push({
  label: '官方交易雷達',
  path: '/official-radar',
  tag: '風險',
  description: '集中看處置股、變更交易、注意股與即將除息事件，盤後先確認哪些股票需要避開、哪些事件值得提前留意。',
});

secondaryNavigationItems.push({
  label: '勝率分點雷達',
  path: '/broker-branches',
  tag: '分點',
  description: '整理勝率高的券商分點最近偏多、偏空與推薦台股，直接看分點資金最近卡位了哪些股票。',
});

secondaryNavigationItems.push({
  label: 'Serenity 觀點雷達',
  path: '/serenity-radar',
  tag: '美股 AI',
  description: '追蹤 Serenity 公開貼文提及的 AI 與半導體供應鏈美股，整理多頭、空頭與中立觀點變化。',
});

const allNavigationItems = [...primaryNavigationItems, ...secondaryNavigationItems];

const featuredMorePaths = ['/radar', '/disposition-radar', '/watchboard', '/favorites-health'];

const moreMenuSections = [
  {
    title: '市場總覽',
    subtitle: '盤前盤後先看風向',
    paths: ['/global-markets', '/asian-currency-watch', '/futures', '/industry-pulse', '/market-buzz', '/official-radar'],
  },
  {
    title: '個股工具',
    subtitle: '選股、掃描與籌碼追蹤',
    paths: ['/radar', '/scanner', '/disposition-radar', '/broker-branches', '/watchboard', '/favorites-health', '/watchlist'],
  },
  {
    title: 'ETF 工具',
    subtitle: '成分、重疊與換股方向',
    paths: ['/etf-overlap', '/high-dividend-etfs'],
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
    return `目前資料日停在 ${globalDataFreshness.value.marketDate ?? '未知日期'}，全站已視為歷史回看，推播與選股判讀請保守使用。`;
  }

  if (globalDataFreshness.value.isWarning) {
    return '資料已超過盤中更新容忍時間，下一輪排程成功後會自動恢復正常。';
  }

  return '資料時間可用，頁面訊號仍以公開資料整理為研究參考。';
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
    label: '判讀模式',
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
    return ['/favorites-health', '/industry-pulse', '/scanner'];
  }

  if (route.path.startsWith('/stocks/')) {
    return ['/favorites-health', '/scanner', '/disposition-radar'];
  }

  if (route.path.startsWith('/industry-pulse') || route.path.startsWith('/themes')) {
    return ['/radar', '/scanner', '/market-buzz'];
  }

  if (route.path.startsWith('/serenity-radar')) {
    return ['/global-markets', '/themes', '/event-stats'];
  }

  if (route.path.startsWith('/global-markets')) {
    return ['/asian-currency-watch', '/futures', '/industry-pulse'];
  }

  if (route.path.startsWith('/asian-currency-watch')) {
    return ['/global-markets', '/futures', '/industry-pulse'];
  }

  return ['/radar', '/industry-pulse', '/event-stats'];
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
      subtitle: '近期新增入口',
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
  <div class="app-shell min-h-screen">
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
                  <span>快速切換盤勢、選股、ETF 與研究頁面</span>
                </div>
                <span class="more-menu-count">{{ filteredSecondaryNavigationItems.length }} 個入口</span>
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
                <section v-if="featuredMoreItems.length" class="more-menu-featured" aria-label="常用入口">
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

                <p v-else class="more-menu-empty">沒有找到符合的入口</p>
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
              <span>{{ filteredSecondaryNavigationItems.length }} 個入口，已依任務分組</span>
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
                <strong>此頁建議</strong>
                <span>依目前頁面挑出下一步最常用入口。</span>
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

            <section v-if="featuredMoreItems.length" class="mobile-more-featured" aria-label="常用入口">
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

            <p v-if="!moreMenuGroups.length" class="more-menu-empty">沒有找到符合的入口</p>
          </div>
        </div>
      </div>
    </nav>
  </div>
</template>
