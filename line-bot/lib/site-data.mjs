const DEFAULT_SITE_URL = 'https://joe94113.github.io/TW_Active_Tracker';

function trimTrailingSlash(value) {
  return String(value ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export function createSiteDataClient(siteUrl = DEFAULT_SITE_URL) {
  const baseUrl = trimTrailingSlash(siteUrl);
  const cache = new Map();

  async function fetchJson(relativePath) {
    const normalizedPath = String(relativePath ?? '').replace(/^\/+/, '');
    const url = `${baseUrl}/${normalizedPath}`;

    if (cache.has(url)) {
      return cache.get(url);
    }

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${url}`);
    }

    const data = await response.json();
    cache.set(url, data);
    return data;
  }

  async function getManifest() {
    return fetchJson('data/manifest.json');
  }

  async function getDashboard() {
    const manifest = await getManifest();
    return fetchJson(manifest.dashboardPath);
  }

  async function getStockSearch() {
    const manifest = await getManifest();
    return fetchJson(manifest.stockSearchPath);
  }

  async function getStockIndex() {
    const manifest = await getManifest();
    return fetchJson(manifest.stockIndexPath);
  }

  async function getTopicIndex() {
    const manifest = await getManifest();
    return fetchJson(manifest.topicRadarPath);
  }

  async function getEntryRadar() {
    const manifest = await getManifest();
    return fetchJson(manifest.entryRadarPath);
  }

  async function getBrokerRadar() {
    const manifest = await getManifest();
    return fetchJson(manifest.brokerBranchRadarPath);
  }

  async function getHighDividendFlow() {
    const manifest = await getManifest();
    return fetchJson(manifest.highDividendEtfFlowPath);
  }

  async function getGlobalMarkets() {
    const manifest = await getManifest();
    return fetchJson(manifest.globalMarketsPath);
  }

  async function getStockDetail(code) {
    const normalizedCode = String(code ?? '').trim();

    if (!normalizedCode) {
      return null;
    }

    try {
      return await fetchJson(`data/stocks/${normalizedCode}.json`);
    } catch {
      return null;
    }
  }

  async function findStock(query) {
    const keyword = String(query ?? '').trim();

    if (!keyword) {
      return null;
    }

    const stockSearch = await getStockSearch();
    const normalizedKeyword = keyword.toLowerCase();

    const exact =
      stockSearch.find((item) => String(item?.code ?? '').trim() === keyword) ??
      stockSearch.find((item) => String(item?.name ?? '').trim() === keyword);

    if (exact) {
      return exact;
    }

    const fuzzy =
      stockSearch.find((item) => String(item?.name ?? '').toLowerCase().includes(normalizedKeyword)) ??
      stockSearch.find((item) => String(item?.code ?? '').toLowerCase().includes(normalizedKeyword)) ??
      null;

    if (fuzzy) {
      return fuzzy;
    }

    // Fall back to the stock index because some candidates may have detail JSON
    // even when they are not yet included in search.json.
    const stockIndex = await getStockIndex();
    const indexExact =
      stockIndex.find((item) => String(item?.code ?? '').trim() === keyword) ??
      stockIndex.find((item) => String(item?.name ?? '').trim() === keyword);

    if (indexExact) {
      return indexExact;
    }

    return (
      stockIndex.find((item) => String(item?.name ?? '').toLowerCase().includes(normalizedKeyword)) ??
      stockIndex.find((item) => String(item?.code ?? '').toLowerCase().includes(normalizedKeyword)) ??
      null
    );
  }

  return {
    baseUrl,
    fetchJson,
    getManifest,
    getDashboard,
    getStockSearch,
    getStockIndex,
    getTopicIndex,
    getEntryRadar,
    getBrokerRadar,
    getHighDividendFlow,
    getGlobalMarkets,
    getStockDetail,
    findStock,
  };
}
