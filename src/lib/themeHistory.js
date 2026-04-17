function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSnapshots(history) {
  return [...(history?.snapshots ?? [])]
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(String(item?.marketDate ?? '')))
    .sort((left, right) => String(left.marketDate).localeCompare(String(right.marketDate)));
}

function getTopicScore(snapshot, slug) {
  const topic = snapshot?.topics?.find((item) => item.slug === slug);
  return toNumber(topic?.score);
}

function getTopicMeta(snapshot, slug) {
  return snapshot?.topics?.find((item) => item.slug === slug) ?? null;
}

function computeDelta(currentValue, previousValue) {
  if (currentValue === null || previousValue === null) {
    return null;
  }

  return currentValue - previousValue;
}

function buildTrendLabel(delta) {
  if (delta === null) return '資料不足';
  if (delta >= 18) return '快速升溫';
  if (delta >= 6) return '升溫中';
  if (delta <= -18) return '快速降溫';
  if (delta <= -6) return '降溫中';
  return '延續中';
}

function buildTrendTone(delta) {
  if (delta === null) return 'normal';
  if (delta >= 6) return 'up';
  if (delta <= -6) return 'down';
  return 'info';
}

export function buildThemeHistoryOverview(history, currentTopics = [], windows = [5, 10, 20]) {
  const snapshots = normalizeSnapshots(history);
  const latestSnapshot = snapshots.at(-1) ?? null;
  const snapshotCount = snapshots.length;

  const rows = currentTopics.map((topic) => {
    const currentScore = toNumber(topic?.score);
    const deltas = Object.fromEntries(
      windows.map((windowSize) => {
        const referenceSnapshot = snapshots.at(-(windowSize + 1)) ?? null;
        const previousScore = referenceSnapshot ? getTopicScore(referenceSnapshot, topic.slug) : null;
        return [windowSize, computeDelta(currentScore, previousScore)];
      }),
    );
    const recentSeries = snapshots
      .slice(-10)
      .map((snapshot) => getTopicScore(snapshot, topic.slug) ?? 0);

    return {
      slug: topic.slug,
      title: topic.title,
      tone: topic.tone ?? 'normal',
      currentScore,
      leaderCode: topic.leaderStocks?.[0]?.code ?? null,
      leaderName: topic.leaderStocks?.[0]?.name ?? null,
      deltas,
      recentSeries,
      trendLabel: buildTrendLabel(deltas[5] ?? deltas[10] ?? deltas[20] ?? null),
      trendTone: buildTrendTone(deltas[5] ?? deltas[10] ?? deltas[20] ?? null),
    };
  });

  const trendsByWindow = Object.fromEntries(
    windows.map((windowSize) => {
      const warming = [...rows]
        .filter((row) => row.deltas[windowSize] !== null)
        .sort((left, right) => (right.deltas[windowSize] ?? -Infinity) - (left.deltas[windowSize] ?? -Infinity))
        .slice(0, 3);
      const cooling = [...rows]
        .filter((row) => row.deltas[windowSize] !== null)
        .sort((left, right) => (left.deltas[windowSize] ?? Infinity) - (right.deltas[windowSize] ?? Infinity))
        .slice(0, 3);
      const previousLeader = snapshots.at(-(windowSize + 1))?.topics?.[0] ?? null;

      return [
        windowSize,
        {
          warming,
          cooling,
          previousLeader,
        },
      ];
    }),
  );

  return {
    snapshotCount,
    latestSnapshot,
    rows,
    trendsByWindow,
  };
}
