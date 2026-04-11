import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const 根目錄 = process.cwd();
const 資料目錄 = path.join(根目錄, 'public', 'data');
const ETF資料目錄 = path.join(資料目錄, 'etfs');
const 使用者代理 =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const 台北日期格式器 = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const 台北時間格式器 = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function 建立ETF項目({
  code,
  fullName,
  provider,
  providerLabel,
  sourceName,
  sourceUrl,
  trackingStatus,
}) {
  return {
    code,
    name: fullName.replace('主動式交易所交易基金', '').trim(),
    fullName,
    provider,
    providerLabel,
    sourceName,
    sourceUrl,
    trackingStatus,
  };
}

const 追蹤ETF清單 = [
  建立ETF項目({
    code: '00980A',
    fullName: '主動野村臺灣優選主動式交易所交易基金',
    provider: 'nomura',
    providerLabel: '野村投信',
    sourceName: '野村投信 ETF 官方持股資料',
    sourceUrl: 'https://www.nomurafunds.com.tw/ETFWEB/product-description?fundNo=00980A',
    trackingStatus: '已串接',
  }),
  建立ETF項目({
    code: '00982A',
    fullName: '主動群益台灣強棒主動式交易所交易基金',
    provider: 'capital',
    providerLabel: '群益投信',
    sourceName: '群益投信 ETF 官方持股資料',
    sourceUrl: 'https://www.capitalfund.com.tw/etf/product/detail/399/portfolio',
    trackingStatus: '已串接',
  }),
  建立ETF項目({
    code: '00981A',
    fullName: '主動統一台股增長主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '統一投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00981A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00983A',
    fullName: '主動中信ARK創新主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '中信投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00983A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00984A',
    fullName: '主動安聯台灣高息主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '安聯投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00984A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00985A',
    fullName: '主動野村台灣50主動式交易所交易基金',
    provider: 'nomura',
    providerLabel: '野村投信',
    sourceName: '野村投信 ETF 官方持股資料',
    sourceUrl: 'https://www.nomurafunds.com.tw/ETFWEB/product-description?fundNo=00985A',
    trackingStatus: '已串接',
  }),
  建立ETF項目({
    code: '00986A',
    fullName: '主動台新龍頭成長主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '台新投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00986A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00982D',
    fullName: '主動富邦動態入息主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '富邦投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00982D',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00983D',
    fullName: '主動富邦複合收益主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '富邦投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00983D',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00989A',
    fullName: '主動摩根美國科技主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '摩根投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00989A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00988A',
    fullName: '主動統一全球創新主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '統一投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00988A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00991A',
    fullName: '主動復華未來50主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '復華投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00991A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00990A',
    fullName: '主動元大AI新經濟主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '元大投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00990A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00987A',
    fullName: '主動台新優勢成長主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '台新投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00987A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00992A',
    fullName: '主動群益科技創新主動式交易所交易基金',
    provider: 'capital',
    providerLabel: '群益投信',
    sourceName: '群益投信 ETF 官方持股資料',
    sourceUrl: 'https://www.capitalfund.com.tw/etf/product/detail/500/portfolio',
    trackingStatus: '已串接',
  }),
  建立ETF項目({
    code: '00994A',
    fullName: '主動第一金台股優主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '第一金投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00994A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00995A',
    fullName: '主動中信台灣卓越主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '中信投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00995A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00993A',
    fullName: '主動安聯台灣主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '安聯投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00993A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00984D',
    fullName: '主動聯博全球非投主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '聯博投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00984D',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00996A',
    fullName: '主動兆豐台灣豐收主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '兆豐投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00996A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00400A',
    fullName: '主動國泰動能高息主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '國泰投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00400A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00401A',
    fullName: '主動摩根台灣鑫收主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '摩根投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00401A',
    trackingStatus: '待串接',
  }),
  建立ETF項目({
    code: '00997A',
    fullName: '主動群益美國增長主動式交易所交易基金',
    provider: 'pending',
    providerLabel: '群益投信',
    sourceName: 'TWSE ETF 商品頁（官方持股來源待串接）',
    sourceUrl: 'https://www.twse.com.tw/zh/ETFortune/etfInfo/00997A',
    trackingStatus: '待串接',
  }),
];

function 取得現在ISO() {
  return new Date().toISOString();
}

function 正規化日期(value) {
  return String(value ?? '').trim().replaceAll('/', '-');
}

function 取數字(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[,%\s]/g, '').replace(/,/g, '');
  if (!cleaned || cleaned === '-') return null;
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : null;
}

function 壓縮文字(value) {
  return String(value ?? '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function 排序持股(items) {
  return [...items].sort((left, right) => (right.weight ?? 0) - (left.weight ?? 0) || (right.shares ?? 0) - (left.shares ?? 0));
}

function 摘要異動(diff) {
  return {
    addedCount: diff.added.length,
    removedCount: diff.removed.length,
    increasedCount: diff.increased.length,
    decreasedCount: diff.decreased.length,
  };
}

function 建立異動(previousSnapshot, currentSnapshot) {
  const 舊持股 = new Map((previousSnapshot?.holdings ?? []).map((item) => [item.code, item]));
  const 新持股 = new Map((currentSnapshot.holdings ?? []).map((item) => [item.code, item]));

  const diff = {
    code: currentSnapshot.code,
    name: currentSnapshot.name,
    fromDisclosureDate: previousSnapshot?.disclosureDate ?? null,
    toDisclosureDate: currentSnapshot.disclosureDate,
    added: [],
    removed: [],
    increased: [],
    decreased: [],
  };

  for (const item of currentSnapshot.holdings ?? []) {
    const previous = 舊持股.get(item.code);

    if (!previous) {
      diff.added.push({
        code: item.code,
        name: item.name,
        currentShares: item.shares,
        currentWeight: item.weight,
        sharesDelta: item.shares,
        weightDelta: item.weight,
      });
      continue;
    }

    const sharesDelta = (item.shares ?? 0) - (previous.shares ?? 0);
    const weightDelta = (item.weight ?? 0) - (previous.weight ?? 0);

    if (sharesDelta > 0 || (sharesDelta === 0 && weightDelta > 0)) {
      diff.increased.push({
        code: item.code,
        name: item.name,
        previousShares: previous.shares,
        currentShares: item.shares,
        previousWeight: previous.weight,
        currentWeight: item.weight,
        sharesDelta,
        weightDelta,
      });
    } else if (sharesDelta < 0 || (sharesDelta === 0 && weightDelta < 0)) {
      diff.decreased.push({
        code: item.code,
        name: item.name,
        previousShares: previous.shares,
        currentShares: item.shares,
        previousWeight: previous.weight,
        currentWeight: item.weight,
        sharesDelta,
        weightDelta,
      });
    }
  }

  for (const item of previousSnapshot?.holdings ?? []) {
    if (!新持股.has(item.code)) {
      diff.removed.push({
        code: item.code,
        name: item.name,
        previousShares: item.shares,
        previousWeight: item.weight,
        sharesDelta: -(item.shares ?? 0),
        weightDelta: -(item.weight ?? 0),
      });
    }
  }

  const 排序器 = (left, right) => Math.abs(right.weightDelta ?? 0) - Math.abs(left.weightDelta ?? 0);
  diff.added.sort(排序器);
  diff.removed.sort(排序器);
  diff.increased.sort(排序器);
  diff.decreased.sort(排序器);
  diff.summary = 摘要異動(diff);
  return diff;
}

async function 讀取JSON存在則回傳(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function 寫入JSON(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function 抓取HTML(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 使用者代理,
      'accept-language': 'zh-TW,zh;q=0.9',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const big5 = new TextDecoder('big5').decode(bytes);
  const markers = ['condition-date', '基金淨資產價值', '已發行受益權單位總數', '股票'];
  const score = (text) => markers.reduce((total, marker) => total + (text.includes(marker) ? 1 : 0), 0);

  return score(big5) > score(utf8) ? big5 : utf8;
}

async function 抓取Nomura快照(etf) {
  const response = await fetch('https://www.nomurafunds.com.tw/API/ETFAPI/api/Fund/GetFundAssets', {
    method: 'POST',
    headers: {
      'user-agent': 使用者代理,
      'accept-language': 'zh-TW,zh;q=0.9',
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json;charset=UTF-8',
      origin: 'https://www.nomurafunds.com.tw',
      referer: etf.sourceUrl,
    },
    body: JSON.stringify({ FundID: etf.code, SearchDate: null }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const fundAsset = payload?.FundAssets ?? payload?.Data?.FundAssets ?? payload?.fundAssets;
  const stockTable = payload?.StockComposition ?? payload?.Data?.StockComposition ?? payload?.stockComposition;

  if (!fundAsset || !stockTable) {
    throw new Error('野村 ETF 回傳格式已變更');
  }

  const holdings = 排序持股(
    (stockTable.Rows ?? stockTable.Data ?? [])
      .map((row) => ({
        code: 壓縮文字(row?.[0]),
        name: 壓縮文字(row?.[1]),
        shares: 取數字(row?.[2]),
        weight: 取數字(row?.[3]),
      }))
      .filter((item) => /^\d{4,6}$/.test(item.code)),
  );

  return {
    code: etf.code,
    name: etf.name,
    fullName: etf.fullName,
    provider: etf.provider,
    providerLabel: etf.providerLabel,
    sourceName: etf.sourceName,
    sourceUrl: etf.sourceUrl,
    trackingStatus: etf.trackingStatus,
    disclosureDate: 正規化日期(fundAsset.NavDate),
    aum: 取數字(fundAsset.Aum),
    nav: 取數字(fundAsset.Nav),
    units: 取數字(fundAsset.Units),
    holdingsCount: holdings.length,
    holdings,
    fetchedAt: 取得現在ISO(),
  };
}

async function 抓取Capital快照(etf) {
  const html = await 抓取HTML(etf.sourceUrl);
  const disclosureDate = html.match(/id="condition-date"[^>]*value="([^"]+)"/)?.[1];

  if (!disclosureDate) {
    throw new Error('群益 ETF 揭露日期解析失敗');
  }

  const stockSectionIndex = html.indexOf('id="buyback-stocks-section"');
  const summarySection = stockSectionIndex >= 0 ? html.slice(0, stockSectionIndex) : html;
  const summaryValues = Array.from(
    summarySection.matchAll(/class="td cell auto"[^>]*>(?:<span[^>]*>TWD<\/span>)?\s*([\d,.-]+)/g),
    (match) => 取數字(match[1]),
  ).filter((value) => value !== null);

  const [aum, nav, units] = summaryValues;

  const holdings = 排序持股(
    Array.from(
      html.matchAll(
        /<div[^>]*class="tr show-for-medium"[^>]*>\s*<div[^>]*class="th"[^>]*>\s*([^<]+?)\s*<\/div>\s*<div[^>]*class="th"[^>]*>\s*([^<]+?)\s*<\/div>\s*<div[^>]*class="td"[^>]*>\s*([\d.]+)%\s*<\/div>\s*<div[^>]*class="td sm-full"[^>]*>\s*([\d,.-]+)\s*<\/div>\s*<\/div>/gms,
      ),
      (match) => ({
        code: 壓縮文字(match[1]),
        name: 壓縮文字(match[2]),
        weight: 取數字(match[3]),
        shares: 取數字(match[4]),
      }),
    ).filter((item) => /^\d{4,6}[A-Z*]?$/.test(item.code)),
  );

  if (!holdings.length) {
    throw new Error('群益 ETF 持股解析失敗');
  }

  return {
    code: etf.code,
    name: etf.name,
    fullName: etf.fullName,
    provider: etf.provider,
    providerLabel: etf.providerLabel,
    sourceName: etf.sourceName,
    sourceUrl: etf.sourceUrl,
    trackingStatus: etf.trackingStatus,
    disclosureDate: 正規化日期(disclosureDate),
    aum,
    nav,
    units,
    holdingsCount: holdings.length,
    holdings,
    fetchedAt: 取得現在ISO(),
  };
}

async function 抓取ETF快照(etf) {
  if (etf.provider === 'nomura') return 抓取Nomura快照(etf);
  if (etf.provider === 'capital') return 抓取Capital快照(etf);
  throw new Error('官方持股來源尚未串接');
}

async function 清除舊版歷史檔(code) {
  const etfDir = path.join(ETF資料目錄, code);
  await rm(path.join(etfDir, 'history.json'), { force: true });
  await rm(path.join(etfDir, 'snapshots'), { recursive: true, force: true });
}

async function 更新單一ETF(etf) {
  const etfDir = path.join(ETF資料目錄, etf.code);
  const latestPath = path.join(etfDir, 'latest.json');
  const previousPath = path.join(etfDir, 'previous.json');
  const diffPath = path.join(etfDir, 'diff-latest.json');
  let snapshot;

  try {
    snapshot = await 抓取ETF快照(etf);
  } catch (error) {
    const cachedLatest = await 讀取JSON存在則回傳(latestPath);
    const cachedDiff = await 讀取JSON存在則回傳(diffPath);

    if (cachedLatest && cachedDiff) {
      return {
        etf,
        snapshot: cachedLatest,
        diff: cachedDiff,
        cacheNote: error instanceof Error ? error.message : String(error),
      };
    }

    throw error;
  }

  const disclosureDate = 正規化日期(snapshot.disclosureDate);
  const existingLatest = await 讀取JSON存在則回傳(latestPath);
  let previousSnapshot = await 讀取JSON存在則回傳(previousPath);

  if (existingLatest && 正規化日期(existingLatest.disclosureDate) !== disclosureDate) {
    previousSnapshot = existingLatest;
    await 寫入JSON(previousPath, existingLatest);
  }

  const diff = 建立異動(previousSnapshot, snapshot);

  await 寫入JSON(latestPath, snapshot);
  await 寫入JSON(diffPath, diff);
  await 清除舊版歷史檔(etf.code);

  return { etf, snapshot, diff, cacheNote: null };
}

function 轉台北日期(date) {
  return 台北日期格式器.format(date).replaceAll('/', '-');
}

function 轉台北時間(date) {
  return 台北時間格式器.format(date);
}

function 民國日期轉西元(value) {
  const text = String(value ?? '').trim();

  if (!text) return null;

  if (/^\d{7}$/.test(text)) {
    return `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}-${text.slice(5, 7)}`;
  }

  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  return 正規化日期(text);
}

function 轉日期查詢字串(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function 轉期交所日期字串(dateText) {
  const text = String(dateText ?? '').trim();
  if (!text) return null;
  return text.replaceAll('-', '/');
}

function 是否一般股票(code) {
  return /^[1-9]\d{3}$/.test(String(code ?? '').trim());
}

async function 抓取JSON資料(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 使用者代理,
      'accept-language': 'zh-TW,zh;q=0.9',
      accept: 'application/json, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function 計算漲跌幅(收盤價, 漲跌值) {
  if (收盤價 === null || 漲跌值 === null) return null;
  const 前收 = 收盤價 - 漲跌值;
  if (!前收) return null;
  return (漲跌值 / 前收) * 100;
}

function 建立上市股票資料(item) {
  const 收盤價 = 取數字(item.ClosingPrice);
  const 漲跌值 = 取數字(item.Change);

  return {
    代號: 壓縮文字(item.Code),
    名稱: 壓縮文字(item.Name),
    收盤價,
    漲跌值,
    漲跌幅: 計算漲跌幅(收盤價, 漲跌值),
    成交量: 取數字(item.TradeVolume),
    成交值: 取數字(item.TradeValue),
    成交筆數: 取數字(item.Transaction),
  };
}

function 建立熱門股資料(item) {
  const 收盤價 = 取數字(item.ClosingPrice);
  const 漲跌值 = 取數字(`${item.Dir === '-' ? '-' : ''}${item.Change ?? ''}`);

  return {
    代號: 壓縮文字(item.Code),
    名稱: 壓縮文字(item.Name),
    收盤價,
    漲跌值,
    漲跌幅: 計算漲跌幅(收盤價, 漲跌值),
    成交量: 取數字(item.TradeVolume),
    成交筆數: 取數字(item.Transaction),
  };
}

function 建立指數卡片資料(indexRows) {
  const 規則 = [
    { 簡稱: '加權指數', patterns: [/發行量加權股價指數/] },
    { 簡稱: '寶島指數', patterns: [/寶島股價指數/] },
    { 簡稱: '電子類', patterns: [/電子類指數/, /電子工業類指數/, /資訊科技/ ] },
    { 簡稱: '金融類', patterns: [/金融保險類指數/, /金融保險/] },
  ];

  return 規則
    .map((rule) => {
      const row = indexRows.find((item) => rule.patterns.some((pattern) => pattern.test(item['指數'] ?? '')));

      if (!row) return null;

      const 漲跌點數 = 取數字(`${row['漲跌'] === '-' ? '-' : ''}${row['漲跌點數'] ?? ''}`);
      const 指數值 = 取數字(row['收盤指數']);
      const 直接百分比 = 取數字(`${row['漲跌'] === '-' ? '-' : ''}${row['漲跌百分比'] ?? ''}`);
      const 漲跌百分比 =
        直接百分比 !== null
          ? 直接百分比
          : 指數值 !== null && 漲跌點數 !== null && 指數值 !== 漲跌點數
            ? (漲跌點數 / (指數值 - 漲跌點數)) * 100
            : null;

      return {
        簡稱: rule.簡稱,
        名稱: row['指數'],
        指數值,
        漲跌點數,
        漲跌百分比,
        走勢: 漲跌點數 > 0 ? '偏多' : 漲跌點數 < 0 ? '回檔' : '整理',
      };
    })
    .filter(Boolean);
}

function 建立市場觀察摘要({ 大盤摘要, 近五日節奏, 熱門股, 指數卡片 }) {
  const 摘要 = [];
  const 平均成交值 =
    近五日節奏.reduce((total, item) => total + (item.成交值 ?? 0), 0) / (近五日節奏.length || 1);
  const 電子類 = 指數卡片.find((item) => item.簡稱 === '電子類');
  const 強勢股 = 熱門股.filter((item) => (item.漲跌幅 ?? 0) > 0).slice(0, 3);

  if ((大盤摘要.漲跌幅 ?? 0) > 0) {
    摘要.push(`加權指數收在 ${大盤摘要.加權指數} 點之上，單日漲幅 ${大盤摘要.漲跌幅.toFixed(2)}%，盤面仍由多方掌握。`);
  } else if ((大盤摘要.漲跌幅 ?? 0) < 0) {
    摘要.push(`加權指數回落至 ${大盤摘要.加權指數} 點，短線先看量能是否能重新回溫。`);
  } else {
    摘要.push('加權指數接近平盤，短線更適合觀察量價是否重新擴散。');
  }

  if ((大盤摘要.成交值 ?? 0) >= 平均成交值 * 1.05) {
    摘要.push('今日成交值高於近五日均值，代表資金仍積極在主流股之間輪動。');
  } else {
    摘要.push('今日成交值低於近五日均值，追價力道稍微降溫，節奏上宜偏向分批。');
  }

  if (電子類 && (電子類.漲跌百分比 ?? 0) > (大盤摘要.漲跌幅 ?? 0)) {
    摘要.push('電子類指數表現優於大盤，科技股仍是短線人氣核心。');
  }

  if (強勢股.length) {
    摘要.push(`熱門股以 ${強勢股.map((item) => item.名稱).join('、')} 最具人氣，短線可留意是否延續量價結構。`);
  }

  return 摘要.slice(0, 4);
}

async function 抓取市場總覽() {
  const [indexRows, hotRows, intradayRows, trendRows, stockRows] = await Promise.all([
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX20'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/MI_5MINS'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
  ]);

  const 指數卡片 = 建立指數卡片資料(indexRows);
  const 近五日節奏 = [...trendRows]
    .map((item) => ({
      日期: 民國日期轉西元(item.Date),
      指數: 取數字(item.TAIEX),
      漲跌點數: 取數字(item.Change),
      成交量: 取數字(item.TradeVolume),
      成交值: 取數字(item.TradeValue),
      成交筆數: 取數字(item.Transaction),
    }))
    .sort((left, right) => left.日期.localeCompare(right.日期))
    .slice(-5);

  const 最新大盤 = 近五日節奏.at(-1) ?? {};
  const 盤中原始資料 = [...intradayRows].reverse().find((item) => item.AccTradeValue) ?? intradayRows.at(-1) ?? {};
  const 全部個股 = stockRows
    .filter((item) => 是否一般股票(item.Code))
    .map(建立上市股票資料);
  const 個股索引 = new Map(全部個股.map((item) => [item.代號, item]));
  const 熱門股 = hotRows
    .filter((item) => 是否一般股票(item.Code))
    .map(建立熱門股資料)
    .slice(0, 10);
  const 成交排行 = [...全部個股]
    .sort((left, right) => (right.成交值 ?? 0) - (left.成交值 ?? 0))
    .slice(0, 10);
  const 強勢股 = [...全部個股]
    .filter((item) => (item.成交值 ?? 0) >= 300000000 && item.漲跌幅 !== null)
    .sort((left, right) => (right.漲跌幅 ?? -Infinity) - (left.漲跌幅 ?? -Infinity))
    .slice(0, 10);

  const 大盤摘要 = {
    資料日期: 最新大盤.日期 ?? 指數卡片[0]?.日期 ?? null,
    加權指數: 最新大盤.指數 ?? null,
    漲跌點數: 最新大盤.漲跌點數 ?? null,
    漲跌幅: 最新大盤.指數 && 最新大盤.漲跌點數
      ? (最新大盤.漲跌點數 / (最新大盤.指數 - 最新大盤.漲跌點數)) * 100
      : null,
    成交量: 最新大盤.成交量 ?? null,
    成交值: 最新大盤.成交值 ?? null,
    成交筆數: 最新大盤.成交筆數 ?? null,
  };

  return {
    市場總覽: {
      資料日期: 最新大盤.日期 ?? null,
      指數卡片,
      大盤摘要,
      盤中脈動: {
        更新時間: 盤中原始資料.Time ?? null,
        累計委買筆數: 取數字(盤中原始資料.AccBidOrders),
        累計委買張數: 取數字(盤中原始資料.AccBidVolume),
        累計委賣筆數: 取數字(盤中原始資料.AccAskOrders),
        累計委賣張數: 取數字(盤中原始資料.AccAskVolume),
        累計成交筆數: 取數字(盤中原始資料.AccTransaction),
        累計成交張數: 取數字(盤中原始資料.AccTradeVolume),
        累計成交值: 取數字(盤中原始資料.AccTradeValue),
      },
      熱門股,
      成交排行,
      強勢股,
      近五日節奏,
      觀察摘要: 建立市場觀察摘要({ 大盤摘要, 近五日節奏, 熱門股, 指數卡片 }),
      資料說明: [
        'TWSE OpenAPI：MI_INDEX、MI_5MINS、FMTQIK、MI_INDEX20、STOCK_DAY_ALL',
        '熱門股以成交量與成交值為主，並排除 ETF 與受益證券，聚焦上市一般股票。',
      ],
    },
    個股索引,
  };
}

async function 抓取法人日資料(date) {
  const response = await fetch(
    `https://www.twse.com.tw/rwd/zh/fund/T86?date=${轉日期查詢字串(date)}&selectType=ALLBUT0999&response=json`,
    {
      headers: {
        'user-agent': 使用者代理,
        'accept-language': 'zh-TW,zh;q=0.9',
        accept: 'application/json, text/plain, */*',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const payload = JSON.parse(await response.text());
  if (payload.stat !== 'OK' || !Array.isArray(payload.data)) {
    return null;
  }

  return payload;
}

function 建立法人排行資料(row, 個股索引) {
  const 代號 = 壓縮文字(row[0]);
  const 補充資料 = 個股索引.get(代號) ?? {};

  return {
    代號,
    名稱: 壓縮文字(row[1]),
    外資買賣超: 取數字(row[4]),
    投信買賣超: 取數字(row[10]),
    自營商買賣超: 取數字(row[11]),
    三大法人買賣超: 取數字(row[18]),
    收盤價: 補充資料.收盤價 ?? null,
    漲跌幅: 補充資料.漲跌幅 ?? null,
    成交值: 補充資料.成交值 ?? null,
    成交量: 補充資料.成交量 ?? null,
  };
}

function 建立連買資料(日資料清單, 個股索引, key) {
  const 最新資料 = 日資料清單[0]?.資料 ?? [];
  const 其他日資料 = 日資料清單.slice(1);

  return 最新資料
    .filter((item) => (item[key] ?? 0) > 0)
    .map((item) => {
      const 序列 = 日資料清單.map((day) => day.索引.get(item.代號)?.[key] ?? null);

      if (序列.some((value) => value === null || value <= 0)) {
        return null;
      }

      return {
        ...item,
        連買天數: 日資料清單.length,
        累計買超股數: 序列.reduce((total, value) => total + (value ?? 0), 0),
        買超序列: 序列,
        觀察: key === '外資買賣超' ? '外資連買' : '投信連買',
        其他法人態度:
          key === '外資買賣超'
            ? 其他日資料.every((day) => (day.索引.get(item.代號)?.投信買賣超 ?? 0) >= 0)
              ? '投信同步偏多'
              : '投信態度分歧'
            : 其他日資料.every((day) => (day.索引.get(item.代號)?.外資買賣超 ?? 0) >= 0)
              ? '外資同步偏多'
              : '外資態度分歧',
      };
    })
    .filter(Boolean)
    .sort((left, right) => (right.累計買超股數 ?? 0) - (left.累計買超股數 ?? 0))
    .slice(0, 12);
}

function 建立土洋對作資料(日資料清單) {
  const 最新資料 = 日資料清單[0]?.資料 ?? [];

  return 最新資料
    .filter((item) => (item.外資買賣超 ?? 0) * (item.投信買賣超 ?? 0) < 0)
    .map((item) => ({
      ...item,
      訊號: (item.外資買賣超 ?? 0) > 0 ? '外資偏多、投信偏空' : '外資偏空、投信偏多',
      對作強度: Math.abs(item.外資買賣超 ?? 0) + Math.abs(item.投信買賣超 ?? 0),
    }))
    .filter((item) => item.對作強度 >= 3000)
    .sort((left, right) => (right.對作強度 ?? 0) - (left.對作強度 ?? 0))
    .slice(0, 12);
}

async function 抓取法人追蹤(個股索引) {
  const 日資料清單 = [];
  const 起始日 = new Date();

  for (let offset = 1; offset <= 10 && 日資料清單.length < 3; offset += 1) {
    const candidate = new Date(起始日);
    candidate.setDate(candidate.getDate() - offset);
    const payload = await 抓取法人日資料(candidate);

    if (!payload) continue;

    const 資料 = payload.data
      .map((row) => 建立法人排行資料(row, 個股索引))
      .filter((item) => 是否一般股票(item.代號));

    日資料清單.push({
      日期: 民國日期轉西元(payload.date),
      資料,
      索引: new Map(資料.map((item) => [item.代號, item])),
    });
  }

  if (!日資料清單.length) {
    throw new Error('三大法人資料暫時無法取得');
  }

  const 外資連買 = 建立連買資料(日資料清單, 個股索引, '外資買賣超');
  const 投信連買 = 建立連買資料(日資料清單, 個股索引, '投信買賣超');
  const 土洋對作 = 建立土洋對作資料(日資料清單);
  const 觀察摘要 = [];

  if (外資連買.length) {
    觀察摘要.push(`外資連買焦點落在 ${外資連買.slice(0, 3).map((item) => item.名稱).join('、')}，短線偏向順勢資金。`);
  }

  if (投信連買.length) {
    觀察摘要.push(`投信連買以 ${投信連買.slice(0, 3).map((item) => item.名稱).join('、')} 為主，偏向中期布局。`);
  }

  if (土洋對作.length) {
    觀察摘要.push(`${土洋對作[0].名稱} 等個股出現土洋對作，代表短線市場對方向仍有分歧。`);
  } else {
    觀察摘要.push('最新一個交易日沒有特別明顯的土洋對作名單，盤面籌碼分歧略為收斂。');
  }

  return {
    資料日期: 日資料清單[0].日期,
    回溯交易日: 日資料清單.map((item) => item.日期),
    外資連買,
    投信連買,
    土洋對作,
    觀察摘要,
    資料說明: [
      `以最近 ${日資料清單.length} 個有資料的交易日計算連買名單。`,
      '資料來源：TWSE 三大法人買賣超日報（T86），僅納入上市一般股票。',
    ],
  };
}

function 去除HTML標籤(value) {
  return 壓縮文字(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function 解析期貨法人列(rowHtml) {
  const cells = Array.from(rowHtml.matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/gi), (match) => 去除HTML標籤(match[1]));

  if (cells.length < 13) {
    return null;
  }

  const [
    身份別,
    交易多方口數,
    交易多方契約金額,
    交易空方口數,
    交易空方契約金額,
    交易淨口數,
    交易淨契約金額,
    未平倉多方口數,
    未平倉多方契約金額,
    未平倉空方口數,
    未平倉空方契約金額,
    未平倉淨口數,
    未平倉淨契約金額,
  ] = cells;

  return {
    身份別,
    交易多方口數: 取數字(交易多方口數),
    交易多方契約金額: 取數字(交易多方契約金額),
    交易空方口數: 取數字(交易空方口數),
    交易空方契約金額: 取數字(交易空方契約金額),
    交易淨口數: 取數字(交易淨口數),
    交易淨契約金額: 取數字(交易淨契約金額),
    未平倉多方口數: 取數字(未平倉多方口數),
    未平倉多方契約金額: 取數字(未平倉多方契約金額),
    未平倉空方口數: 取數字(未平倉空方口數),
    未平倉空方契約金額: 取數字(未平倉空方契約金額),
    未平倉淨口數: 取數字(未平倉淨口數),
    未平倉淨契約金額: 取數字(未平倉淨契約金額),
  };
}

async function 抓取期貨契約資料(queryDate, commodityId) {
  const response = await fetch('https://www.taifex.com.tw/cht/3/futContractsDate', {
    method: 'POST',
    headers: {
      'user-agent': 使用者代理,
      'accept-language': 'zh-TW,zh;q=0.9',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'content-type': 'application/x-www-form-urlencoded',
      referer: 'https://www.taifex.com.tw/cht/3/futContractsDate',
    },
    body: new URLSearchParams({
      queryType: '1',
      goDay: '',
      doQuery: '1',
      dateaddcnt: '',
      queryDate,
      commodityId,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const match = html.match(
    /<td class="sheet-sticky serial-1" rowspan="3"[\s\S]*?<div[^>]*>\s*(\d+)\s*<\/div><\/td>\s*<td class="sheet-sticky serial-2" rowspan="3"[\s\S]*?<div[^>]*>\s*([^<]+?)\s*<\/div><\/td>([\s\S]*?)<\/TR>\s*<TR class="12bk">([\s\S]*?)<\/TR>\s*<TR class="12bk">([\s\S]*?)<\/TR>/i,
  );

  if (!match) {
    throw new Error(`${commodityId} 期貨資料解析失敗`);
  }

  return {
    商品代碼: commodityId,
    契約名稱: 去除HTML標籤(match[2]),
    法人資料: [match[3], match[4], match[5]].map(解析期貨法人列).filter(Boolean),
  };
}

function 建立期貨觀察建議(契約資料) {
  const 外資 = 契約資料.法人資料.find((item) => item.身份別 === '外資') ?? {};
  const 自營商 = 契約資料.法人資料.find((item) => item.身份別 === '自營商') ?? {};
  const 投信 = 契約資料.法人資料.find((item) => item.身份別 === '投信') ?? {};
  let 方向 = '區間整理';

  if ((外資.未平倉淨口數 ?? 0) > 0 && (自營商.未平倉淨口數 ?? 0) > 0) {
    方向 = '偏多觀察';
  } else if ((外資.未平倉淨口數 ?? 0) < 0 && (自營商.未平倉淨口數 ?? 0) < 0) {
    方向 = '偏空觀察';
  } else if ((外資.未平倉淨口數 ?? 0) === 0) {
    方向 = '中性等待';
  }

  const 建議 = [
    `外資未平倉淨口數 ${外資.未平倉淨口數 ?? 0} 口，自營商未平倉淨口數 ${自營商.未平倉淨口數 ?? 0} 口。`,
    `單日交易淨口數方面，外資 ${外資.交易淨口數 ?? 0} 口，投信 ${投信.交易淨口數 ?? 0} 口，自營商 ${自營商.交易淨口數 ?? 0} 口。`,
  ];

  if (方向 === '偏多觀察') {
    建議.push('外資與自營商站在同一側，若現貨續強，可優先用拉回偏多思維觀察。');
  } else if (方向 === '偏空觀察') {
    建議.push('主要法人同步偏空時，短線更適合保守控槓桿，等待壓力區消化後再行布局。');
  } else {
    建議.push('法人未平倉方向尚未一致，短線以區間操作與風險控管為主。');
  }

  return {
    方向,
    觀察建議: 建議,
  };
}

async function 抓取期貨籌碼(優先日期) {
  const 起始日期 = 優先日期 ? new Date(`${優先日期}T12:00:00+08:00`) : new Date();

  for (let offset = 0; offset < 6; offset += 1) {
    const candidate = new Date(起始日期);
    candidate.setDate(candidate.getDate() - offset);
    const 查詢日期 = 轉期交所日期字串(轉台北日期(candidate));

    try {
      const 契約列表 = await Promise.all([
        抓取期貨契約資料(查詢日期, 'MXF'),
        抓取期貨契約資料(查詢日期, 'TMF'),
      ]);

      const 強化後契約列表 = 契約列表.map((item) => ({
        ...item,
        ...建立期貨觀察建議(item),
      }));

      const 整體建議 = 強化後契約列表.map((item) => `${item.契約名稱}：${item.觀察建議.at(-1)}`);

      return {
        資料日期: 查詢日期.replaceAll('/', '-'),
        契約列表: 強化後契約列表,
        整體建議,
        資料說明: [
          '資料來源：臺灣期貨交易所三大法人區分各商品每日交易資訊。',
          '以小型臺指期貨與微型臺指期貨作為散戶常見觀察標的，內容僅供籌碼研究參考。',
        ],
      };
    } catch (error) {
      if (offset === 5) {
        throw error;
      }
    }
  }

  throw new Error('期貨籌碼資料暫時無法取得');
}

function 建立主動ETF總覽(successes, pending) {
  return {
    全部檔數: 追蹤ETF清單.length,
    已串接檔數: successes.length,
    待串接檔數: pending.length,
    已串接ETF: successes.map((item) => ({
      code: item.etf.code,
      name: item.etf.name,
      disclosureDate: item.snapshot.disclosureDate,
    })),
    待串接ETF: pending,
  };
}

function 建立共同持股(successes) {
  const map = new Map();

  for (const result of successes) {
    for (const holding of result.snapshot.holdings ?? []) {
      if (!map.has(holding.code)) {
        map.set(holding.code, {
          code: holding.code,
          name: holding.name,
          持有ETF: [],
        });
      }

      map.get(holding.code).持有ETF.push({
        etfCode: result.etf.code,
        etfName: result.etf.name,
        weight: holding.weight,
        shares: holding.shares,
      });
    }
  }

  return [...map.values()]
    .filter((item) => item.持有ETF.length >= 2)
    .map((item) => ({
      ...item,
      出現ETF數: item.持有ETF.length,
      平均權重:
        item.持有ETF.reduce((total, member) => total + (member.weight ?? 0), 0) / item.持有ETF.length,
      ETF代號: item.持有ETF.map((member) => member.etfCode),
    }))
    .sort((left, right) => (right.出現ETF數 ?? 0) - (left.出現ETF數 ?? 0) || (right.平均權重 ?? 0) - (left.平均權重 ?? 0))
    .slice(0, 30);
}

function 建立異動統計(successes, fieldName) {
  const map = new Map();

  for (const result of successes) {
    for (const item of result.diff[fieldName] ?? []) {
      if (!map.has(item.code)) {
        map.set(item.code, {
          code: item.code,
          name: item.name,
          清單: [],
        });
      }

      map.get(item.code).清單.push({
        etfCode: result.etf.code,
        etfName: result.etf.name,
        sharesDelta: item.sharesDelta ?? null,
        weightDelta: item.weightDelta ?? null,
      });
    }
  }

  const 全部項目 = [...map.values()].map((item) => ({
    ...item,
    出現ETF數: item.清單.length,
    ETF代號: item.清單.map((member) => member.etfCode),
  }));

  return {
    共同: 全部項目
      .filter((item) => item.出現ETF數 >= 2)
      .sort((left, right) => (right.出現ETF數 ?? 0) - (left.出現ETF數 ?? 0))
      .slice(0, 20),
    不重複: 全部項目
      .filter((item) => item.出現ETF數 === 1)
      .map((item) => ({
        code: item.code,
        name: item.name,
        etfCode: item.清單[0]?.etfCode,
        etfName: item.清單[0]?.etfName,
        sharesDelta: item.清單[0]?.sharesDelta ?? null,
        weightDelta: item.清單[0]?.weightDelta ?? null,
      }))
      .sort((left, right) => Math.abs(right.weightDelta ?? 0) - Math.abs(left.weightDelta ?? 0))
      .slice(0, 30),
  };
}

function 建立ETF重疊分析(successes) {
  const 新增統計 = 建立異動統計(successes, 'added');
  const 剔除統計 = 建立異動統計(successes, 'removed');
  const 加碼統計 = 建立異動統計(successes, 'increased');
  const 減碼統計 = 建立異動統計(successes, 'decreased');

  return {
    appName: '台股主動通',
    產生時間: 取得現在ISO(),
    最新揭露日期: successes.map((item) => item.snapshot.disclosureDate).sort().at(-1) ?? null,
    已串接ETF數: successes.length,
    已串接ETF: successes.map((item) => ({
      code: item.etf.code,
      name: item.etf.name,
      disclosureDate: item.snapshot.disclosureDate,
    })),
    共同持股: 建立共同持股(successes),
    共同新增: 新增統計.共同,
    共同剔除: 剔除統計.共同,
    共同加碼: 加碼統計.共同,
    共同減碼: 減碼統計.共同,
    不重複異動: {
      新增: 新增統計.不重複,
      剔除: 剔除統計.不重複,
      加碼: 加碼統計.不重複,
      減碼: 減碼統計.不重複,
    },
    各ETF異動摘要: successes.map((item) => ({
      code: item.etf.code,
      name: item.etf.name,
      disclosureDate: item.snapshot.disclosureDate,
      summary: item.diff.summary,
    })),
    資料說明: [
      '共同項目代表同一個異動在 2 檔以上已串接的主動式 ETF 同時出現。',
      '不重複異動只列出目前僅出現在單一 ETF 的標的，方便快速找出特色持股。',
    ],
  };
}

async function main() {
  await mkdir(ETF資料目錄, { recursive: true });

  const successes = [];
  const failures = [];
  const pending = [];

  for (const etf of 追蹤ETF清單) {
    if (etf.trackingStatus !== '已串接') {
      pending.push({
        code: etf.code,
        name: etf.name,
        fullName: etf.fullName,
        providerLabel: etf.providerLabel,
        sourceName: etf.sourceName,
        sourceUrl: etf.sourceUrl,
        trackingStatus: etf.trackingStatus,
      });
      continue;
    }

    try {
      const result = await 更新單一ETF(etf);
      successes.push(result);
      console.log(`[完成] ${etf.code} ${result.snapshot.disclosureDate}`);
    } catch (error) {
      failures.push({
        code: etf.code,
        name: etf.name,
        providerLabel: etf.providerLabel,
        message: error instanceof Error ? error.message : String(error),
      });
      console.error(`[失敗] ${etf.code}`, error);
    }
  }

  const 現在 = new Date();
  const { 市場總覽, 個股索引 } = await 抓取市場總覽();
  const 法人追蹤 = await 抓取法人追蹤(個股索引);
  const 期貨籌碼 = await 抓取期貨籌碼(市場總覽.資料日期);
  const 主動ETF總覽 = 建立主動ETF總覽(successes, pending);
  const ETF重疊分析 = 建立ETF重疊分析(successes);
  const dashboard = {
    appName: '台股主動通',
    generatedAt: 取得現在ISO(),
    市場總覽,
    法人追蹤,
    期貨籌碼,
    主動ETF總覽,
    免責聲明: [
      '本站資料來自公開官方來源與投信揭露頁面，僅供資訊整理與研究參考。',
      '首頁的籌碼觀察與交易建議屬於統計推論，不構成任何投資建議。',
    ],
  };
  const manifest = {
    appName: '台股主動通',
    generatedAt: 取得現在ISO(),
    generatedAtLocalDate: 轉台北日期(現在),
    generatedAtLocalTime: 轉台北時間(現在),
    dashboardPath: 'data/dashboard.json',
    overlapPath: 'data/etf-overlap.json',
    trackedEtfs: 追蹤ETF清單,
    latestOverview: 追蹤ETF清單.map((etf) => {
      const result = successes.find((item) => item.etf.code === etf.code);
      return {
        code: etf.code,
        name: etf.name,
        fullName: etf.fullName,
        provider: etf.provider,
        providerLabel: etf.providerLabel,
        sourceName: etf.sourceName,
        sourceUrl: etf.sourceUrl,
        trackingStatus: etf.trackingStatus,
        disclosureDate: result?.snapshot.disclosureDate ?? null,
        nav: result?.snapshot.nav ?? null,
        aum: result?.snapshot.aum ?? null,
        holdingsCount: result?.snapshot.holdingsCount ?? 0,
        trackingMessage:
          result?.cacheNote
            ? `官方來源暫時無法更新，先沿用最近一次成功快取：${result.cacheNote}`
            : etf.trackingStatus === '已串接'
              ? '官方來源每日同步'
              : '官方持股來源待串接',
        changeSummary: result?.diff.summary ?? {
          addedCount: 0,
          removedCount: 0,
          increasedCount: 0,
          decreasedCount: 0,
        },
      };
    }),
    latestDisclosureDate: ETF重疊分析.最新揭露日期,
    connectedCount: successes.length,
    pendingEtfs: pending,
    failedEtfs: failures,
    sources: [
      ...追蹤ETF清單.map((etf) => ({
        code: etf.code,
        sourceName: etf.sourceName,
        sourceUrl: etf.sourceUrl,
      })),
      { code: 'TWSE', sourceName: 'TWSE OpenAPI', sourceUrl: 'https://openapi.twse.com.tw/' },
    ],
    storagePolicy: '每檔 ETF 僅保留 latest.json、previous.json、diff-latest.json，方便和前一日比較。',
  };

  await 寫入JSON(path.join(資料目錄, 'dashboard.json'), dashboard);
  await 寫入JSON(path.join(資料目錄, 'etf-overlap.json'), ETF重疊分析);
  await 寫入JSON(path.join(資料目錄, 'manifest.json'), manifest);

  if (failures.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

