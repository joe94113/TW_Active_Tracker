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
const themePreference = ref('system');
const resolvedTheme = ref('light');

let mediaQuery = null;
let mediaQueryHandler = null;
let outsideClickHandler = null;
let colorSchemeQuery = null;
let colorSchemeHandler = null;

const THEME_STORAGE_KEY = 'tw-active-tracker-theme';

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
  }
  applyTheme();

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
    isMoreMenuOpen.value = false;
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
