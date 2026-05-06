function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildKeywordIndex(topics = []) {
  const keywordMap = new Map();

  for (const topic of topics) {
    for (const keyword of topic?.keywords ?? []) {
      const text = String(typeof keyword === 'string' ? keyword : keyword?.keyword ?? '').trim();
      if (!text) continue;

      if (!keywordMap.has(text)) {
        keywordMap.set(text, {
          keyword: text,
          count: 0,
          topics: new Set(),
          representativeStocks: new Map(),
        });
      }

      const bucket = keywordMap.get(text);
      bucket.count += toNumber(keyword?.count) ?? 1;
      bucket.topics.add(topic.title);
      for (const stock of topic?.relatedStocks?.slice(0, 4) ?? []) {
        const code = String(stock?.code ?? '').trim();
        if (!code) continue;
        bucket.representativeStocks.set(code, stock);
      }
    }
  }

  return [...keywordMap.values()]
    .map((item) => ({
      keyword: item.keyword,
      count: item.count,
      topics: [...item.topics].slice(0, 3),
      representativeStocks: [...item.representativeStocks.values()].slice(0, 3),
    }))
    .sort((left, right) => (right.count ?? 0) - (left.count ?? 0));
}

export function buildMarketBuzz(themeRadar = null, themeHistory = null) {
  const topics = [...(themeRadar?.topics ?? [])];
  const snapshots = [...(themeHistory?.snapshots ?? [])];
  const previousSnapshot = snapshots.length >= 2 ? snapshots.at(-2) : null;
  const previousTopicMap = new Map((previousSnapshot?.topics ?? []).map((item) => [item.slug, item]));

  const hotTopics = topics
    .map((topic) => {
      const previous = previousTopicMap.get(topic.slug);
      const scoreChange = previous ? (toNumber(topic.score) ?? 0) - (toNumber(previous.score) ?? 0) : null;
      const discussionHeat =
        (toNumber(topic.score) ?? 0) * 0.8 +
        (toNumber(topic.newsCount) ?? 0) * 2.2 +
        (toNumber(topic.hotCount) ?? 0) * 3.6 +
        (toNumber(topic.institutionalCount) ?? 0) * 5.2 +
        (toNumber(topic.etfCount) ?? 0) * 4.1 +
        Math.max(0, scoreChange ?? 0) * 2.4;

      return {
        ...topic,
        scoreChange,
        discussionHeat,
      };
    })
    .sort((left, right) => (right.discussionHeat ?? 0) - (left.discussionHeat ?? 0));

  const hotKeywords = buildKeywordIndex(hotTopics).slice(0, 18);
  const chatterLeaders = hotTopics
    .flatMap((topic) =>
      (topic.relatedStocks ?? []).slice(0, 5).map((stock) => ({
        ...stock,
        topicTitle: topic.title,
        discussionHeat: topic.discussionHeat ?? 0,
      })),
    )
    .sort((left, right) => (right.discussionHeat ?? 0) - (left.discussionHeat ?? 0))
    .slice(0, 12);

  return {
    hotKeywords,
    hotTopics: hotTopics.slice(0, 12),
    chatterLeaders,
    summary: {
      hottestKeyword: hotKeywords[0] ?? null,
      hottestTopic: hotTopics[0] ?? null,
      hottestStock: chatterLeaders[0] ?? null,
    },
  };
}
