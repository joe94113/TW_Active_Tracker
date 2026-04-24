import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';
import EtfOverlapPage from './pages/EtfOverlapPage.vue';
import EtfListPage from './pages/EtfListPage.vue';
import EtfDetailPage from './pages/EtfDetailPage.vue';
import StockDetailPage from './pages/StockDetailPage.vue';
import ThemeRadarPage from './pages/ThemeRadarPage.vue';
import FuturesPage from './pages/FuturesPage.vue';
import StockRadarPage from './pages/StockRadarPage.vue';
import StockClassroomPage from './pages/StockClassroomPage.vue';
import EntryRadarPage from './pages/EntryRadarPage.vue';
import HighDividendEtfFlowPage from './pages/HighDividendEtfFlowPage.vue';
import TomorrowWatchlistPage from './pages/TomorrowWatchlistPage.vue';
import FavoritesHealthPage from './pages/FavoritesHealthPage.vue';
import StockScannerPage from './pages/StockScannerPage.vue';
import EventStatsPage from './pages/EventStatsPage.vue';
import OfficialRadarPage from './pages/OfficialRadarPage.vue';
import { applySeoMeta } from './lib/seo';

export const ROUTE_NAME = {
  HOME: 'home',
  ETF_OVERLAP: 'etf-overlap',
  ETF_LIST: 'etf-list',
  ETF_DETAIL: 'etf-detail',
  STOCK_DETAIL: 'stock-detail',
  THEME_RADAR: 'theme-radar',
  FUTURES: 'futures',
  STOCK_RADAR: 'stock-radar',
  STOCK_CLASSROOM: 'stock-classroom',
  ENTRY_RADAR: 'entry-radar',
  HIGH_DIVIDEND_ETF_FLOW: 'high-dividend-etf-flow',
  TOMORROW_WATCHLIST: 'tomorrow-watchlist',
  FAVORITES_HEALTH: 'favorites-health',
  STOCK_SCANNER: 'stock-scanner',
  EVENT_STATS: 'event-stats',
  OFFICIAL_RADAR: 'official-radar',
};

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: ROUTE_NAME.HOME,
      component: HomePage,
      meta: {
        title: '台股大盤、熱門股與主動式 ETF 風向球',
        description: '整合台股大盤即時走勢、熱門股排行、主動式 ETF 持股異動、法人觀察與技術面研究入口。',
      },
    },
    {
      path: '/etf-overlap',
      name: ROUTE_NAME.ETF_OVERLAP,
      component: EtfOverlapPage,
      meta: {
        title: 'ETF 重疊持股觀察',
        description: '快速比較主動式 ETF 與熱門股票的重疊持股、權重分布與市場風向。',
      },
    },
    {
      path: '/etfs',
      name: ROUTE_NAME.ETF_LIST,
      component: EtfListPage,
      meta: {
        title: '主動式 ETF 清單',
        description: '瀏覽台股主動式 ETF 清單、最新持股揭露、前一日異動與技術面快覽。',
      },
    },
    {
      path: '/etfs/:code',
      name: ROUTE_NAME.ETF_DETAIL,
      component: EtfDetailPage,
      props: true,
      meta: {
        title: '主動式 ETF 明細',
        description: '查看主動式 ETF 最新成分股、前一日異動、技術面與持股分散。',
      },
    },
    {
      path: '/entry-radar',
      name: ROUTE_NAME.ENTRY_RADAR,
      component: EntryRadarPage,
      meta: {
        title: '起漲卡位雷達',
        description: '把量縮轉強、整理待突破、法人剛轉買、題材剛升溫與補漲候選集中整理，快速找出剛起漲的台股。',
      },
    },
    {
      path: '/high-dividend-etfs',
      name: ROUTE_NAME.HIGH_DIVIDEND_ETF_FLOW,
      component: HighDividendEtfFlowPage,
      meta: {
        title: '高股息 ETF 換股雷達',
        description: '用官方高股息 ETF 名單、最近揭露資料與共識加碼 / 減碼清單，快速看高息與收益型 ETF 最近把資金移到哪些台股。',
      },
    },
    {
      path: '/watchlist',
      name: ROUTE_NAME.TOMORROW_WATCHLIST,
      component: TomorrowWatchlistPage,
      meta: {
        title: '隔日觀察清單',
        description: '把明日盤勢、穩健型、積極型與剛轉強名單整理成同一頁，盤後快速看隔日重點。',
      },
    },
    {
      path: '/favorites-health',
      name: ROUTE_NAME.FAVORITES_HEALTH,
      component: FavoritesHealthPage,
      meta: {
        title: '自選股健檢中心',
        description: '把自選股的健康分數、追價風險、五日籌碼與事件後表現集中整理。',
      },
    },
    {
      path: '/scanner',
      name: ROUTE_NAME.STOCK_SCANNER,
      component: StockScannerPage,
      meta: {
        title: '選股條件篩選器',
        description: '用外資、投信、題材、健康度與隔日觀察條件快速掃描台股候選名單。',
      },
    },
    {
      path: '/event-stats',
      name: ROUTE_NAME.EVENT_STATS,
      component: EventStatsPage,
      meta: {
        title: '事件後表現統計',
        description: '整理月營收、法說、財報與除息後的歷史反應，幫助判斷事件交易節奏。',
      },
    },
    {
      path: '/official-radar',
      name: ROUTE_NAME.OFFICIAL_RADAR,
      component: OfficialRadarPage,
      meta: {
        title: '官方交易雷達',
        description: '把處置股、變更交易、注意股與即將除息事件集中整理，先看哪些股票需要避開、哪些事件值得提前觀察。',
      },
    },
    {
      path: '/radar',
      name: ROUTE_NAME.STOCK_RADAR,
      component: StockRadarPage,
      meta: {
        title: '選股雷達',
        description: '把技術突破、籌碼偏多、整理待發、題材輪動與風險排除整理成同一頁的選股工作台。',
      },
    },
    {
      path: '/classroom',
      name: ROUTE_NAME.STOCK_CLASSROOM,
      component: StockClassroomPage,
      meta: {
        title: '股票小教室',
        description: '用簡單易懂的方式理解技術分析、量價、籌碼、期貨與微台指，建立新手友善的看盤流程。',
      },
    },
    {
      path: '/themes',
      name: ROUTE_NAME.THEME_RADAR,
      component: ThemeRadarPage,
      meta: {
        title: '資金題材雷達',
        description: '用題材強度排行、龍頭股與補漲股拆開看台股近期資金輪動，快速找到值得深挖的題材與個股。',
      },
    },
    {
      path: '/futures',
      name: ROUTE_NAME.FUTURES,
      component: FuturesPage,
      meta: {
        title: '小台 / 微台期貨籌碼與走勢',
        description: '集中看小型臺指期貨與微型臺指期貨的法人未平倉、方向判讀與技術走勢圖，方便盤後單獨研究。',
      },
    },
    {
      path: '/stocks/:code',
      name: ROUTE_NAME.STOCK_DETAIL,
      component: StockDetailPage,
      props: true,
      meta: {
        title: '台股個股研究',
        description: '整合個股技術分析、法人籌碼、持股分級、財務面、關鍵價位與新聞關鍵字。',
      },
    },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

router.afterEach((to) => {
  applySeoMeta({
    title: to.meta?.title,
    description: to.meta?.description,
    routePath: to.fullPath,
  });
});

export default router;
