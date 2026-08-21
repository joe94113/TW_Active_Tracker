import { createRouter, createWebHashHistory } from 'vue-router';
import { applySeoMeta } from './lib/seo';

const HomePage = () => import('./pages/HomePage.vue');
const EtfCenterPage = () => import('./pages/EtfCenterPage.vue');
const EtfDetailPage = () => import('./pages/EtfDetailPage.vue');
const StockDetailPage = () => import('./pages/StockDetailPage.vue');
const ThemeCenterPage = () => import('./pages/ThemeCenterPage.vue');
const FuturesPage = () => import('./pages/FuturesPage.vue');
const StockScannerCenterPage = () => import('./pages/StockScannerCenterPage.vue');
const StockClassroomPage = () => import('./pages/StockClassroomPage.vue');
const EntryRadarPage = () => import('./pages/EntryRadarPage.vue');
const TomorrowWatchlistPage = () => import('./pages/TomorrowWatchlistPage.vue');
const SelfCenterPage = () => import('./pages/SelfCenterPage.vue');
const EventStatsPage = () => import('./pages/EventStatsPage.vue');
const OfficialCenterPage = () => import('./pages/OfficialCenterPage.vue');
const BrokerBranchRadarPage = () => import('./pages/BrokerBranchRadarPage.vue');
const GlobalMarketsPage = () => import('./pages/GlobalMarketsPage.vue');
const AsianCurrencyWatchPage = () => import('./pages/AsianCurrencyWatchPage.vue');
const SerenityRadarPage = () => import('./pages/SerenityRadarPage.vue');

function redirectWithView(path, view) {
  return (to) => ({
    path,
    query: { ...to.query, view },
    hash: to.hash,
  });
}

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
  SELF_CENTER: 'self-center',
  FAVORITES_HEALTH: 'favorites-health',
  STOCK_SCANNER: 'stock-scanner',
  EVENT_STATS: 'event-stats',
  OFFICIAL_RADAR: 'official-radar',
  DISPOSITION_RADAR: 'disposition-radar',
  BROKER_BRANCH_RADAR: 'broker-branch-radar',
  WATCHBOARD: 'watchboard',
  INDUSTRY_PULSE: 'industry-pulse',
  GLOBAL_MARKETS: 'global-markets',
  ASIAN_CURRENCY_WATCH: 'asian-currency-watch',
  MARKET_BUZZ: 'market-buzz',
  SERENITY_RADAR: 'serenity-radar',
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
      redirect: redirectWithView('/etfs', 'overlap'),
    },
    {
      path: '/etfs',
      name: ROUTE_NAME.ETF_LIST,
      component: EtfCenterPage,
      meta: {
        title: 'ETF 中心',
        description: '集中查看 ETF 清單、持股重疊與高股息 ETF 換股方向。',
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
      redirect: redirectWithView('/etfs', 'dividend'),
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
      redirect: redirectWithView('/self-center', 'health'),
    },
    {
      path: '/self-center',
      name: ROUTE_NAME.SELF_CENTER,
      component: SelfCenterPage,
      meta: {
        title: '自選中心',
        description: '集中查看自選股的即時表現、籌碼與健康檢查。',
      },
    },
    {
      path: '/scanner',
      name: ROUTE_NAME.STOCK_SCANNER,
      component: StockScannerCenterPage,
      meta: {
        title: '條件掃描',
        description: '用自訂條件或今日精選快速查看符合條件的台股。',
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
      path: '/disposition-radar',
      redirect: redirectWithView('/official-radar', 'disposition'),
    },
    {
      path: '/official-radar',
      name: ROUTE_NAME.OFFICIAL_RADAR,
      component: OfficialCenterPage,
      meta: {
        title: '官方交易',
        description: '集中查看官方風險名單、處置期間籌碼與近期事件。',
      },
    },
    {
      path: '/broker-branches',
      name: ROUTE_NAME.BROKER_BRANCH_RADAR,
      component: BrokerBranchRadarPage,
      meta: {
        title: '勝率分點雷達',
        description: '整理勝率較高的券商分點最近買賣了哪些台股，並直接給出值得觀察的推薦名單。',
      },
    },
    {
      path: '/watchboard',
      redirect: redirectWithView('/self-center', 'watch'),
    },
    {
      path: '/industry-pulse',
      redirect: redirectWithView('/themes', 'industry'),
    },
    {
      path: '/global-markets',
      name: ROUTE_NAME.GLOBAL_MARKETS,
      component: GlobalMarketsPage,
      meta: {
        title: '國際盤 / 原物料 / 外匯儀表板',
        description: '把國際股指、原油、黃金與外匯放在同一頁，盤前先看全球風向再判斷台股節奏。',
      },
    },
    {
      path: '/asian-currency-watch',
      name: ROUTE_NAME.ASIAN_CURRENCY_WATCH,
      component: AsianCurrencyWatchPage,
      meta: {
        title: '台股每日亞幣觀察',
        description: '集中查看日圓、韓元、人民幣、台幣、外資買賣超、NASDAQ 與美國 10 年期公債殖利率。',
      },
    },
    {
      path: '/market-buzz',
      redirect: redirectWithView('/themes', 'news'),
    },
    {
      path: '/serenity-radar',
      name: ROUTE_NAME.SERENITY_RADAR,
      component: SerenityRadarPage,
      meta: {
        title: 'Serenity 觀點雷達',
        description: '整理 Serenity 公開 X 貼文提及的美股 AI 與半導體供應鏈股票，追蹤多頭、空頭與中立觀點變化。',
      },
    },
    {
      path: '/radar',
      redirect: redirectWithView('/scanner', 'recommended'),
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
      component: ThemeCenterPage,
      meta: {
        title: '資金題材',
        description: '集中查看題材排行、產業熱度與新聞熱度。',
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
