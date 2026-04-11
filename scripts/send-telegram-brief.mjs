import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const taipeiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatTaipeiDate(date = new Date()) {
  return taipeiDateFormatter.format(date);
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}%`;
}

function formatSigned(value, digits = 2) {
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

function buildMessage({ dashboard, overlap, trackedStocks, today }) {
  const marketDate = dashboard?.市場總覽?.資料日期 ?? null;

  if (marketDate !== today) {
    return null;
  }

  const marketSummary = dashboard?.市場總覽?.大盤摘要 ?? {};
  const marketBreadth = dashboard?.市場總覽?.市場廣度 ?? {};
  const observations = (dashboard?.市場總覽?.觀察摘要 ?? []).slice(0, 2);
  const bullishSignals = pickSignalStocks(trackedStocks, 'up');
  const bearishSignals = pickSignalStocks(trackedStocks, 'down');
  const etfHighlights = pickEtfHighlights(overlap);
  const staleEtfs = (overlap?.已串接ETF ?? [])
    .filter((item) => item.disclosureDate && item.disclosureDate !== marketDate)
    .slice(0, 5);

  const lines = [
    `<b>台股主動通｜盤後重點 ${escapeHtml(marketDate)}</b>`,
    `加權指數 ${escapeHtml(formatNumber(marketSummary.加權指數))}（${escapeHtml(formatSigned(marketSummary.漲跌點數))} / ${escapeHtml(formatPercent(marketSummary.漲跌幅))}）`,
    `市場情緒 ${escapeHtml(marketBreadth.市場情緒 ?? '整理中')}｜上漲 ${escapeHtml(formatNumber(marketBreadth?.股票市場?.上漲, 0))} / 下跌 ${escapeHtml(formatNumber(marketBreadth?.股票市場?.下跌, 0))} / 強弱比 ${escapeHtml(formatNumber(marketBreadth?.強弱比))}`,
  ];

  if (observations.length) {
    lines.push('');
    lines.push('<b>大盤觀察</b>');
    observations.forEach((item) => {
      lines.push(`• ${escapeHtml(item)}`);
    });
  }

  if (bullishSignals.length) {
    lines.push('');
    lines.push('<b>偏多技術訊號</b>');
    bullishSignals.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.topSignalTitle)}｜20日 ${escapeHtml(formatPercent(item.return20))}｜法人五日 ${escapeHtml(formatNumber(item.total5Day, 0))}`,
      );
    });
  }

  if (bearishSignals.length) {
    lines.push('');
    lines.push('<b>偏弱技術訊號</b>');
    bearishSignals.forEach((item) => {
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.topSignalTitle)}｜20日 ${escapeHtml(formatPercent(item.return20))}｜法人五日 ${escapeHtml(formatNumber(item.total5Day, 0))}`,
      );
    });
  }

  if (etfHighlights.length) {
    lines.push('');
    lines.push('<b>主動 ETF 風向球</b>');
    etfHighlights.forEach((item) => {
      const exposureText = item.出現ETF數 ? `${item.出現ETF數} 檔同步` : `${item.etfCode} ${item.etfName}`;
      lines.push(
        `• ${escapeHtml(item.code)} ${escapeHtml(item.name)}｜${escapeHtml(item.bucket)}｜${escapeHtml(exposureText)}｜權重變化 ${escapeHtml(formatPercent(item.weightDelta))}`,
      );
    });
  }

  if (staleEtfs.length) {
    lines.push('');
    lines.push('<b>ETF 揭露追蹤</b>');
    lines.push(`• 以下已串接 ETF 最新揭露日仍非 ${escapeHtml(marketDate)}：${escapeHtml(staleEtfs.map((item) => `${item.code}(${item.disclosureDate})`).join('、'))}`);
  }

  return lines.join('\n');
}

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('Skip Telegram push: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.');
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram send failed: ${response.status} ${errorText}`);
  }
}

async function main() {
  const today = formatTaipeiDate();
  const [dashboard, overlap, trackedStocks] = await Promise.all([
    readJson(path.join('public', 'data', 'dashboard.json')),
    readJson(path.join('public', 'data', 'etf-overlap.json')),
    readJson(path.join('public', 'data', 'stocks', 'index.json')),
  ]);

  const message = buildMessage({
    dashboard,
    overlap,
    trackedStocks,
    today,
  });

  if (!message) {
    console.log(`Skip Telegram push: market date does not match today (${today}).`);
    return;
  }

  await sendTelegramMessage(message);
  console.log(`Telegram push sent for ${today}.`);
}

await main();
