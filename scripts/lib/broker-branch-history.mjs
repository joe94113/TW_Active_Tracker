import { createHistoryRowsByCode } from './radar-replay.mjs';

const HORIZONS = [3, 5, 10];

function normalizeDate(value) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findEntryIndex(rows, marketDate) {
  return rows.findIndex((row) => row.date >= marketDate);
}

function computeHorizonPerformance(rows, marketDate, entryClose, existingHorizons = {}) {
  const entryIndex = findEntryIndex(rows, marketDate);
  const resolvedEntryClose = normalizeNumber(entryClose) ?? (entryIndex >= 0 ? rows[entryIndex]?.close ?? null : null);
  const output = {};

  for (const horizon of HORIZONS) {
    const existing = existingHorizons?.[String(horizon)] ?? existingHorizons?.[horizon] ?? null;

    if (entryIndex < 0 || resolvedEntryClose === null) {
      output[horizon] = existing ?? null;
      continue;
    }

    const exitRow = rows[entryIndex + horizon];

    if (!exitRow?.close) {
      output[horizon] = existing ?? null;
      continue;
    }

    output[horizon] = {
      tradingDays: horizon,
      exitDate: exitRow.date,
      exitClose: exitRow.close,
      returnPercent: ((exitRow.close - resolvedEntryClose) / resolvedEntryClose) * 100,
    };
  }

  return output;
}

function summarizePicks(picks = []) {
  const summary = {
    count: picks.length,
    horizons: {},
  };

  for (const horizon of HORIZONS) {
    const values = picks
      .map((pick) => pick?.horizons?.[horizon]?.returnPercent)
      .map(normalizeNumber)
      .filter((value) => value !== null);

    summary.horizons[horizon] = values.length
      ? {
          sampleCount: values.length,
          averageReturn: values.reduce((sum, value) => sum + value, 0) / values.length,
          winRate: (values.filter((value) => value > 0).length / values.length) * 100,
        }
      : {
          sampleCount: 0,
          averageReturn: null,
          winRate: null,
        };
  }

  return summary;
}

function normalizePick(pick, marketDate) {
  return {
    code: String(pick?.code ?? '').trim(),
    name: pick?.stockName ?? pick?.name ?? String(pick?.code ?? '').trim(),
    entryClose: normalizeNumber(pick?.currentPrice) ?? normalizeNumber(pick?.avgPrice) ?? normalizeNumber(pick?.close),
    netLots: normalizeNumber(pick?.netLots),
    performance: normalizeNumber(pick?.performance),
    sourceType: pick?.sourceType ?? null,
    marketDate,
    horizons: pick?.horizons ?? {},
  };
}

function buildSnapshot(marketDate, generatedAt, brokerRadar) {
  return {
    marketDate,
    generatedAt,
    branches: (brokerRadar?.topBranches ?? []).map((branch) => ({
      bno: String(branch?.bno ?? '').trim(),
      name: branch?.name ?? '',
      score: normalizeNumber(branch?.score),
      picks: (branch?.latestBuys ?? [])
        .map((pick) => normalizePick(pick, marketDate))
        .filter((pick) => pick.code && pick.entryClose !== null)
        .slice(0, 5),
    })),
  };
}

function summarizeBranches(snapshots = [], pickLimit = 20) {
  const branchMap = new Map();

  for (const snapshot of [...snapshots].sort((left, right) => right.marketDate.localeCompare(left.marketDate))) {
    for (const branch of snapshot?.branches ?? []) {
      if (!branch?.bno) continue;

      const existing = branchMap.get(branch.bno) ?? {
        bno: branch.bno,
        name: branch.name ?? branch.bno,
        picks: [],
        marketDates: new Set(),
      };

      existing.marketDates.add(snapshot.marketDate);
      for (const pick of branch.picks ?? []) {
        existing.picks.push({
          ...pick,
          snapshotDate: snapshot.marketDate,
        });
      }
      branchMap.set(branch.bno, existing);
    }
  }

  return [...branchMap.values()]
    .map((branch) => {
      const recentPicks = branch.picks
        .sort((left, right) => {
          const dateCompare = String(right.snapshotDate).localeCompare(String(left.snapshotDate));
          if (dateCompare !== 0) return dateCompare;
          return String(left.code).localeCompare(String(right.code));
        })
        .slice(0, pickLimit);
      const summary = summarizePicks(recentPicks);

      return {
        bno: branch.bno,
        name: branch.name,
        snapshotCount: branch.marketDates.size,
        recentPickCount: recentPicks.length,
        latestMarketDate: [...branch.marketDates].sort().at(-1) ?? null,
        horizon3: summary.horizons[3],
        horizon5: summary.horizons[5],
        horizon10: summary.horizons[10],
      };
    })
    .sort((left, right) => {
      const leftWinRate = left.horizon5?.winRate ?? -Infinity;
      const rightWinRate = right.horizon5?.winRate ?? -Infinity;
      if (rightWinRate !== leftWinRate) return rightWinRate - leftWinRate;

      const leftSample = left.horizon5?.sampleCount ?? 0;
      const rightSample = right.horizon5?.sampleCount ?? 0;
      if (rightSample !== leftSample) return rightSample - leftSample;

      return String(left.bno).localeCompare(String(right.bno));
    });
}

export function mergeBrokerBranchHistory({
  existingHistory = null,
  marketDate,
  generatedAt,
  brokerRadar = null,
  detailList = [],
  limit = 40,
  pickLimit = 20,
} = {}) {
  const normalizedMarketDate = normalizeDate(marketDate);

  if (!normalizedMarketDate || !brokerRadar) {
    return existingHistory ?? { generatedAt: null, marketDate: null, horizons: HORIZONS, snapshots: [], branchSummaries: [] };
  }

  const snapshots = [...(existingHistory?.snapshots ?? [])]
    .filter((item) => normalizeDate(item?.marketDate))
    .map((item) => ({
      marketDate: item.marketDate,
      generatedAt: item.generatedAt ?? null,
      branches: (item.branches ?? []).map((branch) => ({
        bno: String(branch?.bno ?? '').trim(),
        name: branch?.name ?? '',
        score: normalizeNumber(branch?.score),
        picks: (branch?.picks ?? []).map((pick) => ({
          ...pick,
          code: String(pick?.code ?? '').trim(),
          entryClose: normalizeNumber(pick?.entryClose),
          netLots: normalizeNumber(pick?.netLots),
          performance: normalizeNumber(pick?.performance),
          sourceType: pick?.sourceType ?? null,
          marketDate: normalizeDate(pick?.marketDate) ?? item.marketDate,
          horizons: pick?.horizons ?? {},
        })),
      })),
    }));

  const nextSnapshot = buildSnapshot(normalizedMarketDate, generatedAt, brokerRadar);
  const currentIndex = snapshots.findIndex((item) => item.marketDate === normalizedMarketDate);
  if (currentIndex >= 0) {
    snapshots[currentIndex] = nextSnapshot;
  } else {
    snapshots.push(nextSnapshot);
  }

  const historyRowsByCode = createHistoryRowsByCode(detailList);
  const normalizedSnapshots = snapshots
    .sort((left, right) => left.marketDate.localeCompare(right.marketDate))
    .slice(-limit)
    .map((snapshot) => ({
      ...snapshot,
      branches: (snapshot.branches ?? []).map((branch) => {
        const picks = (branch.picks ?? []).map((pick) => {
          const rows = historyRowsByCode.get(pick.code) ?? [];
          return {
            ...pick,
            horizons: computeHorizonPerformance(rows, snapshot.marketDate, pick.entryClose, pick.horizons),
          };
        });

        return {
          ...branch,
          picks,
          summary: summarizePicks(picks),
        };
      }),
    }));

  const branchSummaries = summarizeBranches(normalizedSnapshots, pickLimit);

  return {
    generatedAt,
    marketDate: normalizedMarketDate,
    horizons: HORIZONS,
    snapshots: normalizedSnapshots,
    branchSummaries,
  };
}
