const STOP_WORDS = new Set([
  '台股',
  '股票',
  '個股',
  '市場',
  '股市',
  '收盤',
  '盤中',
  '新聞',
  '財經',
  '今日',
  '今天',
  '公司',
  '表示',
  '相關',
  '布局',
  '觀察',
  '分析',
  '同步',
  '整理',
  'nbsp',
  'cmoney',
  'yahoo',
  'yahoo股市',
  'google',
  'rss',
  'factset',
  '豐雲學堂',
]);

const FINANCIAL_TERMS = [
  'AI',
  '法說會',
  '營收',
  '獲利',
  'EPS',
  '股利',
  '除息',
  '除權息',
  '外資',
  '投信',
  '自營商',
  '漲停',
  '跌停',
  '配息',
  '先進製程',
  '擴產',
  '供應鏈',
  '伺服器',
  '半導體',
  '車用',
  '記憶體',
  '聯發科',
  '台積電',
];

export function decodeHtmlEntities(text) {
  return String(text ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&#160;', ' ')
    .replace(/\u00a0/g, ' ');
}

export function stripHtml(text) {
  return decodeHtmlEntities(String(text ?? ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRawKeywordCandidates(text) {
  const normalized = stripHtml(text);
  const chineseTerms = normalized.match(/[\u4e00-\u9fff]{2,6}/g) ?? [];
  const alphanumericTerms = normalized.match(/[A-Za-z][A-Za-z0-9.+-]{1,12}/g) ?? [];
  return [...chineseTerms, ...alphanumericTerms];
}

export function extractNewsKeywords(items, context = {}) {
  const deny = new Set(
    [context.code, context.name, ...(context.aliases ?? [])]
      .flatMap((item) => String(item ?? '').split(/\s+/))
      .filter(Boolean),
  );
  const counts = new Map();

  for (const item of items) {
    const mergedText = [item.title, item.summary, item.source].filter(Boolean).join(' ');
    const seenInArticle = new Set();

    for (const candidate of buildRawKeywordCandidates(mergedText)) {
      const token = candidate.trim();

      if (
        token.length < 2 ||
        STOP_WORDS.has(token) ||
        deny.has(token) ||
        /^\d+$/.test(token) ||
        seenInArticle.has(token)
      ) {
        continue;
      }

      seenInArticle.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }

    for (const term of FINANCIAL_TERMS) {
      if (mergedText.includes(term)) {
        counts.set(term, (counts.get(term) ?? 0) + 2);
      }
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hant'))
    .slice(0, 10)
    .map(([keyword, count]) => ({
      keyword,
      count,
    }));
}
