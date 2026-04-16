import { ref, toValue, watch } from 'vue';
import { fetchOptionalJson } from '../lib/api';
import { stripHtml } from '../lib/newsKeywords';

const KEYWORD_NOISE = new Set([
  'nbsp',
  'google',
  'rss',
  'cmoney',
  'yahoo',
  'yahoo股市',
  'sinotrade.com.tw',
  'line today',
  'factset',
  '豐雲學堂',
  'google news',
]);

function cleanText(value) {
  return stripHtml(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSummary(summary, title, source) {
  let cleaned = cleanText(summary);

  if (!cleaned) {
    return null;
  }

  if (title && cleaned.startsWith(title)) {
    cleaned = cleaned.slice(title.length).trim();
  }

  if (source && cleaned.endsWith(source)) {
    cleaned = cleaned.slice(0, -source.length).trim();
  }

  cleaned = cleaned.replace(/^[-:：|｜]+/, '').replace(/[-:：|｜]+$/, '').trim();

  if (!cleaned || cleaned === title || cleaned === source) {
    return null;
  }

  return cleaned;
}

function normalizeKeyword(item) {
  const keyword = cleanText(item?.keyword);
  const count = Number(item?.count);

  if (!keyword || KEYWORD_NOISE.has(keyword.toLowerCase()) || !Number.isFinite(count) || count <= 0) {
    return null;
  }

  return {
    keyword,
    count,
  };
}

function normalizeNewsItem(item) {
  const title = cleanText(item?.title);
  const source = cleanText(item?.source) || null;
  const summary = cleanSummary(item?.summary, title, source);

  if (!title || !item?.link) {
    return null;
  }

  return {
    ...item,
    title,
    source,
    summary,
  };
}

function normalizeNewsPayload(payload) {
  if (!payload) {
    return null;
  }

  const items = (payload.items ?? [])
    .map(normalizeNewsItem)
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.link === item.link) === index);

  const keywords = (payload.keywords ?? [])
    .map(normalizeKeyword)
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.keyword === item.keyword) === index)
    .slice(0, 8);

  return {
    ...payload,
    items,
    keywords,
  };
}

export function useStockNews(codeSource) {
  const news = ref(null);
  const isLoading = ref(false);
  const errorMessage = ref('');
  const hasLoaded = ref(false);

  watch(
    () => String(toValue(codeSource) ?? '').trim(),
    () => {
      news.value = null;
      isLoading.value = false;
      errorMessage.value = '';
      hasLoaded.value = false;
    },
  );

  async function load() {
    const code = String(toValue(codeSource) ?? '').trim();

    if (!code || isLoading.value) {
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      const payload = await fetchOptionalJson(`data/stocks/news/${code}.json`);
      news.value = normalizeNewsPayload(payload);
      hasLoaded.value = true;

      if (!news.value) {
        errorMessage.value = '目前還沒有整理到這檔股票的近期新聞。';
      } else if (news.value.errorMessage && !(news.value.items?.length)) {
        errorMessage.value = news.value.errorMessage;
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '新聞資料讀取失敗。';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    news,
    isLoading,
    errorMessage,
    hasLoaded,
    load,
  };
}
