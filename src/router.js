import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';
import EtfOverlapPage from './pages/EtfOverlapPage.vue';
import EtfListPage from './pages/EtfListPage.vue';
import EtfDetailPage from './pages/EtfDetailPage.vue';
import StockDetailPage from './pages/StockDetailPage.vue';
import ThemeRadarPage from './pages/ThemeRadarPage.vue';
import FuturesPage from './pages/FuturesPage.vue';
import StockRadarPage from './pages/StockRadarPage.vue';
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
      path: '/radar',
      name: ROUTE_NAME.STOCK_RADAR,
      component: StockRadarPage,
      meta: {
        title: '選股雷達',
        description: '把技術突破、籌碼偏多、整理待發、題材輪動與風險排除整理成同一頁的選股工作台。',
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
