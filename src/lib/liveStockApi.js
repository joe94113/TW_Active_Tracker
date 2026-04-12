import { fetchOptionalJson, fetchRemoteJson } from './api';
import {
  buildIndicatorRows,
  buildTechnicalSignalSummary,
  calculateWindowReturn,
  defaultIndicatorSettings,
  summarizeSignalTitles,
} from './technicalAnalysis';

const LISTED_DIRECTORY_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const COMPANY_PROFILE_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L';
const VALUATION_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL';

let listedDirectoryCache = null;
let listedDirectoryPromise = null;
let companyProfileCache = null;
let companyProfilePromise = null;
let valuationCache = null;
let valuationPromise = null;
let staticSearchIndexCache = null;
let staticSearchIndexPromise = null;

function normalizeNumber(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).replaceAll(',', '').trim();

  if (!text || text === '-' || text === '--' || text === '---') {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildYahooChartUrl(symbol, interval, range) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
}

function mapYahooDailyRows(result) {
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp ?? [];

  if (!quote || !timestamps.length) {
    return [];
  }

  const rows = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: normalizeNumber(quote.open?.[index]),
      high: normalizeNumber(quote.high?.[index]),
      low: normalizeNumber(quote.low?.[index]),
      close: normalizeNumber(quote.close?.[index]),
      volume: normalizeNumber(quote.volume?.[index]),
      turnover: null,
      transactions: null,
    }))
    .filter((item) => item.date && item.open !== null && item.high !== null && item.low !== null && item.close !== null)
    .sort((left, right) => left.date.localeCompare(right.date));

  return rows.map((row, index, list) => {
    const previousClose = list[index - 1]?.close ?? null;
    const change = row.close !== null && previousClose !== null ? row.close - previousClose : null;
    const changePercent = previousClose ? (change / previousClose) * 100 : null;

    return {
      ...row,
      change,
      changePercent,
    };
  });
}

function mapYahooIntraday(result) {
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp ?? [];

  if (!quote || !timestamps.length) {
    return null;
  }

  const previousClose = normalizeNumber(result.meta?.chartPreviousClose ?? result.meta?.previousClose);
  const points = timestamps
    .map((timestamp, index) => {
      const price = normalizeNumber(quote.close?.[index]);

      if (price === null) {
        return null;
      }

      const change = previousClose !== null ? price - previousClose : null;
      const changePercent = previousClose ? (change / previousClose) * 100 : null;

      return {
        timestamp,
        dateTime: new Date(timestamp * 1000).toISOString(),
        time: new Date(timestamp * 1000).toLocaleTimeString('zh-TW', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Taipei',
        }),
        price,
        high: normalizeNumber(quote.high?.[index]),
        low: normalizeNumber(quote.low?.[index]),
        volume: normalizeNumber(quote.volume?.[index]),
        change,
        changePercent,
      };
    })
    .filter(Boolean);

  if (!points.length) {
    return null;
  }

  return {
    interval: '5m',
    marketDate: points.at(-1)?.dateTime?.slice(0, 10) ?? null,
    updatedAt: result.meta?.regularMarketTime
      ? new Date(result.meta.regularMarketTime * 1000).toISOString()
      : points.at(-1)?.dateTime ?? null,
    previousClose,
    latestPrice: normalizeNumber(result.meta?.regularMarketPrice) ?? points.at(-1)?.price ?? null,
    high: normalizeNumber(result.meta?.regularMarketDayHigh),
    low: normalizeNumber(result.meta?.regularMarketDayLow),
    volume: normalizeNumber(result.meta?.regularMarketVolume),
    points,
    資料來源: ['Yahoo Finance Chart API'],
  };
}

async function fetchYahooChart(symbols, interval, range) {
  let lastError = null;

  for (const symbol of symbols) {
    try {
      const payload = await fetchRemoteJson(buildYahooChartUrl(symbol, interval, range));
      const result = payload?.chart?.result?.[0];

      if (result?.timestamp?.length) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`查詢 ${symbols.join(', ')} 圖表資料失敗`);
}

export async function fetchListedStockDirectory() {
  if (listedDirectoryCache) {
    return listedDirectoryCache;
  }

  if (!listedDirectoryPromise) {
    listedDirectoryPromise = fetchRemoteJson(LISTED_DIRECTORY_URL)
      .then((rows) =>
        rows
          .map((row) => ({
            code: String(row.Code ?? '').trim(),
            name: String(row.Name ?? '').trim(),
            close: normalizeNumber(row.ClosingPrice),
            change: normalizeNumber(row.Change),
            changePercent: null,
            volume: normalizeNumber(row.TradeVolume),
            turnover: normalizeNumber(row.TradeValue),
            market: '上市',
            source: 'twse-directory',
          }))
          .filter((item) => /^\d{4}$/.test(item.code)),
      )
      .then((rows) => {
        listedDirectoryCache = rows;
        return rows;
      })
      .finally(() => {
        listedDirectoryPromise = null;
      });
  }

  return listedDirectoryPromise;
}

export async function searchRemoteStocks(keyword, options = {}) {
  const normalizedKeyword = String(keyword ?? '').trim().toLowerCase();

  if (normalizedKeyword.length < 2) {
    return [];
  }

  const limit = options.limit ?? 8;
  const directory = await fetchListedStockDirectory();
  const matches = directory.filter((item) =>
    [item.code, item.name].some((field) => String(field ?? '').toLowerCase().includes(normalizedKeyword)),
  );

  return matches
    .sort((left, right) => {
      const leftExact = left.code === normalizedKeyword || left.name.toLowerCase() === normalizedKeyword;
      const rightExact = right.code === normalizedKeyword || right.name.toLowerCase() === normalizedKeyword;

      if (leftExact !== rightExact) {
        return leftExact ? -1 : 1;
      }

      const leftStarts = left.code.startsWith(normalizedKeyword) || left.name.toLowerCase().startsWith(normalizedKeyword);
      const rightStarts = right.code.startsWith(normalizedKeyword) || right.name.toLowerCase().startsWith(normalizedKeyword);

      if (leftStarts !== rightStarts) {
        return leftStarts ? -1 : 1;
      }

      return (right.turnover ?? 0) - (left.turnover ?? 0);
    })
    .slice(0, limit);
}

async function fetchCompanyProfileMap() {
  if (companyProfileCache) {
    return companyProfileCache;
  }

  if (!companyProfilePromise) {
    companyProfilePromise = fetchRemoteJson(COMPANY_PROFILE_URL)
      .then((rows) =>
        new Map(
          rows.map((row) => [
            String(row.公司代號 ?? '').trim(),
            {
              公司代號: String(row.公司代號 ?? '').trim(),
              公司名稱: row.公司名稱 ?? null,
              公司簡稱: row.公司簡稱 ?? null,
              產業名稱: row.產業別 ?? null,
              董事長: row.董事長 ?? null,
              總經理: row.總經理 ?? null,
              成立日期: row.成立日期 ?? null,
              上市日期: row.上市日期 ?? null,
              實收資本額: normalizeNumber(row.實收資本額),
              已發行股數: normalizeNumber(row.已發行普通股數或TDR原股發行股數),
              網址: row.網址 ?? null,
            },
          ]),
        ),
      )
      .then((map) => {
        companyProfileCache = map;
        return map;
      })
      .finally(() => {
        companyProfilePromise = null;
      });
  }

  return companyProfilePromise;
}

async function fetchValuationMap() {
  if (valuationCache) {
    return valuationCache;
  }

  if (!valuationPromise) {
    valuationPromise = fetchRemoteJson(VALUATION_URL)
      .then((rows) =>
        new Map(
          rows.map((row) => [
            String(row.Code ?? '').trim(),
            {
              本益比: normalizeNumber(row.PEratio),
              殖利率: normalizeNumber(row.DividendYield),
              股價淨值比: normalizeNumber(row.PBratio),
              資料日期: row.Date ?? null,
            },
          ]),
        ),
      )
      .then((map) => {
        valuationCache = map;
        return map;
      })
      .finally(() => {
        valuationPromise = null;
      });
  }

  return valuationPromise;
}

async function fetchStaticSearchIndex() {
  if (staticSearchIndexCache) {
    return staticSearchIndexCache;
  }

  if (!staticSearchIndexPromise) {
    staticSearchIndexPromise = fetchOptionalJson('data/stocks/search.json')
      .then((rows) => {
        staticSearchIndexCache = Array.isArray(rows) ? rows : [];
        return staticSearchIndexCache;
      })
      .finally(() => {
        staticSearchIndexPromise = null;
      });
  }

  return staticSearchIndexPromise;
}

export async function fetchLiveStockSnapshot(code) {
  const normalizedCode = String(code ?? '').trim();

  if (!normalizedCode) {
    throw new Error('缺少股票代號');
  }

  const url =
    `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${normalizedCode}.tw|otc_${normalizedCode}.tw&json=1&delay=0&_=${Date.now()}`;
  const payload = await fetchRemoteJson(url);
  const item =
    payload?.msgArray?.find((entry) => String(entry?.c ?? '').trim() === normalizedCode) ??
    payload?.msgArray?.find((entry) => String(entry?.['@'] ?? '').includes(normalizedCode));

  if (!item) {
    throw new Error(`${normalizedCode} 即時報價查詢失敗`);
  }

  const previousClose = normalizeNumber(item.y);
  const lastPrice = normalizeNumber(item.z) ?? normalizeNumber(item.o) ?? previousClose;
  const change = lastPrice !== null && previousClose !== null ? lastPrice - previousClose : null;
  const changePercent = previousClose ? (change / previousClose) * 100 : null;
  const marketDate = String(item.d ?? '').trim();
  const marketTime = String(item.t ?? '').trim().padStart(6, '0');

  return {
    code: normalizedCode,
    name: item.nf ?? item.n ?? normalizedCode,
    shortName: item.n ?? item.nf ?? normalizedCode,
    market: String(item['@'] ?? '').includes('.otc') ? '上櫃' : '上市',
    previousClose,
    lastPrice,
    change,
    changePercent,
    open: normalizeNumber(item.o),
    high: normalizeNumber(item.h),
    low: normalizeNumber(item.l),
    volume: normalizeNumber(item.v),
    latestTradeVolume: normalizeNumber(item.tv),
    averagePrice: normalizeNumber(item.a),
    updatedAt:
      marketDate.length === 8 && marketTime.length === 6
        ? `${marketDate.slice(0, 4)}-${marketDate.slice(4, 6)}-${marketDate.slice(6, 8)}T${marketTime.slice(0, 2)}:${marketTime.slice(2, 4)}:${marketTime.slice(4, 6)}+08:00`
        : null,
    marketDate: marketDate.length === 8 ? `${marketDate.slice(0, 4)}-${marketDate.slice(4, 6)}-${marketDate.slice(6, 8)}` : null,
    sourceLabel: 'TWSE 即時行情',
  };
}

export async function fetchLiveFallbackStockDetail(code) {
  const normalizedCode = String(code ?? '').trim();
  const symbols = [`${normalizedCode}.TW`, `${normalizedCode}.TWO`];

  const [directoryResult, profileResult, valuationResult, snapshotResult, historyResult, intradayResult, staticSearchResult] = await Promise.allSettled([
    fetchListedStockDirectory(),
    fetchCompanyProfileMap(),
    fetchValuationMap(),
    fetchLiveStockSnapshot(normalizedCode),
    fetchYahooChart(symbols, '1d', '6mo').then(mapYahooDailyRows),
    fetchYahooChart(symbols, '5m', '1d').then(mapYahooIntraday),
    fetchStaticSearchIndex(),
  ]);

  const directoryMatch =
    directoryResult.status === 'fulfilled'
      ? directoryResult.value.find((item) => item.code === normalizedCode) ?? null
      : null;
  const companyProfile =
    profileResult.status === 'fulfilled'
      ? profileResult.value.get(normalizedCode) ?? null
      : null;
  const valuation =
    valuationResult.status === 'fulfilled'
      ? valuationResult.value.get(normalizedCode) ?? null
      : null;
  const liveSnapshot = snapshotResult.status === 'fulfilled' ? snapshotResult.value : null;
  const historyRows = historyResult.status === 'fulfilled' ? historyResult.value : [];
  const intradayData = intradayResult.status === 'fulfilled' ? intradayResult.value : null;
  const staticSearchItem =
    staticSearchResult.status === 'fulfilled'
      ? staticSearchResult.value.find((item) => item.code === normalizedCode) ?? null
      : null;

  if (!directoryMatch && !companyProfile && !liveSnapshot && !historyRows.length && !staticSearchItem) {
    const reason = snapshotResult.status === 'rejected' ? snapshotResult.reason : null;
    throw reason instanceof Error ? reason : new Error(`${normalizedCode} 查無可用資料`);
  }

  const indicatorSettings = { ...defaultIndicatorSettings };
  const indicatorRows = buildIndicatorRows(historyRows, indicatorSettings);
  const latestIndicatorRow = indicatorRows.at(-1) ?? null;
  const technicalSignals = indicatorRows.length
    ? buildTechnicalSignalSummary(indicatorRows, indicatorSettings, {
        name: liveSnapshot?.shortName ?? directoryMatch?.name ?? companyProfile?.公司簡稱 ?? normalizedCode,
      })
    : [];

  const latestSummary = {
    close: latestIndicatorRow?.close ?? liveSnapshot?.lastPrice ?? directoryMatch?.close ?? staticSearchItem?.close ?? null,
    change: latestIndicatorRow?.change ?? liveSnapshot?.change ?? directoryMatch?.change ?? staticSearchItem?.change ?? null,
    changePercent:
      latestIndicatorRow?.changePercent ?? liveSnapshot?.changePercent ?? directoryMatch?.changePercent ?? staticSearchItem?.changePercent ?? null,
    return20: indicatorRows.length ? calculateWindowReturn(indicatorRows, 20) : staticSearchItem?.return20 ?? null,
    return60: indicatorRows.length ? calculateWindowReturn(indicatorRows, 60) : staticSearchItem?.return60 ?? null,
    volume: latestIndicatorRow?.volume ?? liveSnapshot?.volume ?? directoryMatch?.volume ?? staticSearchItem?.volume ?? null,
  };

  const latestIndicators = latestIndicatorRow
    ? {
        maFast: latestIndicatorRow.maFast ?? null,
        maShort: latestIndicatorRow.maShort ?? null,
        maMedium: latestIndicatorRow.maMedium ?? null,
        maLong: latestIndicatorRow.maLong ?? null,
        rsi: latestIndicatorRow.rsi ?? null,
        stochasticK: latestIndicatorRow.stochasticK ?? null,
        stochasticD: latestIndicatorRow.stochasticD ?? null,
        macd: latestIndicatorRow.macd ?? null,
        macdSignal: latestIndicatorRow.macdSignal ?? null,
        macdHist: latestIndicatorRow.macdHist ?? null,
      }
    : {};

  const observationSummary = [
    liveSnapshot?.updatedAt ? `即時行情更新時間：${liveSnapshot.updatedAt.replace('T', ' ').slice(0, 16)}` : null,
    liveSnapshot?.market ? `市場別：${liveSnapshot.market}` : null,
    technicalSignals[0] ? `技術重點：${technicalSignals[0].title}` : null,
    !technicalSignals.length && historyRows.length < 20 ? '歷史資料較少，技術指標仍需累積更多交易日。' : null,
    !liveSnapshot && staticSearchItem ? '目前先顯示最近一次同步快照，盤中即時欄位可能稍晚更新。' : null,
  ].filter(Boolean);

  return {
    code: normalizedCode,
    name: liveSnapshot?.shortName ?? directoryMatch?.name ?? staticSearchItem?.name ?? companyProfile?.公司簡稱 ?? normalizedCode,
    kind: 'live',
    priceDate: liveSnapshot?.marketDate ?? latestIndicatorRow?.date ?? null,
    generatedAt: new Date().toISOString(),
    indicatorSettings,
    歷史資料: historyRows,
    technicalSignals,
    訊號摘要: {
      titles: summarizeSignalTitles(technicalSignals),
      topTitle: technicalSignals[0]?.title ?? null,
      topTone: technicalSignals[0]?.tone ?? 'normal',
    },
    最新摘要: latestSummary,
    最新指標: latestIndicators,
    觀察摘要: observationSummary,
    盤中走勢: intradayData,
    公司概況:
      companyProfile ??
      (staticSearchItem
        ? {
            公司代號: normalizedCode,
            公司簡稱: staticSearchItem.name,
            公司名稱: staticSearchItem.name,
            產業名稱: staticSearchItem.industryName ?? null,
          }
        : null),
    評價面: valuation,
    財務資料: null,
    法人買賣: null,
    持股分散: null,
    融資融券: null,
    主動ETF曝光: {
      count: null,
      items: [],
    },
    同產業比較: null,
    即時報價: liveSnapshot,
    資料來源: ['TWSE OpenAPI', 'TWSE 即時行情', 'Yahoo Finance Chart API'],
  };
}
