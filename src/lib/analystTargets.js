import { stripHtml } from './newsKeywords.js';

const DEFAULT_RECENT_DAYS = 7;

const BROKER_PATTERNS = [
  ['美系外資', /美系外資/i],
  ['歐系外資', /歐系外資/i],
  ['日系外資', /日系外資/i],
  ['港系外資', /港系外資/i],
  ['大摩', /摩根士丹利|Morgan Stanley|大摩/i],
  ['高盛', /高盛|Goldman Sachs/i],
  ['花旗', /花旗|Citi(?:group)?/i],
  ['瑞銀', /瑞銀|UBS/i],
  ['摩根大通', /摩根大通|J\.?P\.?\s*Morgan|JP\s*Morgan/i],
  ['美銀', /美銀|Bank of America|BofA/i],
  ['麥格理', /麥格理|Macquarie/i],
  ['野村', /野村|Nomura/i],
  ['滙豐', /滙豐|HSBC/i],
  ['里昂', /里昂|CLSA/i],
  ['法銀巴黎', /法銀巴黎|BNP Paribas/i],
  ['德意志', /德意志|Deutsche Bank/i],
  ['瑞信', /瑞信|Credit Suisse/i],
];

const ACTION_PATTERNS = [
  ['調升', /調升|上修|調高|升評/i],
  ['重申', /重申|維持|喊買|續喊/i],
  ['初評', /初評|新納追蹤|首次評等/i],
  ['下修', /下修|調降|降評/i],
];

const TARGET_PRICE_PATTERNS = [
  /(?:目標價(?:上看)?|合理價|目標區間上緣|目標區間下緣|上看|看至|喊到|挑戰|調升至|調高至|上修至|升至|上調至)(?:約|至|到)?\s*([0-9]{2,5}(?:\.[0-9]+)?)\s*元/gi,
];

const TARGET_PRICE_CONTEXT = /目標價|合理價|上看|看至|喊到|挑戰|外資|券商|報告|評等|初評|調升|上修|調高|重申/i;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  return stripHtml(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSource(value) {
  const source = normalizeText(value);
  return source || null;
}

function toTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isRecentArticle(publishedAt, recentDays = DEFAULT_RECENT_DAYS) {
  if (!publishedAt) {
    return true;
  }

  const publishedTime = new Date(publishedAt);

  if (Number.isNaN(publishedTime.getTime())) {
    return true;
  }

  const cutoff = Date.now() - recentDays * 86400000;
  return publishedTime.getTime() >= cutoff;
}

function detectBroker(text, source) {
  const merged = `${normalizeText(text)} ${normalizeSource(source) ?? ''}`;

  for (const [label, pattern] of BROKER_PATTERNS) {
    if (pattern.test(merged)) {
      return label;
    }
  }

  if (/外資/.test(merged)) {
    return '外資';
  }

  if (/券商|投顧|報告/.test(merged)) {
    return '券商';
  }

  return null;
}

function detectAction(text) {
  const merged = normalizeText(text);

  for (const [label, pattern] of ACTION_PATTERNS) {
    if (pattern.test(merged)) {
      return label;
    }
  }

  return '提及';
}

function extractTargetPriceValues(text) {
  const values = [];

  for (const pattern of TARGET_PRICE_PATTERNS) {
    pattern.lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
      const targetPrice = toNumber(match[1]);

      if (!targetPrice || targetPrice < 20 || targetPrice > 5000) {
        continue;
      }

      values.push(targetPrice);
    }
  }

  return [...new Set(values)];
}

function buildTargetItems(newsPayload, recentDays = DEFAULT_RECENT_DAYS) {
  const items = [];

  for (const article of newsPayload?.items ?? []) {
    if (!isRecentArticle(article?.publishedAt, recentDays)) {
      continue;
    }

    const title = normalizeText(article?.title);
    const summary = normalizeText(article?.summary);
    const source = normalizeSource(article?.source);
    const mergedText = `${title} ${summary}`.trim();

    if (!mergedText || !TARGET_PRICE_CONTEXT.test(mergedText)) {
      continue;
    }

    const broker = detectBroker(mergedText, source);
    const hasExplicitTargetPhrase = /目標價|合理價|上看|看至|喊到|挑戰|調升至|上修至|調高至/.test(mergedText);

    if (!broker && !hasExplicitTargetPhrase) {
      continue;
    }

    const prices = extractTargetPriceValues(mergedText);

    for (const targetPrice of prices) {
      items.push({
        broker: broker ?? '市場摘要',
        action: detectAction(mergedText),
        targetPrice,
        title: title || summary || '新聞提及目標價',
        source,
        link: article?.link ?? null,
        publishedAt: article?.publishedAt ?? null,
      });
    }
  }

  return items
    .filter((item, index, list) => list.findIndex((candidate) => `${candidate.title}-${candidate.targetPrice}` === `${item.title}-${item.targetPrice}`) === index)
    .sort((left, right) => toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt) || right.targetPrice - left.targetPrice);
}

export function extractForeignTargetPriceSummary(newsPayload, options = {}) {
  const recentDays = Number.isFinite(Number(options.recentDays)) ? Number(options.recentDays) : DEFAULT_RECENT_DAYS;
  const currentClose = toNumber(options.currentClose);
  const items = buildTargetItems(newsPayload, recentDays);

  if (!items.length) {
    return {
      recentDays,
      itemCount: 0,
      latestTargetPrice: null,
      latestBroker: null,
      highestTargetPrice: null,
      lowestTargetPrice: null,
      averageTargetPrice: null,
      premiumToClose: null,
      note: null,
      items: [],
    };
  }

  const targetPrices = items.map((item) => item.targetPrice);
  const latestTargetPrice = items[0]?.targetPrice ?? null;
  const highestTargetPrice = Math.max(...targetPrices);
  const lowestTargetPrice = Math.min(...targetPrices);
  const averageTargetPrice = targetPrices.reduce((sum, value) => sum + value, 0) / targetPrices.length;
  const premiumToClose =
    currentClose && latestTargetPrice
      ? ((latestTargetPrice - currentClose) / currentClose) * 100
      : null;

  return {
    recentDays,
    itemCount: items.length,
    latestTargetPrice,
    latestBroker: items[0]?.broker ?? null,
    highestTargetPrice,
    lowestTargetPrice,
    averageTargetPrice,
    premiumToClose,
    note: `近 ${recentDays} 天新聞整理到 ${items.length} 則券商/外資目標價提及，最新 ${items[0]?.broker ?? '市場'} 看 ${latestTargetPrice} 元，區間 ${lowestTargetPrice} - ${highestTargetPrice} 元。`,
    items: items.slice(0, 8),
  };
}
