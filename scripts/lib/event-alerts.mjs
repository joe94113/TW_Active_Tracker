import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildStockEventCalendar } from '../../src/lib/stockInsights.js';
import { formatNumber, formatPercent, formatTaipeiDate } from './close-digest.mjs';

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

function resolveAlertMarketDate(dashboard) {
  return (
    normalizeDateKey(dashboard?.市場總覽?.即時狀態?.marketDate) ??
    normalizeDateKey(dashboard?.市場總覽?.大盤摘要?.資料日期) ??
    normalizeDateKey(dashboard?.市場總覽?.盤中脈動?.資料日期) ??
    normalizeDateKey(dashboard?.市場總覽?.資料日期) ??
    null
  );
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

function buildCandidateCodeSet({ dashboard, stockIndex }) {
  const codeSet = new Set();
  const rankedStocks = [...stockIndex]
    .sort((left, right) => scoreStock(right) - scoreStock(left))
    .slice(0, 240);

  rankedStocks.forEach((item) => codeSet.add(item.code));
  (dashboard?.法人追蹤?.外資連買 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.法人追蹤?.投信連買 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.法人追蹤?.土洋對作 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));

  return [...codeSet].filter((code) => /^\d{4,6}$/.test(code));
}

function mapEventPriority(event, score) {
  const label = String(event?.label ?? '');
  const isRevenue = label.includes('月營收');
  const isQuarter = label.includes('季報');
  const isEtf = label.includes('ETF');
  const base = isRevenue ? 32 : isQuarter ? 26 : isEtf ? 18 : 14;

  return base + score;
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

function pickEtfRefreshHighlights(overlap, marketDate) {
  return [...(overlap?.已串接ETF ?? [])]
    .filter((item) => normalizeDateKey(item.disclosureDate) === marketDate)
    .map((item) => ({
      code: item.code,
      name: item.name,
      changeCount:
        (item.changeSummary?.totalChangeCount ?? 0) ||
        (item.changeSummary?.addedCount ?? 0) +
          (item.changeSummary?.removedCount ?? 0) +
          (item.changeSummary?.increasedCount ?? 0) +
          (item.changeSummary?.decreasedCount ?? 0),
    }))
    .filter((item) => (item.changeCount ?? 0) > 0)
    .sort((left, right) => (right.changeCount ?? 0) - (left.changeCount ?? 0))
    .slice(0, 5);
}

function pickStaleEtfs(overlap, marketDate) {
  return [...(overlap?.已串接ETF ?? [])]
    .map((item) => ({
      code: item.code,
      name: item.name,
      disclosureDate: normalizeDateKey(item.disclosureDate),
    }))
    .filter((item) => item.disclosureDate && item.disclosureDate < marketDate)
    .sort((left, right) => String(left.disclosureDate).localeCompare(String(right.disclosureDate)))
    .slice(0, 5);
}

function pickIdentityRow(contract, identity) {
  return (contract?.法人資料 ?? []).find((item) => item.身份別 === identity) ?? null;
}

function pickFuturesCards(dashboard) {
  return [...(dashboard?.期貨籌碼?.契約列表 ?? [])]
    .slice(0, 2)
    .map((contract) => {
      const technicalData = contract?.技術面資料 ?? {};
      const history = (technicalData?.歷史資料 ?? []).filter((item) => Number.isFinite(Number(item?.close)));
      const latestSummary = technicalData?.最新摘要 ?? {};
      const latestIndicators = technicalData?.最新指標 ?? {};
      const foreign = pickIdentityRow(contract, '外資');
      const dealer = pickIdentityRow(contract, '自營商');

      return {
        code: contract?.商品代碼 ?? technicalData?.code ?? null,
        name: contract?.契約名稱 ?? technicalData?.name ?? null,
        latestDate: technicalData?.priceDate ?? dashboard?.期貨籌碼?.資料日期 ?? null,
        latestClose: latestSummary.close ?? history.at(-1)?.close ?? null,
        changePercent: latestSummary.changePercent ?? history.at(-1)?.changePercent ?? null,
        return20: latestSummary.return20 ?? null,
        rsi: latestIndicators.rsi14 ?? latestIndicators.rsi ?? null,
        macdHist: latestIndicators.macdHist ?? null,
        direction: contract?.方向 ?? '區間整理',
        highlight: contract?.觀察建議?.at(-1) ?? '先看價格與法人方向是否同步。',
        foreignNetOi: foreign?.未平倉淨口數 ?? null,
        dealerNetOi: dealer?.未平倉淨口數 ?? null,
      };
    })
    .filter((item) => item.name && item.latestClose !== null);
}

function formatEventEta(daysUntil) {
  if (daysUntil === 0) return '今天';
  if (daysUntil === 1) return '明天';
  return `${daysUntil} 天後`;
}

function formatFuturesSummaryLine(item) {
  return `• ${item.name}｜收 ${formatNumber(item.latestClose, 0)}｜單日 ${formatPercent(item.changePercent)}｜20日 ${formatPercent(item.return20)}｜RSI ${formatNumber(item.rsi, 1)}｜${item.direction}`;
}

function buildFuturesDiscordDescription(item) {
  const lines = [
    `收 ${formatNumber(item.latestClose, 0)} ｜ 單日 ${formatPercent(item.changePercent)} ｜ 20日 ${formatPercent(item.return20)}`,
    `RSI ${formatNumber(item.rsi, 1)} ｜ MACD柱 ${formatNumber(item.macdHist, 1)} ｜ 日線 ${item.latestDate ?? '-'}`,
  ];

  lines.push(`外資 OI ${formatNumber(item.foreignNetOi, 0)} ｜ 自營 OI ${formatNumber(item.dealerNetOi, 0)}`);
  lines.push(item.highlight ?? '先看價格與法人方向是否同步。');

  return lines.join('\n');
}

function buildDiscordEventFields(summary) {
  const fields = [];

  if (summary.upcomingEvents.length) {
    fields.push({
      name: '三日內事件',
      value: summary.upcomingEvents
        .map(
          (item) =>
            `• **${item.code} ${item.name}**\n${item.label}｜${formatEventEta(item.daysUntil)}｜20日 ${formatPercent(item.return20)}｜ETF ${formatNumber(item.activeEtfCount, 0)}\n${item.note}`,
        )
        .join('\n'),
      inline: false,
    });
  }

  if (summary.recentEvents.length) {
    fields.push({
      name: '今日已揭露',
      value: summary.recentEvents
        .map(
          (item) =>
            `• **${item.code} ${item.name}**\n${item.label}｜${item.topSignalTitle}｜法人五日 ${formatNumber(item.total5Day, 0)}\n${item.note}`,
        )
        .join('\n'),
      inline: false,
    });
  }

  if (summary.refreshedEtfs.length) {
    fields.push({
      name: '主動 ETF 有異動',
      value: summary.refreshedEtfs
        .map((item) => `• **${item.code} ${item.name}**\n成分異動 ${formatNumber(item.changeCount, 0)} 檔`)
        .join('\n'),
      inline: false,
    });
  }

  if (summary.staleEtfs.length) {
    fields.push({
      name: 'ETF 揭露待追蹤',
      value: summary.staleEtfs.map((item) => `${item.code}(${item.disclosureDate})`).join('、'),
      inline: false,
    });
  }

  return fields;
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

  const summary = {
    appName: dashboard?.appName ?? '台股主動通',
    marketDate,
    futuresCards: pickFuturesCards(dashboard),
    recentEvents: recentEvents.sort((left, right) => right.priority - left.priority).slice(0, 4),
    upcomingEvents: upcomingEvents.sort((left, right) => left.daysUntil - right.daysUntil || right.priority - left.priority).slice(0, 4),
    refreshedEtfs: pickEtfRefreshHighlights(overlap, marketDate),
    staleEtfs: pickStaleEtfs(overlap, marketDate),
  };

  if (
    !summary.futuresCards.length &&
    !summary.recentEvents.length &&
    !summary.upcomingEvents.length &&
    !summary.refreshedEtfs.length &&
    !summary.staleEtfs.length
  ) {
    return null;
  }

  return summary;
}

export function buildTelegramEventAlertMessage(summary) {
  if (!summary) {
    return null;
  }

  const lines = [
    `<b>${escapeHtml(summary.appName)}｜期貨與事件雷達 ${escapeHtml(summary.marketDate)}</b>`,
    '先看小台、微台的盤後節奏，再補三日內真正會影響隔日節奏的事件。',
  ];

  if (summary.futuresCards.length) {
    lines.push('');
    lines.push('<b>期貨風向球</b>');
    summary.futuresCards.forEach((item) => {
      lines.push(formatFuturesSummaryLine(item));
      lines.push(
        `  外資 OI ${escapeHtml(formatNumber(item.foreignNetOi, 0))}｜自營 OI ${escapeHtml(formatNumber(item.dealerNetOi, 0))}｜日線 ${escapeHtml(item.latestDate ?? '-')}`,
      );
      lines.push(`  ${escapeHtml(item.highlight ?? '先看價格與法人方向是否同步。')}`);
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

  if (summary.refreshedEtfs.length) {
    lines.push('');
    lines.push('<b>主動 ETF 有異動</b>');
    summary.refreshedEtfs.forEach((item) => {
      lines.push(`• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜成分異動 ${escapeHtml(formatNumber(item.changeCount, 0))} 檔`);
    });
  }

  if (summary.staleEtfs.length) {
    lines.push('');
    lines.push('<b>ETF 揭露待追蹤</b>');
    lines.push(`• ${escapeHtml(summary.staleEtfs.map((item) => `${item.code}(${item.disclosureDate})`).join('、'))}`);
  }

  return lines.join('\n');
}

export function buildDiscordEventAlertPayload(summary) {
  if (!summary) {
    return null;
  }

  const eventFields = buildDiscordEventFields(summary);

  return {
    username: summary.appName,
    avatar_url: 'https://www.twse.com.tw/rsrc/images/brand/favicon.png',
    embeds: [
      {
        title: `${summary.appName}｜期貨與事件雷達 ${summary.marketDate}`,
        description: '先看小台、微台的盤後節奏，再補三日內真正會影響隔日買賣的事件。',
        color: 0x0b699b,
        footer: {
          text: '僅供研究參考，不構成投資建議。',
        },
        timestamp: new Date(`${summary.marketDate}T18:40:00+08:00`).toISOString(),
      },
      ...summary.futuresCards.map((item) => ({
        title: `${item.name}｜${item.direction}`,
        description: buildFuturesDiscordDescription(item),
        color: Number(item.changePercent ?? 0) >= 0 ? 0xdc4c4c : 0x1f9d72,
        footer: {
          text: `期貨日線 ${item.latestDate ?? '-'}`,
        },
      })),
      ...(eventFields.length
        ? [
            {
              title: '隔日事件與 ETF 追蹤',
              color: 0x22466d,
              fields: eventFields,
            },
          ]
        : []),
    ],
    allowed_mentions: {
      parse: [],
    },
  };
}
