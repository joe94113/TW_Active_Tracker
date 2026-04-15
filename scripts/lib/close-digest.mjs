import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSelectionRadar } from './selection-radar.mjs';

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

function resolveDigestMarketDate(dashboard) {
  return (
    normalizeDateKey(dashboard?.市場總覽?.即時狀態?.marketDate) ??
    normalizeDateKey(dashboard?.市場總覽?.大盤摘要?.資料日期) ??
    normalizeDateKey(dashboard?.市場總覽?.盤中脈動?.資料日期) ??
    normalizeDateKey(dashboard?.市場總覽?.資料日期) ??
    null
  );
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

function buildOfficialRadarSummary(items) {
  return {
    dispositions: items.filter((item) => item.isUnderDisposition).length,
    changedTrading: items.filter((item) => item.hasChangedTrading).length,
    attentionWarnings: items.filter((item) => item.hasAttentionWarning).length,
  };
}

export async function loadCloseDigestData() {
  const [dashboard, trackedStocks, stockSearchList] = await Promise.all([
    readJson(path.join('public', 'data', 'dashboard.json')),
    readJson(path.join('public', 'data', 'stocks', 'index.json')),
    readJson(path.join('public', 'data', 'stocks', 'search.json')),
  ]);
  const trackedCodes = [...new Set((trackedStocks ?? []).map((item) => String(item.code ?? '').trim()).filter(Boolean))];
  const stockDetailList = (
    await Promise.all(
      trackedCodes.map(async (code) => {
        try {
          return await readJson(path.join('public', 'data', 'stocks', `${code}.json`));
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean);

  return {
    dashboard,
    trackedStocks,
    stockSearchList,
    stockDetailList,
  };
}

export function buildCloseDigestSummary({ dashboard, trackedStocks, stockSearchList, stockDetailList, today = formatTaipeiDate() }) {
  const marketDate = resolveDigestMarketDate(dashboard);

  if (marketDate !== today) {
    return null;
  }

  const selectionUniverse = Array.isArray(stockSearchList) && stockSearchList.length ? stockSearchList : trackedStocks;
  const officialRiskRadar = pickOfficialRiskRadar(selectionUniverse);
  const selectionRadar = buildSelectionRadar({
    dashboard,
    stockMetaList: trackedStocks,
    stockDetailList,
  });

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
    ...selectionRadar,
  };
}

function appendTelegramSection(lines, title, items, formatter, limit = 3) {
  const selected = (items ?? []).slice(0, limit).map(formatter).filter(Boolean);

  if (!selected.length) {
    return;
  }

  lines.push('');
  lines.push(`<b>${title}</b>`);
  lines.push(...selected);
}

export function buildTelegramMessage(summary) {
  if (!summary) {
    return null;
  }

  const lines = [
    `<b>${escapeHtml(summary.appName)}｜盤後快訊 ${escapeHtml(summary.marketDate)}</b>`,
    `加權指數 ${escapeHtml(formatNumber(summary.marketSummary.加權指數))}（${escapeHtml(formatSigned(summary.marketSummary.漲跌點數))} / ${escapeHtml(formatPercent(summary.marketSummary.漲跌幅))}）`,
    `市場情緒 ${escapeHtml(summary.marketBreadth.市場情緒 ?? '整理中')}｜上漲 ${escapeHtml(formatNumber(summary.marketBreadth?.股票市場?.上漲, 0))} / 下跌 ${escapeHtml(formatNumber(summary.marketBreadth?.股票市場?.下跌, 0))} / 強弱比 ${escapeHtml(formatNumber(summary.marketBreadth?.強弱比))}`,
  ];

  appendTelegramSection(lines, '今晚先看', summary.observations, (item) => `• ${escapeHtml(item)}`, 2);
  appendTelegramSection(
    lines,
    '官方交易雷達',
    summary.officialRiskRadar,
    (item) =>
      `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.alertLabel)}｜${escapeHtml(item.topSelectionSignalTitle ?? '官方公告提醒')}｜日變動 ${escapeHtml(formatPercent(item.changePercent))}`,
    3,
  );
  appendTelegramSection(
    lines,
    '偏多技術訊號',
    summary.bullishSignals,
    (item) =>
      `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.topSignalTitle)}｜20日 ${escapeHtml(formatPercent(item.return20))}｜法人五日 ${escapeHtml(formatNumber(item.total5Day, 0))}`,
    2,
  );
  appendTelegramSection(
    lines,
    '偏弱技術訊號',
    summary.bearishSignals,
    (item) =>
      `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.topSignalTitle)}｜20日 ${escapeHtml(formatPercent(item.return20))}｜法人五日 ${escapeHtml(formatNumber(item.total5Day, 0))}`,
    2,
  );
  appendTelegramSection(
    lines,
    '外資 / 投信同步偏多',
    summary.institutionalResonance,
    (item) =>
      `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.signalLabel)}｜外資 ${escapeHtml(formatNumber(item.foreignAccumulated, 0))} / 投信 ${escapeHtml(formatNumber(item.trustAccumulated, 0))} 股｜20日 ${escapeHtml(formatPercent(item.return20))}`,
    3,
  );
  appendTelegramSection(
    lines,
    '量縮價漲觀察',
    summary.volumeSqueezeRisers,
    (item) =>
      `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜單日 ${escapeHtml(formatPercent(item.changePercent))}｜量能為 5 日均量 ${escapeHtml(formatNumber(item.volumeRatio5, 0))}%｜距 20 日高點 ${escapeHtml(formatNumber(item.distanceToHigh20, 1))}%`,
    3,
  );
  appendTelegramSection(
    lines,
    '盤整待突破',
    summary.consolidationWatch,
    (item) =>
      `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜30 日箱型 ${escapeHtml(formatNumber(item.rangePercent, 1))}%｜距箱頂 ${escapeHtml(formatNumber(item.distanceToHigh, 1))}%｜RSI ${escapeHtml(formatNumber(item.rsi, 1))}`,
    3,
  );

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
        `**加權指數** ${formatNumber(summary.marketSummary.加權指數)}（${formatSigned(summary.marketSummary.漲跌點數)} / ${formatPercent(summary.marketSummary.漲跌幅)}）`,
        `**市場情緒** ${summary.marketBreadth.市場情緒 ?? '整理中'} ｜ **上漲 / 下跌** ${formatNumber(summary.marketBreadth?.股票市場?.上漲, 0)} / ${formatNumber(summary.marketBreadth?.股票市場?.下跌, 0)} ｜ **強弱比** ${formatNumber(summary.marketBreadth?.強弱比)}`,
      ].join('\n'),
      color,
      fields: summary.observations.length
        ? [
            {
              name: '今晚先看',
              value: toEmbedLines(summary.observations.slice(0, 3), (item) => `• ${item}`),
              inline: false,
            },
          ]
        : [],
      footer: {
        text: '僅供研究參考，不構成投資建議。',
      },
      timestamp: new Date(`${summary.marketDate}T11:00:00+08:00`).toISOString(),
    },
    {
      title: '選股線索',
      color: 0x22466d,
      fields: [
        {
          name: '官方交易雷達',
          value: [
            `處置 ${formatNumber(summary.officialRadarSummary?.dispositions, 0)}｜變更交易 ${formatNumber(summary.officialRadarSummary?.changedTrading, 0)}｜注意累計 ${formatNumber(summary.officialRadarSummary?.attentionWarnings, 0)}`,
            toEmbedLines(
              summary.officialRiskRadar.slice(0, 4),
              (item) => `• **${item.code} ${item.name}**\n${item.alertLabel}｜${item.topSelectionSignalTitle ?? '官方公告提醒'}｜日變動 ${formatPercent(item.changePercent)}`,
            ),
          ].join('\n'),
          inline: false,
        },
        {
          name: '偏多技術訊號',
          value: toEmbedLines(
            summary.bullishSignals.slice(0, 3),
            (item) => `• **${item.code} ${item.name}**\n${item.topSignalTitle}｜20日 ${formatPercent(item.return20)}｜法人五日 ${formatNumber(item.total5Day, 0)}`,
          ),
          inline: false,
        },
        {
          name: '偏弱技術訊號',
          value: toEmbedLines(
            summary.bearishSignals.slice(0, 3),
            (item) => `• **${item.code} ${item.name}**\n${item.topSignalTitle}｜20日 ${formatPercent(item.return20)}｜法人五日 ${formatNumber(item.total5Day, 0)}`,
          ),
          inline: false,
        },
      ],
    },
    {
      title: '選股雷達',
      color: 0x13885e,
      fields: [
        {
          name: '外資 / 投信同步偏多',
          value: toEmbedLines(
            summary.institutionalResonance.slice(0, 4),
            (item) => `• **${item.code} ${item.name}**\n${item.signalLabel}｜外資 ${formatNumber(item.foreignAccumulated, 0)} / 投信 ${formatNumber(item.trustAccumulated, 0)} 股｜20日 ${formatPercent(item.return20)}`,
          ),
          inline: false,
        },
        {
          name: '量縮價漲觀察',
          value: toEmbedLines(
            summary.volumeSqueezeRisers.slice(0, 4),
            (item) => `• **${item.code} ${item.name}**\n單日 ${formatPercent(item.changePercent)}｜量能為 5 日均量 ${formatNumber(item.volumeRatio5, 0)}%｜距 20 日高點 ${formatNumber(item.distanceToHigh20, 1)}%`,
          ),
          inline: false,
        },
        {
          name: '盤整待突破',
          value: toEmbedLines(
            summary.consolidationWatch.slice(0, 4),
            (item) => `• **${item.code} ${item.name}**\n30 日箱型 ${formatNumber(item.rangePercent, 1)}%｜距箱頂 ${formatNumber(item.distanceToHigh, 1)}%｜MA20 / MA60 差 ${formatNumber(item.maGapPercent, 1)}%｜RSI ${formatNumber(item.rsi, 1)}`,
          ),
          inline: false,
        },
      ],
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
