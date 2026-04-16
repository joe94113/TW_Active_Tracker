function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getThemeToneLabel(tone) {
  if (tone === 'up') return '資金偏多';
  if (tone === 'info') return '熱度升溫';
  return '觀察中';
}

export function getLeaderStocks(topic, limit = 3) {
  const explicit = Array.isArray(topic?.leaderStocks) ? topic.leaderStocks.filter(Boolean) : [];

  if (explicit.length) {
    return explicit.slice(0, limit);
  }

  return [...(topic?.relatedStocks ?? [])].filter(Boolean).slice(0, limit);
}

export function getCatchUpStocks(topic, limit = 3) {
  const explicit = Array.isArray(topic?.catchUpStocks) ? topic.catchUpStocks.filter(Boolean) : [];

  if (explicit.length) {
    return explicit.slice(0, limit);
  }

  const relatedStocks = [...(topic?.relatedStocks ?? [])].filter(Boolean);

  if (!relatedStocks.length) {
    return [];
  }

  const leaders = getLeaderStocks(topic, 3);
  const leaderCodes = new Set(leaders.map((item) => item.code));
  const leaderReturn = Math.max(...leaders.map((item) => toNumber(item?.return20) ?? 0), 0);

  const candidates = relatedStocks
    .filter((item) => !leaderCodes.has(item.code))
    .filter((item) => {
      const return20 = toNumber(item?.return20);

      if (return20 === null) {
        return true;
      }

      return return20 <= Math.max(leaderReturn * 0.62, 16);
    })
    .map((item) => {
      const return20 = toNumber(item?.return20) ?? 0;
      const changePercent = toNumber(item?.changePercent) ?? 0;
      const total5Day = toNumber(item?.total5Day) ?? 0;
      const score =
        (item?.newsMentions ?? 0) * 10 +
        (item?.activeEtfCount ?? 0) * 8 +
        (total5Day > 0 ? 18 : 0) +
        Math.max(0, changePercent) * 3 -
        Math.max(0, return20) * 0.45;

      return {
        ...item,
        catchUpScore: score,
      };
    })
    .sort((left, right) => right.catchUpScore - left.catchUpScore || (right.score ?? 0) - (left.score ?? 0));

  if (candidates.length) {
    return candidates.slice(0, limit);
  }

  return relatedStocks.filter((item) => !leaderCodes.has(item.code)).slice(0, limit);
}

export function buildThemeMomentumTopics(themeRadar, limit = 3) {
  return [...(themeRadar?.topics ?? [])]
    .filter((item) => (item?.score ?? 0) >= 56)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      leaderStocks: getLeaderStocks(item, 3),
      catchUpStocks: getCatchUpStocks(item, 3),
    }));
}
