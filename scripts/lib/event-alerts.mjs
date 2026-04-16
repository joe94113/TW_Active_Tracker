import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSelectionRadar } from './selection-radar.mjs';
import { buildThemeMomentumTopics } from '../../src/lib/themeRadar.js';
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
  const rankedStocks = [...stockIndex]
    .sort((left, right) => scoreStock(right) - scoreStock(left))
    .slice(0, 240);

  rankedStocks.forEach((item) => codeSet.add(item.code));
  (dashboard?.法人追蹤?.外資連買 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.法人追蹤?.投信連買 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));
  (dashboard?.法人追蹤?.土洋對作 ?? []).forEach((item) => codeSet.add(String(item.代號 ?? '').trim()));

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
        highlight: contract?.觀察建議?.at(-1) ?? '先看價格與法人方向是否同步。',
        foreignNetOi: foreign?.未平倉淨口數 ?? null,
        dealerNetOi: dealer?.未平倉淨口數 ?? null,
      };
    })
    .filter((item) => item.name && item.latestClose !== null);
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

function buildDiscordSelectionFields(summary) {
  const fields = [];

  if (summary.institutionalResonance.length) {
    fields.push({
      name: '外資 / 投信同步偏多',
      value: summary.institutionalResonance
        .map(
          (item) =>
            `• **${item.code} ${item.name}**\n${item.signalLabel}｜外資 ${formatNumber(item.foreignAccumulated, 0)} / 投信 ${formatNumber(item.trustAccumulated, 0)} 股｜20日 ${formatPercent(item.return20)}`,
        )
        .join('\n'),
      inline: false,
    });
  }

  if (summary.volumeSqueezeRisers.length) {
    fields.push({
      name: '量縮價漲觀察',
      value: summary.volumeSqueezeRisers
        .map(
          (item) =>
            `• **${item.code} ${item.name}**\n單日 ${formatPercent(item.changePercent)}｜量能為 5 日均量 ${formatNumber(item.volumeRatio5, 0)}%｜距 20 日高點 ${formatNumber(item.distanceToHigh20, 1)}%`,
        )
        .join('\n'),
      inline: false,
    });
  }

  if (summary.consolidationWatch.length) {
    fields.push({
      name: '盤整待突破',
      value: summary.consolidationWatch
        .map(
          (item) =>
            `• **${item.code} ${item.name}**\n30 日箱型 ${formatNumber(item.rangePercent, 1)}%｜距箱頂 ${formatNumber(item.distanceToHigh, 1)}%｜MA20 / MA60 差 ${formatNumber(item.maGapPercent, 1)}%｜RSI ${formatNumber(item.rsi, 1)}`,
        )
        .join('\n'),
      inline: false,
    });
  }

  if (summary.themeMomentumTopics.length) {
    fields.push({
      name: '資金轉強題材',
      value: summary.themeMomentumTopics
        .map((item) => {
          const leader = item.leaderStocks?.[0];
          const catchUp = item.catchUpStocks?.[0];
          return `• **${item.title}**\n${item.observation}\n龍頭 ${leader ? `${leader.code} ${leader.name}` : '—'}｜補漲 ${catchUp ? `${catchUp.code} ${catchUp.name}` : '—'}`;
        })
        .join('\n'),
      inline: false,
    });
  }

  return fields;
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
    themeMomentumTopics: buildThemeMomentumTopics(dashboard?.題材雷達, 3),
    ...selectionRadar,
  };

  if (
    !summary.futuresCards.length &&
    !summary.institutionalResonance.length &&
    !summary.volumeSqueezeRisers.length &&
    !summary.consolidationWatch.length &&
    !summary.themeMomentumTopics.length
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
    `<b>${escapeHtml(summary.appName)}｜期貨與選股雷達 ${escapeHtml(summary.marketDate)}</b>`,
    '先看小台、微台的盤後節奏，再補量縮價漲、盤整待突破與雙法人同步布局。',
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

  if (summary.institutionalResonance.length) {
    lines.push('');
    lines.push('<b>外資 / 投信同步偏多</b>');
    summary.institutionalResonance.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.signalLabel)}｜20日 ${escapeHtml(formatPercent(item.return20))}`,
      );
      lines.push(`  外資約 ${escapeHtml(formatNumber(item.foreignAccumulated, 0))} 股 / 投信約 ${escapeHtml(formatNumber(item.trustAccumulated, 0))} 股，可視為中短線同步加倉。`);
    });
  }

  if (summary.volumeSqueezeRisers.length) {
    lines.push('');
    lines.push('<b>量縮價漲觀察</b>');
    summary.volumeSqueezeRisers.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜單日 ${escapeHtml(formatPercent(item.changePercent))}｜量能為 5 日均量 ${escapeHtml(formatNumber(item.volumeRatio5, 0))}%｜距 20 日高點 ${escapeHtml(formatNumber(item.distanceToHigh20, 1))}%`,
      );
      lines.push('  價格先動、量沒有急放大，適合列入續強觀察名單。');
    });
  }

  if (summary.consolidationWatch.length) {
    lines.push('');
    lines.push('<b>盤整待突破</b>');
    summary.consolidationWatch.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜30 日箱型 ${escapeHtml(formatNumber(item.rangePercent, 1))}%｜距箱頂 ${escapeHtml(formatNumber(item.distanceToHigh, 1))}%｜RSI ${escapeHtml(formatNumber(item.rsi, 1))}`,
      );
      lines.push('  若隔日帶量站上箱頂，通常會比中途追高更容易管理風險。');
    });
  }

  if (summary.themeMomentumTopics.length) {
    lines.push('');
    lines.push('<b>資金轉強題材</b>');
    summary.themeMomentumTopics.forEach((item) => {
      const leader = item.leaderStocks?.[0];
      const catchUp = item.catchUpStocks?.[0];
      lines.push(
        `• ${escapeHtml(item.title)}｜${escapeHtml(formatNumber(item.score, 0))} 分｜龍頭 ${escapeHtml(leader ? `${leader.code} ${leader.name}` : '—')}｜補漲 ${escapeHtml(catchUp ? `${catchUp.code} ${catchUp.name}` : '—')}`,
      );
      lines.push(`  ${escapeHtml(item.observation)}`);
    });
  }

  return lines.join('\n');
}

export function buildDiscordEventAlertPayload(summary) {
  if (!summary) {
    return null;
  }

  const eventFields = buildDiscordSelectionFields(summary);

  return {
    username: summary.appName,
    avatar_url: 'https://www.twse.com.tw/rsrc/images/brand/favicon.png',
    embeds: [
      {
        title: `${summary.appName}｜期貨與選股雷達 ${summary.marketDate}`,
        description: '先看小台、微台盤後節奏，再看量縮價漲、盤整待突破與雙法人同步布局。',
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
              title: '選股雷達',
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
