import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSelectionRadar } from './selection-radar.mjs';
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
  const rankedStocks = [...(stockIndex ?? [])]
    .sort((left, right) => scoreStock(right) - scoreStock(left))
    .slice(0, 240);

  rankedStocks.forEach((item) => codeSet.add(String(item.code ?? '').trim()));
  (dashboard?.法人追蹤?.外資連買 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.法人追蹤?.投信連買 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.法人追蹤?.土洋對作 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.市場總覽?.熱門股 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.市場總覽?.成交排行 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.市場總覽?.強勢股 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));

  return [...codeSet].filter((code) => /^\d{4,6}$/.test(code));
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
        highlight: contract?.觀察建議?.at(-1) ?? '留意法人未平倉是否開始同方向加碼。',
        foreignNetOi: foreign?.未平倉淨口數 ?? null,
        dealerNetOi: dealer?.未平倉淨口數 ?? null,
      };
    })
    .filter((item) => item.name && item.latestClose !== null);
}

function buildSelectionFocusList(selectionRadar, limit = 4) {
  const usedCodes = new Set();
  const focusList = [];
  const buckets = [
    {
      label: '雙法人偏多',
      items: selectionRadar.institutionalResonance ?? [],
      detail: (item) =>
        `外資 ${formatNumber(item.foreignAccumulated, 0)} / 投信 ${formatNumber(item.trustAccumulated, 0)}｜20 日 ${formatPercent(item.return20)}`,
    },
    {
      label: '量縮價漲',
      items: selectionRadar.volumeSqueezeRisers ?? [],
      detail: (item) =>
        `單日 ${formatPercent(item.changePercent)}｜量比 5 日 ${formatNumber(item.volumeRatio5, 0)}%｜距 20 日高 ${formatNumber(item.distanceToHigh20, 1)}%`,
    },
    {
      label: '盤整待發',
      items: selectionRadar.consolidationWatch ?? [],
      detail: (item) =>
        `30 日箱體 ${formatNumber(item.rangePercent, 1)}%｜離箱頂 ${formatNumber(item.distanceToHigh, 1)}%｜RSI ${formatNumber(item.rsi, 1)}`,
    },
  ];

  for (const bucket of buckets) {
    for (const item of bucket.items) {
      const code = String(item?.code ?? '').trim();

      if (!code || usedCodes.has(code)) {
        continue;
      }

      usedCodes.add(code);
      focusList.push({
        code,
        name: item.name,
        label: bucket.label,
        detail: bucket.detail(item),
      });

      if (focusList.length >= limit) {
        return focusList;
      }
    }
  }

  return focusList;
}

function formatFuturesSummaryLine(item) {
  return `• ${item.name}｜收 ${formatNumber(item.latestClose, 0)}｜單日 ${formatPercent(item.changePercent)}｜20 日 ${formatPercent(item.return20)}｜RSI ${formatNumber(item.rsi, 1)}｜${item.direction}`;
}

function buildFuturesDiscordField(item) {
  return [
    `收 ${formatNumber(item.latestClose, 0)}｜單日 ${formatPercent(item.changePercent)}｜20 日 ${formatPercent(item.return20)}`,
    `RSI ${formatNumber(item.rsi, 1)}｜MACD 柱 ${formatNumber(item.macdHist, 1)}｜日線 ${item.latestDate ?? '-'}`,
    `外資 OI ${formatNumber(item.foreignNetOi, 0)}｜自營 OI ${formatNumber(item.dealerNetOi, 0)}`,
    item.highlight ?? '留意法人未平倉是否開始同方向加碼。',
  ].join('\n');
}

export async function loadEventAlertData() {
  const [dashboard, stockIndex] = await Promise.all([
    readJson(path.join('public', 'data', 'dashboard.json')),
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
    stockIndex,
    stockDetailList,
  };
}

export function buildEventAlertSummary({ dashboard, stockIndex, stockDetailList, today = formatTaipeiDate() }) {
  const marketDate = resolveAlertMarketDate(dashboard);

  if (marketDate !== today) {
    return null;
  }

  const selectionRadar = buildSelectionRadar({
    dashboard,
    stockMetaList: stockIndex,
    stockDetailList,
  });

  const summary = {
    appName: dashboard?.appName ?? '台股主動通',
    marketDate,
    futuresCards: pickFuturesCards(dashboard),
    focusList: buildSelectionFocusList(selectionRadar),
  };

  if (!summary.futuresCards.length && !summary.focusList.length) {
    return null;
  }

  return summary;
}

export function buildTelegramEventAlertMessage(summary) {
  if (!summary) {
    return null;
  }

  const lines = [
    `<b>${escapeHtml(summary.appName)}｜盤後快看 ${escapeHtml(summary.marketDate)}</b>`,
    '先看小台 / 微台方向，再看今晚最值得打開個股頁的名單。',
  ];

  if (summary.futuresCards.length) {
    lines.push('');
    lines.push('<b>期貨風向球</b>');
    summary.futuresCards.forEach((item) => lines.push(formatFuturesSummaryLine(item)));
  }

  if (summary.focusList.length) {
    lines.push('');
    lines.push('<b>今晚先看</b>');
    summary.focusList.forEach((item) => {
      lines.push(`• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.label)}`);
      lines.push(`  ${escapeHtml(item.detail)}`);
    });
  }

  return lines.join('\n');
}

export function buildDiscordEventAlertPayload(summary) {
  if (!summary) {
    return null;
  }

  const embeds = [
    {
      title: `${summary.appName}｜盤後快看 ${summary.marketDate}`,
      description: '先看小台 / 微台方向，再看今晚最值得打開個股頁的名單。',
      color: 0x0b699b,
      footer: {
        text: '僅供研究參考，不構成投資建議。',
      },
      timestamp: new Date(`${summary.marketDate}T18:40:00+08:00`).toISOString(),
    },
    ...(summary.futuresCards.length
      ? [
          {
            title: '期貨風向球',
            color: 0x22466d,
            fields: summary.futuresCards.map((item) => ({
              name: item.name,
              value: buildFuturesDiscordField(item),
              inline: false,
            })),
          },
        ]
      : []),
    ...(summary.focusList.length
      ? [
          {
            title: '今晚先看',
            color: 0x13885e,
            fields: summary.focusList.map((item) => ({
              name: `${item.code} ${item.name}｜${item.label}`,
              value: item.detail,
              inline: false,
            })),
          },
        ]
      : []),
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
