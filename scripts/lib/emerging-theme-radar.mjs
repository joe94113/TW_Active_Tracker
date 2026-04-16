import { stripHtml } from '../../src/lib/newsKeywords.js';

const RECENT_NEWS_DAYS = 7;

const GENERIC_KEYWORD_DENYLIST = new Set([
  'nbsp',
  '台股',
  '個股',
  '題材',
  '新聞',
  '即時新聞',
  '投資網誌',
  '網誌',
  '快訊',
  '焦點',
  '觀察',
  '市場',
  '法人',
  '投資',
  '盤中',
  '盤後',
  '收盤',
  '營收',
  '毛利率',
  '殖利率',
  '本益比',
  'EPS',
  'AI',
  'IC',
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'Yahoo',
  'Google',
  'MoneyDJ',
  'CMoney',
  '工商時報',
  '經濟日報',
  '聯合新聞網',
  '中央社',
  '鉅亨網',
  '股市爆料同學',
  '股市爆料同學會',
  '爆料同學會',
  '理財周刊',
  'Factset',
  'FactSet',
  '月營收公告',
  '呈現雙成長',
  '新聞快訊',
  '豐雲學堂',
  '股市',
  'KY',
  '萬張',
  '概念股',
  '檔概念股',
  '法說',
  '法說會',
  '創高',
  '新高',
  '爆量',
  '漲停',
  '跌停',
  '月增',
  '年增',
]);

const THEME_LIKE_PATTERNS = [
  /CPO|CoWoS|SoIC|FOPLP|HBM|DDR|ASIC|AEC|BBU|LPO|CXL|GPU|CPU|NPU|TPU|GB\d+/i,
  /矽|光|纖|板|載板|封裝|封測|散熱|液冷|機器人|自動化|儲能|電網|重電|記憶體|光模組|光通訊|網通|交換器|伺服器|車用|電池|能源|材料|玻纖|銅箔|CCL|PCB|半導體|晶片|探針|設備|機殼|電源|模組|封測|低軌|衛星|軍工|航太/i,
];

function normalizeText(value) {
  return stripHtml(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isRecentNews(publishedAt, recentDays = RECENT_NEWS_DAYS) {
  if (!publishedAt) {
    return true;
  }

  const date = new Date(publishedAt);
  return !Number.isNaN(date.getTime()) && date.getTime() >= Date.now() - recentDays * 86400000;
}

function includesAlias(text, aliases = []) {
  const normalized = normalizeText(text).toLowerCase();
  return aliases.some((alias) => normalized.includes(String(alias ?? '').trim().toLowerCase()));
}

function createRankMap(items = [], codeField = '代號') {
  return new Map(
    items
      .map((item, index) => [String(item?.[codeField] ?? '').trim(), index + 1])
      .filter(([code]) => code),
  );
}

function createSummaryMap(stockSummaries = []) {
  return new Map(
    stockSummaries
      .map((item) => [String(item?.code ?? '').trim(), item])
      .filter(([code]) => code),
  );
}

function buildTopicSlug(keyword) {
  return `emerging-${keyword.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-').replace(/^-+|-+$/g, '')}`;
}

function buildTopicSearchUrl(keyword) {
  return `https://news.google.com/search?q=${encodeURIComponent(`${keyword} 台股`)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
}

function extractArticleKeywords(text) {
  const normalized = normalizeText(text);
  const chineseTerms = normalized.match(/[\u4e00-\u9fff]{2,8}/g) ?? [];
  const alphaNumericTerms = normalized.match(/[A-Za-z][A-Za-z0-9.+-]{1,14}/g) ?? [];

  return [...new Set([...chineseTerms, ...alphaNumericTerms].map((item) => normalizeText(item)).filter(Boolean))];
}

function isSourceDerivedKeyword(keyword, source) {
  const normalizedKeyword = normalizeText(keyword).toLowerCase();
  const normalizedSource = normalizeText(source).toLowerCase();

  if (!normalizedKeyword || !normalizedSource) {
    return false;
  }

  return (
    normalizedKeyword === normalizedSource ||
    normalizedSource.includes(normalizedKeyword) ||
    normalizedKeyword.includes(normalizedSource)
  );
}

function hasUsefulKeyword(keyword, existingTopics, stockSummaryMap) {
  const normalized = normalizeText(keyword);

  if (!normalized || normalized.length < 2 || normalized.length > 12) {
    return false;
  }

  if (GENERIC_KEYWORD_DENYLIST.has(normalized)) {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return false;
  }

  if (![...normalized].some((char) => /[\u4e00-\u9fffA-Za-z]/.test(char))) {
    return false;
  }

  if (/(新聞|網誌|快訊|焦點|市場|盤後|盤中|收盤|即時|投資|分析|觀點)/.test(normalized)) {
    return false;
  }

  if (/(概念股|萬張|千張|法說|法說會|漲停|跌停|新高|創高|爆量|月增|年增|評等|目標價|券商)/i.test(normalized)) {
    return false;
  }

  const looksLikeAcronym = /^[A-Z][A-Z0-9.+-]{1,9}$/i.test(normalized);
  const looksThemeLike = THEME_LIKE_PATTERNS.some((pattern) => pattern.test(normalized));

  if (!looksLikeAcronym && !looksThemeLike) {
    return false;
  }

  for (const topic of existingTopics) {
    if (includesAlias(normalized, [topic.title, ...(topic.aliases ?? [])])) {
      return false;
    }
  }

  for (const summary of stockSummaryMap.values()) {
    if (normalized === String(summary?.code ?? '').trim() || normalized === normalizeText(summary?.name)) {
      return false;
    }
  }

  return true;
}

function getConfirmationCount(summary, hotRank, strongRank, turnoverRank) {
  return [
    (summary?.foreign5Day ?? 0) > 0,
    (summary?.investmentTrust5Day ?? 0) > 0,
    (summary?.activeEtfCount ?? 0) > 0,
    Boolean(hotRank),
    Boolean(strongRank),
    Boolean(turnoverRank),
    summary?.topSignalTone === 'up',
  ].filter(Boolean).length;
}

function scoreStock(summary, hotRank, strongRank, turnoverRank, newsMentions) {
  const return20 = toNumber(summary?.return20) ?? 0;
  const changePercent = toNumber(summary?.changePercent) ?? 0;
  const etfCount = toNumber(summary?.activeEtfCount) ?? 0;
  const positiveForeign = (summary?.foreign5Day ?? 0) > 0 ? 1 : 0;
  const positiveTrust = (summary?.investmentTrust5Day ?? 0) > 0 ? 1 : 0;

  return (
    newsMentions * 20 +
    (hotRank ? Math.max(0, 14 - hotRank) * 4 : 0) +
    (strongRank ? Math.max(0, 14 - strongRank) * 4 : 0) +
    (turnoverRank ? Math.max(0, 14 - turnoverRank) * 3 : 0) +
    (positiveForeign + positiveTrust) * 12 +
    (positiveForeign && positiveTrust ? 12 : 0) +
    etfCount * 6 +
    Math.max(0, return20) * 1.1 +
    Math.max(0, changePercent) * 3 +
    (summary?.topSignalTone === 'up' ? 10 : 0)
  );
}

function buildCatchUpStocks(relatedStocks = []) {
  if (!relatedStocks.length) {
    return [];
  }

  const leaders = relatedStocks.slice(0, 3);
  const leaderCodes = new Set(leaders.map((item) => item.code));
  const leaderReturn = Math.max(...leaders.map((item) => toNumber(item.return20) ?? 0), 0);

  return relatedStocks
    .filter((item) => !leaderCodes.has(item.code))
    .filter((item) => {
      const return20 = toNumber(item.return20);
      return return20 === null || return20 <= Math.max(leaderReturn * 0.68, 18);
    })
    .map((item) => ({
      ...item,
      catchUpScore:
        (item.newsMentions ?? 0) * 10 +
        Math.max(0, toNumber(item.changePercent) ?? 0) * 3 -
        Math.max(0, toNumber(item.return20) ?? 0) * 0.4 +
        ((item.total5Day ?? 0) > 0 ? 16 : 0) +
        (item.activeEtfCount ?? 0) * 7,
    }))
    .sort((left, right) => right.catchUpScore - left.catchUpScore || right.score - left.score)
    .slice(0, 3);
}

function buildObservation({ headlineCount, hotCount, institutionalCount, etfCount }) {
  if (hotCount >= 2 && institutionalCount >= 2) {
    return '近期新聞與法人同步聚焦，資金有往這個新題材擴散的跡象。';
  }

  if (headlineCount >= 3 && hotCount >= 1) {
    return '新聞熱度先升溫，盤面已有代表股冒出，可列入下一輪觀察。';
  }

  if (institutionalCount >= 2 || etfCount >= 2) {
    return '新聞還不算全面，但籌碼與 ETF 曝光開始集中，適合提早追蹤。';
  }

  return '近期新聞反覆提及，先作為新題材觀察名單，等待盤面確認。';
}

function buildKeywordCooccurrence(counts = new Map()) {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hant'))
    .slice(0, 8)
    .map(([keyword, count]) => ({ keyword, count }));
}

export function discoverEmergingTopics({
  stockSummaries = [],
  stockNewsList = [],
  topicNewsList = [],
  marketOverview = {},
  existingTopics = [],
} = {}) {
  const stockSummaryMap = createSummaryMap(stockSummaries);
  const hotRankMap = createRankMap(marketOverview?.熱門股 ?? []);
  const strongRankMap = createRankMap(marketOverview?.強勢股 ?? []);
  const turnoverRankMap = createRankMap(marketOverview?.成交排行 ?? []);
  const candidateKeywords = new Map();

  for (const news of stockNewsList) {
    const code = String(news?.code ?? '').trim();
    const recentItems = (news?.items ?? []).filter((item) => isRecentNews(item?.publishedAt));

    if (!code || !recentItems.length) {
      continue;
    }

    for (const item of recentItems) {
      const articleText = normalizeText([item?.title, item?.summary].filter(Boolean).join(' '));
      const articleKeywords = extractArticleKeywords(articleText).filter(
        (keyword) =>
          hasUsefulKeyword(keyword, existingTopics, stockSummaryMap) &&
          !isSourceDerivedKeyword(keyword, item?.source),
      );

      for (const keyword of articleKeywords) {
        const entry = candidateKeywords.get(keyword) ?? {
          keyword,
          stockCodes: new Set(),
          stockMentions: new Map(),
          headlines: [],
          textMatches: 0,
          coKeywords: new Map(),
        };

        entry.stockCodes.add(code);
        entry.stockMentions.set(code, (entry.stockMentions.get(code) ?? 0) + 1);
        entry.headlines.push({
          title: item.title,
          link: item.link,
          source: item.source ?? null,
          publishedAt: item.publishedAt ?? null,
        });
        entry.textMatches += 1;

        for (const coKeyword of articleKeywords) {
          if (coKeyword === keyword || !hasUsefulKeyword(coKeyword, existingTopics, stockSummaryMap)) {
            continue;
          }

          entry.coKeywords.set(coKeyword, (entry.coKeywords.get(coKeyword) ?? 0) + 1);
        }

        candidateKeywords.set(keyword, entry);
      }
    }
  }

  for (const topicNews of topicNewsList) {
    for (const item of topicNews?.items ?? []) {
      if (!isRecentNews(item?.publishedAt)) {
        continue;
      }

      const text = normalizeText([item?.title, item?.summary].filter(Boolean).join(' '));

      for (const [keyword, entry] of candidateKeywords.entries()) {
        if (text.includes(keyword)) {
          entry.headlines.push({
            title: item.title,
            link: item.link,
            source: item.source ?? null,
            publishedAt: item.publishedAt ?? null,
          });
        }
      }
    }
  }

  return [...candidateKeywords.values()]
    .map((entry) => {
      const relatedStocks = [...entry.stockCodes]
        .map((code) => {
          const summary = stockSummaryMap.get(code);

          if (!summary) {
            return null;
          }

          const hotRank = hotRankMap.get(code);
          const strongRank = strongRankMap.get(code);
          const turnoverRank = turnoverRankMap.get(code);
          const newsMentions = entry.stockMentions.get(code) ?? 0;
          const confirmationCount = getConfirmationCount(summary, hotRank, strongRank, turnoverRank);

          if (newsMentions < 1 || confirmationCount < 1) {
            return null;
          }

          return {
            code,
            name: summary.name,
            score: scoreStock(summary, hotRank, strongRank, turnoverRank, newsMentions),
            isCoreStock: false,
            changePercent: summary.changePercent ?? null,
            return20: summary.return20 ?? null,
            total5Day: summary.total5Day ?? null,
            activeEtfCount: summary.activeEtfCount ?? 0,
            newsMentions,
            drivers: [
              hotRank ? `熱門股第 ${hotRank} 名` : null,
              strongRank ? `強勢股第 ${strongRank} 名` : null,
              (summary?.foreign5Day ?? 0) > 0 && (summary?.investmentTrust5Day ?? 0) > 0 ? '外資投信同步偏多' : null,
              (summary?.activeEtfCount ?? 0) > 0 ? `${summary.activeEtfCount} 檔主動 ETF 持有` : null,
              summary?.topSignalTitle ?? null,
            ].filter(Boolean).slice(0, 3),
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score || left.code.localeCompare(right.code))
        .slice(0, 5);

      const distinctHeadlines = entry.headlines
        .filter((item, index, list) => list.findIndex((candidate) => candidate.link === item.link) === index)
        .sort((left, right) => toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt))
        .slice(0, 6);

      const hotCount = relatedStocks.filter((stock) => hotRankMap.has(stock.code) || strongRankMap.has(stock.code)).length;
      const institutionalCount = relatedStocks.filter((stock) => (stock.total5Day ?? 0) > 0).length;
      const etfCount = relatedStocks.filter((stock) => (stock.activeEtfCount ?? 0) > 0).length;
      const headlineCount = distinctHeadlines.length;

      if (entry.textMatches < 3 || relatedStocks.length < 2 || headlineCount < 2 || (hotCount + institutionalCount + etfCount) < 2) {
        return null;
      }

      const score =
        headlineCount * 12 +
        hotCount * 18 +
        institutionalCount * 16 +
        etfCount * 12 +
        relatedStocks.reduce((sum, stock) => sum + Math.max(0, stock.score * 0.12), 0);

      return {
        slug: buildTopicSlug(entry.keyword),
        title: `${entry.keyword} 題材`,
        isEmerging: true,
        score: Math.round(score),
        tone: score >= 88 ? 'up' : score >= 56 ? 'info' : 'normal',
        newsCount: headlineCount,
        hotCount,
        institutionalCount,
        etfCount,
        observation: buildObservation({ headlineCount, hotCount, institutionalCount, etfCount }),
        keywords: buildKeywordCooccurrence(entry.coKeywords),
        headlines: distinctHeadlines.slice(0, 3),
        leaderStocks: relatedStocks.slice(0, 3),
        catchUpStocks: buildCatchUpStocks(relatedStocks),
        relatedStocks,
        sourceUrl: buildTopicSearchUrl(entry.keyword),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'zh-Hant'))
    .slice(0, 3);
}
