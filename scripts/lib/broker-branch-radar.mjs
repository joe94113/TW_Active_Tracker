import { stripHtml } from '../../src/lib/newsKeywords.js';

const STOCK_CODE_RE = /^[1-9]\d{3}$/;
const TOPIC_LIMIT = 5;
const TOP_BRANCH_LIMIT = 10;
const CANDIDATE_STOCK_LIMIT = 28;
const SCOUT_STOCK_LIMIT_PER_MARKET = 18;
const SCOUT_MOMENTUM_LIMIT_PER_MARKET = 10;
const BROKER_SOURCE_KEYS = ['histock', 'fubon', 'cmoney'];
const DEFAULT_SOURCE_REQUEST_POLICY = Object.freeze({
  timeoutMs: 10000,
  maxAttempts: 2,
  baseBackoffMs: 1200,
  maxBackoffMs: 10000,
  maxRetryAfterMs: 30000,
  histockMinIntervalMs: 350,
  histockJitterMs: 250,
  histockCircuitThreshold: 2,
  histockCircuitCooldownMs: 60000,
});
const COVERAGE_GATE_MINIMUM_RATIO = 0.8;
const PRIMARY_SOURCE_GATE_MINIMUM_RATIO = 0.8;
const BRANCH_SOURCE_GATE_MINIMUM_RATIO = 0.8;
const BLOCK_PAGE_PATTERNS = [
  /<title[^>]*>\s*just a moment(?:\.{3})?\s*<\/title>/i,
  /\bcf-chl-[a-z0-9_-]+/i,
  /attention required!?\s*\|\s*cloudflare/i,
  /\bcloudflare ray id\b/i,
  /\benable javascript and cookies to continue\b/i,
  /\bchecking your browser before accessing\b/i,
  /\baccess denied\b/i,
];
const HISTOCK_HEADERS = {
  'user-agent': 'Mozilla/5.0',
  'accept-language': 'zh-TW,zh;q=0.9',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  referer: 'https://histock.tw/',
};
const CMONEY_HEADERS = {
  'user-agent': 'Mozilla/5.0',
  'accept-language': 'zh-TW,zh;q=0.9',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  referer: 'https://www.cmoney.tw/',
};
const FUBON_DJ_HEADERS = {
  'user-agent': 'Mozilla/5.0',
  'accept-language': 'zh-TW,zh;q=0.9',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  referer: 'https://fubon-ebrokerdj.fbs.com.tw/',
};
const BROKER_BRANCH_WATCHLIST = [
  { bno: '8440', name: '摩根大通' },
  { bno: '1480', name: '美商高盛' },
  { bno: '1440', name: '美林' },
  { bno: '1470', name: '台灣摩根士丹利' },
  { bno: '9268', name: '凱基-台北' },
  { bno: '5850', name: '統一' },
  { bno: '9600', name: '富邦' },
  { bno: '9676', name: '富邦-仁愛' },
  { bno: '9800', name: '元大' },
  { bno: '9207', name: '凱基-永和' },
  { bno: '9846', name: '元大-大直' },
];
const WATCHED_BRANCH_CODE_SET = new Set(BROKER_BRANCH_WATCHLIST.map((branch) => branch.bno));
const WATCHED_BRANCH_NAME_TO_CODE = new Map(BROKER_BRANCH_WATCHLIST.map((branch) => [branch.name, branch.bno]));

function compactText(value) {
  return stripHtml(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const text = compactText(value)
    .replaceAll(',', '')
    .replaceAll('%', '')
    .replaceAll('＋', '+')
    .replaceAll('－', '-');

  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function isStockCode(code) {
  return STOCK_CODE_RE.test(String(code ?? '').trim());
}

function average(values) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (!validValues.length) return null;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function buildStockMap(stockMetaList = []) {
  return new Map(
    stockMetaList
      .filter((item) => item?.code)
      .map((item) => [String(item.code).trim(), item]),
  );
}

function normalizeLotsToShares(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value) * 1000;
}

function buildLiquidityKey(tradeValue) {
  if (!Number.isFinite(tradeValue)) return 'low';
  if (tradeValue >= 2000000000) return 'very-high';
  if (tradeValue >= 800000000) return 'high';
  if (tradeValue >= 150000000) return 'mid-high';
  if (tradeValue >= 50000000) return 'mid';
  return 'low';
}

function isTradableStock(stockMeta = {}) {
  const dailyTradeValue = Number(stockMeta?.dailyTradeValue ?? 0);
  const averageTradeValue = Number(stockMeta?.avgTradeValue ?? 0);
  const liquidityKey = String(stockMeta?.liquidityTier?.key ?? '');

  return (
    dailyTradeValue >= 50000000 ||
    averageTradeValue >= 50000000 ||
    ['very-high', 'high', 'mid-high'].includes(liquidityKey)
  );
}

function createFallbackStockMeta({
  code,
  name,
  close = null,
  changePercent = null,
  dailyTradeValue = null,
  volume = null,
  market = null,
}) {
  return {
    code,
    name,
    close,
    changePercent,
    dailyTradeValue,
    avgTradeValue: dailyTradeValue,
    volume,
    market,
    liquidityTier: {
      key: buildLiquidityKey(dailyTradeValue),
    },
    industryName: null,
    return20: null,
    foreign5Day: null,
    investmentTrust5Day: null,
    foreignTargetPrice: null,
    foreignTargetPricePremium: null,
    foreignTargetBroker: null,
    topSignalTitle: null,
    topSignalTone: 'normal',
    topSelectionSignalTitle: null,
    selectionSignalTone: 'info',
    themeTitle: null,
  };
}

function addCandidate(candidates, stockMap, sourceItem, origin, weight) {
  const code = String(sourceItem?.code ?? '').trim();

  if (!isStockCode(code)) {
    return;
  }

  const stockMeta = stockMap.get(code);

  if (stockMeta && !isTradableStock(stockMeta)) {
    return;
  }

  const existing = candidates.get(code) ?? {
    code,
    name: stockMeta?.name ?? sourceItem?.name ?? code,
    score: 0,
    origins: new Set(),
  };

  existing.score += weight;
  existing.origins.add(origin);
  candidates.set(code, existing);
}

function buildCandidateStocks({ stockMetaList = [], selectionRadar = null, entryRadar = null, themeRadar = null }) {
  const stockMap = buildStockMap(stockMetaList);
  const candidates = new Map();

  for (const item of selectionRadar?.institutionalResonance ?? []) {
    addCandidate(candidates, stockMap, item, '雙法人共振', 28);
  }

  for (const item of selectionRadar?.volumeSqueezeRisers ?? []) {
    addCandidate(candidates, stockMap, item, '量縮轉強', 22);
  }

  for (const item of selectionRadar?.consolidationWatch ?? []) {
    addCandidate(candidates, stockMap, item, '整理待突破', 20);
  }

  for (const [key, items] of Object.entries(entryRadar?.sections ?? {})) {
    const originMap = {
      freshStarters: '起漲卡位',
      nearBreakouts: '接近突破',
      institutionalTurns: '法人剛轉買',
      themeIgnition: '題材剛升溫',
      catchUpCandidates: '補漲候選',
    };

    for (const item of items ?? []) {
      addCandidate(candidates, stockMap, item, originMap[key] ?? '分點候選', 18);
    }
  }

  for (const topic of (themeRadar?.topics ?? []).slice(0, TOPIC_LIMIT)) {
    for (const item of topic?.leaderStocks ?? []) {
      addCandidate(candidates, stockMap, item, `${topic.title} 龍頭`, 18);
    }

    for (const item of topic?.catchUpStocks ?? []) {
      addCandidate(candidates, stockMap, item, `${topic.title} 補漲`, 14);
    }
  }

  if (candidates.size < 12) {
    const supplements = [...stockMetaList]
      .filter((item) => isStockCode(item?.code) && isTradableStock(item))
      .sort((left, right) =>
        (Number(right.selectionSignalCount ?? 0) - Number(left.selectionSignalCount ?? 0)) ||
        (Number(right.dailyTradeValue ?? 0) - Number(left.dailyTradeValue ?? 0)),
      )
      .slice(0, 20);

    for (const item of supplements) {
      addCandidate(candidates, stockMap, item, '流動性補充', 10);
    }
  }

  return [...candidates.values()]
    .sort((left, right) => right.score - left.score || left.code.localeCompare(right.code))
    .slice(0, CANDIDATE_STOCK_LIMIT)
    .map((item) => ({
      code: item.code,
      name: item.name,
      score: item.score,
      origins: [...item.origins],
      meta: stockMap.get(item.code) ?? null,
    }));
}

function extractTableRows(html, marker) {
  const index = html.indexOf(marker);

  if (index < 0) {
    return [];
  }

  const tableEndIndex = html.indexOf('</table>', index);

  if (tableEndIndex < 0) {
    return [];
  }

  const tableHtml = html.slice(index, tableEndIndex);
  return [...tableHtml.matchAll(/<tr[^>]*align="center"[^>]*>([\s\S]*?)<\/tr>/gim)].map((match) => match[1]);
}

function parseStockBranchRows(html, code) {
  return extractTableRows(html, 'CPHB1_chipAnalysis1_gBuy')
    .map((rowHtml, index) => {
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gim)].map((match) => match[1]);

      if (cells.length < 13) {
        return null;
      }

      const branchName = compactText(cells[1]);
      const bno = rowHtml.match(/bno=(\d+)/)?.[1] ?? null;
      const rank = Number(rowHtml.match(/top-(\d+)-30PX/i)?.[1] ?? index + 1);
      const performance = toNumber(cells[2]);
      const totalProfitK = toNumber(cells[3]);
      const realizedProfitK = toNumber(cells[4]);
      const unrealizedProfitK = toNumber(cells[5]);
      const netLots = normalizeLotsToShares(toNumber(cells[6]));
      const buyLots = normalizeLotsToShares(toNumber(cells[7]));
      const sellLots = normalizeLotsToShares(toNumber(cells[8]));
      const avgPrice = toNumber(cells[9]);
      const avgBuy = toNumber(cells[10]);
      const avgSell = toNumber(cells[11]);
      const currentPrice = toNumber(cells[12]);

      if (!branchName || !bno || performance === null || totalProfitK === null) {
        return null;
      }

      return {
        code,
        bno,
        branchName,
        rank,
        performance,
        totalProfitK,
        realizedProfitK,
        unrealizedProfitK,
        netLots,
        buyLots,
        sellLots,
        avgPrice,
        avgBuy,
        avgSell,
        currentPrice,
      };
    })
    .filter(Boolean);
}

function parseBranchStockRows(html) {
  return extractTableRows(html, 'CPHB1_bt1_g')
    .map((rowHtml) => {
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gim)].map((match) => match[1]);

      if (cells.length < 12) {
        return null;
      }

      const code = rowHtml.match(/no=([0-9A-Za-z]+)/)?.[1] ?? null;

      if (!isStockCode(code)) {
        return null;
      }

      return {
        code,
        name: compactText(cells[0]),
        performance: toNumber(cells[1]),
        totalProfitK: toNumber(cells[2]),
        realizedProfitK: toNumber(cells[3]),
        unrealizedProfitK: toNumber(cells[4]),
        netLots: normalizeLotsToShares(toNumber(cells[5])),
        buyLots: normalizeLotsToShares(toNumber(cells[6])),
        sellLots: normalizeLotsToShares(toNumber(cells[7])),
        avgPrice: toNumber(cells[8]),
        avgBuy: toNumber(cells[9]),
        avgSell: toNumber(cells[10]),
        currentPrice: toNumber(cells[11]),
      };
    })
    .filter(Boolean);
}

function parseStockDailyBranchRows(html, code) {
  const jsonMatch = html.match(/var\s+jsonDatas\s*=\s*eval\((\{[\s\S]*?\})\);/im);

  if (jsonMatch?.[1]) {
    try {
      const payload = JSON.parse(jsonMatch[1]);
      const buyRows = (payload?.Buy ?? [])
        .map((item) => ({
          code,
          bno: String(item?.Number ?? '').trim(),
          branchName: compactText(item?.Name),
          performance: null,
          totalProfitK: null,
          realizedProfitK: null,
          unrealizedProfitK: null,
          netLots: (toNumber(item?.BSSum) ?? 0) * 1000,
          buyLots: (toNumber(item?.BuySum) ?? 0) * 1000,
          sellLots: (toNumber(item?.SellSum) ?? 0) * 1000,
          avgPrice: toNumber(item?.Price),
          avgBuy: null,
          avgSell: null,
          currentPrice: null,
          sourceType: 'stock-branch-daily',
        }))
        .filter((item) => item.bno && item.branchName);
      const sellRows = (payload?.Sell ?? [])
        .map((item) => ({
          code,
          bno: String(item?.Number ?? '').trim(),
          branchName: compactText(item?.Name),
          performance: null,
          totalProfitK: null,
          realizedProfitK: null,
          unrealizedProfitK: null,
          netLots: (toNumber(item?.BSSum) ?? 0) * 1000,
          buyLots: (toNumber(item?.BuySum) ?? 0) * 1000,
          sellLots: (toNumber(item?.SellSum) ?? 0) * 1000,
          avgPrice: toNumber(item?.Price),
          avgBuy: null,
          avgSell: null,
          currentPrice: null,
          sourceType: 'stock-branch-daily',
        }))
        .filter((item) => item.bno && item.branchName);

      if (buyRows.length || sellRows.length) {
        return [...sellRows, ...buyRows];
      }
    } catch {
      // Fall back to parsing the rendered table when the embedded payload is unavailable.
    }
  }

  const tableMatch = html.match(/<table[^>]*class="tb-stock tbChip tbHide"[^>]*>([\s\S]*?)<\/table>/im);

  if (!tableMatch) {
    return [];
  }

  return [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gim)]
    .map((match) => match[1])
    .map((rowHtml) => {
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gim)].map((cell) => cell[1]);

      if (cells.length < 10) {
        return [];
      }

      const linkMatches = [...rowHtml.matchAll(/brokertrace\.aspx\?bno=(\d+)&no=/gim)];
      const sellBranchBno = linkMatches[0]?.[1] ?? null;
      const buyBranchBno = linkMatches[1]?.[1] ?? null;

      const sellBranchName = compactText(cells[0]);
      const buyBranchName = compactText(cells[5]);
      const sellBuyLots = toNumber(cells[1]);
      const sellSellLots = toNumber(cells[2]);
      const sellNetLots = toNumber(cells[3]);
      const sellAvgPrice = toNumber(cells[4]);
      const buyBuyLots = toNumber(cells[6]);
      const buySellLots = toNumber(cells[7]);
      const buyNetLots = toNumber(cells[8]);
      const buyAvgPrice = toNumber(cells[9]);

      const rows = [];

      if (sellBranchBno && sellBranchName && Number.isFinite(sellNetLots)) {
        rows.push({
          code,
          bno: sellBranchBno,
          branchName: sellBranchName,
          performance: null,
          totalProfitK: null,
          realizedProfitK: null,
          unrealizedProfitK: null,
          netLots: sellNetLots * 1000,
          buyLots: (sellBuyLots ?? 0) * 1000,
          sellLots: (sellSellLots ?? 0) * 1000,
          avgPrice: sellAvgPrice,
          avgBuy: null,
          avgSell: null,
          currentPrice: null,
          sourceType: 'stock-branch-daily',
        });
      }

      if (buyBranchBno && buyBranchName && Number.isFinite(buyNetLots)) {
        rows.push({
          code,
          bno: buyBranchBno,
          branchName: buyBranchName,
          performance: null,
          totalProfitK: null,
          realizedProfitK: null,
          unrealizedProfitK: null,
          netLots: buyNetLots * 1000,
          buyLots: (buyBuyLots ?? 0) * 1000,
          sellLots: (buySellLots ?? 0) * 1000,
          avgPrice: buyAvgPrice,
          avgBuy: null,
          avgSell: null,
          currentPrice: null,
          sourceType: 'stock-branch-daily',
        });
      }

      return rows;
    })
    .flat();
}

function parseCMoneyStockBranchRows(html, code) {
  return [...html.matchAll(
    /<a href="\/forum\/stock\/\d+\?s=broker&amp;agent=([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a><\/td>\s*<td[^>]*>\s*([+-]?[0-9,]+)\s*<\/td>\s*<td[^>]*>\s*([0-9.]+)\s*<\/td>/gim,
  )]
    .map((match) => {
      const bno = String(match[1] ?? '').trim();
      const branchName = compactText(match[2]);
      const netLots = toNumber(match[3]);
      const avgPrice = toNumber(match[4]);

      if (!bno || !branchName || !Number.isFinite(netLots)) {
        return null;
      }

      const normalizedNetLots = Number(netLots) * 1000;

      return {
        code,
        bno,
        branchName,
        performance: null,
        totalProfitK: null,
        realizedProfitK: null,
        unrealizedProfitK: null,
        netLots: normalizedNetLots,
        buyLots: normalizedNetLots > 0 ? normalizedNetLots : 0,
        sellLots: normalizedNetLots < 0 ? Math.abs(normalizedNetLots) : 0,
        avgPrice,
        avgBuy: null,
        avgSell: null,
        currentPrice: null,
        sourceType: 'stock-branch-cmoney',
      };
    })
    .filter(Boolean);
}

function resolveWatchedBranchCode(candidateBno, branchName) {
  const normalizedBno = String(candidateBno ?? '').trim();

  if (normalizedBno && WATCHED_BRANCH_CODE_SET.has(normalizedBno)) {
    return normalizedBno;
  }

  return WATCHED_BRANCH_NAME_TO_CODE.get(compactText(branchName)) ?? normalizedBno ?? null;
}

function parseFubonDjStockBranchRows(html, code) {
  return [...html.matchAll(
    /<TR>\s*<TD class="t4t1" nowrap><a href="([^"]+?)">([^<]+?)<\/a><\/TD>\s*<TD class="t3n1">([\d,]+)<\/TD>\s*<TD class="t3n1">([\d,]+)<\/TD>\s*<TD class="t3n1">([\d,]+)<\/TD>\s*<TD class="t3n1">([^<]+)<\/TD>\s*<TD class="t4t1" nowrap><a href="([^"]+?)">([^<]+?)<\/a><\/TD>\s*<TD class="t3n1">([\d,]+)<\/TD>\s*<TD class="t3n1">([\d,]+)<\/TD>\s*<TD class="t3n1">([\d,]+)<\/TD>\s*<TD class="t3n1">([^<]+)<\/TD>\s*<\/tr>/gim,
  )]
    .flatMap((match) => {
      const buyLink = match[1] ?? '';
      const buyName = compactText(match[2]);
      const buyBuyLots = toNumber(match[3]) ?? 0;
      const buySellLots = toNumber(match[4]) ?? 0;
      const buyNetLots = toNumber(match[5]) ?? 0;
      const sellLink = match[7] ?? '';
      const sellName = compactText(match[8]);
      const sellBuyLots = toNumber(match[9]) ?? 0;
      const sellSellLots = toNumber(match[10]) ?? 0;
      const sellNetLots = toNumber(match[11]) ?? 0;
      const buyBno = resolveWatchedBranchCode(buyLink.match(/[?&]b=([^&"]+)/i)?.[1] ?? null, buyName);
      const sellBno = resolveWatchedBranchCode(sellLink.match(/[?&]b=([^&"]+)/i)?.[1] ?? null, sellName);

      const rows = [];

      if (buyBno && buyName && Number.isFinite(buyNetLots) && buyNetLots > 0) {
        rows.push({
          code,
          bno: buyBno,
          branchName: buyName,
          performance: null,
          totalProfitK: null,
          realizedProfitK: null,
          unrealizedProfitK: null,
          netLots: buyNetLots * 1000,
          buyLots: buyBuyLots * 1000,
          sellLots: buySellLots * 1000,
          avgPrice: null,
          avgBuy: null,
          avgSell: null,
          currentPrice: null,
          sourceType: 'stock-branch-fubon-dj',
        });
      }

      if (sellBno && sellName && Number.isFinite(sellNetLots) && sellNetLots > 0) {
        rows.push({
          code,
          bno: sellBno,
          branchName: sellName,
          performance: null,
          totalProfitK: null,
          realizedProfitK: null,
          unrealizedProfitK: null,
          netLots: -sellNetLots * 1000,
          buyLots: sellBuyLots * 1000,
          sellLots: sellSellLots * 1000,
          avgPrice: null,
          avgBuy: null,
          avgSell: null,
          currentPrice: null,
          sourceType: 'stock-branch-fubon-dj',
        });
      }

      return rows;
    })
    .filter(Boolean);
}

async function fetchTwseActiveQuotes(fetchJson) {
  const rows = await fetchJson('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
  return rows
    .map((row) => {
      const code = String(row?.Code ?? '').trim();
      if (!isStockCode(code)) return null;

      const close = toNumber(row?.ClosingPrice);
      const change = toNumber(row?.Change);
      const directionText = compactText(row?.Dir);
      const signedChange = directionText === '-' ? -(Math.abs(change ?? 0)) : change;
      const priorClose =
        Number.isFinite(close) && Number.isFinite(signedChange) ? Number(close) - Number(signedChange) : null;
      const changePercent =
        Number.isFinite(close) && Number.isFinite(priorClose) && Math.abs(priorClose) > 0
          ? (Number(signedChange) / priorClose) * 100
          : null;

      return createFallbackStockMeta({
        code,
        name: compactText(row?.Name) || code,
        close,
        changePercent,
        dailyTradeValue: toNumber(row?.TradeValue),
        volume: toNumber(row?.TradeVolume),
        market: 'twse',
      });
    })
    .filter(Boolean);
}

function parseSignedOtcChange(value) {
  const text = compactText(value);
  if (!text) return null;
  const numeric = Number(text.replaceAll(',', '').replaceAll('+', ''));
  if (!Number.isFinite(numeric)) return null;
  return text.startsWith('-') ? -Math.abs(numeric) : Math.abs(numeric);
}

async function fetchTpexActiveQuotes(fetchJson) {
  const rows = await fetchJson('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes');
  return rows
    .map((row) => {
      const code = String(row?.SecuritiesCompanyCode ?? '').trim();
      if (!isStockCode(code)) return null;

      const close = toNumber(row?.Close);
      const signedChange = parseSignedOtcChange(row?.Change);
      const priorClose =
        Number.isFinite(close) && Number.isFinite(signedChange) ? Number(close) - Number(signedChange) : null;
      const changePercent =
        Number.isFinite(close) && Number.isFinite(priorClose) && Math.abs(priorClose) > 0
          ? (Number(signedChange) / priorClose) * 100
          : null;

      return createFallbackStockMeta({
        code,
        name: compactText(row?.CompanyName) || code,
        close,
        changePercent,
        dailyTradeValue: toNumber(row?.TransactionAmount),
        volume: toNumber(row?.TradingShares),
        market: 'tpex',
      });
    })
    .filter(Boolean);
}

function mergeStockMaps(primaryMap, fallbackStocks = []) {
  const merged = new Map(primaryMap);

  for (const stock of fallbackStocks) {
    if (!stock?.code || merged.has(stock.code)) continue;
    merged.set(stock.code, stock);
  }

  return merged;
}

function buildScoutStocks({ candidateStocks = [], stockMap, twseQuotes = [], tpexQuotes = [] }) {
  const pool = new Map();

  for (const item of candidateStocks) {
    const stockMeta = stockMap.get(item.code);
    if (!stockMeta) continue;
    pool.set(item.code, {
      code: item.code,
      name: stockMeta.name ?? item.name ?? item.code,
      priority: 100 + Number(item.score ?? 0),
      source: 'candidate',
    });
  }

  const addRanked = (items, source, startPriority) => {
    for (const [index, item] of items.entries()) {
      if (!item?.code) continue;
      const priority = startPriority - index;
      const existing = pool.get(item.code);

      if (!existing || priority > existing.priority) {
        pool.set(item.code, {
          code: item.code,
          name: item.name ?? existing?.name ?? item.code,
          priority,
          source,
        });
      }
    }
  };

  const byTradeValue = (rows) =>
    [...rows]
      .filter((item) => Number(item?.dailyTradeValue ?? 0) >= 150000000)
      .sort((left, right) => Number(right?.dailyTradeValue ?? 0) - Number(left?.dailyTradeValue ?? 0))
      .slice(0, SCOUT_STOCK_LIMIT_PER_MARKET);

  const byMomentum = (rows) =>
    [...rows]
      .filter((item) => Number(item?.dailyTradeValue ?? 0) >= 100000000 && Number(item?.changePercent ?? 0) >= 2.5)
      .sort((left, right) => Number(right?.changePercent ?? 0) - Number(left?.changePercent ?? 0))
      .slice(0, SCOUT_MOMENTUM_LIMIT_PER_MARKET);

  addRanked(byTradeValue(twseQuotes), 'twse-active', 80);
  addRanked(byTradeValue(tpexQuotes), 'tpex-active', 78);
  addRanked(byMomentum(twseQuotes), 'twse-momentum', 70);
  addRanked(byMomentum(tpexQuotes), 'tpex-momentum', 68);

  return [...pool.values()]
    .sort((left, right) => right.priority - left.priority || left.code.localeCompare(right.code))
    .map((item) => ({
      code: item.code,
      name: item.name,
      priority: item.priority,
      source: item.source,
    }));
}

function buildBranchScoutStocks(branchRecentPages = [], stockMap = new Map()) {
  const pool = new Map();

  for (const page of branchRecentPages) {
    for (const row of (page?.rows ?? []).slice(0, 20)) {
      const code = String(row?.code ?? '').trim();
      if (!isStockCode(code)) continue;

      const stockMeta = stockMap.get(code);
      if (stockMeta && !isTradableStock(stockMeta)) continue;

      const existing = pool.get(code);
      const priority =
        Math.max(0, Number(row?.performance ?? 0)) * 6 +
        Math.min(Math.abs(Number(row?.netLots ?? 0)) / 80000, 20) +
        Math.min(Math.max(0, Number(row?.totalProfitK ?? 0)) / 4000, 16);

      if (!existing || priority > existing.priority) {
        pool.set(code, {
          code,
          name: stockMeta?.name ?? row?.name ?? code,
          priority,
          source: 'branch-profit',
        });
      }
    }
  }

  return [...pool.values()]
    .sort((left, right) => right.priority - left.priority || left.code.localeCompare(right.code))
    .slice(0, 80);
}

async function mapInBatches(items, mapper, batchSize = 4) {
  const results = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const mapped = await Promise.all(batch.map(mapper));
    results.push(...mapped);
  }

  return results;
}

function mergeScoutStocks(primaryStocks = [], supplementalStocks = []) {
  const merged = new Map(primaryStocks.map((item) => [item.code, { ...item }]));

  for (const item of supplementalStocks) {
    if (!item?.code) continue;
    const existing = merged.get(item.code);
    if (!existing || Number(item.priority ?? 0) > Number(existing.priority ?? 0)) {
      merged.set(item.code, { ...item });
    }
  }

  return [...merged.values()]
    .sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0) || left.code.localeCompare(right.code));
}

function buildBranchRanking(branchStockPages) {
  const branchMap = new Map();

  for (const page of branchStockPages) {
    if (!page?.rows?.length) continue;

    for (const row of page.rows.slice(0, 6)) {
      if ((row.performance ?? 0) <= 0 || (row.totalProfitK ?? 0) <= 0) {
        continue;
      }

      const existing = branchMap.get(row.bno) ?? {
        bno: row.bno,
        name: row.branchName,
        score: 0,
        candidateHits: 0,
        appearances: [],
        performanceValues: [],
        netLotsValues: [],
      };

      existing.candidateHits += 1;
      existing.score +=
        Math.max(0, 8 - row.rank) * 8 +
        Math.max(0, row.performance) * 18 +
        Math.min(Math.max(0, row.totalProfitK) / 4000, 22) +
        Math.min(Math.max(0, row.netLots ?? 0) / 50000, 20) +
        Math.min(page.candidateScore / 3, 10);
      existing.appearances.push({
        code: page.code,
        name: page.name,
        performance: row.performance,
        netLots: row.netLots,
      });
      existing.performanceValues.push(row.performance);
      existing.netLotsValues.push(row.netLots ?? 0);
      branchMap.set(row.bno, existing);
    }
  }

  return [...branchMap.values()]
    .map((item) => ({
      ...item,
      avgPerformance: average(item.performanceValues),
      avgNetLots: average(item.netLotsValues),
    }))
    .sort((left, right) => right.score - left.score || String(left.bno).localeCompare(String(right.bno)))
    .slice(0, TOP_BRANCH_LIMIT);
}

function createBaseStockEntry(stockMeta, row, branch, extra = {}) {
  const resolvedCode = stockMeta?.code ?? row?.code ?? '';
  const resolvedName = stockMeta?.name ?? row?.stockName ?? row?.name ?? resolvedCode;
  return {
    code: resolvedCode,
    name: resolvedName,
    industryName: stockMeta?.industryName ?? null,
    close: stockMeta?.close ?? row.currentPrice ?? null,
    changePercent: stockMeta?.changePercent ?? null,
    return20: stockMeta?.return20 ?? null,
    foreign5Day: stockMeta?.foreign5Day ?? null,
    investmentTrust5Day: stockMeta?.investmentTrust5Day ?? null,
    foreignTargetPrice: stockMeta?.foreignTargetPrice ?? null,
    foreignTargetPricePremium: stockMeta?.foreignTargetPricePremium ?? null,
    foreignTargetBroker: stockMeta?.foreignTargetBroker ?? null,
    topSignalTitle: stockMeta?.topSignalTitle ?? null,
    topSignalTone: stockMeta?.topSignalTone ?? 'normal',
    selectionSignalTitle: stockMeta?.topSelectionSignalTitle ?? null,
    selectionSignalTone: stockMeta?.selectionSignalTone ?? 'info',
    themeTitle: stockMeta?.themeTitle ?? null,
    score: 0,
    branchCount: 0,
    branchNames: [],
    branchCodes: [],
    avgBranchPerformance: null,
    netLotsTotal: 0,
    buyLotsTotal: 0,
    sellLotsTotal: 0,
    drivers: [],
    ...extra,
  };
}

function pushUnique(list, value) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function buildRecommendedStocks(branchDetails, stockMap) {
  const buyMap = new Map();
  const sellMap = new Map();

  for (const branch of branchDetails) {
    for (const row of branch.latestBuys ?? []) {
      const stockMeta = stockMap.get(row.code);

      if (stockMeta && !isTradableStock(stockMeta)) {
        continue;
      }

      const existing = buyMap.get(row.code) ?? createBaseStockEntry(stockMeta, row, branch);
      const performanceConfidence = row.performance === null || row.performance === undefined ? 0.45 : 1;
      existing.branchCount += 1;
      existing.branchNames.push(branch.name);
      existing.branchCodes.push(branch.bno);
      existing.netLotsTotal += row.netLots ?? 0;
      existing.buyLotsTotal += row.buyLots ?? 0;
      existing.sellLotsTotal += row.sellLots ?? 0;
      existing.avgBranchPerformance = average([existing.avgBranchPerformance, row.performance, branch.avgPerformance]);
      existing.score +=
        branch.score * 0.34 +
        Math.max(0, row.performance ?? 0) * 18 +
        Math.min(Math.max(0, row.netLots ?? 0) / 50000, 18) * performanceConfidence +
        ((stockMeta?.topSignalTone ?? '') === 'up' ? 14 : 0) +
        Math.min(Math.max(0, Number(stockMeta?.foreign5Day ?? 0)) / 800000, 10) +
        Math.min(Math.max(0, Number(stockMeta?.investmentTrust5Day ?? 0)) / 150000, 8);

      if ((stockMeta?.return20 ?? 0) > 25) {
        existing.score -= 10;
      }

      if ((stockMeta?.changePercent ?? 0) > 6) {
        existing.score -= 8;
      }

      pushUnique(existing.drivers, `${branch.name} 偏多`);
      if ((stockMeta?.foreign5Day ?? 0) > 0) pushUnique(existing.drivers, '外資偏多');
      if ((stockMeta?.investmentTrust5Day ?? 0) > 0) pushUnique(existing.drivers, '投信偏多');
      if (stockMeta?.topSignalTitle) pushUnique(existing.drivers, stockMeta.topSignalTitle);
      buyMap.set(row.code, existing);
    }

    for (const row of branch.latestSells ?? []) {
      const stockMeta = stockMap.get(row.code);

      if (stockMeta && !isTradableStock(stockMeta)) {
        continue;
      }

      const existing = sellMap.get(row.code) ?? createBaseStockEntry(stockMeta, row, branch);
      const performanceConfidence = row.performance === null || row.performance === undefined ? 0.45 : 1;
      existing.branchCount += 1;
      existing.branchNames.push(branch.name);
      existing.branchCodes.push(branch.bno);
      existing.netLotsTotal += row.netLots ?? 0;
      existing.buyLotsTotal += row.buyLots ?? 0;
      existing.sellLotsTotal += row.sellLots ?? 0;
      existing.avgBranchPerformance = average([existing.avgBranchPerformance, row.performance, branch.avgPerformance]);
      existing.score +=
        branch.score * 0.28 +
        Math.min(Math.abs(row.netLots ?? 0) / 50000, 18) * performanceConfidence +
        Math.max(0, Number(stockMeta?.return20 ?? 0)) * 0.45 +
        ((stockMeta?.topSignalTone ?? '') === 'down' ? 10 : 0);

      pushUnique(existing.drivers, `${branch.name} 偏空`);
      if (stockMeta?.topSignalTitle) pushUnique(existing.drivers, stockMeta.topSignalTitle);
      sellMap.set(row.code, existing);
    }
  }

  const recommendedStocks = [...buyMap.values()]
    .map((item) => ({
      ...item,
      branchNames: [...new Set(item.branchNames)].slice(0, 4),
      recommendationLabel:
        item.branchCount >= 3 && (item.foreign5Day ?? 0) > 0 && (item.investmentTrust5Day ?? 0) > 0
          ? '分點與雙法人共振'
          : item.branchCount >= 2 && (item.topSignalTone ?? '') === 'up'
            ? '分點偏多'
            : '分點觀察',
      recommendationNote:
        item.branchCount >= 3
          ? '多個高勝率分點同時偏多，可優先放進隔日觀察清單。'
          : '分點開始偏多，但仍要搭配量價與風險控管一起看。',
    }))
    .sort((left, right) => right.score - left.score || left.code.localeCompare(right.code))
    .slice(0, 12);

  const recentBuyFocus = [...buyMap.values()]
    .map((item) => ({
      ...item,
      branchNames: [...new Set(item.branchNames)].slice(0, 4),
    }))
    .sort((left, right) => right.score - left.score || left.code.localeCompare(right.code))
    .slice(0, 18);

  const recentSellFocus = [...sellMap.values()]
    .map((item) => ({
      ...item,
      branchNames: [...new Set(item.branchNames)].slice(0, 4),
      recommendationLabel: item.branchCount >= 2 ? '短線賣壓' : '留意調節',
      recommendationNote:
        item.branchCount >= 2
          ? '高勝率分點同步調節，短線先觀察支撐與量縮是否止穩。'
          : '分點開始轉賣，先別急著追價。',
    }))
    .sort((left, right) => right.score - left.score || left.code.localeCompare(right.code))
    .slice(0, 18);

  return {
    recommendedStocks,
    recentBuyFocus,
    recentSellFocus,
  };
}

function mergeBranchRows(primaryRows = [], supplementalRows = []) {
  const merged = new Map(primaryRows.map((row) => [row.code, { ...row }]));

  for (const row of supplementalRows) {
    const existing = merged.get(row.code);
    if (!existing) {
      merged.set(row.code, { ...row });
      continue;
    }

    merged.set(row.code, {
      ...existing,
      ...row,
      name: existing.name ?? row.name ?? null,
      branchName: existing.branchName ?? row.branchName ?? null,
      netLots: row.netLots ?? existing.netLots ?? null,
      buyLots: row.buyLots ?? existing.buyLots ?? null,
      sellLots: row.sellLots ?? existing.sellLots ?? null,
      avgPrice: row.avgPrice ?? existing.avgPrice ?? null,
      performance: existing.performance ?? row.performance ?? null,
      totalProfitK: existing.totalProfitK ?? row.totalProfitK ?? null,
      realizedProfitK: existing.realizedProfitK ?? row.realizedProfitK ?? null,
      unrealizedProfitK: existing.unrealizedProfitK ?? row.unrealizedProfitK ?? null,
      avgBuy: existing.avgBuy ?? row.avgBuy ?? null,
      avgSell: existing.avgSell ?? row.avgSell ?? null,
      currentPrice: existing.currentPrice ?? row.currentPrice ?? null,
      sourceType: row.sourceType ?? existing.sourceType ?? null,
    });
  }

  return [...merged.values()];
}

function buildBranchDetails(topBranches, branchRecentPages, stockMap) {
  return topBranches.map((branch) => {
    const recentPage = branchRecentPages.find((item) => item?.bno === branch.bno);
    const recentRows = (recentPage?.rows ?? []).filter((row) => stockMap.has(row.code));
    const latestBuys = recentRows
      .filter((row) => (row.netLots ?? 0) > 0)
      .sort((left, right) => (right.netLots ?? 0) - (left.netLots ?? 0))
      .slice(0, 5)
      .map((row) => ({
        ...row,
        stockName: stockMap.get(row.code)?.name ?? row.name,
      }));
    const latestSells = recentRows
      .filter((row) => (row.netLots ?? 0) < 0)
      .sort((left, right) => (left.netLots ?? 0) - (right.netLots ?? 0))
      .slice(0, 5)
      .map((row) => ({
        ...row,
        stockName: stockMap.get(row.code)?.name ?? row.name,
      }));

    return {
      bno: branch.bno,
      name: branch.name,
      score: Number(branch.score.toFixed(2)),
      candidateHits: branch.candidateHits,
      avgPerformance: branch.avgPerformance,
      avgNetLots: branch.avgNetLots,
      appearanceCount: branch.appearances.length,
      appearances: branch.appearances.slice(0, 5),
      recentRows,
      latestBuys,
      latestSells,
      sourceUrl: `https://histock.tw/stock/brokerprofit.aspx?bno=${branch.bno}`,
    };
  });
}

function buildObservations({ recommendedStocks, recentSellFocus, topBranches, themeRadar }) {
  const observations = [];

  if (recommendedStocks.length) {
    const topStock = recommendedStocks[0];
    observations.push(`分點偏多最集中的股票先看 ${topStock.code} ${topStock.name}。`);
  }

  if (topBranches.length) {
    observations.push(`高勝率分點目前以前 ${topBranches.length} 名的觀察值最穩，優先看重複出現的股票。`);
  }

  const hotTheme = themeRadar?.topics?.[0]?.title ?? null;
  if (hotTheme) {
    observations.push(`近期主線題材先看 ${hotTheme}，分點與題材重疊的股票勝率通常更高。`);
  }

  if (recentSellFocus.length) {
    const topSell = recentSellFocus[0];
    observations.push(`短線賣壓較集中的股票先看 ${topSell.code} ${topSell.name} 是否守住支撐。`);
  }

  return observations.slice(0, 4);
}

function buildWatchlistBranchDetails(branchRecentPages, stockMap, candidateStocks) {
  const candidateSet = new Set(candidateStocks.map((item) => item.code));

  return branchRecentPages
    .map((page) => {
      if (!page?.rows?.length) {
        return null;
      }

      const recentRows = page.rows.filter((row) => stockMap.has(row.code));
      const candidateRows = recentRows.filter((row) => candidateSet.has(row.code));
      const latestBuys = recentRows
        .filter((row) => (row.netLots ?? 0) > 0)
        .sort((left, right) => (right.netLots ?? 0) - (left.netLots ?? 0))
        .slice(0, 5)
        .map((row) => ({
          ...row,
          stockName: stockMap.get(row.code)?.name ?? row.name,
        }));
      const latestSells = recentRows
        .filter((row) => (row.netLots ?? 0) < 0)
        .sort((left, right) => (left.netLots ?? 0) - (right.netLots ?? 0))
        .slice(0, 5)
        .map((row) => ({
          ...row,
          stockName: stockMap.get(row.code)?.name ?? row.name,
        }));

      const avgPerformance = average(candidateRows.map((row) => row.performance ?? null));
      const avgNetLots = average(candidateRows.map((row) => row.netLots ?? null));
      const positiveHitCount = candidateRows.filter(
        (row) => (row.netLots ?? 0) > 0 && row.performance !== null && row.performance !== undefined && row.performance > -1,
      ).length;
      const dailyOnlyHitCount = candidateRows.filter(
        (row) => (row.netLots ?? 0) > 0 && (row.performance === null || row.performance === undefined),
      ).length;
      const score =
        candidateRows.length * 24 +
        positiveHitCount * 14 +
        dailyOnlyHitCount * 6 +
        Math.max(0, avgPerformance ?? 0) * 26 +
        Math.min(
          candidateRows.reduce((sum, row) => sum + Math.abs(row.netLots ?? 0), 0) / 450000,
          34,
        );

      return {
        bno: page.bno,
        name: page.name,
        score: Number(score.toFixed(2)),
        candidateHits: candidateRows.length,
        avgPerformance,
        avgNetLots,
        appearanceCount: candidateRows.length,
        appearances: candidateRows.slice(0, 5).map((row) => ({
          code: row.code,
          name: stockMap.get(row.code)?.name ?? row.name,
          performance: row.performance,
          netLots: row.netLots,
        })),
        recentRows,
        latestBuys,
        latestSells,
        sourceUrl: `https://histock.tw/stock/brokerprofit.aspx?bno=${page.bno}`,
      };
    })
    .filter(Boolean)
    .filter((branch) => branch.candidateHits > 0 || branch.latestBuys.length || branch.latestSells.length)
    .sort((left, right) => right.score - left.score || String(left.bno).localeCompare(String(right.bno)))
    .slice(0, TOP_BRANCH_LIMIT);
}

class BrokerSourceRequestError extends Error {
  constructor(code, { status = null, retryable = false, retryAfterMs = null, skipped = false, cause = null } = {}) {
    super(status ? `${code} (HTTP ${status})` : code, cause ? { cause } : undefined);
    this.name = 'BrokerSourceRequestError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.skipped = skipped;
  }
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizePositiveInteger(value, fallback, minimum = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.round(number)) : fallback;
}

function resolveBrokerSourceRuntime(runtime = {}) {
  const fetchImpl = runtime.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new TypeError('buildBrokerBranchRadar requires a fetch implementation');
  }

  const clockNow =
    typeof runtime.clock === 'function'
      ? runtime.clock
      : typeof runtime.clock?.now === 'function'
        ? () => runtime.clock.now()
        : () => Date.now();
  const policyOverrides = runtime.policy ?? {};
  const policy = {
    timeoutMs: normalizePositiveInteger(
      policyOverrides.timeoutMs,
      DEFAULT_SOURCE_REQUEST_POLICY.timeoutMs,
      1,
    ),
    maxAttempts: normalizePositiveInteger(
      policyOverrides.maxAttempts,
      DEFAULT_SOURCE_REQUEST_POLICY.maxAttempts,
      1,
    ),
    baseBackoffMs: normalizePositiveInteger(
      policyOverrides.baseBackoffMs,
      DEFAULT_SOURCE_REQUEST_POLICY.baseBackoffMs,
    ),
    maxBackoffMs: normalizePositiveInteger(
      policyOverrides.maxBackoffMs,
      DEFAULT_SOURCE_REQUEST_POLICY.maxBackoffMs,
    ),
    maxRetryAfterMs: normalizePositiveInteger(
      policyOverrides.maxRetryAfterMs,
      DEFAULT_SOURCE_REQUEST_POLICY.maxRetryAfterMs,
    ),
    histockMinIntervalMs: normalizePositiveInteger(
      policyOverrides.histockMinIntervalMs,
      DEFAULT_SOURCE_REQUEST_POLICY.histockMinIntervalMs,
    ),
    histockJitterMs: normalizePositiveInteger(
      policyOverrides.histockJitterMs,
      DEFAULT_SOURCE_REQUEST_POLICY.histockJitterMs,
    ),
    histockCircuitThreshold: normalizePositiveInteger(
      policyOverrides.histockCircuitThreshold,
      DEFAULT_SOURCE_REQUEST_POLICY.histockCircuitThreshold,
      1,
    ),
    histockCircuitCooldownMs: normalizePositiveInteger(
      policyOverrides.histockCircuitCooldownMs,
      DEFAULT_SOURCE_REQUEST_POLICY.histockCircuitCooldownMs,
    ),
  };

  policy.maxBackoffMs = Math.max(policy.baseBackoffMs, policy.maxBackoffMs);

  return {
    fetch: fetchImpl,
    sleep: typeof runtime.sleep === 'function' ? runtime.sleep : defaultSleep,
    random: typeof runtime.random === 'function' ? runtime.random : Math.random,
    now: clockNow,
    logger: runtime.logger ?? console,
    policy,
  };
}

function retryAfterMilliseconds(value, now) {
  const text = String(value ?? '').trim();

  if (!text) return null;

  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now()) : null;
}

function isRetryableHttpStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function sourceFailureCode(error) {
  const code = String(error?.code ?? '').trim().toUpperCase();
  if (/^[A-Z][A-Z0-9_]{0,39}$/.test(code)) return code;

  const status = Number(error?.status);
  if (Number.isInteger(status) && status >= 100 && status <= 599) return `HTTP_${status}`;

  return 'REQUEST_FAILED';
}

function assertNotBlockPage(html) {
  const sample = String(html ?? '').slice(0, 250000);

  if (BLOCK_PAGE_PATTERNS.some((pattern) => pattern.test(sample))) {
    throw new BrokerSourceRequestError('BLOCK_PAGE');
  }

  return html;
}

function assertExpectedSourcePage(html, patterns) {
  assertNotBlockPage(html);
  const sample = String(html ?? '').slice(0, 500000);
  if (!patterns.some((pattern) => pattern.test(sample))) {
    throw new BrokerSourceRequestError('UNEXPECTED_PAGE');
  }
  return html;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
    return {
      response,
      clearRequestTimeout: () => clearTimeout(timeout),
    };
  } catch (error) {
    clearTimeout(timeout);
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new BrokerSourceRequestError('TIMEOUT', { retryable: true, cause: error });
    }

    if (error instanceof BrokerSourceRequestError) throw error;
    throw new BrokerSourceRequestError('NETWORK_ERROR', { retryable: true, cause: error });
  }
}

function assertCircuitAvailable(hostState, now) {
  const currentTime = now();

  if (hostState.openUntil > currentTime) {
    throw new BrokerSourceRequestError('CIRCUIT_OPEN', { skipped: true });
  }

  if (hostState.openUntil > 0) {
    hostState.openUntil = 0;
    hostState.consecutiveBlockedResponses = 0;
  }
}

function recordHostResponse(hostState, status, retryAfterMs, runtime) {
  if (!hostState) return false;

  const circuitFailure = status === 408 || status === 429 || status >= 500;
  if (status !== 403 && !circuitFailure) {
    hostState.consecutiveBlockedResponses = 0;
    return false;
  }

  hostState.consecutiveBlockedResponses += 1;
  const shouldOpen =
    status === 403 ||
    hostState.consecutiveBlockedResponses >= runtime.policy.histockCircuitThreshold ||
    Number(retryAfterMs ?? 0) > runtime.policy.maxRetryAfterMs;

  if (shouldOpen) {
    hostState.openUntil =
      runtime.now() + Math.max(runtime.policy.histockCircuitCooldownMs, Number(retryAfterMs ?? 0));
  }

  return shouldOpen;
}

function recordHostTransportFailure(hostState, error, runtime) {
  if (!hostState || !['TIMEOUT', 'NETWORK_ERROR'].includes(error?.code)) return false;
  hostState.consecutiveBlockedResponses += 1;
  if (hostState.consecutiveBlockedResponses < runtime.policy.histockCircuitThreshold) return false;
  hostState.openUntil = runtime.now() + runtime.policy.histockCircuitCooldownMs;
  return true;
}

async function requestBrokerSourceBody({ runtime, url, headers, decode, validate, hostState = null }) {
  const { policy } = runtime;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    let clearRequestTimeout = null;
    try {
      if (hostState) assertCircuitAvailable(hostState, runtime.now);

      const pendingResponse = await fetchWithTimeout(runtime.fetch, url, { headers }, policy.timeoutMs);
      const response = pendingResponse.response;
      clearRequestTimeout = pendingResponse.clearRequestTimeout;
      const status = Number(response?.status ?? 0);
      const ok = response?.ok ?? (status >= 200 && status < 300);

      if (!ok) {
        const retryAfterMs = retryAfterMilliseconds(response?.headers?.get?.('retry-after'), runtime.now);
        const circuitOpened = recordHostResponse(hostState, status, retryAfterMs, runtime);
        await response?.body?.cancel?.().catch(() => {});
        throw new BrokerSourceRequestError(`HTTP_${status || 'ERROR'}`, {
          status: status || null,
          retryable:
            isRetryableHttpStatus(status) &&
            !circuitOpened &&
            Number(retryAfterMs ?? 0) <= policy.maxRetryAfterMs,
          retryAfterMs,
        });
      }

      try {
        const body = await decode(response);
        validate?.(body);
        recordHostResponse(hostState, status, null, runtime);
        clearRequestTimeout?.();
        return body;
      } catch (error) {
        if (error instanceof BrokerSourceRequestError) {
          if (['BLOCK_PAGE', 'UNEXPECTED_PAGE'].includes(error.code) && hostState) {
            recordHostResponse(hostState, 403, null, runtime);
          }
          throw error;
        }

        if (error?.name === 'AbortError') {
          throw new BrokerSourceRequestError('TIMEOUT', { retryable: true, cause: error });
        }

        throw new BrokerSourceRequestError('RESPONSE_READ_FAILED', { retryable: true, cause: error });
      }
    } catch (error) {
      const normalizedError =
        error instanceof BrokerSourceRequestError
          ? error
          : new BrokerSourceRequestError('REQUEST_FAILED', { retryable: false, cause: error });

      clearRequestTimeout?.();
      if (recordHostTransportFailure(hostState, normalizedError, runtime)) {
        normalizedError.retryable = false;
      }

      if (!normalizedError.retryable || attempt >= policy.maxAttempts) {
        throw normalizedError;
      }

      const exponentialBackoff = Math.min(
        policy.maxBackoffMs,
        policy.baseBackoffMs * 2 ** (attempt - 1),
      );
      await runtime.sleep(Math.max(exponentialBackoff, Number(normalizedError.retryAfterMs ?? 0)));
    }
  }

  throw new BrokerSourceRequestError('REQUEST_FAILED');
}

function createBrokerSourceClient(runtimeOverrides = {}) {
  const runtime = resolveBrokerSourceRuntime(runtimeOverrides);
  const sourceHosts = new Map();

  const getHostState = (url) => {
    const host = new URL(url).host;
    const existing = sourceHosts.get(host);
    if (existing) return existing;

    const state = {
      tail: Promise.resolve(),
      nextStartAt: 0,
      consecutiveBlockedResponses: 0,
      openUntil: 0,
    };
    sourceHosts.set(host, state);
    return state;
  };

  const scheduleHiStockRequest = (url, request) => {
    const hostState = getHostState(url);
    const scheduled = hostState.tail.then(async () => {
      assertCircuitAvailable(hostState, runtime.now);

      const waitMs = Math.max(0, hostState.nextStartAt - runtime.now());
      if (waitMs > 0) await runtime.sleep(waitMs);

      assertCircuitAvailable(hostState, runtime.now);
      const randomValue = Math.min(0.999999, Math.max(0, Number(runtime.random()) || 0));
      hostState.nextStartAt =
        runtime.now() + runtime.policy.histockMinIntervalMs + Math.round(randomValue * runtime.policy.histockJitterMs);
      return request(hostState);
    });

    hostState.tail = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled;
  };

  return {
    runtime,
    fetchJson(url) {
      return requestBrokerSourceBody({
        runtime,
        url,
        headers: { accept: 'application/json,text/plain;q=0.9,*/*;q=0.5' },
        decode: async (response) => {
          try {
            return await response.json();
          } catch (error) {
            throw new BrokerSourceRequestError('INVALID_JSON', { retryable: true, cause: error });
          }
        },
        validate: (value) => {
          if (!Array.isArray(value)) {
            throw new BrokerSourceRequestError('UNEXPECTED_PAYLOAD', { retryable: true });
          }
        },
        hostState: getHostState(url),
      });
    },
    fetchHiStockHtml(url) {
      const expectedPatterns = url.includes('/brokerprofit.aspx')
        ? [/\bCPHB1_bt1_g\b/i, /brokerprofit\.aspx/i]
        : [/var\s+jsonDatas\s*=/i, /class=["'][^"']*\btb-stock\b[^"']*\btbChip\b/i];
      return scheduleHiStockRequest(url, (hostState) =>
        requestBrokerSourceBody({
          runtime,
          url,
          headers: HISTOCK_HEADERS,
          decode: (response) => response.text(),
          validate: (html) => assertExpectedSourcePage(html, expectedPatterns),
          hostState,
        }),
      );
    },
    fetchCMoneyHtml(url) {
      return requestBrokerSourceBody({
        runtime,
        url,
        headers: CMONEY_HEADERS,
        decode: (response) => response.text(),
        validate: (html) => assertExpectedSourcePage(html, [
          /\/forum\/stock\/\d+\?s=broker/i,
          /(?:券商分點|主力進出)/i,
        ]),
        hostState: getHostState(url),
      });
    },
    fetchFubonDjHtml(url) {
      return requestBrokerSourceBody({
        runtime,
        url,
        headers: FUBON_DJ_HEADERS,
        decode: async (response) => new TextDecoder('big5').decode(await response.arrayBuffer()),
        validate: (html) => assertExpectedSourcePage(html, [
          /\bzco_[0-9a-z]+\.djhtm\b/i,
          /class=["']t4t1["']/i,
          /主力進出/i,
        ]),
        hostState: getHostState(url),
      });
    },
  };
}

function sanitizeHealthTarget(target = {}) {
  return {
    code: String(target.code ?? '').trim().slice(0, 12),
    name: compactText(target.name).slice(0, 80),
  };
}

function createSourceHealthTracker() {
  const state = Object.fromEntries(
    BROKER_SOURCE_KEYS.map((source) => [
      source,
      {
        attempted: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        failureCodes: {},
        failedStocks: [],
        skippedStocks: [],
        failedBranches: [],
        skippedBranches: [],
      },
    ]),
  );

  const record = (source, target, outcome, error = null) => {
    const sourceState = state[source];
    if (!sourceState) return;

    if (outcome === 'succeeded') {
      sourceState.attempted += 1;
      sourceState.succeeded += 1;
      return;
    }

    const errorCode = sourceFailureCode(error);
    sourceState.failureCodes[errorCode] = (sourceState.failureCodes[errorCode] ?? 0) + 1;
    const item = {
      ...sanitizeHealthTarget(target),
      errorCode,
    };
    const targetType = target?.type === 'branch' ? 'Branches' : 'Stocks';

    if (outcome === 'skipped') {
      sourceState.skipped += 1;
      sourceState[`skipped${targetType}`].push(item);
      return;
    }

    sourceState.attempted += 1;
    sourceState.failed += 1;
    sourceState[`failed${targetType}`].push(item);
  };

  return {
    success(source, target) {
      record(source, target, 'succeeded');
    },
    error(source, target, error) {
      record(source, target, error?.skipped ? 'skipped' : 'failed', error);
    },
    snapshot() {
      return Object.fromEntries(
        BROKER_SOURCE_KEYS.map((source) => {
          const sourceState = state[source];
          const sortTargets = (items) =>
            [...items].sort((left, right) =>
              left.code.localeCompare(right.code) || left.errorCode.localeCompare(right.errorCode),
            );

          return [
            source,
            {
              attempted: sourceState.attempted,
              succeeded: sourceState.succeeded,
              failed: sourceState.failed,
              skipped: sourceState.skipped,
              requestCount: sourceState.attempted + sourceState.skipped,
              failureCodes: Object.fromEntries(
                Object.entries(sourceState.failureCodes).sort(([left], [right]) => left.localeCompare(right)),
              ),
              failedStocks: sortTargets(sourceState.failedStocks),
              skippedStocks: sortTargets(sourceState.skippedStocks),
              failedBranches: sortTargets(sourceState.failedBranches),
              skippedBranches: sortTargets(sourceState.skippedBranches),
            },
          ];
        }),
      );
    },
  };
}

function createStockSourceOutcomes(stocks = []) {
  return new Map(
    stocks.map((stock) => [
      stock.code,
      {
        code: stock.code,
        name: stock.name,
        sources: Object.fromEntries(BROKER_SOURCE_KEYS.map((source) => [source, null])),
      },
    ]),
  );
}

function recordStockSourceOutcome(outcomes, stock, source, outcome, error = null) {
  const entry = outcomes.get(stock.code);
  if (!entry) return;

  entry.sources[source] = {
    status: outcome,
    ...(error ? { errorCode: sourceFailureCode(error) } : {}),
  };
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}

function buildStockSourceCoverage(stocks, outcomes, sourceHealth) {
  const requestedStockCount = stocks.length;
  const sourceCounts = Object.fromEntries(
    BROKER_SOURCE_KEYS.map((source) => [
      source,
      { attempted: 0, succeeded: 0, failed: 0, skipped: 0 },
    ]),
  );
  const missingStocks = [];
  const failedStocks = [];
  const skippedStocks = [];
  let attemptedStockCount = 0;
  let succeededStockCount = 0;
  let completeStockCount = 0;
  let partialStockCount = 0;

  for (const stock of stocks) {
    const entry = outcomes.get(stock.code);
    const sourceEntries = BROKER_SOURCE_KEYS.map((source) => [
      source,
      entry?.sources?.[source] ?? { status: 'skipped', errorCode: 'NOT_ATTEMPTED' },
    ]);
    const attemptedSources = sourceEntries.filter(([, item]) => ['succeeded', 'failed'].includes(item.status));
    const succeededSources = sourceEntries.filter(([, item]) => item.status === 'succeeded');
    const failedSources = sourceEntries.filter(([, item]) => item.status === 'failed');

    if (attemptedSources.length) attemptedStockCount += 1;

    for (const [source, item] of sourceEntries) {
      if (item.status === 'succeeded') {
        sourceCounts[source].attempted += 1;
        sourceCounts[source].succeeded += 1;
      } else if (item.status === 'failed') {
        sourceCounts[source].attempted += 1;
        sourceCounts[source].failed += 1;
      } else {
        sourceCounts[source].skipped += 1;
      }
    }

    if (succeededSources.length === BROKER_SOURCE_KEYS.length) {
      succeededStockCount += 1;
      completeStockCount += 1;
      continue;
    }

    if (succeededSources.length) {
      succeededStockCount += 1;
      partialStockCount += 1;
    } else if (failedSources.length) {
      failedStocks.push(sanitizeHealthTarget(stock));
    } else {
      skippedStocks.push(sanitizeHealthTarget(stock));
    }

    missingStocks.push({
      ...sanitizeHealthTarget(stock),
      missingSources: sourceEntries
        .filter(([, item]) => item.status !== 'succeeded')
        .map(([source, item]) => ({
          source,
          status: item.status,
          errorCode: item.errorCode ?? 'NOT_ATTEMPTED',
        })),
    });
  }

  const coverageRatio = ratio(succeededStockCount, requestedStockCount);
  const completeRatio = ratio(completeStockCount, requestedStockCount);
  const primarySourceSuccessRatio = ratio(sourceCounts.histock.succeeded, requestedStockCount);
  const failedBranchCount = sourceHealth?.histock?.failedBranches?.length ?? 0;
  const skippedBranchCount = sourceHealth?.histock?.skippedBranches?.length ?? 0;
  const requestedBranchCount = BROKER_BRANCH_WATCHLIST.length;
  const branchSourceSuccessRatio = ratio(
    Math.max(0, requestedBranchCount - failedBranchCount - skippedBranchCount),
    requestedBranchCount,
  );
  const qualityGateReasons = [];

  if (requestedStockCount === 0) qualityGateReasons.push('NO_STOCKS_REQUESTED');
  if (coverageRatio < COVERAGE_GATE_MINIMUM_RATIO) qualityGateReasons.push('STOCK_COVERAGE_BELOW_THRESHOLD');
  if (primarySourceSuccessRatio < PRIMARY_SOURCE_GATE_MINIMUM_RATIO) {
    qualityGateReasons.push('PRIMARY_SOURCE_COVERAGE_BELOW_THRESHOLD');
  }
  if (branchSourceSuccessRatio < BRANCH_SOURCE_GATE_MINIMUM_RATIO) {
    qualityGateReasons.push('BRANCH_SOURCE_COVERAGE_BELOW_THRESHOLD');
  }

  const shouldReplaceExisting = qualityGateReasons.length === 0;

  return {
    requestedStockCount,
    attemptedStockCount,
    succeededStockCount,
    failedStockCount: failedStocks.length,
    skippedStockCount: skippedStocks.length,
    completeStockCount,
    partialStockCount,
    coverageRatio,
    completeRatio,
    requestedBranchCount,
    branchSourceSuccessRatio,
    sourceCounts,
    missingStocks,
    failedStocks,
    skippedStocks,
    qualityGate: {
      status: shouldReplaceExisting ? (completeRatio >= COVERAGE_GATE_MINIMUM_RATIO ? 'pass' : 'degraded') : 'fail',
      shouldReplaceExisting,
      recommendation: shouldReplaceExisting ? 'replace' : 'preserve-existing',
      minimumCoverageRatio: COVERAGE_GATE_MINIMUM_RATIO,
      minimumPrimarySourceSuccessRatio: PRIMARY_SOURCE_GATE_MINIMUM_RATIO,
      minimumBranchSourceSuccessRatio: BRANCH_SOURCE_GATE_MINIMUM_RATIO,
      observedCoverageRatio: coverageRatio,
      observedPrimarySourceSuccessRatio: primarySourceSuccessRatio,
      observedBranchSourceSuccessRatio: branchSourceSuccessRatio,
      reasons: qualityGateReasons,
    },
  };
}

function mergeWatchedBranchRows(...rowGroups) {
  const merged = new Map();

  for (const rows of rowGroups) {
    for (const row of rows ?? []) {
      if (!row?.bno || !row?.code) continue;
      const key = `${row.code}:${row.bno}`;
      if (merged.has(key)) continue;
      merged.set(key, row);
    }
  }

  return [...merged.values()];
}

/**
 * Builds the radar through one dependency seam. Production callers can omit the
 * second argument; tests may inject fetch, sleep, random, clock, logger and policy.
 */
export async function buildBrokerBranchRadar(
  {
    stockMetaList = [],
    selectionRadar = null,
    entryRadar = null,
    themeRadar = null,
    generatedAt,
    marketDate,
  },
  runtimeOverrides = {},
) {
  const sourceClient = createBrokerSourceClient(runtimeOverrides);
  const { runtime } = sourceClient;
  const sourceHealthTracker = createSourceHealthTracker();
  const baseStockMap = buildStockMap(stockMetaList);
  const candidateStocks = buildCandidateStocks({
    stockMetaList,
    selectionRadar,
    entryRadar,
    themeRadar,
  });
  const [twseQuotes, tpexQuotes] = await Promise.all([
    fetchTwseActiveQuotes(sourceClient.fetchJson).catch((error) => {
      runtime.logger.warn(`[TWSE 活躍股略過] ${error?.message ?? error}`);
      return [];
    }),
    fetchTpexActiveQuotes(sourceClient.fetchJson).catch((error) => {
      runtime.logger.warn(`[TPEx 活躍股略過] ${error?.message ?? error}`);
      return [];
    }),
  ]);
  const stockMap = mergeStockMaps(baseStockMap, [...twseQuotes, ...tpexQuotes]);
  const scoutStocks = buildScoutStocks({
    candidateStocks,
    stockMap,
    twseQuotes,
    tpexQuotes,
  });

  const branchRecentPages = await mapInBatches(
    BROKER_BRANCH_WATCHLIST,
    async (candidate) => {
      const target = { type: 'branch', code: candidate.bno, name: candidate.name };

      try {
        const html = await sourceClient.fetchHiStockHtml(
          `https://histock.tw/stock/brokerprofit.aspx?bno=${candidate.bno}`,
        );
        const rows = parseBranchStockRows(html);
        sourceHealthTracker.success('histock', target);

        return {
          bno: candidate.bno,
          name: candidate.name,
          rows,
        };
      } catch (error) {
        sourceHealthTracker.error('histock', target, error);
        runtime.logger.warn(`[券商分點略過] ${candidate.name}：${sourceFailureCode(error)}`);
        return null;
      }
    },
    4,
  );
  const enrichedScoutStocks = mergeScoutStocks(scoutStocks, buildBranchScoutStocks(branchRecentPages, stockMap));
  const stockSourceOutcomes = createStockSourceOutcomes(enrichedScoutStocks);
  const stockBranchPages = await mapInBatches(
    enrichedScoutStocks,
    async (stock) => {
      const target = { type: 'stock', code: stock.code, name: stock.name };
      const loadRows = async ({ source, label, fetchHtml, parseRows }) => {
        try {
          const html = await fetchHtml();
          let rows;

          try {
            rows = parseRows(html).filter((row) => WATCHED_BRANCH_CODE_SET.has(row.bno));
          } catch (error) {
            throw new BrokerSourceRequestError('PARSE_ERROR', { cause: error });
          }

          sourceHealthTracker.success(source, target);
          recordStockSourceOutcome(stockSourceOutcomes, stock, source, 'succeeded');
          return rows;
        } catch (error) {
          sourceHealthTracker.error(source, target, error);
          recordStockSourceOutcome(
            stockSourceOutcomes,
            stock,
            source,
            error?.skipped ? 'skipped' : 'failed',
            error,
          );
          runtime.logger.warn(`[${label}略過] ${stock.code} ${stock.name}｜${sourceFailureCode(error)}`);
          return [];
        }
      };

      const [histockRows, fubonRows, cmoneyRows] = await Promise.all([
        loadRows({
          source: 'histock',
          label: 'HiStock 分點',
          fetchHtml: () =>
            sourceClient.fetchHiStockHtml(`https://histock.tw/stock/branch.aspx?day=14&no=${stock.code}`),
          parseRows: (html) => parseStockDailyBranchRows(html, stock.code),
        }),
        loadRows({
          source: 'fubon',
          label: '富邦分點',
          fetchHtml: () =>
            sourceClient.fetchFubonDjHtml(
              `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco_${stock.code}.djhtm`,
            ),
          parseRows: (html) => parseFubonDjStockBranchRows(html, stock.code),
        }),
        loadRows({
          source: 'cmoney',
          label: 'CMoney 分點',
          fetchHtml: () => sourceClient.fetchCMoneyHtml(`https://www.cmoney.tw/forum/stock/${stock.code}?s=broker`),
          parseRows: (html) => parseCMoneyStockBranchRows(html, stock.code),
        }),
      ]);

      const rows = mergeWatchedBranchRows(histockRows, fubonRows, cmoneyRows);

      return {
        code: stock.code,
        name: stock.name,
        rows,
      };
    },
    4,
  );
  const dailyBranchRowsByBno = new Map();

  for (const stockPage of stockBranchPages.filter(Boolean)) {
    for (const row of stockPage.rows ?? []) {
      const branchName =
        BROKER_BRANCH_WATCHLIST.find((branch) => branch.bno === row.bno)?.name ?? row.branchName ?? row.bno;
      const entry = dailyBranchRowsByBno.get(row.bno) ?? {
        bno: row.bno,
        name: branchName,
        rows: [],
      };
      entry.rows.push({
        ...row,
        name: stockMap.get(row.code)?.name ?? stockPage.name ?? row.code,
        currentPrice: stockMap.get(row.code)?.close ?? row.currentPrice ?? null,
      });
      dailyBranchRowsByBno.set(row.bno, entry);
    }
  }
  const mergedBranchPages = BROKER_BRANCH_WATCHLIST.map((branch) => {
    const profitPage = branchRecentPages.find((item) => item?.bno === branch.bno) ?? null;
    const dailyPage = dailyBranchRowsByBno.get(branch.bno) ?? null;
    return {
      bno: branch.bno,
      name: branch.name,
      rows: mergeBranchRows(profitPage?.rows ?? [], dailyPage?.rows ?? []),
    };
  }).filter((item) => item.rows.length);

  const branchDetails = buildWatchlistBranchDetails(mergedBranchPages, stockMap, candidateStocks);
  const { recommendedStocks, recentBuyFocus, recentSellFocus } = buildRecommendedStocks(branchDetails, stockMap);
  const sourceHealth = sourceHealthTracker.snapshot();
  const coverage = buildStockSourceCoverage(enrichedScoutStocks, stockSourceOutcomes, sourceHealth);

  return {
    generatedAt,
    marketDate,
    sourceName: 'HiStock 券商分點觀察池 + 富邦證券主力買賣超 + CMoney 當日分點表',
    sourceHealth,
    coverage,
    summary: {
      candidateStockCount: candidateStocks.length,
      stockCoverageCount: branchDetails.reduce(
        (sum, branch) => sum + new Set(branch.appearances.map((item) => item.code)).size,
        0,
      ),
      branchCount: branchDetails.length,
      recommendedCount: recommendedStocks.length,
      recentBuyCount: recentBuyFocus.length,
      recentSellCount: recentSellFocus.length,
      scoutStockCount: enrichedScoutStocks.length,
    },
    observations: buildObservations({ recommendedStocks, recentSellFocus, topBranches: branchDetails, themeRadar }),
    candidateStocks: candidateStocks.map((item) => ({
      code: item.code,
      name: item.name,
      score: Number(item.score.toFixed(2)),
      origins: item.origins,
    })),
    recommendedStocks,
    recentBuyFocus,
    recentSellFocus,
    topBranches: branchDetails,
  };
}
