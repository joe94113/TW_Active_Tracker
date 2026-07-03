import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const ROOT_DIR = process.cwd();
const OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'data', 'influencers', 'serenity', 'summary.json');
const USERNAME = process.env.SERENITY_X_USERNAME?.trim() || 'aleabitoreddit';
const BEARER_TOKEN = process.env.X_BEARER_TOKEN?.trim();
const MAX_PAGES = Number(process.env.SERENITY_X_MAX_PAGES ?? 4);
const LOOKBACK_DAYS = Number(process.env.SERENITY_LOOKBACK_DAYS ?? 92);
const SOURCE_MODE = String(process.env.SERENITY_SOURCE ?? 'auto').trim().toLowerCase();
const TRACKSERENITY_FEED_URL = 'https://www.trackserenity.com/data/signals.json';
const TRACKSERENITY_PERFORMANCE_URL = 'https://www.trackserenity.com/performance';
const TRACKSERENITY_QUOTES_URL = 'https://www.trackserenity.com/api/stocks';

const TIMEFRAMES = [
  { key: 'day', label: '日', days: 1 },
  { key: 'week', label: '週', days: 7 },
  { key: 'month', label: '月', days: 31 },
  { key: 'quarter', label: '季', days: 92 },
];

const BULLISH_TERMS = [
  'bullish',
  'long',
  'buy',
  'bought',
  'accumulate',
  'accumulation',
  'upside',
  'breakout',
  'leader',
  'outperform',
  'strong',
  'strength',
  'winner',
  'tailwind',
  'moat',
  'undervalued',
];

const BEARISH_TERMS = [
  'bearish',
  'short',
  'sell',
  'sold',
  'avoid',
  'weak',
  'weakness',
  'downside',
  'risk',
  'headwind',
  'overvalued',
  'crowded',
  'miss',
  'cut',
  'downgrade',
];

const SYMBOL_DENYLIST = new Set([
  'A',
  'AI',
  'API',
  'ARM',
  'ASAP',
  'ATH',
  'CEO',
  'CFO',
  'CPU',
  'ETF',
  'EPS',
  'FY',
  'GDP',
  'GPU',
  'IPO',
  'LLM',
  'MR',
  'PC',
  'Q',
  'QoQ',
  'ROI',
  'US',
  'USD',
  'YoY',
].map((item) => item.toUpperCase()));

class XApiError extends Error {
  constructor(response, bodyText, payload = null) {
    const detail = payload?.detail ?? bodyText.slice(0, 500);
    super(`X API HTTP ${response.status} ${response.statusText}: ${detail}`);
    this.name = 'XApiError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.bodyText = bodyText;
    this.payload = payload;
  }
}

function getIsoDaysAgo(days, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10) || null;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildEmptyPayload(status = 'pending_token') {
  const timeframes = Object.fromEntries(
    TIMEFRAMES.map((item) => [
      item.key,
      {
        label: item.label,
        startDate: null,
        endDate: null,
        stats: {
          mentionedStocks: 0,
          bullish: 0,
          bearish: 0,
          neutral: 0,
          posts: 0,
        },
        stocks: [],
      },
    ]),
  );

  return {
    schemaVersion: 1,
    generatedAt: null,
    source: {
      type: 'x-api-v2',
      status,
      username: USERNAME,
      profileUrl: `https://x.com/${USERNAME}`,
      notes: [
        'Use the official X API v2 user timeline endpoint when X_BEARER_TOKEN is configured.',
        'Store derived summaries, stock tickers, stance labels, post IDs, metrics, and source links instead of republishing full post text.',
        'Do not scrape X web HTML or bypass platform rate limits.',
      ],
    },
    influencer: {
      name: 'Serenity',
      handle: USERNAME,
      profileUrl: `https://x.com/${USERNAME}`,
      focus: 'AI and semiconductor supply-chain commentary',
    },
    timeframes,
    recentPosts: [],
  };
}

function createErrorPayload(status, error) {
  const payload = buildEmptyPayload(status);
  const xPayload = error instanceof XApiError ? error.payload : null;

  return {
    ...payload,
    generatedAt: new Date().toISOString(),
    source: {
      ...payload.source,
      error: {
        statusCode: error instanceof XApiError ? error.status : null,
        title: xPayload?.title ?? error.name ?? 'Error',
        reason: xPayload?.reason ?? null,
        detail: xPayload?.detail ?? error.message,
        type: xPayload?.type ?? null,
        registrationUrl: xPayload?.registration_url ?? null,
      },
    },
  };
}

async function fetchText(url, accept = 'text/html,application/json;q=0.9,*/*;q=0.8') {
  const response = await fetch(url, {
    headers: {
      accept,
      'user-agent': 'TW-Active-Tracker/1.0 (+https://joe94113.github.io/TW_Active_Tracker/)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
  }

  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url, 'application/json,text/plain;q=0.9,*/*;q=0.8'));
}

async function fetchTrackSerenityPerformanceRows() {
  const html = await fetchText(TRACKSERENITY_PERFORMANCE_URL);
  const match = html.match(/const\s+performanceRows\s*=\s*(\[[\s\S]*?\]);/);

  if (!match) {
    return [];
  }

  return vm.runInNewContext(`(${match[1]})`, {}, { timeout: 1000 });
}

async function fetchTrackSerenityQuotes(symbols) {
  const uniqueSymbols = [
    ...new Set(
      symbols
        .map((symbol) => String(symbol ?? '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  if (!uniqueSymbols.length) {
    return {};
  }

  const url = new URL(TRACKSERENITY_QUOTES_URL);
  url.searchParams.set('quoteOnly', '1');
  url.searchParams.set('symbols', uniqueSymbols.join(','));

  const payload = await fetchJson(url.toString());
  return payload?.quotes && typeof payload.quotes === 'object' ? payload.quotes : {};
}

async function fetchTrackSerenityFeed() {
  const [feed, performanceRows] = await Promise.all([
    fetchJson(TRACKSERENITY_FEED_URL),
    fetchTrackSerenityPerformanceRows().catch(() => []),
  ]);
  const quoteSymbols = performanceRows.map((item) => item?.symbol);
  const quotes = await fetchTrackSerenityQuotes(quoteSymbols).catch(() => ({}));

  return {
    feed,
    performanceRows,
    quotes,
  };
}

function classifyXApiError(error) {
  if (!(error instanceof XApiError)) {
    return null;
  }

  if (error.status === 403 && error.payload?.reason === 'client-not-enrolled') {
    return 'access_required';
  }

  if (error.status === 401) {
    return 'invalid_token';
  }

  if (error.status === 402) {
    return 'credits_depleted';
  }

  if (error.status === 403) {
    return 'forbidden';
  }

  return null;
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function xFetch(url) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${BEARER_TOKEN}`,
      accept: 'application/json',
      'user-agent': 'TW-Active-Tracker/1.0',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let payload = null;

    try {
      payload = JSON.parse(body);
    } catch {
      payload = null;
    }

    throw new XApiError(response, body, payload);
  }

  return response.json();
}

async function fetchUserByUsername(username) {
  const url = new URL(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`);
  url.searchParams.set('user.fields', 'created_at,description,verified,verified_type,public_metrics');
  return xFetch(url);
}

async function fetchRecentPosts(userId) {
  const posts = [];
  const oldestAllowed = Date.parse(getIsoDaysAgo(LOOKBACK_DAYS));
  let paginationToken = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`https://api.x.com/2/users/${encodeURIComponent(userId)}/tweets`);
    url.searchParams.set('max_results', '100');
    url.searchParams.set('exclude', 'retweets');
    url.searchParams.set('tweet.fields', 'created_at,entities,public_metrics,lang,referenced_tweets');

    if (paginationToken) {
      url.searchParams.set('pagination_token', paginationToken);
    }

    const payload = await xFetch(url);
    const batch = payload?.data ?? [];
    posts.push(...batch);

    const oldestInBatch = Math.min(...batch.map((item) => Date.parse(item.created_at)).filter(Number.isFinite));
    if (!payload?.meta?.next_token || (Number.isFinite(oldestInBatch) && oldestInBatch < oldestAllowed)) {
      break;
    }

    paginationToken = payload.meta.next_token;
  }

  return posts.filter((item) => {
    const createdAt = Date.parse(item.created_at);
    return Number.isFinite(createdAt) && createdAt >= oldestAllowed;
  });
}

function extractSymbols(post) {
  const cashtagSymbols =
    post.entities?.cashtags
      ?.map((item) => String(item?.tag ?? '').trim().toUpperCase())
      .filter(Boolean) ?? [];
  const directCashtagSymbols =
    post.cashtags
      ?.map((item) => String(item ?? '').trim().toUpperCase())
      .filter(Boolean) ?? [];

  const textSymbols = Array.from(String(post.text ?? '').matchAll(/\$([A-Z][A-Z0-9.]{0,5})\b/g), (match) =>
    match[1].trim().toUpperCase(),
  ).filter((symbol) => symbol.length >= 1 && symbol.length <= 6 && !SYMBOL_DENYLIST.has(symbol));

  return [...new Set([...cashtagSymbols, ...directCashtagSymbols, ...textSymbols])].sort();
}

function getPostCreatedAt(post) {
  return post?.created_at ?? post?.createdAt ?? null;
}

function getPostUrl(post) {
  if (post?.url) {
    return String(post.url).replace('https://twitter.com/', 'https://x.com/');
  }

  return `https://x.com/${USERNAME}/status/${post.id}`;
}

function inferStance(text) {
  const normalized = String(text ?? '').toLowerCase();
  const bullishScore = BULLISH_TERMS.reduce((total, term) => total + (normalized.includes(term) ? 1 : 0), 0);
  const bearishScore = BEARISH_TERMS.reduce((total, term) => total + (normalized.includes(term) ? 1 : 0), 0);
  const score = bullishScore - bearishScore;

  if (score > 0) return { stance: 'bullish', score };
  if (score < 0) return { stance: 'bearish', score };
  return { stance: 'neutral', score: 0 };
}

function createDerivedSummary(symbols, stance) {
  const label = stance === 'bullish' ? '多頭' : stance === 'bearish' ? '空頭' : '中立';
  return `提到 ${symbols.join(', ')}；系統依關鍵字暫判為${label}，請點原文核對完整脈絡。`;
}

function createMentionEvents(posts) {
  return posts.flatMap((post) => {
    const symbols = extractSymbols(post);
    const createdAt = getPostCreatedAt(post);

    if (!symbols.length || !createdAt) {
      return [];
    }

    const { stance, score } = inferStance(post.text);
    const url = getPostUrl(post);
    const summary = createDerivedSummary(symbols, stance);

    return symbols.map((symbol) => ({
      symbol,
      stance,
      stanceScore: score,
      createdAt,
      date: formatDate(createdAt),
      postId: post.id,
      postUrl: url,
      summary,
      metrics: post.public_metrics ?? null,
    }));
  });
}

function aggregateTimeframe(events, timeframe, now = new Date()) {
  const startIso = getIsoDaysAgo(timeframe.days, now);
  const startTime = Date.parse(startIso);
  const scopedEvents = events.filter((item) => Date.parse(item.createdAt) >= startTime);
  const bySymbol = new Map();
  const postIds = new Set(scopedEvents.map((item) => item.postId));

  for (const event of scopedEvents) {
    const current =
      bySymbol.get(event.symbol) ??
      {
        symbol: event.symbol,
        mentionCount: 0,
        bullishCount: 0,
        bearishCount: 0,
        neutralCount: 0,
        stanceScore: 0,
        lastMentionAt: null,
        history: [],
      };

    current.mentionCount += 1;
    current.stanceScore += event.stanceScore;
    current[`${event.stance}Count`] += 1;
    current.lastMentionAt =
      !current.lastMentionAt || Date.parse(event.createdAt) > Date.parse(current.lastMentionAt)
        ? event.createdAt
        : current.lastMentionAt;
    current.history.push({
      date: event.date,
      stance: event.stance,
      summary: event.summary,
      postUrl: event.postUrl,
      postId: event.postId,
      metrics: event.metrics,
    });
    bySymbol.set(event.symbol, current);
  }

  const stocks = [...bySymbol.values()]
    .map((item) => ({
      ...item,
      stance: item.stanceScore > 0 ? 'bullish' : item.stanceScore < 0 ? 'bearish' : 'neutral',
      history: item.history.sort((left, right) => String(right.date).localeCompare(String(left.date))),
    }))
    .sort(
      (left, right) =>
        right.mentionCount - left.mentionCount ||
        Math.abs(right.stanceScore) - Math.abs(left.stanceScore) ||
        left.symbol.localeCompare(right.symbol),
    );

  return {
    label: timeframe.label,
    startDate: formatDate(startIso),
    endDate: formatDate(now.toISOString()),
    stats: {
      mentionedStocks: stocks.length,
      bullish: stocks.filter((item) => item.stance === 'bullish').length,
      bearish: stocks.filter((item) => item.stance === 'bearish').length,
      neutral: stocks.filter((item) => item.stance === 'neutral').length,
      posts: postIds.size,
    },
    stocks,
  };
}

function buildPayload(user, posts, sourceOverrides = {}) {
  const now = new Date();
  const events = createMentionEvents(posts);
  const timeframes = Object.fromEntries(TIMEFRAMES.map((timeframe) => [timeframe.key, aggregateTimeframe(events, timeframe, now)]));
  const recentPosts = posts
    .map((post) => {
      const symbols = extractSymbols(post);
      const stance = inferStance(post.text).stance;
      const createdAt = getPostCreatedAt(post);
      return {
        id: post.id,
        createdAt,
        date: formatDate(createdAt),
        postUrl: getPostUrl(post),
        symbols,
        stance,
        summary: symbols.length ? createDerivedSummary(symbols, stance) : '未偵測到股票代號，保留原文連結供人工核對。',
      };
    })
    .filter((item) => item.symbols.length)
    .slice(0, 24);

  return {
    ...buildEmptyPayload('ready'),
    generatedAt: now.toISOString(),
    source: {
      ...buildEmptyPayload('ready').source,
      ...sourceOverrides,
      userId: user?.id ?? null,
      fetchedPosts: posts.length,
      lookbackDays: LOOKBACK_DAYS,
      maxPages: MAX_PAGES,
    },
    influencer: {
      name: user?.name ?? 'Serenity',
      handle: user?.username ?? USERNAME,
      profileUrl: `https://x.com/${user?.username ?? USERNAME}`,
      focus: 'AI and semiconductor supply-chain commentary',
      publicMetrics: user?.public_metrics ?? null,
      verified: user?.verified ?? null,
      verifiedType: user?.verified_type ?? null,
    },
    timeframes,
    recentPosts,
  };
}

async function buildTrackSerenityPayload() {
  const { feed, performanceRows, quotes } = await fetchTrackSerenityFeed();
  const posts = feed?.tweets ?? [];
  const sourceUser = feed?.sources?.find((item) => item?.username === USERNAME) ?? feed?.sources?.[0] ?? null;
  const payload = buildPayload(
    {
      id: null,
      name: sourceUser?.nickname ?? 'Serenity',
      username: sourceUser?.username ?? USERNAME,
    },
    posts,
    {
      type: 'trackserenity-public-feed',
      status: 'ready',
      sourceUrl: TRACKSERENITY_FEED_URL,
      performanceUrl: TRACKSERENITY_PERFORMANCE_URL,
      quoteUrl: TRACKSERENITY_QUOTES_URL,
      upstreamUpdatedAt: feed?.updatedAt ?? null,
      trackedPerformanceRows: performanceRows.length,
      quotedPerformanceRows: Object.keys(quotes ?? {}).length,
      notes: [
        'Fallback source: TrackSerenity public feed and performance page.',
        'Crawler checks robots.txt and uses a low-volume request pattern.',
        'Stored output keeps derived summaries, ticker labels, stance labels, post IDs, and source links instead of republishing full post text.',
      ],
    },
  );

  payload.performanceRows = performanceRows.map((item) => {
    const symbol = String(item.symbol ?? '').toUpperCase();
    const mentionPrice = toFiniteNumber(item.mentionPrice);
    const quote = quotes?.[symbol] ?? null;
    const currentPrice = toFiniteNumber(quote?.price);
    const returnSinceMention =
      mentionPrice && currentPrice !== null
        ? ((currentPrice - mentionPrice) / mentionPrice) * 100
        : null;

    return {
      symbol,
      company: item.company ?? null,
      exchange: item.exchange ?? null,
      mentionDate: item.mentionDate ?? null,
      mentionPrice,
      currency: item.currency ?? null,
      currentPrice,
      currentCurrency: quote?.currency ?? item.currency ?? null,
      returnSinceMention,
      quoteSource: quote?.source ?? null,
      quoteUpdatedAt: quote?.updatedAt ?? null,
    };
  });

  return payload;
}

async function writeTrackSerenityFallback(reason = 'fallback') {
  const payload = await buildTrackSerenityPayload();
  await writeJson(OUTPUT_PATH, payload);
  console.log(
    `Wrote Serenity radar from TrackSerenity (${reason}): ${payload.source.fetchedPosts} posts, ${payload.timeframes.quarter.stats.mentionedStocks} symbols.`,
  );
}

async function main() {
  if (SOURCE_MODE === 'trackserenity') {
    await writeTrackSerenityFallback('requested');
    return;
  }

  if (!BEARER_TOKEN) {
    if (SOURCE_MODE === 'auto') {
      await writeTrackSerenityFallback('missing X_BEARER_TOKEN');
      return;
    }

    console.log('X_BEARER_TOKEN is not configured; keeping Serenity radar in pending_token state.');
    await writeJson(OUTPUT_PATH, buildEmptyPayload('pending_token'));
    return;
  }

  const userPayload = await fetchUserByUsername(USERNAME);
  const user = userPayload?.data;

  if (!user?.id) {
    throw new Error(`X user not found: ${USERNAME}`);
  }

  const posts = await fetchRecentPosts(user.id);
  const payload = buildPayload(user, posts);
  await writeJson(OUTPUT_PATH, payload);
  console.log(`Wrote Serenity radar: ${posts.length} posts, ${payload.timeframes.quarter.stats.mentionedStocks} symbols.`);
}

main().catch(async (error) => {
  const status = classifyXApiError(error);

  if (status) {
    if (SOURCE_MODE === 'auto' && ['access_required', 'credits_depleted', 'forbidden'].includes(status)) {
      console.warn(`${error.message}\nFalling back to TrackSerenity public feed.`);
      try {
        await writeTrackSerenityFallback(status);
      } catch (fallbackError) {
        console.error(fallbackError);
        process.exitCode = 1;
      }
      return;
    }

    console.warn(`${error.message}\nWriting Serenity radar status: ${status}`);
    try {
      await writeJson(OUTPUT_PATH, createErrorPayload(status, error));
    } catch (writeError) {
      console.error(writeError);
      process.exitCode = 1;
    }
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
