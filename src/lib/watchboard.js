function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickValue(primary, fallback) {
  return primary ?? fallback ?? null;
}

export function buildFavoriteWatchboard(favorites = [], snapshotMap = new Map()) {
  const rows = favorites.map((item) => {
    const snapshot = snapshotMap.get(String(item?.code ?? '').trim().toUpperCase()) ?? null;
    const close = pickValue(snapshot?.lastPrice, item?.close);
    const change = pickValue(snapshot?.change, item?.change);
    const changePercent = pickValue(snapshot?.changePercent, item?.changePercent);
    const volume = pickValue(snapshot?.volume, item?.volume);
    const dualBuy = (toNumber(item?.foreign5Day) ?? 0) > 0 && (toNumber(item?.investmentTrust5Day) ?? 0) > 0;
    const riskCount = [
      item?.isUnderDisposition,
      item?.hasAttentionWarning,
      item?.hasChangedTrading,
      item?.hasMarginSurge,
      (toNumber(item?.healthScore) ?? 100) < 45,
    ].filter(Boolean).length;
    const watchPriority =
      (toNumber(item?.healthScore) ?? 0) +
      (dualBuy ? 12 : 0) +
      ((item?.topSignalTone === 'up' ? 9 : 0)) +
      (Math.max(0, toNumber(item?.return20) ?? 0) * 0.3) -
      riskCount * 8;

    return {
      ...item,
      snapshot,
      close,
      change,
      changePercent,
      volume,
      dualBuy,
      riskCount,
      watchPriority,
      tone:
        (changePercent ?? 0) > 0
          ? 'up'
          : (changePercent ?? 0) < 0
            ? 'down'
            : item?.topSignalTone ?? 'normal',
    };
  });

  const sortedRows = [...rows].sort((left, right) => (right.watchPriority ?? 0) - (left.watchPriority ?? 0));

  return {
    rows: sortedRows,
    summary: {
      count: rows.length,
      risingCount: rows.filter((row) => (row.changePercent ?? 0) > 0).length,
      dualBuyCount: rows.filter((row) => row.dualBuy).length,
      riskCount: rows.filter((row) => row.riskCount > 0).length,
      topIdea: sortedRows[0] ?? null,
    },
  };
}
