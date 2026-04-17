function normalizeDate(value) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeTopicSnapshot(topic) {
  return {
    slug: topic.slug,
    title: topic.title,
    score: Number(topic.score ?? 0),
    tone: topic.tone ?? 'normal',
    newsCount: Number(topic.newsCount ?? 0),
    hotCount: Number(topic.hotCount ?? 0),
    institutionalCount: Number(topic.institutionalCount ?? 0),
    etfCount: Number(topic.etfCount ?? 0),
    leaderCode: topic.leaderStocks?.[0]?.code ?? null,
    leaderName: topic.leaderStocks?.[0]?.name ?? null,
    catchUpCode: topic.catchUpStocks?.[0]?.code ?? null,
    catchUpName: topic.catchUpStocks?.[0]?.name ?? null,
  };
}

export function buildThemeHistorySnapshot(themeRadar) {
  const marketDate = normalizeDate(themeRadar?.marketDate);

  if (!marketDate) {
    return null;
  }

  return {
    marketDate,
    generatedAt: themeRadar?.generatedAt ?? null,
    leaderSlug: themeRadar?.topics?.[0]?.slug ?? null,
    leaderTitle: themeRadar?.topics?.[0]?.title ?? null,
    topics: (themeRadar?.topics ?? []).slice(0, 10).map(normalizeTopicSnapshot),
  };
}

export function mergeThemeHistory(existingHistory, snapshot, limit = 40) {
  const snapshots = [...(existingHistory?.snapshots ?? [])]
    .filter((item) => normalizeDate(item?.marketDate))
    .map((item) => ({
      marketDate: item.marketDate,
      generatedAt: item.generatedAt ?? null,
      leaderSlug: item.leaderSlug ?? item.topTopic?.slug ?? null,
      leaderTitle: item.leaderTitle ?? item.topTopic?.title ?? null,
      topics: (item.topics ?? []).map(normalizeTopicSnapshot),
    }));

  if (snapshot?.marketDate) {
    const index = snapshots.findIndex((item) => item.marketDate === snapshot.marketDate);

    if (index >= 0) {
      snapshots[index] = snapshot;
    } else {
      snapshots.push(snapshot);
    }
  }

  const normalizedSnapshots = snapshots
    .sort((left, right) => left.marketDate.localeCompare(right.marketDate))
    .slice(-limit);

  return {
    generatedAt: snapshot?.generatedAt ?? existingHistory?.generatedAt ?? null,
    marketDate: snapshot?.marketDate ?? existingHistory?.marketDate ?? null,
    snapshots: normalizedSnapshots,
  };
}
