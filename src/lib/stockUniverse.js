function normalizeCode(value) {
  return String(value ?? '').trim();
}

export function mergeStockUniverse(stockSummaries = [], stockSearchList = []) {
  const summaryMap = new Map(
    (stockSummaries ?? [])
      .filter(Boolean)
      .map((item) => [normalizeCode(item.code), item])
      .filter(([code]) => code),
  );
  const searchMap = new Map(
    (stockSearchList ?? [])
      .filter(Boolean)
      .map((item) => [normalizeCode(item.code), item])
      .filter(([code]) => code),
  );
  const codes = new Set([...summaryMap.keys(), ...searchMap.keys()]);

  return [...codes]
    .map((code) => {
      const summary = summaryMap.get(code) ?? {};
      const search = searchMap.get(code) ?? {};
      return {
        ...search,
        ...summary,
        code,
        name: summary.name ?? search.name ?? code,
        industryName: summary.industryName ?? search.industryName ?? null,
      };
    })
    .filter((item) => item.code && item.name);
}

export function createStockCodeMap(stockList = []) {
  return new Map(
    (stockList ?? [])
      .filter(Boolean)
      .map((item) => [normalizeCode(item.code), item])
      .filter(([code]) => code),
  );
}
