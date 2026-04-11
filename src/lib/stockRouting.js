import { ROUTE_NAME } from '../router';

export function isStockCode(code) {
  return /^[1-9]\d{3}$/.test(String(code ?? '').trim());
}

export function createStockRoute(code) {
  return {
    name: ROUTE_NAME.STOCK_DETAIL,
    params: {
      code: String(code ?? '').trim(),
    },
  };
}
