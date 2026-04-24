const BULLISH_SIGNALS = new Set([
  'golden-cross',
  'macd-bullish-cross',
  'rsi-oversold',
  'kd-bullish',
  'break-above-long-ma',
]);

const BEARISH_SIGNALS = new Set([
  'death-cross',
  'macd-bearish-cross',
  'rsi-overbought',
  'kd-bearish',
  'break-below-long-ma',
]);

const EVENT_KEYWORDS = [
  { type: '新品發表', tone: 'up', pattern: /(新品|新平台|新世代|新方案|發表會|發表|亮相|推出)/i },
  { type: '量產出貨', tone: 'up', pattern: /(量產|出貨|拉貨|投產|試產|送樣)/i },
  { type: '法說觀察', tone: 'normal', pattern: /(法說|法說會|營運說明會|業績發表)/i },
  { type: '展會催化', tone: 'normal', pattern: /(展會|展覽|參展|論壇|大會)/i },
];

const INSIDER_SUBJECT_PATTERN = /(董監|董事|監察人|經理人|內部人|大股東|董事長|副總|總經理)/i;
const INSIDER_BUY_PATTERN = /(增持|加碼|買進|敲進|認購|取得|加倉)/i;
const INSIDER_SELL_PATTERN = /(減持|申讓|轉讓|賣出|處分|調節)/i;

const PRODUCT_EVENT_TEMPLATES = [
  {
    slug: 'computex',
    title: 'COMPUTEX Taipei',
    month: 6,
    day: 2,
    themes: ['AI 伺服器 / ASIC', 'CPO / 矽光子', 'PCB / CCL', '散熱 / 液冷'],
    tone: 'up',
    note: 'AI 伺服器、CPO、散熱與高階板材常在展前與展中出現題材催化。',
    url: 'https://www.computextaipei.com.tw/',
  },
  {
    slug: 'wwdc',
    title: 'Apple WWDC',
    month: 6,
    day: 9,
    themes: ['PCB / CCL', '機器人 / 自動化', '記憶體 / DDR5'],
    tone: 'normal',
    note: 'Apple 生態鏈與終端規格升級議題常在開發者大會前後升溫。',
    url: 'https://developer.apple.com/wwdc/',
  },
  {
    slug: 'semicon-taiwan',
    title: 'SEMICON Taiwan',
    month: 9,
    day: 9,
    themes: ['CoWoS / 先進封裝', 'CPO / 矽光子', 'ABF 載板'],
    tone: 'up',
    note: '半導體設備、先進封裝與材料題材常在展前出現資金卡位。',
    url: 'https://www.semicontaiwan.org/',
  },
  {
    slug: 'ces',
    title: 'CES',
    month: 1,
    day: 7,
    themes: ['AI 伺服器 / ASIC', '機器人 / 自動化', '散熱 / 液冷'],
    tone: 'normal',
    note: '消費電子與 AI 應用題材常在 CES 前後聚焦新產品方向。',
    url: 'https://www.ces.tech/',
  },
  {
    slug: 'gtc',
    title: 'NVIDIA GTC',
    month: 3,
    day: 18,
    themes: ['AI 伺服器 / ASIC', 'CoWoS / 先進封裝', 'CPO / 矽光子'],
    tone: 'up',
    note: 'AI 伺服器、CPO 與先進封裝題材常在 GTC 前後出現主線切換。',
    url: 'https://www.nvidia.com/gtc/',
  },
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  return String(value ?? '').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDate(value) {
  const text = String(value ?? '').trim().replace(/\//g, '-');
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return text.replace(/[T\s].+$/, '');
}

function normalizeMonth(value) {
  const text = String(value ?? '').trim().replace(/\//g, '-');
  if (!text) return null;
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  return normalizeDate(text)?.slice(0, 7) ?? null;
}

function parseDate(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function diffDays(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

function getQuarterLabel(year, quarter) {
  return `${year}Q${quarter}`;
}

function getNextQuarterWindow(year, quarter) {
  if (!Number.isFinite(year) || !Number.isFinite(quarter)) {
    return null;
  }

  if (quarter === 1) {
    return { quarter: getQuarterLabel(year, 2), expectedDate: formatDate(year, 8, 14) };
  }
  if (quarter === 2) {
    return { quarter: getQuarterLabel(year, 3), expectedDate: formatDate(year, 11, 14) };
  }
  if (quarter === 3) {
    return { quarter: getQuarterLabel(year, 4), expectedDate: formatDate(year + 1, 3, 31) };
  }
  if (quarter === 4) {
    return { quarter: getQuarterLabel(year + 1, 1), expectedDate: formatDate(year + 1, 5, 15) };
  }

  return null;
}

function buildCuratedProductEvents(marketDate, topicDefinitions = []) {
  const asOf = parseDate(marketDate) ?? new Date();
  const currentYear = Number(String(marketDate ?? '').slice(0, 4)) || asOf.getFullYear();
  const themeMap = new Map(
    topicDefinitions.flatMap((topic) => (topic.aliases ?? []).concat(topic.title).map((alias) => [alias, topic.title])),
  );

  return PRODUCT_EVENT_TEMPLATES.map((template) => {
    let year = currentYear;
    let startDate = formatDate(year, template.month, template.day);
    const start = parseDate(startDate);
    if (start && diffDays(asOf, start) < -7) {
      year += 1;
      startDate = formatDate(year, template.month, template.day);
    }

    return {
      slug: `${template.slug}-${year}`,
      title: template.title,
      startDate,
      endDate: startDate,
      themes: template.themes.map((theme) => themeMap.get(theme) ?? theme),
      industries: [],
      tone: template.tone,
      url: template.url,
      note: template.note,
      source: 'curated-calendar',
    };
  });
}

function inferDynamicProductEvents(topicNewsList = [], marketDate) {
  const asOf = parseDate(marketDate) ?? new Date();
  const eventMap = new Map();

  for (const topicNews of topicNewsList) {
    const themeTitle = topicNews?.title ?? null;
    for (const article of topicNews?.items ?? []) {
      const publishedAt = parseDate(article?.publishedAt ?? article?.publishedTime ?? article?.date);
      const daysFromToday = diffDays(asOf, publishedAt);
      if (daysFromToday === null || daysFromToday < -3 || daysFromToday > 21) {
        continue;
      }

      const text = normalizeText([article?.title, article?.summary].filter(Boolean).join(' '));
      const match = EVENT_KEYWORDS.find((item) => item.pattern.test(text));
      if (!match) continue;

      const slug = `${themeTitle ?? 'theme'}-${match.type}-${normalizeDate(article?.publishedAt ?? article?.publishedTime ?? article?.date) ?? 'recent'}`;
      if (eventMap.has(slug)) continue;

      eventMap.set(slug, {
        slug,
        title: article?.title ?? `${themeTitle ?? '題材'} ${match.type}`,
        startDate: normalizeDate(article?.publishedAt ?? article?.publishedTime ?? article?.date) ?? marketDate ?? null,
        endDate: normalizeDate(article?.publishedAt ?? article?.publishedTime ?? article?.date) ?? marketDate ?? null,
        themes: themeTitle ? [themeTitle] : [],
        industries: [],
        tone: match.tone,
        url: article?.link ?? null,
        note: normalizeText(article?.summary ?? article?.source ?? `${match.type} 相關近期新聞`),
        source: 'recent-news',
      });
    }
  }

  return [...eventMap.values()];
}

function parseShareAmount(text, sign = 1) {
  const shareMatch = text.match(/([\d,.]+)\s*(萬)?\s*(張|股)/);
  if (!shareMatch) return null;

  let amount = Number(shareMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  if (shareMatch[2] === '萬') amount *= 10000;
  if (shareMatch[3] === '張') amount *= 1000;
  return amount * sign;
}

function parsePercentAmount(text, sign = 1) {
  const pctMatch = text.match(/([\d.]+)\s*%/);
  if (!pctMatch) return null;
  const amount = Number(pctMatch[1]);
  return Number.isFinite(amount) ? amount * sign : null;
}

function detectHistoricalSignals(rows = []) {
  const stats = new Map();
  const usableRows = rows.filter((row) => Number.isFinite(Number(row?.close)));
  if (usableRows.length < 25) return stats;

  const recordSignal = (key, index, direction) => {
    if (index + 20 >= usableRows.length) return;
    const currentClose = Number(usableRows[index].close);
    const futureClose = Number(usableRows[index + 20].close);
    if (!Number.isFinite(currentClose) || !Number.isFinite(futureClose) || currentClose <= 0) return;

    const rawReturn20 = ((futureClose - currentClose) / currentClose) * 100;
    const directionalReturn20 = rawReturn20 * direction;
    if (!stats.has(key)) {
      stats.set(key, []);
    }
    stats.get(key).push(directionalReturn20);
  };

  for (let index = 1; index < usableRows.length; index += 1) {
    const previous = usableRows[index - 1];
    const current = usableRows[index];
    const prevMaFast = toNumber(previous.maFast ?? previous.ma5);
    const prevMaMedium = toNumber(previous.maMedium ?? previous.ma20);
    const maFast = toNumber(current.maFast ?? current.ma5);
    const maMedium = toNumber(current.maMedium ?? current.ma20);
    const prevMacd = toNumber(previous.macd);
    const prevMacdSignal = toNumber(previous.macdSignal);
    const macd = toNumber(current.macd);
    const macdSignal = toNumber(current.macdSignal);
    const prevK = toNumber(previous.stochasticK ?? previous.k9);
    const prevD = toNumber(previous.stochasticD ?? previous.d9);
    const k = toNumber(current.stochasticK ?? current.k9);
    const d = toNumber(current.stochasticD ?? current.d9);
    const prevClose = toNumber(previous.close);
    const prevMaLong = toNumber(previous.maLong ?? previous.ma60);
    const close = toNumber(current.close);
    const maLong = toNumber(current.maLong ?? current.ma60);
    const rsi = toNumber(current.rsi ?? current.rsi14);

    if (prevMaFast !== null && prevMaMedium !== null && maFast !== null && maMedium !== null) {
      if (prevMaFast <= prevMaMedium && maFast > maMedium) recordSignal('golden-cross', index, 1);
      if (prevMaFast >= prevMaMedium && maFast < maMedium) recordSignal('death-cross', index, -1);
    }

    if (prevMacd !== null && prevMacdSignal !== null && macd !== null && macdSignal !== null) {
      if (prevMacd <= prevMacdSignal && macd > macdSignal) recordSignal('macd-bullish-cross', index, 1);
      if (prevMacd >= prevMacdSignal && macd < macdSignal) recordSignal('macd-bearish-cross', index, -1);
    }

    if (rsi !== null) {
      if (rsi <= 30) recordSignal('rsi-oversold', index, 1);
      if (rsi >= 70) recordSignal('rsi-overbought', index, -1);
    }

    if (prevK !== null && prevD !== null && k !== null && d !== null) {
      if (prevK <= prevD && k > d && k <= 35) recordSignal('kd-bullish', index, 1);
      if (prevK >= prevD && k < d && k >= 65) recordSignal('kd-bearish', index, -1);
    }

    if (prevClose !== null && prevMaLong !== null && close !== null && maLong !== null) {
      if (prevClose <= prevMaLong && close > maLong) recordSignal('break-above-long-ma', index, 1);
      if (prevClose >= prevMaLong && close < maLong) recordSignal('break-below-long-ma', index, -1);
    }
  }

  return stats;
}

export function buildEarningsCalendar({ stockDetails = [], updatedAt, marketDate }) {
  const items = stockDetails
    .map((detail) => {
      const statement = detail?.財務資料?.綜合損益表;
      if (!statement) return null;

      const year = toNumber(statement.年度);
      const quarter = toNumber(statement.季別);
      const nextWindow = getNextQuarterWindow(year, quarter);
      if (!nextWindow) return null;

      return {
        code: detail.code,
        companyName: detail.name ?? detail?.公司概況?.公司簡稱 ?? null,
        expectedDate: nextWindow.expectedDate,
        quarter: nextWindow.quarter,
        type: '財報',
        note: `最新已揭露 ${getQuarterLabel(year, quarter)}，下一次觀察窗先看 ${nextWindow.expectedDate}。`,
      };
    })
    .filter(Boolean)
    .sort((left, right) => String(left.expectedDate).localeCompare(String(right.expectedDate)));

  return {
    updatedAt,
    marketDate,
    season: marketDate ? `${marketDate.slice(0, 4)}Q${Math.ceil(Number(marketDate.slice(5, 7)) / 3)}` : null,
    note: '依最新季報推估下一次財報觀察窗，實際揭露日仍以公司公告為準。',
    items,
  };
}

export function buildProductEvents({
  topicDefinitions = [],
  topicNewsList = [],
  updatedAt,
  marketDate,
}) {
  const curated = buildCuratedProductEvents(marketDate, topicDefinitions);
  const dynamic = inferDynamicProductEvents(topicNewsList, marketDate);
  const items = [...curated, ...dynamic]
    .sort((left, right) => String(left.startDate ?? '').localeCompare(String(right.startDate ?? '')))
    .slice(0, 24);

  return {
    updatedAt,
    marketDate,
    note: '結合固定產業展會與近 21 天題材新聞中的催化訊號，提供題材輪動觀察用事件清單。',
    items,
  };
}

export function buildInsiderHoldings({ stockNewsList = [], updatedAt, marketDate }) {
  const grouped = new Map();

  for (const news of stockNewsList) {
    const code = String(news?.code ?? '').trim();
    if (!code) continue;

    for (const article of news?.items ?? []) {
      const text = normalizeText([article?.title, article?.summary].filter(Boolean).join(' '));
      if (!INSIDER_SUBJECT_PATTERN.test(text)) continue;

      const isBuy = INSIDER_BUY_PATTERN.test(text);
      const isSell = INSIDER_SELL_PATTERN.test(text);
      if (!isBuy && !isSell) continue;

      const sign = isBuy ? 1 : -1;
      const deltaPct = parsePercentAmount(text, sign);
      const deltaShares = parseShareAmount(text, sign);

      if (deltaPct === null && deltaShares === null) continue;

      const reportMonth =
        normalizeMonth(article?.publishedAt ?? article?.publishedTime ?? article?.date) ??
        normalizeMonth(marketDate) ??
        null;
      const record = {
        code,
        companyName: news?.name ?? null,
        reportMonth,
        directorsShares: null,
        directorsPctOfShares: null,
        supervisorsShares: null,
        supervisorsPctOfShares: null,
        managerShares: null,
        managerPctOfShares: null,
        totalShares: null,
        totalPctOfShares: null,
        deltaFromPrevMonth: {
          shares: deltaShares,
          pct: deltaPct,
        },
        sourceTitle: article?.title ?? null,
        sourceUrl: article?.link ?? null,
        sourceDate: normalizeDate(article?.publishedAt ?? article?.publishedTime ?? article?.date),
        note: `${isBuy ? '近期新聞偏向內部人加碼' : '近期新聞偏向內部人調節'}，為新聞語意整理，僅供觀察。`,
      };

      const existing = grouped.get(code);
      if (!existing) {
        grouped.set(code, record);
        continue;
      }

      const existingMagnitude = Math.abs(toNumber(existing.deltaFromPrevMonth?.pct) ?? 0);
      const currentMagnitude = Math.abs(toNumber(record.deltaFromPrevMonth?.pct) ?? 0);
      if (currentMagnitude >= existingMagnitude) {
        grouped.set(code, record);
      }
    }
  }

  return {
    updatedAt,
    marketDate,
    note: '依近 7 天內部人相關新聞整理，並非官方股權申報原始檔，適合當成輔助觀察而非唯一依據。',
    items: [...grouped.values()].sort((left, right) => String(right.reportMonth ?? '').localeCompare(String(left.reportMonth ?? ''))),
  };
}

export function buildSignalConfidenceStats({ stockDetails = [], updatedAt, marketDate }) {
  const signalMap = new Map();

  for (const detail of stockDetails) {
    const rows = Array.isArray(detail?.歷史資料) ? detail.歷史資料.slice(-240) : [];
    const stockStats = detectHistoricalSignals(rows);
    for (const [signalKey, returns] of stockStats.entries()) {
      if (!signalMap.has(signalKey)) {
        signalMap.set(signalKey, []);
      }
      signalMap.get(signalKey).push(...returns);
    }
  }

  const signals = Object.fromEntries(
    [...signalMap.entries()].map(([signalKey, returns]) => {
      const samples = returns.length;
      const wins = returns.filter((value) => value > 0).length;
      const avgReturn20 = samples ? returns.reduce((sum, value) => sum + value, 0) / samples : null;
      const tone = avgReturn20 === null ? 'normal' : avgReturn20 >= 2 ? 'up' : avgReturn20 <= -2 ? 'down' : 'normal';
      return [
        signalKey,
        {
          samples,
          winRate: samples ? (wins / samples) * 100 : null,
          avgReturn20,
          tone,
        },
      ];
    }),
  );

  return {
    updatedAt,
    marketDate,
    lookbackDays: 240,
    note: '以近 240 個交易日內各技術訊號出現後的 20 日方向報酬估算，作為訊號可信度參考。',
    signals,
  };
}
