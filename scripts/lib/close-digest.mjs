import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSelectionRadar } from './selection-radar.mjs';
import { buildRatingText, buildWatchGroups } from './watch-groups.mjs';
import { buildThemeMomentumTopics } from '../../src/lib/themeRadar.js';

const rootDir = process.cwd();
const siteUrl = 'https://joe94113.github.io/TW_Active_Tracker/';
const brandIconUrl = `${siteUrl}icon-128.png`;
const socialCardUrl = `${siteUrl}social-card.png`;

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

function pickSignalStocks(items, tone) {
  return [...(items ?? [])]
    .filter((item) => item.topSignalTone === tone && item.topSignalTitle)
    .sort(
      (left, right) =>
        (right.technicalSignals?.[0]?.importance ?? 0) - (left.technicalSignals?.[0]?.importance ?? 0) ||
        (right.activeEtfCount ?? 0) - (left.activeEtfCount ?? 0) ||
        Math.abs(right.total5Day ?? 0) - Math.abs(left.total5Day ?? 0) ||
        Math.abs(right.return20 ?? 0) - Math.abs(left.return20 ?? 0),
    )
    .slice(0, 4);
}

function getAlertPriority(item) {
  if (item.isUnderDisposition) return 3;
  if (item.hasChangedTrading) return 2;
  if (item.hasAttentionWarning) return 1;
  return 0;
}

function getAlertLabel(item) {
  if (item.isUnderDisposition) return '處置';
  if (item.hasChangedTrading) return '變更交易';
  if (item.hasAttentionWarning) return '注意股';
  return '提醒';
}

function pickOfficialRiskRadar(items) {
  return [...(items ?? [])]
    .filter((item) => item.isUnderDisposition || item.hasChangedTrading || item.hasAttentionWarning)
    .map((item) => ({
      ...item,
      alertLabel: getAlertLabel(item),
      priority: getAlertPriority(item),
    }))
    .sort(
      (left, right) =>
        (right.priority ?? 0) - (left.priority ?? 0) ||
        (right.selectionSignalCount ?? 0) - (left.selectionSignalCount ?? 0) ||
        Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0) ||
        String(left.code).localeCompare(String(right.code)),
    )
    .slice(0, 4);
}

function buildOfficialRadarSummary(items) {
  return {
    dispositions: (items ?? []).filter((item) => item.isUnderDisposition).length,
    changedTrading: (items ?? []).filter((item) => item.hasChangedTrading).length,
    attentionWarnings: (items ?? []).filter((item) => item.hasAttentionWarning).length,
  };
}

function buildTomorrowOutlook(summary) {
  const outlook = [];

  if (summary.observations?.length) {
    outlook.push(...summary.observations.slice(0, 2));
  }

  if (summary.themeMomentumTopics?.length) {
    const topTheme = summary.themeMomentumTopics[0];
    const leader = topTheme.leaderStocks?.[0];
    outlook.push(`資金主線暫看 ${topTheme.title}${leader ? `，龍頭可先看 ${leader.code} ${leader.name}` : ''}。`);
  }

  if (summary.officialRiskRadar?.length) {
    const topRisk = summary.officialRiskRadar[0];
    outlook.push(`${topRisk.code} ${topRisk.name} 出現 ${topRisk.alertLabel}，短線先避開追價。`);
  } else if (
    Number(summary.officialRadarSummary?.dispositions ?? 0) === 0 &&
    Number(summary.officialRadarSummary?.changedTrading ?? 0) === 0 &&
    Number(summary.officialRadarSummary?.attentionWarnings ?? 0) === 0
  ) {
    outlook.push('官方風險股不多，短線盤面相對乾淨，但仍要搭配量價確認。');
  }

  return outlook.slice(0, 4);
}

function buildWatchListLines(items) {
  return items.map((item) => `• ${item.code} ${item.name}｜${item.label}｜${buildRatingText(item.rating)}\n${item.detail}`);
}

function getMarketThemeColor(summary) {
  const changePercent = Number(summary?.marketSummary?.漲跌幅 ?? 0);
  const breadthRatio = Number(summary?.marketBreadth?.強弱比 ?? 1);
  const sentiment = String(summary?.marketBreadth?.市場情緒 ?? '');

  if (changePercent >= 1.5 || breadthRatio >= 2.2 || sentiment.includes('全面擴散')) {
    return { primary: 0xd84c4c, secondary: 0xf08c6b };
  }

  if (changePercent >= 0.2 || breadthRatio >= 1.15 || sentiment.includes('多方')) {
    return { primary: 0x0b699b, secondary: 0x13885e };
  }

  if (changePercent <= -1.5 || breadthRatio <= 0.7 || sentiment.includes('空方')) {
    return { primary: 0x5b6b7a, secondary: 0x7c4d79 };
  }

  return { primary: 0x56657a, secondary: 0x607d8b };
}

function getWatchGroupColors(summary) {
  const marketUp = Number(summary?.marketSummary?.漲跌點數 ?? 0) >= 0;

  return {
    stable: marketUp ? 0x2f7ea1 : 0x5b6b7a,
    aggressive: marketUp ? 0xe07a4f : 0x8a5a7b,
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

  const summary = {
    appName: dashboard?.appName ?? '台股主動通',
    marketDate,
    marketSummary: dashboard?.市場總覽?.大盤摘要 ?? {},
    marketBreadth: dashboard?.市場總覽?.市場廣度 ?? {},
    observations: (dashboard?.市場總覽?.觀察摘要 ?? []).slice(0, 3),
    bullishSignals: pickSignalStocks(trackedStocks, 'up'),
    bearishSignals: pickSignalStocks(trackedStocks, 'down'),
    officialRadarSummary: buildOfficialRadarSummary(selectionUniverse),
    officialRiskRadar,
    themeMomentumTopics: buildThemeMomentumTopics(dashboard?.題材雷達, 3),
    ...selectionRadar,
  };

  return {
    ...summary,
    tomorrowOutlook: buildTomorrowOutlook(summary),
    watchGroups: buildWatchGroups(summary),
  };
}

export function buildTelegramMessage(summary) {
  if (!summary) {
    return null;
  }

  const lines = [
    `<b>${escapeHtml(summary.appName)}｜明日盤勢 ${escapeHtml(summary.marketDate)}</b>`,
    `加權 ${escapeHtml(formatNumber(summary.marketSummary.加權指數))}（${escapeHtml(formatSigned(summary.marketSummary.漲跌點數))} / ${escapeHtml(formatPercent(summary.marketSummary.漲跌幅))}）`,
    `市場廣度 ${escapeHtml(summary.marketBreadth.市場情緒 ?? '資料整理中')}｜上漲 / 下跌 ${escapeHtml(formatNumber(summary.marketBreadth?.股票市場?.上漲, 0))} / ${escapeHtml(formatNumber(summary.marketBreadth?.股票市場?.下跌, 0))}｜強弱比 ${escapeHtml(formatNumber(summary.marketBreadth?.強弱比))}`,
  ];

  if (summary.tomorrowOutlook.length) {
    lines.push('');
    lines.push('<b>明天盤勢</b>');
    summary.tomorrowOutlook.forEach((item) => lines.push(`• ${escapeHtml(item)}`));
  }

  if (summary.watchGroups.stable.length) {
    lines.push('');
    lines.push('<b>穩健型</b>');
    summary.watchGroups.stable.forEach((item) => {
      lines.push(`• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.label)}｜${escapeHtml(buildRatingText(item.rating))}`);
      lines.push(`  ${escapeHtml(item.detail)}`);
    });
  }

  if (summary.watchGroups.aggressive.length) {
    lines.push('');
    lines.push('<b>積極型</b>');
    summary.watchGroups.aggressive.forEach((item) => {
      lines.push(`• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.label)}｜${escapeHtml(buildRatingText(item.rating))}`);
      lines.push(`  ${escapeHtml(item.detail)}`);
    });
  }

  return lines.join('\n');
}

function createLineText(text, options = {}) {
  return {
    type: 'text',
    text,
    wrap: options.wrap ?? true,
    size: options.size ?? 'sm',
    color: options.color ?? '#10202d',
    weight: options.weight ?? 'regular',
    flex: options.flex ?? 0,
  };
}

function createLineMetric(label, value) {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      createLineText(label, { size: 'xs', color: '#6b7a86', flex: 3 }),
      createLineText(value, { size: 'sm', weight: 'bold', color: '#10202d', flex: 5 }),
    ],
  };
}

function createLineBubble({ title, accentColor, lines = [], linkUrl = siteUrl, footerText = '打開台股主動通' }) {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: accentColor,
      contents: [
        createLineText(title, {
          size: 'md',
          weight: 'bold',
          color: '#ffffff',
        }),
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '16px',
      contents: lines,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'link',
          height: 'sm',
          action: {
            type: 'uri',
            label: footerText,
            uri: linkUrl,
          },
        },
      ],
    },
  };
}

function buildLineWatchRows(items) {
  if (!items.length) {
    return [createLineText('今天沒有特別突出的名單。', { color: '#6b7a86' })];
  }

  return items.flatMap((item) => [
    {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: [
        createLineText(`${item.code} ${item.name}`, { size: 'sm', weight: 'bold' }),
        createLineText(`${item.label}｜${buildRatingText(item.rating)}`, { size: 'xs', color: '#0b699b' }),
        createLineText(item.detail, { size: 'xs', color: '#4b5c68' }),
      ],
    },
    {
      type: 'separator',
      margin: 'md',
    },
  ]).slice(0, Math.max(items.length * 2 - 1, 0));
}

export function buildLineFlexPayload(summary) {
  if (!summary) {
    return null;
  }

  const themeColors = getMarketThemeColor(summary);
  const watchGroupColors = getWatchGroupColors(summary);

  return {
    type: 'flex',
    altText: `${summary.appName} ${summary.marketDate}｜明日盤勢與最近可留意`,
    contents: {
      type: 'carousel',
      contents: [
        createLineBubble({
          title: `明日盤勢｜${summary.marketDate}`,
          accentColor: `#${themeColors.primary.toString(16).padStart(6, '0')}`,
          lines: [
            createLineMetric('加權', `${formatNumber(summary.marketSummary.加權指數)}（${formatSigned(summary.marketSummary.漲跌點數)} / ${formatPercent(summary.marketSummary.漲跌幅)}）`),
            createLineMetric('廣度', `${summary.marketBreadth.市場情緒 ?? '資料整理中'}｜強弱比 ${formatNumber(summary.marketBreadth?.強弱比)}`),
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              margin: 'md',
              contents: summary.tomorrowOutlook.length
                ? summary.tomorrowOutlook.slice(0, 4).map((item) => createLineText(`• ${item}`, { size: 'xs', color: '#4b5c68' }))
                : [createLineText('• 目前沒有足夠的盤後觀察摘要。', { size: 'xs', color: '#6b7a86' })],
            },
          ],
        }),
        createLineBubble({
          title: '🛡 穩健型',
          accentColor: `#${watchGroupColors.stable.toString(16).padStart(6, '0')}`,
          linkUrl: `${siteUrl}#/radar`,
          footerText: '打開選股雷達',
          lines: buildLineWatchRows(summary.watchGroups.stable),
        }),
        createLineBubble({
          title: '🔥 積極型',
          accentColor: `#${watchGroupColors.aggressive.toString(16).padStart(6, '0')}`,
          linkUrl: `${siteUrl}#/radar`,
          footerText: '打開選股雷達',
          lines: buildLineWatchRows(summary.watchGroups.aggressive),
        }),
      ],
    },
  };
}

export function buildDiscordPayload(summary) {
  if (!summary) {
    return null;
  }

  const themeColors = getMarketThemeColor(summary);
  const watchGroupColors = getWatchGroupColors(summary);

  return {
    username: summary.appName,
    avatar_url: brandIconUrl,
    embeds: [
      {
        title: `${summary.appName}｜明日盤勢 ${summary.marketDate}`,
        url: siteUrl,
        author: {
          name: summary.appName,
          icon_url: brandIconUrl,
          url: siteUrl,
        },
        description: [
          `**加權指數** ${formatNumber(summary.marketSummary.加權指數)}（${formatSigned(summary.marketSummary.漲跌點數)} / ${formatPercent(summary.marketSummary.漲跌幅)}）`,
          `**市場廣度** ${summary.marketBreadth.市場情緒 ?? '資料整理中'}｜上漲 / 下跌 ${formatNumber(summary.marketBreadth?.股票市場?.上漲, 0)} / ${formatNumber(summary.marketBreadth?.股票市場?.下跌, 0)}｜強弱比 ${formatNumber(summary.marketBreadth?.強弱比)}`,
        ].join('\n'),
        color: themeColors.primary,
        thumbnail: {
          url: brandIconUrl,
        },
        fields: [
          {
            name: '明天盤勢',
            value: summary.tomorrowOutlook.length
              ? summary.tomorrowOutlook.map((item) => `• ${item}`).join('\n')
              : '• 目前沒有足夠的觀察摘要。',
            inline: false,
          },
        ],
        footer: {
          text: '僅供研究參考，不構成投資建議。',
          icon_url: brandIconUrl,
        },
        timestamp: new Date(`${summary.marketDate}T18:35:00+08:00`).toISOString(),
      },
      ...(summary.watchGroups.stable.length
        ? [
            {
              title: '🛡 最近可留意｜穩健型',
              url: `${siteUrl}#/radar`,
              color: watchGroupColors.stable,
              fields: [
                {
                  name: '穩健型',
                  value: buildWatchListLines(summary.watchGroups.stable).join('\n'),
                  inline: false,
                },
              ],
              footer: {
                text: '偏向雙法人與趨勢延續，適合先放進追蹤清單。',
                icon_url: brandIconUrl,
              },
            },
          ]
        : []),
      ...(summary.watchGroups.aggressive.length
        ? [
            {
              title: '🔥 最近可留意｜積極型',
              url: `${siteUrl}#/radar`,
              color: watchGroupColors.aggressive,
              image: !summary.watchGroups.stable.length ? { url: socialCardUrl } : undefined,
              fields: [
                {
                  name: '積極型',
                  value: buildWatchListLines(summary.watchGroups.aggressive).join('\n'),
                  inline: false,
                },
              ],
              footer: {
                text: '偏向突破與轉強，適合短線盯盤確認量價。',
                icon_url: brandIconUrl,
              },
            },
          ]
        : []),
    ],
    allowed_mentions: {
      parse: [],
    },
  };
}
