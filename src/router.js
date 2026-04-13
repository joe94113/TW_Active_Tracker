import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';
import EtfOverlapPage from './pages/EtfOverlapPage.vue';
import EtfListPage from './pages/EtfListPage.vue';
import EtfDetailPage from './pages/EtfDetailPage.vue';
import StockDetailPage from './pages/StockDetailPage.vue';
import { applySeoMeta } from './lib/seo';

export const ROUTE_NAME = {
  HOME: 'home',
  ETF_OVERLAP: 'etf-overlap',
  ETF_LIST: 'etf-list',
  ETF_DETAIL: 'etf-detail',
  STOCK_DETAIL: 'stock-detail',
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
