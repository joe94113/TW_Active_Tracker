function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  const text = String(value ?? '').trim().replaceAll('/', '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeYearMonth(value) {
  const text = String(value ?? '').trim().replaceAll('/', '').replaceAll('-', '');
  return /^\d{6}$/.test(text) ? text : null;
}

function shiftMonths(yearMonth, offset) {
  const normalized = normalizeYearMonth(yearMonth);

  if (!normalized) {
    return null;
  }

  const year = Number(normalized.slice(0, 4));
  const monthIndex = Number(normalized.slice(4, 6)) - 1;
  const date = new Date(Date.UTC(year, monthIndex + offset, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildRevenueEventDate(yearMonth) {
  const normalized = normalizeYearMonth(yearMonth);

  if (!normalized) {
    return null;
  }

  const year = Number(normalized.slice(0, 4));
  const monthIndex = Number(normalized.slice(4, 6)) - 1;
  const eventDate = new Date(Date.UTC(year, monthIndex + 1, 10));
  return eventDate.toISOString().slice(0, 10);
}

function buildQuarterEventDate(year, quarter) {
  const normalizedYear = Number(year);
  const normalizedQuarter = Number(quarter);

  if (!Number.isFinite(normalizedYear) || !Number.isFinite(normalizedQuarter) || normalizedQuarter < 1 || normalizedQuarter > 4) {
    return null;
  }

  const monthIndex = normalizedQuarter * 3 + 1;
  const date = new Date(Date.UTC(normalizedYear, monthIndex, 14));
  return date.toISOString().slice(0, 10);
}

function getHistoryRows(detail) {
  return (detail?.歷史資料 ?? [])
    .map((row) => ({
      date: normalizeDate(row?.date),
      close: toNumber(row?.close),
    }))
    .filter((row) => row.date && row.close !== null)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function findTradingIndex(rows, date) {
  return rows.findIndex((row) => row.date >= date);
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

function buildEventStats(rows, eventDates, title, note) {
  const samples = eventDates
    .map((eventDate) => {
      const entryIndex = findTradingIndex(rows, eventDate);

      if (entryIndex < 0) {
        return null;
      }

      const entryRow = rows[entryIndex];
      const horizons = [3, 5, 10].reduce((result, horizon) => {
        const exitRow = rows[entryIndex + horizon];
        result[horizon] = exitRow
          ? {
              exitDate: exitRow.date,
              returnPercent: ((exitRow.close - entryRow.close) / entryRow.close) * 100,
            }
          : null;
        return result;
      }, {});

      return {
        eventDate,
        tradeDate: entryRow.date,
        entryClose: entryRow.close,
        horizons,
      };
    })
    .filter(Boolean);

  if (!samples.length) {
    return null;
  }

  return {
    key: title,
    title,
    note,
    sampleCount: samples.length,
    metrics: {
      3: summarizeReturns(samples.map((sample) => toNumber(sample.horizons[3]?.returnPercent)).filter((value) => value !== null)),
      5: summarizeReturns(samples.map((sample) => toNumber(sample.horizons[5]?.returnPercent)).filter((value) => value !== null)),
      10: summarizeReturns(samples.map((sample) => toNumber(sample.horizons[10]?.returnPercent)).filter((value) => value !== null)),
    },
    samples: samples.slice(0, 8),
  };
}

export function buildStockEventPerformance(detail) {
  const rows = getHistoryRows(detail);

  if (rows.length < 40) {
    return [];
  }

  const monthlyRevenue = detail?.財務資料?.月營收 ?? null;
  const incomeStatement = detail?.財務資料?.綜合損益表 ?? null;
  const monthlyYearMonth = normalizeYearMonth(monthlyRevenue?.資料年月);
  const latestQuarterDate = buildQuarterEventDate(incomeStatement?.年度, incomeStatement?.季別);

  const monthlyEventDates = monthlyYearMonth
    ? Array.from({ length: 8 }, (_, index) => buildRevenueEventDate(shiftMonths(monthlyYearMonth, -index))).filter(Boolean)
    : [];
  const quarterEventDates = latestQuarterDate
    ? Array.from({ length: 8 }, (_, index) => {
        const baseDate = new Date(`${latestQuarterDate}T00:00:00Z`);
        baseDate.setUTCMonth(baseDate.getUTCMonth() - index * 3);
        return baseDate.toISOString().slice(0, 10);
      })
    : [];

  return [
    buildEventStats(rows, monthlyEventDates, '月營收觀察窗', '以近 8 次月營收固定觀察窗估算，偏向盤後研究用途。'),
    buildEventStats(rows, quarterEventDates, '財報 / 法說觀察窗', '以近 8 次季度公告窗估算，適合回看事件後 3 / 5 / 10 日反應。'),
  ].filter(Boolean);
}
