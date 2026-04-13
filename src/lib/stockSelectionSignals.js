const displayNumberFormatter = new Intl.NumberFormat('zh-TW');

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeCode(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).replaceAll(',', '').trim();

  if (!text || text === '-' || text === '--' || text === '---') {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

export function normalizeAnnouncementDate(value) {
  const text = normalizeText(value).replaceAll('.', '/');

  if (!text) {
    return null;
  }

  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  if (/^\d{7}$/.test(text)) {
    return `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}-${text.slice(5, 7)}`;
  }

  const rocMatch = text.match(/(\d{2,3})[/-](\d{1,2})[/-](\d{1,2})/);

  if (rocMatch) {
    const [, rocYear, month, day] = rocMatch;
    return `${Number(rocYear) + 1911}-${padNumber(month)}-${padNumber(day)}`;
  }

  const gregorianMatch = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);

  if (gregorianMatch) {
    const [, year, month, day] = gregorianMatch;
    return `${year}-${padNumber(month)}-${padNumber(day)}`;
  }

  return null;
}

function parseDateRange(periodText) {
  const matches = [...normalizeText(periodText).matchAll(/(\d{2,3})[/-](\d{1,2})[/-](\d{1,2})/g)].map((match) =>
    normalizeAnnouncementDate(`${match[1]}/${match[2]}/${match[3]}`),
  );

  return {
    startDate: matches[0] ?? null,
    endDate: matches.at(-1) ?? null,
  };
}

function buildRowsByCode(rows, codeFields) {
  const map = new Map();

  for (const row of rows ?? []) {
    const code = codeFields
      .map((field) => normalizeCode(row?.[field]))
      .find(Boolean);

    if (!code) {
      continue;
    }

    if (!map.has(code)) {
      map.set(code, []);
    }

    map.get(code).push(row);
  }

  return map;
}

function pickLatestDate(...values) {
  return values
    .map((value) => normalizeAnnouncementDate(value))
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function formatVolume(value) {
  const numericValue = normalizeNumber(value);
  return numericValue === null ? null : displayNumberFormatter.format(numericValue);
}

function buildDividendLabel(exDividendType) {
  switch (normalizeText(exDividendType)) {
    case '權':
      return '除權';
    case '息':
      return '除息';
    case '權息':
      return '除權息';
    default:
      return '股利事件';
  }
}

function buildDividendNote(row) {
  const parts = [];
  const cashDividend = normalizeNumber(row?.CashDividend);
  const stockDividendRatio = normalizeNumber(row?.StockDividendRatio);
  const subscriptionRatio = normalizeNumber(row?.SubscriptionRatio);
  const subscriptionPricePerShare = normalizeNumber(row?.SubscriptionPricePerShare);

  if (cashDividend !== null) {
    parts.push(`現金股利 ${cashDividend.toFixed(2)} 元`);
  }

  if (stockDividendRatio !== null) {
    parts.push(`股票股利 ${stockDividendRatio.toFixed(2)}`);
  }

  if (subscriptionRatio !== null) {
    parts.push(`配股率 ${subscriptionRatio.toFixed(2)}`);
  }

  if (subscriptionPricePerShare !== null) {
    parts.push(`認購價 ${subscriptionPricePerShare.toFixed(2)} 元`);
  }

  return parts.join('，') || '接近股利事件日期，隔日觀察時記得先留意參考價調整。';
}

function buildDispositionHighlight(row, endDate) {
  const measure = normalizeText(row?.DispositionMeasures) || '處置交易';
  const reason = normalizeText(row?.ReasonsOfDisposition) || '波動異常';
  return `目前列入${measure}，原因為${reason}${endDate ? `，處置期到 ${endDate}` : ''}。`;
}

function buildAttentionHighlight(row) {
  const description = normalizeText(row?.RecentlyMetAttentionSecuritiesCriteria);
  return description ? `最近多次達注意股票標準，${description}。` : '最近多次達注意股票標準，短線波動風險偏高。';
}

function buildChangedTradingHighlight() {
  return '目前列入變更交易，撮合節奏與一般股票不同，短線流動性要先留意。';
}

function buildDividendHighlight(label, date) {
  return `${label}${date ? `日期在 ${date}` : ''}，隔日評估時記得先把股利事件納入。`;
}

function buildShortSaleHighlight(volume) {
  return volume ? `今日可借券賣出股數約 ${formatVolume(volume)} 股，可作為券源與流動性參考。` : null;
}

export function createStockSelectionSignalDataset({
  asOfDate = null,
  dispositionRows = [],
  attentionRows = [],
  changedTradingRows = [],
  exDividendRows = [],
  shortSaleRows = [],
} = {}) {
  const dispositionByCode = buildRowsByCode(dispositionRows, ['Code']);
  const attentionByCode = buildRowsByCode(attentionRows, ['Code']);
  const changedTradingByCode = buildRowsByCode(
    changedTradingRows.filter((row) => normalizeText(row?.PeriodicCallAuctionTrading)),
    ['Code'],
  );
  const exDividendByCode = buildRowsByCode(exDividendRows, ['Code']);
  const shortSaleByCode = buildRowsByCode(shortSaleRows, ['TWSECode', 'GRETAICode']);

  const resolvedAsOfDate = asOfDate ?? [
    ...dispositionRows.map((row) => row?.Date),
    ...changedTradingRows.map((row) => row?.Date),
  ]
    .map((value) => normalizeAnnouncementDate(value))
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  return {
    asOfDate: resolvedAsOfDate,
    dispositionByCode,
    attentionByCode,
    changedTradingByCode,
    exDividendByCode,
    shortSaleByCode,
  };
}

export function buildStockSelectionSignals(dataset, code) {
  const normalizedCode = normalizeCode(code);

  if (!dataset || !normalizedCode) {
    return null;
  }

  const dispositions = (dataset.dispositionByCode.get(normalizedCode) ?? [])
    .map((row) => ({
      row,
      announcementDate: normalizeAnnouncementDate(row?.Date),
      ...parseDateRange(row?.DispositionPeriod),
    }))
    .sort((left, right) => {
      const rightDate = pickLatestDate(right.endDate, right.startDate, right.announcementDate);
      const leftDate = pickLatestDate(left.endDate, left.startDate, left.announcementDate);

      if (!rightDate && !leftDate) return 0;
      if (!rightDate) return -1;
      if (!leftDate) return 1;
      return rightDate.localeCompare(leftDate);
    });
  const attentionNotices = dataset.attentionByCode.get(normalizedCode) ?? [];
  const changedTradingRows = dataset.changedTradingByCode.get(normalizedCode) ?? [];
  const exDividendRows = (dataset.exDividendByCode.get(normalizedCode) ?? [])
    .map((row) => ({
      row,
      date: normalizeAnnouncementDate(row?.Date),
      label: buildDividendLabel(row?.Exdividend),
    }))
    .filter((item) => item.date)
    .sort((left, right) => left.date.localeCompare(right.date));
  const shortSaleRow = (dataset.shortSaleByCode.get(normalizedCode) ?? [])[0] ?? null;
  const shortSaleAvailableVolume =
    normalizeNumber(shortSaleRow?.TWSEAvailableVolume) ??
    normalizeNumber(shortSaleRow?.GRETAIAvailableVolume);

  const alerts = [];
  const eventCalendar = [];
  const highlights = [];

  const disposition = dispositions[0] ?? null;
  if (disposition) {
    const endDate = disposition.endDate ?? disposition.startDate ?? disposition.announcementDate;
    const detailText = normalizeText(disposition.row?.Detail);

    alerts.push({
      key: `disposition-${normalizedCode}-${endDate ?? 'latest'}`,
      type: 'disposition',
      tone: 'risk',
      title: normalizeText(disposition.row?.DispositionMeasures) || '列入處置股票',
      badgeLabel: '處置',
      date: disposition.announcementDate ?? endDate,
      note: buildDispositionHighlight(disposition.row, endDate),
      detail: detailText ? `${detailText.slice(0, 110)}${detailText.length > 110 ? '…' : ''}` : null,
      footnote: endDate ? `處置期間至 ${endDate}` : null,
    });

    if (endDate) {
      eventCalendar.push({
        key: `disposition-end-${normalizedCode}-${endDate}`,
        label: '處置交易結束觀察',
        date: endDate,
        status: endDate >= (dataset.asOfDate ?? endDate) ? 'upcoming' : 'recent',
        note: buildDispositionHighlight(disposition.row, endDate),
      });
    }

    highlights.push(buildDispositionHighlight(disposition.row, endDate));
  }

  const attentionNotice = attentionNotices[0] ?? null;
  if (attentionNotice) {
    const note = buildAttentionHighlight(attentionNotice);

    alerts.push({
      key: `attention-${normalizedCode}`,
      type: 'attention',
      tone: 'warning',
      title: '注意股累計次數偏高',
      badgeLabel: '注意',
      date: dataset.asOfDate ?? null,
      note,
      detail: normalizeText(attentionNotice?.RecentlyMetAttentionSecuritiesCriteria) || null,
      footnote: '近期波動節奏偏快，隔日追價前先留意風險。',
    });

    highlights.push(note);
  }

  const changedTrading = changedTradingRows[0] ?? null;
  if (changedTrading) {
    const changedTradingDate = normalizeAnnouncementDate(changedTrading?.Date);
    const note = buildChangedTradingHighlight();

    alerts.push({
      key: `changed-trading-${normalizedCode}`,
      type: 'changed-trading',
      tone: 'warning',
      title: '列入變更交易',
      badgeLabel: '交易',
      date: changedTradingDate,
      note,
      detail: '若當日出現分盤撮合，掛單與成交節奏都會和一般股票不同。',
      footnote: changedTradingDate ? `資料日期 ${changedTradingDate}` : null,
    });

    highlights.push(note);
  }

  const dividend = exDividendRows[0] ?? null;
  if (dividend) {
    const note = buildDividendNote(dividend.row);

    alerts.push({
      key: `dividend-${normalizedCode}-${dividend.date}`,
      type: 'ex-dividend',
      tone: 'info',
      title: `${dividend.label}事件接近`,
      badgeLabel: '股利',
      date: dividend.date,
      note,
      detail: `${dividend.label}日為 ${dividend.date}`,
      footnote: '隔日價位與殖利率判讀要把股利事件一起看。',
    });

    eventCalendar.push({
      key: `dividend-event-${normalizedCode}-${dividend.date}`,
      label: `${dividend.label}觀察`,
      date: dividend.date,
      status: dividend.date >= (dataset.asOfDate ?? dividend.date) ? 'upcoming' : 'recent',
      note,
    });

    highlights.push(buildDividendHighlight(dividend.label, dividend.date));
  }

  if (shortSaleAvailableVolume !== null) {
    const note = buildShortSaleHighlight(shortSaleAvailableVolume);

    alerts.push({
      key: `short-sale-${normalizedCode}`,
      type: 'short-sale',
      tone: 'info',
      title: '可借券賣出餘量',
      badgeLabel: '借券',
      date: dataset.asOfDate ?? null,
      note,
      detail: '券源多寡不代表方向，但有助於評估隔日券源與流動性。',
      footnote: note,
    });

    if (note) {
      highlights.push(note);
    }
  }

  const riskTone = disposition ? 'risk' : attentionNotice || changedTrading ? 'warning' : alerts.length ? 'info' : 'normal';

  return {
    asOfDate: dataset.asOfDate ?? null,
    alerts,
    eventCalendar,
    highlights: [...new Set(highlights)].filter(Boolean).slice(0, 4),
    summary: {
      riskTone,
      activeDispositionCount: dispositions.length,
      attentionWarningCount: attentionNotices.length,
      changedTradingCount: changedTradingRows.length,
      nextExDividendDate: dividend?.date ?? null,
      shortSaleAvailableVolume,
      alertCount: alerts.length,
      topTitle: alerts[0]?.title ?? null,
      topTone: alerts[0]?.tone ?? 'normal',
    },
  };
}
