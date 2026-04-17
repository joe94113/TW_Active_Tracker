function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const HORIZONS = [3, 5, 10];

function normalizeSnapshots(history) {
  return [...(history?.snapshots ?? [])]
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(String(item?.marketDate ?? '')))
    .sort((left, right) => String(right.marketDate).localeCompare(String(left.marketDate)));
}

function collectReturns(snapshots, groupKey, horizon) {
  return snapshots
    .flatMap((snapshot) => snapshot?.[groupKey] ?? [])
    .map((item) => toNumber(item?.horizons?.[horizon]?.returnPercent))
    .filter((value) => value !== null);
}

function summarizeReturns(values) {
  if (!values.length) {
    return {
      sampleCount: 0,
      averageReturn: null,
      winRate: null,
    };
  }

  return {
    sampleCount: values.length,
    averageReturn: values.reduce((sum, value) => sum + value, 0) / values.length,
    winRate: (values.filter((value) => value > 0).length / values.length) * 100,
  };
}

export function buildReplayOverview(history) {
  const snapshots = normalizeSnapshots(history);

  return {
    snapshotCount: snapshots.length,
    snapshots: snapshots.slice(0, 12),
    groups: {
      stable: Object.fromEntries(HORIZONS.map((horizon) => [horizon, summarizeReturns(collectReturns(snapshots, 'stable', horizon))])),
      aggressive: Object.fromEntries(HORIZONS.map((horizon) => [horizon, summarizeReturns(collectReturns(snapshots, 'aggressive', horizon))])),
    },
  };
}
