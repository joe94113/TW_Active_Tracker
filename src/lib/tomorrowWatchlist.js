function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLatestSnapshot(replayHistory) {
  return [...(replayHistory?.snapshots ?? [])]
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(String(item?.marketDate ?? '')))
    .sort((left, right) => String(right.marketDate).localeCompare(String(left.marketDate)))[0] ?? null;
}

function normalizeWatchItem(item = {}, stockMap = new Map(), tone = 'up') {
  const code = String(item?.code ?? '').trim();
  const stock = stockMap.get(code) ?? {};
  return {
    ...stock,
    ...item,
    code,
    name: item?.name ?? stock?.name ?? code,
    industryName: stock?.industryName ?? item?.industryName ?? null,
    close: toNumber(stock?.close ?? item?.close),
    changePercent: toNumber(stock?.changePercent ?? item?.changePercent),
    return20: toNumber(stock?.return20 ?? item?.return20),
    volume: toNumber(stock?.volume ?? item?.volume),
    foreign5Day: toNumber(stock?.foreign5Day ?? item?.foreign5Day),
    investmentTrust5Day: toNumber(stock?.investmentTrust5Day ?? item?.investmentTrust5Day),
    healthScore: toNumber(stock?.healthScore ?? item?.healthScore),
    healthGrade: stock?.healthGrade ?? item?.healthGrade ?? null,
    topSignalTitle: stock?.topSignalTitle ?? item?.topSignalTitle ?? null,
    themeTitle: stock?.themeTitle ?? item?.themeTitle ?? null,
    tone,
  };
}

export function buildTomorrowWatchlist({ dashboard = null, replayHistory = null, entryRadar = null, stockMap = new Map() } = {}) {
  const latestSnapshot = getLatestSnapshot(replayHistory);
  const stable = (latestSnapshot?.stable ?? []).map((item) => normalizeWatchItem(item, stockMap, 'up')).slice(0, 5);
  const aggressive = (latestSnapshot?.aggressive ?? []).map((item) => normalizeWatchItem(item, stockMap, 'warning')).slice(0, 6);
  const freshStarters = (entryRadar?.sections?.freshStarters ?? [])
    .map((item) => normalizeWatchItem(item, stockMap, item?.topSignalTone === 'up' ? 'up' : 'info'))
    .slice(0, 4);
  const nearBreakouts = (entryRadar?.sections?.nearBreakouts ?? [])
    .map((item) => normalizeWatchItem(item, stockMap, item?.topSignalTone === 'up' ? 'up' : 'info'))
    .slice(0, 4);

  return {
    marketDate: latestSnapshot?.marketDate ?? entryRadar?.marketDate ?? dashboard?.市場總覽?.即時狀態?.marketDate ?? null,
    observations: dashboard?.市場總覽?.觀察摘要?.slice?.(0, 4) ?? [],
    topTheme: entryRadar?.spotlight?.topThemeTitle ?? null,
    sections: [
      {
        key: 'stable',
        title: '穩健型觀察',
        note: '優先看雙法人偏多、趨勢延續且風險較低的名單。',
        items: stable,
        emptyMessage: '今天沒有特別整齊的穩健型觀察名單。',
      },
      {
        key: 'aggressive',
        title: '積極型觀察',
        note: '偏向量縮價揚、盤整待突破與短線切入機會，適合隔日盯盤。',
        items: aggressive,
        emptyMessage: '今天沒有特別整齊的積極型觀察名單。',
      },
      {
        key: 'fresh',
        title: '剛轉強 / 近突破',
        note: '把起漲卡位雷達裡最接近發動點的股票拉出來，方便提前卡位。',
        items: [...freshStarters, ...nearBreakouts].slice(0, 6),
        emptyMessage: '今天沒有特別明顯的剛轉強或近突破名單。',
      },
    ],
  };
}
