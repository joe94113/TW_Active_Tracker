import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';
import EtfOverlapPage from './pages/EtfOverlapPage.vue';
import EtfListPage from './pages/EtfListPage.vue';
import EtfDetailPage from './pages/EtfDetailPage.vue';
import StockDetailPage from './pages/StockDetailPage.vue';

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
    { path: '/', name: ROUTE_NAME.HOME, component: HomePage },
    { path: '/etf-overlap', name: ROUTE_NAME.ETF_OVERLAP, component: EtfOverlapPage },
    { path: '/etfs', name: ROUTE_NAME.ETF_LIST, component: EtfListPage },
    { path: '/etfs/:code', name: ROUTE_NAME.ETF_DETAIL, component: EtfDetailPage, props: true },
    { path: '/stocks/:code', name: ROUTE_NAME.STOCK_DETAIL, component: StockDetailPage, props: true },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
