import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const taipeiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatTaipeiDate(date = new Date()) {
  return taipeiDateFormatter.format(date);
}

export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

export function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}%`;
}

export function formatSigned(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${formatNumber(number, digits)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function readJson(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content);
}

function pickSignalStocks(items, tone) {
  return [...items]
    .filter((item) => item.topSignalTone === tone && item.topSignalTitle && item.topSignalTitle !== '技術面中性')
    .sort((left, right) =>
      (right.technicalSignals?.[0]?.importance ?? 0) - (left.technicalSignals?.[0]?.importance ?? 0) ||
      (right.activeEtfCount ?? 0) - (left.activeEtfCount ?? 0) ||
      Math.abs(right.total5Day ?? 0) - Math.abs(left.total5Day ?? 0) ||
      Math.abs(right.return20 ?? 0) - Math.abs(left.return20 ?? 0),
    )
    .slice(0, 3);
}

function normalizeDateKey(value) {
  const text = String(value ?? '').trim().replaceAll('/', '-');

  if (!text) {
    return null;
  }

  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  if (/^\d{7}$/.test(text)) {
    return `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}-${text.slice(5, 7)}`;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function toDayStamp(dateText) {
  const stamp = Date.parse(`${dateText}T00:00:00+08:00`);
  return Number.isFinite(stamp) ? stamp : null;
}

function diffDays(fromDate, targetDate) {
  const fromStamp = toDayStamp(fromDate);
  const targetStamp = toDayStamp(targetDate);

  if (fromStamp === null || targetStamp === null) {
    return null;
  }

  return Math.round((targetStamp - fromStamp) / 86400000);
}

function getAlertPriority(item) {
  if (item.isUnderDisposition) return 3;
  if (item.hasChangedTrading) return 2;
  if (item.hasAttentionWarning) return 1;
  return 0;
}

function getAlertLabel(item) {
  if (item.isUnderDisposition) return '處置中';
  if (item.hasChangedTrading) return '變更交易';
  if (item.hasAttentionWarning) return '注意累計';
  return '觀察';
}

function getAlertTone(item) {
  if (item.isUnderDisposition) return 'risk';
  if (item.hasChangedTrading || item.hasAttentionWarning) return 'warning';
  return item.selectionSignalTone ?? 'info';
}

function pickOfficialRiskRadar(items) {
  return [...items]
    .filter((item) => item.isUnderDisposition || item.hasChangedTrading || item.hasAttentionWarning)
    .map((item) => ({
      ...item,
      alertLabel: getAlertLabel(item),
      alertTone: getAlertTone(item),
      priority: getAlertPriority(item),
    }))
    .sort((left, right) =>
      (right.priority ?? 0) - (left.priority ?? 0) ||
      (right.selectionSignalCount ?? 0) - (left.selectionSignalCount ?? 0) ||
      Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0) ||
      String(left.code).localeCompare(String(right.code)),
    )
    .slice(0, 6);
}

function pickUpcomingDividendWatch(items, marketDate) {
  return [...items]
    .map((item) => {
      const nextEventDate = normalizeDateKey(item.nextExDividendDate);
      const dayOffset = nextEventDate ? diffDays(marketDate, nextEventDate) : null;

      return {
        ...item,
        nextEventDate,
        dayOffset,
      };
    })
    .filter((item) => item.nextEventDate && item.dayOffset !== null && item.dayOffset >= 0 && item.dayOffset <= 21)
    .sort((left, right) =>
      (left.dayOffset ?? Infinity) - (right.dayOffset ?? Infinity) ||
      String(left.nextEventDate).localeCompare(String(right.nextEventDate)) ||
      String(left.code).localeCompare(String(right.code)),
    )
    .slice(0, 6);
}

function buildOfficialRadarSummary(items) {
  return {
    dispositions: items.filter((item) => item.isUnderDisposition).length,
    changedTrading: items.filter((item) => item.hasChangedTrading).length,
    attentionWarnings: items.filter((item) => item.hasAttentionWarning).length,
  };
}

function pickEtfHighlights(overlap) {
  const combined = [
    ...(overlap?.共同新增 ?? []).map((item) => ({ ...item, bucket: '共同新增' })),
    ...(overlap?.共同加碼 ?? []).map((item) => ({ ...item, bucket: '共同加碼' })),
    ...(overlap?.不重複異動?.新增 ?? []).map((item) => ({ ...item, bucket: '新增' })),
    ...(overlap?.不重複異動?.加碼 ?? []).map((item) => ({ ...item, bucket: '加碼' })),
  ];

  return combined
    .filter((item) => /^\d{4,6}$/.test(String(item.code ?? '').trim()))
    .sort((left, right) =>
      (right.出現ETF數 ?? 1) - (left.出現ETF數 ?? 1) ||
      Math.abs(right.weightDelta ?? 0) - Math.abs(left.weightDelta ?? 0),
    )
    .slice(0, 5);
}

export async function loadCloseDigestData() {
  const [dashboard, overlap, trackedStocks, stockSearchList] = await Promise.all([
    readJson(path.join('public', 'data', 'dashboard.json')),
    readJson(path.join('public', 'data', 'etf-overlap.json')),
    readJson(path.join('public', 'data', 'stocks', 'index.json')),
    readJson(path.join('public', 'data', 'stocks', 'search.json')),
  ]);

  return {
    dashboard,
    overlap,
    trackedStocks,
    stockSearchList,
  };
}

export function buildCloseDigestSummary({ dashboard, overlap, trackedStocks, stockSearchList, today = formatTaipeiDate() }) {
  const marketDate = dashboard?.市場總覽?.資料日期 ?? null;

  if (marketDate !== today) {
    return null;
  }

  const selectionUniverse = Array.isArray(stockSearchList) && stockSearchList.length ? stockSearchList : trackedStocks;
  const officialRiskRadar = pickOfficialRiskRadar(selectionUniverse);
  const upcomingDividendWatch = pickUpcomingDividendWatch(selectionUniverse, marketDate);

  return {
    appName: dashboard?.appName ?? '台股主動通',
    marketDate,
    marketSummary: dashboard?.市場總覽?.大盤摘要 ?? {},
    marketBreadth: dashboard?.市場總覽?.市場廣度 ?? {},
    observations: (dashboard?.市場總覽?.觀察摘要 ?? []).slice(0, 2),
    bullishSignals: pickSignalStocks(trackedStocks, 'up'),
    bearishSignals: pickSignalStocks(trackedStocks, 'down'),
    officialRadarSummary: buildOfficialRadarSummary(selectionUniverse),
    officialRiskRadar,
    upcomingDividendWatch,
    etfHighlights: pickEtfHighlights(overlap),
    staleEtfs: (overlap?.已串接ETF ?? [])
      .filter((item) => item.disclosureDate && item.disclosureDate !== marketDate)
      .slice(0, 5),
  };
}

export function buildTelegramMessage(summary) {
  if (!summary) {
    return null;
  }

  const lines = [
    `<b>${escapeHtml(summary.appName)}｜盤後重點 ${escapeHtml(summary.marketDate)}</b>`,
    `加權指數 ${escapeHtml(formatNumber(summary.marketSummary.加權指數))}（${escapeHtml(formatSigned(summary.marketSummary.漲跌點數))} / ${escapeHtml(formatPercent(summary.marketSummary.漲跌幅))}）`,
    `市場情緒 ${escapeHtml(summary.marketBreadth.市場情緒 ?? '整理中')}｜上漲 ${escapeHtml(formatNumber(summary.marketBreadth?.股票市場?.上漲, 0))} / 下跌 ${escapeHtml(formatNumber(summary.marketBreadth?.股票市場?.下跌, 0))} / 強弱比 ${escapeHtml(formatNumber(summary.marketBreadth?.強弱比))}`,
  ];

  if (summary.observations.length) {
    lines.push('');
    lines.push('<b>大盤觀察</b>');
    summary.observations.forEach((item) => {
      lines.push(`• ${escapeHtml(item)}`);
    });
  }

  lines.push('');
  lines.push('<b>官方交易雷達</b>');
  lines.push(
    `• 處置 ${escapeHtml(formatNumber(summary.officialRadarSummary?.dispositions, 0))}｜變更交易 ${escapeHtml(formatNumber(summary.officialRadarSummary?.changedTrading, 0))}｜注意累計 ${escapeHtml(formatNumber(summary.officialRadarSummary?.attentionWarnings, 0))}`,
  );

  if (summary.officialRiskRadar.length) {
    summary.officialRiskRadar.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.alertLabel)}｜${escapeHtml(item.topSelectionSignalTitle ?? '官方公告提醒')}｜日變動 ${escapeHtml(formatPercent(item.changePercent))}`,
      );
    });
  }

  if (summary.upcomingDividendWatch.length) {
    lines.push('');
    lines.push('<b>即將除息 / 事件接近</b>');
    summary.upcomingDividendWatch.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.topSelectionSignalTitle ?? '股利事件接近')}｜${escapeHtml(item.nextEventDate)}｜${escapeHtml(item.dayOffset === 0 ? '今天' : `${item.dayOffset} 天後`)}`,
      );
    });
  }

  if (summary.bullishSignals.length) {
    lines.push('');
    lines.push('<b>偏多技術訊號</b>');
    summary.bullishSignals.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.topSignalTitle)}｜20日 ${escapeHtml(formatPercent(item.return20))}｜法人五日 ${escapeHtml(formatNumber(item.total5Day, 0))}`,
      );
    });
  }

  if (summary.bearishSignals.length) {
    lines.push('');
    lines.push('<b>偏弱技術訊號</b>');
    summary.bearishSignals.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.topSignalTitle)}｜20日 ${escapeHtml(formatPercent(item.return20))}｜法人五日 ${escapeHtml(formatNumber(item.total5Day, 0))}`,
      );
    });
  }

  if (summary.etfHighlights.length) {
    lines.push('');
    lines.push('<b>主動 ETF 風向球</b>');
    summary.etfHighlights.forEach((item) => {
      const exposureText = item.出現ETF數 ? `${item.出現ETF數} 檔同步` : `${item.etfCode} ${item.etfName}`;
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.bucket)}｜${escapeHtml(exposureText)}｜權重變化 ${escapeHtml(formatPercent(item.weightDelta))}`,
      );
    });
  }

  if (summary.staleEtfs.length) {
    lines.push('');
    lines.push('<b>ETF 揭露追蹤</b>');
    lines.push(`• 以下已串接 ETF 最新揭露日仍非 ${escapeHtml(summary.marketDate)}：${escapeHtml(summary.staleEtfs.map((item) => `${item.code}(${item.disclosureDate})`).join('、'))}`);
  }

  return lines.join('\n');
}

function toEmbedLines(items, formatter) {
  const lines = items.map(formatter).filter(Boolean);
  return lines.length ? lines.join('\n') : '無';
}

export function buildDiscordPayload(summary) {
  if (!summary) {
    return null;
  }

  const marketUp = Number(summary.marketSummary.漲跌點數 ?? 0) >= 0;
  const color = marketUp ? 0x0b699b : 0x13885e;
  const titlePrefix = marketUp ? '偏多收盤' : '震盪收盤';

  const embeds = [
    {
      title: `${summary.appName}｜${titlePrefix} ${summary.marketDate}`,
      description: [
        `**加權指數** ${formatNumber(summary.marketSummary.加權指數)}  (${formatSigned(summary.marketSummary.漲跌點數)} / ${formatPercent(summary.marketSummary.漲跌幅)})`,
        `**市場情緒** ${summary.marketBreadth.市場情緒 ?? '整理中'}`,
        `**上漲 / 下跌** ${formatNumber(summary.marketBreadth?.股票市場?.上漲, 0)} / ${formatNumber(summary.marketBreadth?.股票市場?.下跌, 0)}`,
        `**強弱比** ${formatNumber(summary.marketBreadth?.強弱比)}`,
      ].join('\n'),
      color,
      fields: [
        {
          name: '大盤觀察',
          value: toEmbedLines(summary.observations, (item) => `• ${item}`),
          inline: false,
        },
        {
          name: '官方交易雷達',
          value: [
            `處置 ${formatNumber(summary.officialRadarSummary?.dispositions, 0)}｜變更交易 ${formatNumber(summary.officialRadarSummary?.changedTrading, 0)}｜注意累計 ${formatNumber(summary.officialRadarSummary?.attentionWarnings, 0)}`,
            toEmbedLines(
              summary.officialRiskRadar,
              (item) => `• **${item.code} ${item.name}**\n${item.alertLabel}｜${item.topSelectionSignalTitle ?? '官方公告提醒'}｜日變動 ${formatPercent(item.changePercent)}`,
            ),
          ].join('\n'),
          inline: false,
        },
        {
          name: '即將除息 / 事件接近',
          value: toEmbedLines(
            summary.upcomingDividendWatch,
            (item) => `• **${item.code} ${item.name}**\n${item.topSelectionSignalTitle ?? '股利事件接近'}｜${item.nextEventDate}｜${item.dayOffset === 0 ? '今天' : `${item.dayOffset} 天後`}`,
          ),
          inline: false,
        },
        {
          name: '偏多技術訊號',
          value: toEmbedLines(
            summary.bullishSignals,
            (item) => `• **${item.code} ${item.name}**\n${item.topSignalTitle}｜20日 ${formatPercent(item.return20)}｜法人五日 ${formatNumber(item.total5Day, 0)}`,
          ),
          inline: false,
        },
        {
          name: '偏弱技術訊號',
          value: toEmbedLines(
            summary.bearishSignals,
            (item) => `• **${item.code} ${item.name}**\n${item.topSignalTitle}｜20日 ${formatPercent(item.return20)}｜法人五日 ${formatNumber(item.total5Day, 0)}`,
          ),
          inline: false,
        },
        {
          name: '主動 ETF 風向球',
          value: toEmbedLines(
            summary.etfHighlights,
            (item) => {
              const exposureText = item.出現ETF數 ? `${item.出現ETF數} 檔同步` : `${item.etfCode} ${item.etfName}`;
              return `• **${item.code} ${item.name}**\n${item.bucket}｜${exposureText}｜權重變化 ${formatPercent(item.weightDelta)}`;
            },
          ),
          inline: false,
        },
        ...(summary.staleEtfs.length
          ? [
              {
                name: 'ETF 揭露追蹤',
                value: `仍有部分已串接 ETF 未更新到 ${summary.marketDate}：${summary.staleEtfs.map((item) => `${item.code}(${item.disclosureDate})`).join('、')}`,
                inline: false,
              },
            ]
          : []),
      ],
      footer: {
        text: '僅供研究參考，不構成投資建議。',
      },
      timestamp: new Date(`${summary.marketDate}T11:00:00+08:00`).toISOString(),
    },
  ];

  return {
    username: summary.appName,
    avatar_url: 'https://www.twse.com.tw/rsrc/images/brand/favicon.png',
    embeds,
    allowed_mentions: {
      parse: [],
    },
  };
}
