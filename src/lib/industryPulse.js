function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getIndustryName(stock) {
  return String(
    stock?.industryName ??
      stock?.industryValuation?.industryName ??
      '',
  ).trim();
}

function createTopicCodeMap(themeRadar) {
  const map = new Map();

  for (const topic of themeRadar?.topics ?? []) {
    for (const stock of topic.relatedStocks ?? []) {
      const code = String(stock?.code ?? '').trim();
      if (!code) continue;
      if (!map.has(code)) {
        map.set(code, []);
      }
      map.get(code).push({
        slug: topic.slug,
        title: topic.title,
        score: topic.score ?? 0,
        tone: topic.tone ?? 'info',
      });
    }
  }

  return map;
}

export function buildIndustryPulse(stockList = [], themeRadar = null) {
  const topicCodeMap = createTopicCodeMap(themeRadar);
  const industryMap = new Map();

  for (const stock of stockList ?? []) {
    const industryName = getIndustryName(stock);
    if (!industryName) continue;

    if (!industryMap.has(industryName)) {
      industryMap.set(industryName, {
        industryName,
        stocks: [],
        totalTradeValue: 0,
        advancingCount: 0,
        decliningCount: 0,
        bullishSignalCount: 0,
        dualBuyCount: 0,
        activeEtfCount: 0,
        dualGrowthCount: 0,
        absoluteChangeTotal: 0,
      });
    }

    const bucket = industryMap.get(industryName);
    const changePercent = toNumber(stock?.changePercent) ?? 0;
    const tradeValue = toNumber(stock?.dailyTradeValue) ?? toNumber(stock?.avgTradeValue) ?? 0;
    const foreign5Day = toNumber(stock?.foreign5Day) ?? 0;
    const trust5Day = toNumber(stock?.investmentTrust5Day) ?? 0;
    const activeEtfCount = toNumber(stock?.activeEtfCount) ?? 0;
    const topics = topicCodeMap.get(String(stock?.code ?? '').trim()) ?? [];

    bucket.stocks.push({
      ...stock,
      industryName,
      themeMentions: topics,
      tradeValue,
    });
    bucket.totalTradeValue += tradeValue;
    bucket.advancingCount += changePercent > 0 ? 1 : 0;
    bucket.decliningCount += changePercent < 0 ? 1 : 0;
    bucket.bullishSignalCount += stock?.topSignalTone === 'up' ? 1 : 0;
    bucket.dualBuyCount += foreign5Day > 0 && trust5Day > 0 ? 1 : 0;
    bucket.activeEtfCount += activeEtfCount > 0 ? 1 : 0;
    bucket.dualGrowthCount += stock?.monthlyRevenueDualGrowth ? 1 : 0;
    bucket.absoluteChangeTotal += Math.abs(changePercent);
  }

  const industries = [...industryMap.values()]
    .map((bucket) => {
      const count = bucket.stocks.length;
      const avgChangePercent = count
        ? bucket.stocks.reduce((sum, stock) => sum + (toNumber(stock.changePercent) ?? 0), 0) / count
        : 0;
      const avgReturn20 = count
        ? bucket.stocks.reduce((sum, stock) => sum + (toNumber(stock.return20) ?? 0), 0) / count
        : 0;
      const avgAbsChangePercent = count ? bucket.absoluteChangeTotal / count : 0;
      const breadthRatio = count ? (bucket.advancingCount - bucket.decliningCount) / count : 0;
      const heatScore =
        avgChangePercent * 16 +
        avgReturn20 * 1.3 +
        breadthRatio * 35 +
        Math.log10(Math.max(bucket.totalTradeValue, 1)) * 6 +
        bucket.bullishSignalCount * 3 +
        bucket.dualBuyCount * 5 +
        bucket.activeEtfCount * 2 +
        bucket.dualGrowthCount * 2;

      const leaders = [...bucket.stocks]
        .sort((left, right) => (right.tradeValue ?? 0) - (left.tradeValue ?? 0) || (right.changePercent ?? 0) - (left.changePercent ?? 0))
        .slice(0, 3);

      return {
        industryName: bucket.industryName,
        stockCount: count,
        avgChangePercent,
        avgAbsChangePercent,
        avgReturn20,
        breadthRatio,
        totalTradeValue: bucket.totalTradeValue,
        advancingCount: bucket.advancingCount,
        decliningCount: bucket.decliningCount,
        bullishSignalCount: bucket.bullishSignalCount,
        dualBuyCount: bucket.dualBuyCount,
        activeEtfCount: bucket.activeEtfCount,
        dualGrowthCount: bucket.dualGrowthCount,
        heatScore,
        tone: heatScore >= 38 ? 'up' : heatScore <= 12 ? 'down' : 'info',
        leaders,
      };
    })
    .sort((left, right) => (right.heatScore ?? 0) - (left.heatScore ?? 0));

  const suddenMoves = [...(stockList ?? [])]
    .map((stock) => {
      const changePercent = toNumber(stock?.changePercent) ?? 0;
      const tradeValue = toNumber(stock?.dailyTradeValue) ?? toNumber(stock?.avgTradeValue) ?? 0;
      const activityScore =
        Math.abs(changePercent) * 22 +
        Math.log10(Math.max(tradeValue, 1)) * 7 +
        (stock?.topSignalTone === 'up' ? 6 : 0) +
        ((toNumber(stock?.activeEtfCount) ?? 0) > 0 ? 3 : 0);

      return {
        ...stock,
        industryName: getIndustryName(stock),
        tradeValue,
        activityScore,
      };
    })
    .filter((stock) => stock.industryName && (stock.tradeValue ?? 0) >= 30000000)
    .sort((left, right) => (right.activityScore ?? 0) - (left.activityScore ?? 0))
    .slice(0, 12);

  return {
    topIndustries: industries.slice(0, 12),
    suddenMoves,
    summary: {
      industryCount: industries.length,
      strongestIndustry: industries[0] ?? null,
      weakestIndustry: [...industries].reverse()[0] ?? null,
      topSuddenMove: suddenMoves[0] ?? null,
    },
  };
}
