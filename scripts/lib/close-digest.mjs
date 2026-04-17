import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSelectionRadar } from './selection-radar.mjs';
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

function takeUniqueByCode(items, usedCodes, formatter, limit = 3) {
  const results = [];

  for (const item of items ?? []) {
    const code = String(item?.code ?? '').trim();

    if (!code || usedCodes.has(code)) {
      continue;
    }

    usedCodes.add(code);
    results.push(formatter(item));

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function clampRating(value) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function buildRatingText(value) {
  const rating = clampRating(value);
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
}

function rateStableInstitutional(item) {
  const foreign = Math.max(0, Number(item?.foreignAccumulated ?? 0));
  const trust = Math.max(0, Number(item?.trustAccumulated ?? 0));
  const return20 = Number(item?.return20 ?? 0);
  const days = Math.max(Number(item?.foreignDays ?? 0), Number(item?.trustDays ?? 0));
  const raw = 2.2 + Math.min((foreign + trust) / 30000000, 1.1) + Math.min(return20 / 30, 0.9) + Math.min(days / 8, 0.8);
  return clampRating(raw);
}

function rateStableBullish(item) {
  const return20 = Number(item?.return20 ?? 0);
  const total5Day = Math.max(0, Number(item?.total5Day ?? 0));
  const etfCount = Number(item?.activeEtfCount ?? 0);
  const raw = 2 + Math.min(return20 / 24, 1) + Math.min(total5Day / 8000000, 0.8) + Math.min(etfCount / 4, 0.8);
  return clampRating(raw);
}

function rateAggressiveVolume(item) {
  const volumeRatio5 = Math.max(0, Number(item?.volumeRatio5 ?? 0));
  const distanceToHigh20 = Math.max(0, Number(item?.distanceToHigh20 ?? 99));
  const changePercent = Number(item?.changePercent ?? 0);
  const raw = 2.3 + Math.min(changePercent / 8, 0.9) + Math.max(0, (70 - volumeRatio5) / 120) + Math.max(0, (6 - distanceToHigh20) / 8);
  return clampRating(raw);
}

function rateAggressiveConsolidation(item) {
  const rangePercent = Math.max(0, Number(item?.rangePercent ?? 99));
  const distanceToHigh = Math.max(0, Number(item?.distanceToHigh ?? 99));
  const rsi = Number(item?.rsi ?? 50);
  const raw = 2.1 + Math.max(0, (8 - rangePercent) / 10) + Math.max(0, (2.5 - distanceToHigh) / 3) + Math.max(0, (rsi - 50) / 35);
  return clampRating(raw);
}

function buildWatchGroups(summary) {
  const stableCodes = new Set();
  const aggressiveCodes = new Set();
  const stable = [];
  const aggressive = [];

  stable.push(
    ...takeUniqueByCode(
      summary.institutionalResonance,
      stableCodes,
      (item) => ({
        code: item.code,
        name: item.name,
        label: '雙法人偏多',
        rating: rateStableInstitutional(item),
        detail: `${item.signalLabel}｜外資 ${formatNumber(item.foreignAccumulated, 0)} / 投信 ${formatNumber(item.trustAccumulated, 0)}｜20 日 ${formatPercent(item.return20)}`,
      }),
      3,
    ),
  );

  stable.push(
    ...takeUniqueByCode(
      summary.bullishSignals,
      stableCodes,
      (item) => ({
        code: item.code,
        name: item.name,
        label: '偏多焦點',
        rating: rateStableBullish(item),
        detail: `${item.topSignalTitle}｜20 日 ${formatPercent(item.return20)}｜五日籌碼 ${formatNumber(item.total5Day, 0)}`,
      }),
      2,
    ),
  );

  aggressive.push(
    ...takeUniqueByCode(
      summary.volumeSqueezeRisers,
      aggressiveCodes,
      (item) => ({
        code: item.code,
        name: item.name,
        label: '量縮價漲',
        rating: rateAggressiveVolume(item),
        detail: `單日 ${formatPercent(item.changePercent)}｜量比 5 日 ${formatNumber(item.volumeRatio5, 0)}%｜距 20 日高 ${formatNumber(item.distanceToHigh20, 1)}%`,
      }),
      3,
    ),
  );

  aggressive.push(
    ...takeUniqueByCode(
      summary.consolidationWatch,
      aggressiveCodes,
      (item) => ({
        code: item.code,
        name: item.name,
        label: '盤整待發',
        rating: rateAggressiveConsolidation(item),
        detail: `30 日箱體 ${formatNumber(item.rangePercent, 1)}%｜離箱頂 ${formatNumber(item.distanceToHigh, 1)}%｜RSI ${formatNumber(item.rsi, 1)}`,
      }),
      3,
    ),
  );

  const stableSorted = stable.sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0)).slice(0, 5);
  const stableCodeSet = new Set(stableSorted.map((item) => item.code));
  const aggressiveDeduped = aggressive
    .filter((item) => !stableCodeSet.has(item.code))
    .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))
    .slice(0, 6);

  return {
    stable: stableSorted,
    aggressive: aggressiveDeduped,
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

export function buildDiscordPayload(summary) {
  if (!summary) {
    return null;
  }

  const themeColors = getMarketThemeColor(summary);

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
      ...(summary.watchGroups.stable.length || summary.watchGroups.aggressive.length
        ? [
            {
              title: '最近可留意',
              url: `${siteUrl}#/radar`,
              color: themeColors.secondary,
              image:
                summary.watchGroups.stable.length && !summary.watchGroups.aggressive.length
                  ? { url: socialCardUrl }
                  : undefined,
              fields: [
                ...(summary.watchGroups.stable.length
                  ? [
                      {
                        name: '穩健型',
                        value: buildWatchListLines(summary.watchGroups.stable).join('\n'),
                        inline: false,
                      },
                    ]
                  : []),
                ...(summary.watchGroups.aggressive.length
                  ? [
                      {
                        name: '積極型',
                        value: buildWatchListLines(summary.watchGroups.aggressive).join('\n'),
                        inline: false,
                      },
                    ]
                  : []),
              ],
              footer: {
                text: '更多選股整理可直接打開選股雷達。',
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
