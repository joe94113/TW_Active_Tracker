import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildStockEventCalendar } from '../../src/lib/stockInsights.js';
import {
  formatNumber,
  formatPercent,
  formatTaipeiDate,
} from './close-digest.mjs';

export { formatTaipeiDate } from './close-digest.mjs';

const rootDir = process.cwd();

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

function buildCandidateCodeSet({ dashboard, stockIndex }) {
  const codeSet = new Set();

  const rankedStocks = [...stockIndex]
    .sort((left, right) => scoreStock(right) - scoreStock(left))
    .slice(0, 240);

  rankedStocks.forEach((item) => codeSet.add(item.code));
  (dashboard?.市場總覽?.熱門股 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.法人追蹤?.外資連買 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.法人追蹤?.投信連買 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));

  return [...codeSet].filter((code) => /^\d{4,6}$/.test(code));
}

function scoreStock(item) {
  const primarySignalImportance = item?.technicalSignals?.[0]?.importance ?? 0;

  return (
    primarySignalImportance * 42 +
    Math.min(Math.abs(Number(item?.return20 ?? 0)) * 1.8, 32) +
    Math.min(Math.abs(Number(item?.total5Day ?? 0)) / 600000, 20) +
    Math.min(Number(item?.volume ?? 0) / 1200000, 10) +
    Number(item?.activeEtfCount ?? 0) * 18 +
    (item?.topSignalTone === 'up' || item?.topSignalTone === 'down' ? 8 : 0)
  );
}

function mapEventPriority(event, score) {
  const label = String(event?.label ?? '');
  const isRevenue = label.includes('月營收');
  const isQuarter = label.includes('季報');
  const isEtf = label.includes('ETF');
  const base = isRevenue ? 32 : isQuarter ? 26 : isEtf ? 18 : 14;

  return base + score;
}

function pickEtfRefreshHighlights(overlap, marketDate) {
  return [...(overlap?.已串接ETF ?? [])]
    .filter((item) => item.disclosureDate === marketDate)
    .sort((left, right) =>
      ((right.changeSummary?.totalChangeCount ?? 0) ||
        (right.changeSummary?.addedCount ?? 0) +
          (right.changeSummary?.removedCount ?? 0) +
          (right.changeSummary?.increasedCount ?? 0) +
          (right.changeSummary?.decreasedCount ?? 0)) -
      ((left.changeSummary?.totalChangeCount ?? 0) ||
        (left.changeSummary?.addedCount ?? 0) +
          (left.changeSummary?.removedCount ?? 0) +
          (left.changeSummary?.increasedCount ?? 0) +
          (left.changeSummary?.decreasedCount ?? 0))
    )
    .slice(0, 5)
    .map((item) => ({
      code: item.code,
      name: item.name,
      disclosureDate: item.disclosureDate,
      changeCount:
        (item.changeSummary?.totalChangeCount ?? 0) ||
        (item.changeSummary?.addedCount ?? 0) +
          (item.changeSummary?.removedCount ?? 0) +
          (item.changeSummary?.increasedCount ?? 0) +
          (item.changeSummary?.decreasedCount ?? 0),
    }));
}

function pickStaleEtfs(overlap, marketDate) {
  return [...(overlap?.已串接ETF ?? [])]
    .filter((item) => item.disclosureDate && item.disclosureDate !== marketDate)
    .sort((left, right) => String(left.disclosureDate).localeCompare(String(right.disclosureDate)))
    .slice(0, 5)
    .map((item) => ({
      code: item.code,
      name: item.name,
      disclosureDate: item.disclosureDate,
    }));
}

function buildEventEntry({ detail, stockMeta, event, marketDate }) {
  const daysUntil = diffDays(marketDate, event.date);

  if (daysUntil === null) {
    return null;
  }

  return {
    code: detail.code,
    name: detail.name,
    label: event.label,
    note: event.note,
    date: event.date,
    daysUntil,
    status: event.status,
    topSignalTitle: stockMeta?.topSignalTitle ?? '技術面整理中',
    topSignalTone: stockMeta?.topSignalTone ?? 'normal',
    total5Day: stockMeta?.total5Day ?? null,
    activeEtfCount: stockMeta?.activeEtfCount ?? 0,
    return20: stockMeta?.return20 ?? null,
    priority: mapEventPriority(event, scoreStock(stockMeta)),
  };
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

function resolveAlertMarketDate(dashboard) {
  return (
    normalizeDateKey(dashboard?.市場總覽?.即時狀態?.marketDate) ??
    normalizeDateKey(dashboard?.市場總覽?.大盤摘要?.資料日期) ??
    normalizeDateKey(dashboard?.市場總覽?.盤中脈動?.資料日期) ??
    normalizeDateKey(dashboard?.市場總覽?.資料日期) ??
    null
  );
}

export async function loadEventAlertData() {
  const [dashboard, overlap, stockIndex] = await Promise.all([
    readJson(path.join('public', 'data', 'dashboard.json')),
    readJson(path.join('public', 'data', 'etf-overlap.json')),
    readJson(path.join('public', 'data', 'stocks', 'index.json')),
  ]);

  const candidateCodes = buildCandidateCodeSet({ dashboard, stockIndex });
  const stockDetailList = (
    await Promise.all(
      candidateCodes.map(async (code) => {
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
    overlap,
    stockIndex,
    stockDetailList,
  };
}

export function buildEventAlertSummary({ dashboard, overlap, stockIndex, stockDetailList, today = formatTaipeiDate() }) {
  const marketDate = resolveAlertMarketDate(dashboard);

  if (marketDate !== today) {
    return null;
  }

  const stockMetaMap = new Map(stockIndex.map((item) => [item.code, item]));
  const recentEvents = [];
  const upcomingEvents = [];

  stockDetailList.forEach((detail) => {
    const events = buildStockEventCalendar(detail);
    const stockMeta = stockMetaMap.get(detail.code) ?? {};

    const recent = events
      .map((event) => buildEventEntry({ detail, stockMeta, event, marketDate }))
      .filter(Boolean)
      .filter((item) => item.status === 'recent' && item.daysUntil === 0)
      .sort((left, right) => right.priority - left.priority)[0];

    const upcoming = events
      .map((event) => buildEventEntry({ detail, stockMeta, event, marketDate }))
      .filter(Boolean)
      .filter((item) => item.status === 'upcoming' && item.daysUntil >= 0 && item.daysUntil <= 3)
      .sort((left, right) => left.daysUntil - right.daysUntil || right.priority - left.priority)[0];

    if (recent) {
      recentEvents.push(recent);
    }

    if (upcoming) {
      upcomingEvents.push(upcoming);
    }
  });

  const sortedRecentEvents = recentEvents
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 6);
  const sortedUpcomingEvents = upcomingEvents
    .sort((left, right) => left.daysUntil - right.daysUntil || right.priority - left.priority)
    .slice(0, 6);
  const refreshedEtfs = pickEtfRefreshHighlights(overlap, marketDate);
  const staleEtfs = pickStaleEtfs(overlap, marketDate);

  if (!sortedRecentEvents.length && !sortedUpcomingEvents.length && !refreshedEtfs.length && !staleEtfs.length) {
    return null;
  }

  return {
    appName: dashboard?.appName ?? '台股主動通',
    marketDate,
    recentEvents: sortedRecentEvents,
    upcomingEvents: sortedUpcomingEvents,
    refreshedEtfs,
    staleEtfs,
  };
}

function formatEventEta(daysUntil) {
  if (daysUntil === 0) return '今天';
  if (daysUntil === 1) return '明天';
  return `${daysUntil} 天後`;
}

export function buildTelegramEventAlertMessage(summary) {
  if (!summary) {
    return null;
  }

  const lines = [
    `<b>${escapeHtml(summary.appName)}｜事件雷達 ${escapeHtml(summary.marketDate)}</b>`,
    '盤後先看明天到三日內的事件節奏，避免隔日才被動追消息。',
  ];

  if (summary.recentEvents.length) {
    lines.push('');
    lines.push('<b>今日已揭露</b>');
    summary.recentEvents.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.label)}｜${escapeHtml(item.topSignalTitle)}｜法人五日 ${escapeHtml(formatNumber(item.total5Day, 0))}`,
      );
      lines.push(`  ${escapeHtml(item.note)}`);
    });
  }

  if (summary.upcomingEvents.length) {
    lines.push('');
    lines.push('<b>三日內事件</b>');
    summary.upcomingEvents.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.label)}｜${escapeHtml(formatEventEta(item.daysUntil))}｜20日 ${escapeHtml(formatPercent(item.return20))}｜ETF ${escapeHtml(formatNumber(item.activeEtfCount, 0))}`,
      );
      lines.push(`  ${escapeHtml(item.note)}`);
    });
  }

  if (summary.refreshedEtfs.length) {
    lines.push('');
    lines.push('<b>今日主動 ETF 已更新</b>');
    summary.refreshedEtfs.forEach((item) => {
      lines.push(`• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜成分異動 ${escapeHtml(formatNumber(item.changeCount, 0))} 檔`);
    });
  }

  if (summary.staleEtfs.length) {
    lines.push('');
    lines.push('<b>ETF 揭露待追蹤</b>');
    lines.push(`• 仍有部分已串接 ETF 未更新到 ${escapeHtml(summary.marketDate)}：${escapeHtml(summary.staleEtfs.map((item) => `${item.code}(${item.disclosureDate})`).join('、'))}`);
  }

  return lines.join('\n');
}

function toEmbedLines(items, formatter) {
  const lines = items.map(formatter).filter(Boolean);
  return lines.length ? lines.join('\n') : '無';
}

export function buildDiscordEventAlertPayload(summary) {
  if (!summary) {
    return null;
  }

  return {
    username: summary.appName,
    avatar_url: 'https://www.twse.com.tw/rsrc/images/brand/favicon.png',
    embeds: [
      {
        title: `${summary.appName}｜事件雷達 ${summary.marketDate}`,
        description: '盤後先看明天到三日內的事件節奏，避免隔日才被動追消息。',
        color: 0x0b699b,
        fields: [
          {
            name: '今日已揭露',
            value: toEmbedLines(
              summary.recentEvents,
              (item) => `• **${item.code} ${item.name}**\n${item.label}｜${item.topSignalTitle}｜法人五日 ${formatNumber(item.total5Day, 0)}\n${item.note}`,
            ),
            inline: false,
          },
          {
            name: '三日內事件',
            value: toEmbedLines(
              summary.upcomingEvents,
              (item) => `• **${item.code} ${item.name}**\n${item.label}｜${formatEventEta(item.daysUntil)}｜20日 ${formatPercent(item.return20)}｜ETF ${formatNumber(item.activeEtfCount, 0)}\n${item.note}`,
            ),
            inline: false,
          },
          {
            name: '今日主動 ETF 已更新',
            value: toEmbedLines(
              summary.refreshedEtfs,
              (item) => `• **${item.code} ${item.name}**\n成分異動 ${formatNumber(item.changeCount, 0)} 檔`,
            ),
            inline: false,
          },
          ...(summary.staleEtfs.length
            ? [
                {
                  name: 'ETF 揭露待追蹤',
                  value: summary.staleEtfs.map((item) => `${item.code}(${item.disclosureDate})`).join('、'),
                  inline: false,
                },
              ]
            : []),
        ],
        footer: {
          text: '僅供研究參考，不構成投資建議。',
        },
        timestamp: new Date(`${summary.marketDate}T11:20:00+08:00`).toISOString(),
      },
    ],
    allowed_mentions: {
      parse: [],
    },
  };
}
