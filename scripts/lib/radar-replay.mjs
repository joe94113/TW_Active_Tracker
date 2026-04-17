const HORIZONS = [3, 5, 10];

function normalizeDate(value) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createHistoryRowsByCode(detailList = []) {
  const map = new Map();

  for (const detail of detailList ?? []) {
    const code = String(detail?.code ?? '').trim();

    if (!code) {
      continue;
    }

    const rows = (detail?.歷史資料 ?? [])
      .map((row) => ({
        date: normalizeDate(row?.date),
        close: normalizeNumber(row?.close),
      }))
      .filter((row) => row.date && row.close !== null)
      .sort((left, right) => left.date.localeCompare(right.date));

    if (rows.length) {
      map.set(code, rows);
    }
  }

  return map;
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

function summarizeGroup(items = []) {
  const summary = {
    count: items.length,
    horizons: {},
  };

  for (const horizon of HORIZONS) {
    const values = items
      .map((item) => item?.horizons?.[horizon]?.returnPercent)
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

function normalizePick(pick, marketDate, priceLookup) {
  const code = String(pick?.code ?? '').trim();
  const entryClose = normalizeNumber(pick?.entryClose) ?? normalizeNumber(priceLookup.get(code)?.close);

  return {
    code,
    name: pick?.name ?? code,
    label: pick?.label ?? null,
    rating: normalizeNumber(pick?.rating) ?? null,
    detail: pick?.detail ?? null,
    entryClose,
    marketDate,
    horizons: pick?.horizons ?? {},
  };
}

function buildSnapshot(marketDate, generatedAt, watchGroups, priceLookup) {
  const stable = (watchGroups?.stable ?? []).map((item) => normalizePick(item, marketDate, priceLookup));
  const aggressive = (watchGroups?.aggressive ?? []).map((item) => normalizePick(item, marketDate, priceLookup));

  return {
    marketDate,
    generatedAt,
    stable,
    aggressive,
    summary: {
      stable: summarizeGroup(stable),
      aggressive: summarizeGroup(aggressive),
    },
  };
}

export function mergeRadarReplayHistory({
  existingHistory = null,
  marketDate,
  generatedAt,
  watchGroups,
  detailList = [],
  priceLookup = new Map(),
  limit = 40,
} = {}) {
  const normalizedMarketDate = normalizeDate(marketDate);

  if (!normalizedMarketDate) {
    return existingHistory ?? { generatedAt: null, marketDate: null, snapshots: [] };
  }

  const snapshots = [...(existingHistory?.snapshots ?? [])]
    .filter((item) => normalizeDate(item?.marketDate))
    .map((item) => ({
      marketDate: item.marketDate,
      generatedAt: item.generatedAt ?? null,
      stable: (item.stable ?? []).map((pick) => normalizePick(pick, item.marketDate, priceLookup)),
      aggressive: (item.aggressive ?? []).map((pick) => normalizePick(pick, item.marketDate, priceLookup)),
      summary: item.summary ?? null,
    }));

  const nextSnapshot = buildSnapshot(normalizedMarketDate, generatedAt, watchGroups, priceLookup);
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
    .map((snapshot) => {
      const stable = snapshot.stable.map((pick) => {
        const rows = historyRowsByCode.get(pick.code) ?? [];
        return {
          ...pick,
          horizons: computeHorizonPerformance(rows, snapshot.marketDate, pick.entryClose, pick.horizons),
        };
      });
      const aggressive = snapshot.aggressive.map((pick) => {
        const rows = historyRowsByCode.get(pick.code) ?? [];
        return {
          ...pick,
          horizons: computeHorizonPerformance(rows, snapshot.marketDate, pick.entryClose, pick.horizons),
        };
      });

      return {
        ...snapshot,
        stable,
        aggressive,
        summary: {
          stable: summarizeGroup(stable),
          aggressive: summarizeGroup(aggressive),
        },
      };
    });

  return {
    generatedAt,
    marketDate: normalizedMarketDate,
    horizons: HORIZONS,
    snapshots: normalizedSnapshots,
  };
}
