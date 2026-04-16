import { discoverEmergingTopics } from './emerging-theme-radar.mjs';
import { stripHtml } from '../../src/lib/newsKeywords.js';

const RECENT_NEWS_DAYS = 7;

const TOPIC_DEFINITIONS = [
  {
    slug: 'cpo',
    title: 'CPO / 矽光子',
    aliases: ['CPO', '矽光子', '共同封裝光學', '光通訊', '光模組', '高速光'],
    searchQuery: '(CPO OR 矽光子 OR 共同封裝光學 OR 光通訊 OR 光模組) 台股',
    coreStocks: ['6451', '3711', '3363', '3163', '4979', '6442', '2345', '3443'],
  },
  {
    slug: 'pcb',
    title: 'PCB / CCL',
    aliases: ['PCB', '印刷電路板', 'CCL', '銅箔基板', 'HDI', '軟板'],
    searchQuery: '(PCB OR 印刷電路板 OR CCL OR 銅箔基板 OR HDI OR 軟板) 台股',
    coreStocks: ['2383', '3037', '8046', '6274', '6213', '3189', '2368'],
  },
  {
    slug: 'abf',
    title: 'ABF 載板',
    aliases: ['ABF', 'ABF載板', '載板', 'IC載板', 'BT載板'],
    searchQuery: '(ABF OR ABF載板 OR 載板 OR IC載板 OR BT載板) 台股',
    coreStocks: ['8046', '3037', '3189'],
  },
  {
    slug: 'glass-fiber',
    title: '玻纖布 / Low Dk',
    aliases: ['玻纖布', 'Low Dk', 'Low-loss', 'T-glass', '低介電'],
    searchQuery: '(玻纖布 OR Low Dk OR Low-loss OR T-glass OR 低介電) 台股',
    coreStocks: ['1802', '1815', '1303', '6213', '6274', '2383'],
  },
  {
    slug: 'ai-server',
    title: 'AI 伺服器 / ASIC',
    aliases: ['AI伺服器', 'ASIC', '伺服器', 'GB200', 'Rubin', 'TPU', 'Trainium'],
    searchQuery: '("AI 伺服器" OR ASIC OR GB200 OR Rubin OR TPU OR Trainium) 台股',
    coreStocks: ['2382', '3231', '6669', '2356', '3443', '3661', '5274'],
  },
  {
    slug: 'cowos',
    title: 'CoWoS / 先進封裝',
    aliases: ['CoWoS', '先進封裝', '封裝', 'SoIC', 'HBM'],
    searchQuery: '(CoWoS OR 先進封裝 OR SoIC OR HBM) 台股',
    coreStocks: ['2330', '3711', '3131', '3583', '6223', '6187'],
  },
  {
    slug: 'cooling',
    title: '散熱 / 液冷',
    aliases: ['散熱', '液冷', '水冷', '熱模組', '風扇'],
    searchQuery: '(散熱 OR 液冷 OR 水冷 OR 熱模組 OR 風扇) 台股',
    coreStocks: ['3017', '3324', '3653', '6230'],
  },
  {
    slug: 'robotics',
    title: '機器人 / 自動化',
    aliases: ['機器人', '自動化', '協作機器人', '工業自動化'],
    searchQuery: '(機器人 OR 自動化 OR 協作機器人 OR 工業自動化) 台股',
    coreStocks: ['2049', '1536', '4540', '3019'],
  },
  {
    slug: 'power-grid',
    title: '重電 / 儲能',
    aliases: ['重電', '儲能', '電網', '電力設備', 'EMS'],
    searchQuery: '(重電 OR 儲能 OR 電網 OR 電力設備 OR EMS) 台股',
    coreStocks: ['1519', '1503', '1513', '1514', '2371'],
  },
  {
    slug: 'memory',
    title: '記憶體 / DDR5',
    aliases: ['記憶體', 'DDR5', 'NAND', 'SSD', 'HBM'],
    searchQuery: '(記憶體 OR DDR5 OR NAND OR SSD OR HBM) 台股',
    coreStocks: ['2408', '2344', '2337', '8299'],
  },
];

const THEME_NOISE_KEYWORDS = new Set([
  'nbsp',
  'CMoney',
  'Yahoo股市',
  '股市爆料同學',
  '投資網誌',
  '即時新聞',
  '新聞',
  '財經',
  '台股',
  'Yahoo',
  '聯合新聞網',
  '工商時報',
  '經濟日報',
  '財訊',
  '億元',
  '月營收',
  '營收',
  'EPS',
]);

function normalizeText(value) {
  return stripHtml(String(value ?? '')).replace(/\s+/g, ' ').trim();
}

function includesAlias(text, aliases) {
  const normalizedText = normalizeText(text).toLowerCase();
  return aliases.some((alias) => normalizedText.includes(String(alias ?? '').toLowerCase()));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createRankMap(items = [], codeField = '代號') {
  return new Map(
    items
      .map((item, index) => [String(item?.[codeField] ?? '').trim(), index + 1])
      .filter(([code]) => code),
  );
}

function createStockSummaryMap(stockSummaries = []) {
  return new Map(
    stockSummaries
      .map((item) => [String(item?.code ?? '').trim(), item])
      .filter(([code]) => code),
  );
}

function createCodeSet(values = []) {
  return new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  );
}

function collectStockMentionsFromTopicNews(topicNews, stockSummaries) {
  const mentionMap = new Map();

  for (const article of topicNews?.items ?? []) {
    const text = normalizeText([article?.title, article?.summary, article?.source].filter(Boolean).join(' ')).toLowerCase();

    for (const stock of stockSummaries) {
      const code = String(stock?.code ?? '').trim();
      const name = normalizeText(stock?.name ?? '').toLowerCase();

      if (!code || !name) {
        continue;
      }

      if (text.includes(code.toLowerCase()) || text.includes(name)) {
        mentionMap.set(code, (mentionMap.get(code) ?? 0) + 1);
      }
    }
  }

  return mentionMap;
}

function collectStockMentionsFromStockNews(topic, stockNewsList) {
  const mentionMap = new Map();

  for (const news of stockNewsList ?? []) {
    const text = normalizeText([
      ...(news?.keywords ?? []).map((item) => item.keyword),
      ...(news?.items ?? []).flatMap((item) => [item.title, item.summary]),
    ].filter(Boolean).join(' '));

    if (!includesAlias(text, topic.aliases)) {
      continue;
    }

    const code = String(news?.code ?? '').trim();

    if (code) {
      mentionMap.set(code, (mentionMap.get(code) ?? 0) + 1);
    }
  }

  return mentionMap;
}

function buildDrivers({ code, summary, hotRankMap, strongRankMap, turnoverRankMap, isCoreStock }) {
  const drivers = [];
  const positiveForeign = (summary?.foreign5Day ?? 0) > 0;
  const positiveTrust = (summary?.investmentTrust5Day ?? 0) > 0;

  if (isCoreStock) {
    drivers.push('核心題材股');
  }

  if (hotRankMap.has(code)) {
    drivers.push(`熱門股第 ${hotRankMap.get(code)} 名`);
  }

  if (strongRankMap.has(code)) {
    drivers.push(`強勢股第 ${strongRankMap.get(code)} 名`);
  }

  if (turnoverRankMap.has(code)) {
    drivers.push(`成交值第 ${turnoverRankMap.get(code)} 名`);
  }

  if (positiveForeign && positiveTrust) {
    drivers.push('外資投信同步偏多');
  } else if (positiveForeign) {
    drivers.push('外資偏多');
  } else if (positiveTrust) {
    drivers.push('投信偏多');
  }

  if ((summary?.activeEtfCount ?? 0) > 0) {
    drivers.push(`${summary.activeEtfCount} 檔主動式 ETF 持有`);
  }

  if (summary?.topSignalTone === 'up' && summary?.topSignalTitle) {
    drivers.push(summary.topSignalTitle);
  }

  return drivers.slice(0, 3);
}

function hasTopicConfirmation({ summary, hotRank, strongRank, turnoverRank }) {
  const positiveForeign = (summary?.foreign5Day ?? 0) > 0;
  const positiveTrust = (summary?.investmentTrust5Day ?? 0) > 0;
  const etfCount = toNumber(summary?.activeEtfCount) ?? 0;

  return [
    positiveForeign,
    positiveTrust,
    etfCount > 0,
    Boolean(hotRank),
    Boolean(strongRank),
    Boolean(turnoverRank),
    summary?.topSignalTone === 'up',
  ].filter(Boolean).length;
}

function shouldIncludeTopicStock({ isCoreStock, summary, topicNewsHit, stockNewsMentions, hotRank, strongRank, turnoverRank }) {
  const confirmations = hasTopicConfirmation({ summary, hotRank, strongRank, turnoverRank });

  if (isCoreStock) {
    return true;
  }

  if (stockNewsMentions >= 1 && confirmations >= 1) {
    return true;
  }

  if (topicNewsHit >= 2 && confirmations >= 2) {
    return true;
  }

  if ((hotRank || strongRank) && confirmations >= 2) {
    return true;
  }

  return false;
}

function scoreTopicStock({ code, summary, topicStockNewsMentions, topicNewsMentions, hotRankMap, strongRankMap, turnoverRankMap, isCoreStock }) {
  const hotRank = hotRankMap.get(code);
  const strongRank = strongRankMap.get(code);
  const turnoverRank = turnoverRankMap.get(code);
  const stockNewsMentions = topicStockNewsMentions.get(code) ?? 0;
  const topicNewsHit = topicNewsMentions.get(code) ?? 0;
  const positiveForeign = (summary?.foreign5Day ?? 0) > 0 ? 1 : 0;
  const positiveTrust = (summary?.investmentTrust5Day ?? 0) > 0 ? 1 : 0;
  const dualInstitutional = positiveForeign && positiveTrust ? 1 : 0;
  const etfCount = toNumber(summary?.activeEtfCount) ?? 0;
  const return20 = toNumber(summary?.return20) ?? 0;
  const changePercent = toNumber(summary?.changePercent) ?? 0;

  return (
    (isCoreStock ? 28 : 0) +
    stockNewsMentions * 18 +
    topicNewsHit * 12 +
    (hotRank ? Math.max(0, 14 - hotRank) * 3 : 0) +
    (strongRank ? Math.max(0, 14 - strongRank) * 3 : 0) +
    (turnoverRank ? Math.max(0, 14 - turnoverRank) * 2 : 0) +
    (positiveForeign + positiveTrust) * 10 +
    dualInstitutional * 10 +
    etfCount * 4 +
    Math.max(0, return20) * 0.9 +
    Math.max(0, changePercent) * 3 +
    (summary?.topSignalTone === 'up' ? 8 : 0)
  );
}

function buildTopicObservation({ hotCount, institutionalCount, etfCount, newsCount }) {
  if (hotCount >= 2 && institutionalCount >= 2) {
    return '熱門股與法人同步轉進，短線資金正在快速聚焦這個題材。';
  }

  if (hotCount >= 2) {
    return '人氣股明顯集中，盤面討論度與成交熱度正在升高。';
  }

  if (institutionalCount >= 2) {
    return '法人買盤開始連續布局，適合優先追蹤族群中的領頭股。';
  }

  if (etfCount >= 2) {
    return '主動式 ETF 曝光度提升，代表資金已經開始放進投資組合。';
  }

  if (newsCount >= 3) {
    return '新聞熱度升溫，但盤面資金尚未完全擴散，適合先建立觀察名單。';
  }

  return '題材剛開始被提及，還在醞釀期，適合觀察族群是否開始放量。';
}

function buildTopicTone(score) {
  if (score >= 90) return 'up';
  if (score >= 56) return 'info';
  return 'normal';
}

function buildRadarObservations(topics) {
  return topics.slice(0, 3).map((topic) => {
    const leadStock = topic.relatedStocks?.[0];

    if (leadStock) {
      return `${topic.title} 目前由 ${leadStock.code} ${leadStock.name} 帶頭，${topic.observation}`;
    }

    return `${topic.title} 目前仍在醞釀期，${topic.observation}`;
  });
}

function buildCatchUpStocks(relatedStocks = []) {
  if (!relatedStocks.length) {
    return [];
  }

  const leaders = relatedStocks.slice(0, 3);
  const leaderCodes = new Set(leaders.map((item) => item.code));
  const leaderReturn = Math.max(...leaders.map((item) => toNumber(item.return20) ?? 0), 0);
  const candidates = relatedStocks
    .filter((item) => !leaderCodes.has(item.code))
    .filter((item) => {
      const return20 = toNumber(item.return20);

      if (return20 === null) {
        return true;
      }

      return return20 <= Math.max(leaderReturn * 0.62, 16);
    })
    .map((item) => {
      const return20 = toNumber(item.return20) ?? 0;
      const changePercent = toNumber(item.changePercent) ?? 0;
      const total5Day = toNumber(item.total5Day) ?? 0;
      const score =
        (item.isCoreStock ? 20 : 0) +
        (item.newsMentions ?? 0) * 10 +
        (item.activeEtfCount ?? 0) * 8 +
        (total5Day > 0 ? 18 : 0) +
        Math.max(0, changePercent) * 3 -
        Math.max(0, return20) * 0.45;

      return {
        ...item,
        catchUpScore: score,
      };
    })
    .sort((left, right) => right.catchUpScore - left.catchUpScore || right.score - left.score);

  return candidates.slice(0, 3);
}

function combineKeywordCounts(topicNews, stockNewsList, topic) {
  const keywordCounts = new Map();
  const isNoiseKeyword = (value) => {
    const keyword = normalizeText(value);

    if (!keyword) {
      return true;
    }

    if (THEME_NOISE_KEYWORDS.has(keyword)) {
      return true;
    }

    return /^(googlenews|rss|moneydj|udn|ettoday)$/i.test(keyword);
  };

  for (const keyword of topicNews?.keywords ?? []) {
    const name = normalizeText(keyword?.keyword);
    const count = toNumber(keyword?.count) ?? 0;

    if (name && !isNoiseKeyword(name)) {
      keywordCounts.set(name, (keywordCounts.get(name) ?? 0) + count + 1);
    }
  }

  for (const news of stockNewsList ?? []) {
    const text = normalizeText([
      ...(news?.keywords ?? []).map((item) => item.keyword),
      ...(news?.items ?? []).flatMap((item) => [item.title, item.summary]),
    ].filter(Boolean).join(' '));

    if (!includesAlias(text, topic.aliases)) {
      continue;
    }

    for (const keyword of news?.keywords ?? []) {
      const name = normalizeText(keyword?.keyword);
      const count = toNumber(keyword?.count) ?? 0;

      if (!name || isNoiseKeyword(name) || includesAlias(name, topic.aliases)) {
        continue;
      }

      keywordCounts.set(name, (keywordCounts.get(name) ?? 0) + count);
    }
  }

  return [...keywordCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hant'))
    .slice(0, 8)
    .map(([keyword, count]) => ({ keyword, count }));
}

export function buildThemeRadar({
  stockSummaries = [],
  stockNewsList = [],
  topicNewsList = [],
  marketOverview = {},
  generatedAt = null,
  marketDate = null,
} = {}) {
  const stockSummaryMap = createStockSummaryMap(stockSummaries);
  const hotRankMap = createRankMap(marketOverview?.熱門股 ?? []);
  const strongRankMap = createRankMap(marketOverview?.強勢股 ?? []);
  const turnoverRankMap = createRankMap(marketOverview?.成交排行 ?? []);

  const curatedTopics = TOPIC_DEFINITIONS.map((topic) => {
    const topicNews = topicNewsList.find((item) => item.slug === topic.slug) ?? null;
    const topicNewsMentions = collectStockMentionsFromTopicNews(topicNews, stockSummaries);
    const topicStockNewsMentions = collectStockMentionsFromStockNews(topic, stockNewsList);
    const topicCoreCodes = createCodeSet(topic.coreStocks);
    const relatedCodes = new Set([...topicCoreCodes, ...topicNewsMentions.keys(), ...topicStockNewsMentions.keys()]);

    const relatedStocks = [...relatedCodes]
      .map((code) => {
        const summary = stockSummaryMap.get(code);

        if (!summary) {
          return null;
        }

        const hotRank = hotRankMap.get(code);
        const strongRank = strongRankMap.get(code);
        const turnoverRank = turnoverRankMap.get(code);
        const stockNewsMentions = topicStockNewsMentions.get(code) ?? 0;
        const topicNewsHit = topicNewsMentions.get(code) ?? 0;
        const isCoreStock = topicCoreCodes.has(code);

        if (
          !shouldIncludeTopicStock({
            isCoreStock,
            summary,
            topicNewsHit,
            stockNewsMentions,
            hotRank,
            strongRank,
            turnoverRank,
          })
        ) {
          return null;
        }

        const score = scoreTopicStock({
          code,
          summary,
          topicStockNewsMentions,
          topicNewsMentions,
          hotRankMap,
          strongRankMap,
          turnoverRankMap,
          isCoreStock,
        });

        return {
          code,
          name: summary.name,
          score,
          isCoreStock,
          changePercent: summary.changePercent ?? null,
          return20: summary.return20 ?? null,
          total5Day: summary.total5Day ?? null,
          activeEtfCount: summary.activeEtfCount ?? 0,
          newsMentions: stockNewsMentions + topicNewsHit,
          drivers: buildDrivers({ code, summary, hotRankMap, strongRankMap, turnoverRankMap, isCoreStock }),
        };
      })
      .filter(Boolean)
      .sort(
        (left, right) =>
          Number(right.isCoreStock) - Number(left.isCoreStock) ||
          right.score - left.score ||
          String(left.code).localeCompare(String(right.code)),
      )
      .slice(0, 5);

    const hotCount = relatedStocks.filter((item) => hotRankMap.has(item.code) || strongRankMap.has(item.code)).length;
    const institutionalCount = relatedStocks.filter((item) => (item.total5Day ?? 0) > 0).length;
    const etfCount = relatedStocks.filter((item) => (item.activeEtfCount ?? 0) > 0).length;
    const newsCount = (topicNews?.items?.length ?? 0) + [...topicStockNewsMentions.values()].reduce((sum, value) => sum + value, 0);
    const score =
      newsCount * 6 +
      hotCount * 18 +
      institutionalCount * 16 +
      etfCount * 10 +
      relatedStocks.reduce((sum, stock) => sum + Math.max(0, stock.score * 0.12), 0);
    const tone = buildTopicTone(score);

    return {
      slug: topic.slug,
      title: topic.title,
      score: Math.round(score),
      tone,
      newsCount,
      hotCount,
      institutionalCount,
      etfCount,
      observation: buildTopicObservation({ hotCount, institutionalCount, etfCount, newsCount }),
      keywords: combineKeywordCounts(topicNews, stockNewsList, topic),
      headlines: (topicNews?.items ?? []).slice(0, 3).map((item) => ({
        title: item.title,
        link: item.link,
        source: item.source ?? null,
        publishedAt: item.publishedAt ?? null,
      })),
      leaderStocks: relatedStocks.slice(0, 3),
      catchUpStocks: buildCatchUpStocks(relatedStocks),
      relatedStocks,
      sourceUrl: topicNews?.sourceUrl ?? null,
    };
  });

  const emergingTopics = discoverEmergingTopics({
    stockSummaries,
    stockNewsList,
    topicNewsList,
    marketOverview,
    existingTopics: TOPIC_DEFINITIONS,
  });

  const topics = [...curatedTopics, ...emergingTopics]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'zh-Hant'))
    .slice(0, 8);

  return {
    generatedAt,
    marketDate,
    recentNewsDays: RECENT_NEWS_DAYS,
    sourceName: `Google News RSS（近 ${RECENT_NEWS_DAYS} 天）+ 台股盤面摘要`,
    topics,
    observations: buildRadarObservations(topics),
  };
}

export { TOPIC_DEFINITIONS };
