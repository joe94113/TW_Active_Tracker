const GLOBAL_MARKET_SECTIONS = [
  {
    key: 'indices',
    title: '國際股指',
    items: [
      { symbol: '^TWII', label: '台股加權', shortLabel: '加權' },
      { symbol: '^SOX', label: '費城半導體', shortLabel: '費半' },
      { symbol: '^IXIC', label: 'NASDAQ', shortLabel: 'NASDAQ' },
      { symbol: '^GSPC', label: 'S&P 500', shortLabel: 'S&P500' },
      { symbol: '^DJI', label: '道瓊工業', shortLabel: '道瓊' },
      { symbol: '^N225', label: '日經 225', shortLabel: '日經' },
      { symbol: '^HSI', label: '恆生指數', shortLabel: '恆生' },
      { symbol: '000001.SS', label: '上證指數', shortLabel: '上證' },
    ],
  },
  {
    key: 'commodities',
    title: '原物料',
    items: [
      { symbol: 'CL=F', label: 'WTI 原油', shortLabel: '原油' },
      { symbol: 'GC=F', label: '黃金', shortLabel: '黃金' },
      { symbol: 'SI=F', label: '白銀', shortLabel: '白銀' },
      { symbol: 'HG=F', label: '銅價', shortLabel: '銅' },
    ],
  },
  {
    key: 'fx',
    title: '外匯',
    items: [
      { symbol: 'USDTWD=X', label: '美元 / 台幣', shortLabel: '美元兌台幣' },
      { symbol: 'USDJPY=X', label: '美元 / 日圓', shortLabel: '美元兌日圓' },
      { symbol: 'USDKRW=X', label: '美元 / 韓元', shortLabel: '美元兌韓元' },
      { symbol: 'USDCNY=X', label: '美元 / 人民幣', shortLabel: '美元兌人民幣' },
      { symbol: 'EURUSD=X', label: '歐元 / 美元', shortLabel: '歐元兌美元' },
      { symbol: 'GBPUSD=X', label: '英鎊 / 美元', shortLabel: '英鎊兌美元' },
    ],
  },
  {
    key: 'rates',
    title: '美債殖利率',
    items: [
      {
        symbol: '^TNX',
        label: '美國 10 年期公債殖利率',
        shortLabel: '美債 10Y',
        unit: 'percent',
      },
    ],
  },
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return null;
}

function pickLatestBars(rows = []) {
  return [...rows]
    .filter((row) => normalizeDate(row?.date) && toNumber(row?.close) !== null)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
}

function pickReturn(rows = [], offset = 20) {
  if (!rows.length) return null;
  const latest = rows.at(-1);
  const previous = rows.at(Math.max(0, rows.length - 1 - offset));
  const latestClose = toNumber(latest?.close);
  const previousClose = toNumber(previous?.close);
  if (latestClose === null || previousClose === null || previousClose === 0) return null;
  return ((latestClose - previousClose) / previousClose) * 100;
}

function buildSeriesItem(config, rows = []) {
  const normalizedRows = pickLatestBars(rows);
  const latest = normalizedRows.at(-1) ?? null;
  const previous = normalizedRows.at(-2) ?? null;
  const close = toNumber(latest?.close);
  const previousClose = toNumber(previous?.close);
  const change = close !== null && previousClose !== null ? close - previousClose : null;
  const changePercent = change !== null && previousClose ? (change / previousClose) * 100 : null;
  const return5 = pickReturn(normalizedRows, 5);
  const return20 = pickReturn(normalizedRows, 20);
  const volume = toNumber(latest?.volume);

  return {
    symbol: config.symbol,
    label: config.label,
    shortLabel: config.shortLabel,
    unit: config.unit ?? 'number',
    close,
    change,
    changeBasisPoints: config.unit === 'percent' && change !== null ? change * 100 : null,
    changePercent,
    return5,
    return20,
    volume,
    marketDate: latest?.date ?? null,
    status:
      changePercent === null
        ? 'normal'
        : changePercent > 0
          ? 'up'
          : changePercent < 0
            ? 'down'
            : 'normal',
    sparkline: normalizedRows.slice(-20).map((row) => ({
      date: row.date,
      close: toNumber(row.close),
    })),
  };
}

function buildSummary(sections = []) {
  const flatItems = sections.flatMap((section) => section.items ?? []);
  const leadIndex = [...flatItems]
    .filter((item) => item.changePercent !== null)
    .sort((left, right) => (right.changePercent ?? -Infinity) - (left.changePercent ?? -Infinity))[0] ?? null;
  const weakIndex = [...flatItems]
    .filter((item) => item.changePercent !== null)
    .sort((left, right) => (left.changePercent ?? Infinity) - (right.changePercent ?? Infinity))[0] ?? null;
  const riskAsset = [...flatItems]
    .filter((item) => item.return5 !== null)
    .sort((left, right) => Math.abs(right.return5 ?? 0) - Math.abs(left.return5 ?? 0))[0] ?? null;

  return {
    strongest: leadIndex,
    weakest: weakIndex,
    mostVolatile: riskAsset,
  };
}

export const GLOBAL_MARKET_SYMBOLS = GLOBAL_MARKET_SECTIONS.flatMap((section) => section.items.map((item) => item.symbol));

export function buildGlobalMarketsDashboard({ seriesMap, generatedAt, marketDate }) {
  const sections = GLOBAL_MARKET_SECTIONS.map((section) => ({
    key: section.key,
    title: section.title,
    items: section.items.map((item) => buildSeriesItem(item, seriesMap.get(item.symbol) ?? [])),
  }));

  return {
    generatedAt,
    marketDate,
    sections,
    summary: buildSummary(sections),
  };
}
