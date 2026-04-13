import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import * as XLSX from 'xlsx';
import {
  buildIndicatorRows,
  buildTechnicalSignalSummary,
  calculateWindowReturn,
  defaultIndicatorSettings,
  summarizeSignalTitles,
} from '../src/lib/technicalAnalysis.js';
import { decodeHtmlEntities, extractNewsKeywords, stripHtml } from '../src/lib/newsKeywords.js';

const 根目錄 = process.cwd();
const 資料目錄 = path.join(根目錄, 'public', 'data');
const ETF資料目錄 = path.join(資料目錄, 'etfs');
const 個股新聞資料目錄 = path.join(資料目錄, 'stocks', 'news');
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
  providerConfig = {},
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
    providerConfig,
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
    provider: 'ctbc',
    providerLabel: '中信投信',
    sourceName: '中信投信 ETF 官方持股資料',
    sourceUrl: 'https://www.ctbcinvestments.com.tw/CTWEB/Content/ETF/pcd.aspx?ETF_ID=00983A',
    trackingStatus: '已串接',
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
    provider: 'taishin',
    providerLabel: '台新投信',
    sourceName: '台新投信 ETF 官方持股資料',
    sourceUrl: 'https://www.tsit.com.tw/ETF/Home/ETFSeriesDetail/00986A',
    trackingStatus: '已串接',
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
    provider: 'jpm',
    providerLabel: '摩根投信',
    sourceName: '摩根投信 ETF 官方估值檔案',
    sourceUrl: 'https://am.jpmorgan.com/tw/zh/asset-management/twetf/products/jpmorgan-taiwan-u-s-tech-leaders-active-etf-tw00000989a5',
    trackingStatus: '已串接',
    providerConfig: {
      xlsxUrl:
        'https://am.jpmorgan.com/content/dam/jpm-am-aem/asiapacific/tw/zh/regulatory/etf-supplement/jpm_apac_tw_etf_pcf_updates_00989A_TW00000989A5.xlsx',
    },
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
    provider: 'fh',
    providerLabel: '復華投信',
    sourceName: '復華投信 ETF 官方持股資料',
    sourceUrl: 'https://www.fhtrust.com.tw/ETF/etf_detail/ETF23',
    trackingStatus: '已串接',
  }),
  建立ETF項目({
    code: '00990A',
    fullName: '主動元大AI新經濟主動式交易所交易基金',
    provider: 'yuanta',
    providerLabel: '元大投信',
    sourceName: '元大投信 ETF 官方持股資料',
    sourceUrl: 'https://www.yuantaetfs.com/product/detail/00990A/ratio',
    trackingStatus: '已串接',
  }),
  建立ETF項目({
    code: '00987A',
    fullName: '主動台新優勢成長主動式交易所交易基金',
    provider: 'taishin',
    providerLabel: '台新投信',
    sourceName: '台新投信 ETF 官方持股資料',
    sourceUrl: 'https://www.tsit.com.tw/ETF/Home/ETFSeriesDetail/00987A',
    trackingStatus: '已串接',
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
    provider: 'first',
    providerLabel: '第一金投信',
    sourceName: '第一金投信 ETF 官方持股 API',
    sourceUrl: 'https://www.fsitc.com.tw/FundDetail.aspx?ID=150',
    trackingStatus: '已串接',
    providerConfig: {
      fundApiId: '182',
    },
  }),
  建立ETF項目({
    code: '00995A',
    fullName: '主動中信台灣卓越主動式交易所交易基金',
    provider: 'ctbc',
    providerLabel: '中信投信',
    sourceName: '中信投信 ETF 官方持股資料',
    sourceUrl: 'https://www.ctbcinvestments.com.tw/CTWEB/Content/ETF/pcd.aspx?ETF_ID=00995A',
    trackingStatus: '已串接',
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
    provider: 'mega',
    providerLabel: '兆豐投信',
    sourceName: '兆豐投信 ETF 官方持股資料',
    sourceUrl: 'https://www.megafunds.com.tw/MEGA/etf/etf_product.aspx?id=23',
    trackingStatus: '已串接',
  }),
  建立ETF項目({
    code: '00400A',
    fullName: '主動國泰動能高息主動式交易所交易基金',
    provider: 'cathay',
    providerLabel: '國泰投信',
    sourceName: '國泰投信 ETF 官方 API',
    sourceUrl: 'https://www.cathaysite.com.tw/ETF/00400A',
    trackingStatus: '已串接',
    providerConfig: {
      fundCode: 'EA',
    },
  }),
  建立ETF項目({
    code: '00401A',
    fullName: '主動摩根台灣鑫收主動式交易所交易基金',
    provider: 'jpm',
    providerLabel: '摩根投信',
    sourceName: '摩根投信 ETF 官方估值檔案',
    sourceUrl: 'https://am.jpmorgan.com/tw/zh/asset-management/twetf/products/jpmorgan-taiwan-taiwan-equity-high-income-active-etf-tw00000401a1',
    trackingStatus: '已串接',
    providerConfig: {
      xlsxUrl:
        'https://am.jpmorgan.com/content/dam/jpm-am-aem/asiapacific/tw/zh/regulatory/etf-supplement/jpm_apac_tw_etf_pcf_updates_00401A_TW00000401A1.xlsx',
    },
  }),
  建立ETF項目({
    code: '00997A',
    fullName: '主動群益美國增長主動式交易所交易基金',
    provider: 'capital',
    providerLabel: '群益投信',
    sourceName: '群益投信 ETF 官方持股資料',
    sourceUrl: 'https://www.capitalfund.com.tw/etf/product/detail/502/portfolio',
    trackingStatus: '待串接',
  }),
];

const 上市公司綜合損益端點 = [
  {
    類別: '一般業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci',
  },
  {
    類別: '金融業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_basi',
  },
  {
    類別: '證券期貨業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_bd',
  },
  {
    類別: '金控業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_fh',
  },
  {
    類別: '保險業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ins',
  },
  {
    類別: '異業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_mim',
  },
];

const 上市公司資產負債端點 = [
  {
    類別: '一般業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap07_L_ci',
  },
  {
    類別: '金融業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap07_L_basi',
  },
  {
    類別: '證券期貨業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap07_L_bd',
  },
  {
    類別: '金控業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap07_L_fh',
  },
  {
    類別: '保險業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap07_L_ins',
  },
  {
    類別: '異業',
    url: 'https://openapi.twse.com.tw/v1/opendata/t187ap07_L_mim',
  },
];

function 取得現在ISO(date = new Date()) {
  return date.toISOString();
}

function 正規化日期(value) {
  const text = String(value ?? '').trim().replaceAll('/', '-');
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  return text.replace(/\s.+$/, '');
}

function 正規化年月(value) {
  const text = String(value ?? '').trim().replaceAll('/', '-');
  if (!text) return null;

  if (/^\d{5}$/.test(text)) {
    return `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}`;
  }

  if (/^\d{6}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}`;
  }

  return text;
}

function 取數字(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/,/g, '').replace(/[^\d.+-]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : null;
}

function 壓縮文字(value) {
  return String(value ?? '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function 取第一個欄位(row, 欄位清單) {
  for (const 欄位 of 欄位清單) {
    const value = row?.[欄位];

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string' && !value.trim()) {
      continue;
    }

    return value;
  }

  return null;
}

function 取第一個文字(row, 欄位清單) {
  const value = 取第一個欄位(row, 欄位清單);
  return value === null ? null : 壓縮文字(value);
}

function 取第一個數字(row, 欄位清單) {
  const value = 取第一個欄位(row, 欄位清單);
  return value === null ? null : 取數字(value);
}

function 是否台股證券代號(code) {
  return /^[1-9]\d{3}$/.test(String(code ?? '').trim());
}

function 排序持股(items) {
  return [...items].sort((left, right) => (right.weight ?? 0) - (left.weight ?? 0) || (right.shares ?? 0) - (left.shares ?? 0));
}

function 摘要異動(diff) {
  return {
    comparisonReady: Boolean(diff.fromDisclosureDate),
    addedCount: diff.added.length,
    removedCount: diff.removed.length,
    increasedCount: diff.increased.length,
    decreasedCount: diff.decreased.length,
    totalChangeCount:
      diff.added.length +
      diff.removed.length +
      diff.increased.length +
      diff.decreased.length,
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
    comparisonReady: Boolean(previousSnapshot?.disclosureDate),
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
    if (error instanceof SyntaxError) {
      const raw = await readFile(filePath, 'utf8').catch(() => '');
      if (raw.includes('<<<<<<<') || raw.includes('=======') || raw.includes('>>>>>>>')) {
        console.warn(`[警告] 偵測到 Git 衝突標記，忽略舊 JSON：${filePath}`);
        return null;
      }
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
  const markers = ['condition-date', '基金淨資產價值', '已發行受益權單位總數', '基金資產', '股票', '股票代碼'];
  const score = (text) => markers.reduce((total, marker) => total + (text.includes(marker) ? 1 : 0), 0);

  return score(big5) > score(utf8) ? big5 : utf8;
}

async function 抓取文字(url, accept = 'text/plain, text/html, application/xml;q=0.9, */*;q=0.8') {
  const response = await fetch(url, {
    headers: {
      'user-agent': 使用者代理,
      'accept-language': 'zh-TW,zh;q=0.9',
      accept,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function 解析RSS欄位(itemText, tagName) {
  return itemText.match(new RegExp(`<${tagName}(?:[^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'i'))?.[1] ?? null;
}

function 建立Google新聞搜尋網址(code, name) {
  const query = `${name} ${code} when:7d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
}

function 建立Google新聞頁面網址(code, name) {
  const query = `${name} ${code}`;
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
}

function 解析Google新聞RSS(xmlText) {
  const items = Array.from(xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g), (match) => {
    const body = match[1];
    const title = stripHtml(解析RSS欄位(body, 'title'));
    const link = decodeHtmlEntities(stripHtml(解析RSS欄位(body, 'link')));
    const pubDate = stripHtml(解析RSS欄位(body, 'pubDate'));
    const source = stripHtml(解析RSS欄位(body, 'source'));
    const summary = stripHtml(解析RSS欄位(body, 'description'));
    const publishedTime = pubDate ? new Date(pubDate) : null;

    if (!title || !link) {
      return null;
    }

    return {
      title,
      link,
      source: source || null,
      summary: summary || null,
      publishedAt: publishedTime && !Number.isNaN(publishedTime.getTime()) ? publishedTime.toISOString() : null,
    };
  }).filter(Boolean);

  return items.slice(0, 12);
}

async function 抓取個股新聞(item) {
  const today = 轉台北日期(new Date());
  const existing = await 讀取JSON存在則回傳(path.join(個股新聞資料目錄, `${item.code}.json`));

  if (existing?.generatedAtLocalDate === today && existing?.items?.length) {
    return existing;
  }

  try {
    const xmlText = await 抓取文字(建立Google新聞搜尋網址(item.code, item.name), 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5');
    const newsItems = 解析Google新聞RSS(xmlText);
    const keywords = extractNewsKeywords(newsItems, {
      code: item.code,
      name: item.name,
      aliases: [item.name],
    });
    const payload = {
      code: item.code,
      name: item.name,
      generatedAt: 取得現在ISO(),
      generatedAtLocalDate: today,
      sourceName: 'Google News RSS',
      sourceUrl: 建立Google新聞頁面網址(item.code, item.name),
      keywords,
      items: newsItems,
    };

    await 寫入JSON(path.join(個股新聞資料目錄, `${item.code}.json`), payload);
    return payload;
  } catch (error) {
    if (existing?.items?.length) {
      return {
        ...existing,
        cacheNote: error instanceof Error ? error.message : String(error),
      };
    }

    await 寫入JSON(path.join(個股新聞資料目錄, `${item.code}.json`), {
      code: item.code,
      name: item.name,
      generatedAt: 取得現在ISO(),
      generatedAtLocalDate: today,
      sourceName: 'Google News RSS',
      sourceUrl: 建立Google新聞頁面網址(item.code, item.name),
      keywords: [],
      items: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

async function 批次抓取個股新聞(items, concurrency = 8) {
  const results = [];
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      const result = await 抓取個股新聞(items[index]);
      if (result) {
        results.push(result);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker()));
  return results;
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

async function 抓取CTBC快照(etf) {
  const html = await 抓取HTML(etf.sourceUrl);
  const disclosureDate = html.match(/id="Label_AUM01">([^<]+)</)?.[1];
  const aum = 取數字(html.match(/id="Label_AUM02">([^<]+)</)?.[1]);
  const units = 取數字(html.match(/id="Label_AUM03">([^<]+)</)?.[1]);
  const nav = 取數字(html.match(/id="Label_AUM04">([^<]+)</)?.[1]);
  const holdings = 排序持股(
    Array.from(
      html.matchAll(
        /<tr>\s*<td>\s*([^<]+?)\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>\s*<td>\s*([\d,.-]+)\s*<\/td>\s*<td>\s*([\d.]+)\s*<\/td>\s*<\/tr>/gms,
      ),
      (match) => ({
        code: 壓縮文字(match[1]),
        name: 壓縮文字(match[2]),
        shares: 取數字(match[3]),
        weight: 取數字(match[4]),
      }),
    ).filter((item) => item.code && item.name),
  );

  if (!disclosureDate || !holdings.length) {
    throw new Error('中信 ETF 持股解析失敗');
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

async function 抓取Taishin快照(etf) {
  const html = await 抓取HTML(etf.sourceUrl);
  const disclosureDate =
    html.match(/id="PUB_DATE"[^>]*value="([^"]+)"/)?.[1] ??
    html.match(/id="DATA_DATE"[^>]*value="([^"]+)"/)?.[1];
  const 所有欄位 = new Map(
    Array.from(
      html.matchAll(/<th>\s*([\s\S]*?)\s*<\/th>\s*<td>\s*([\s\S]*?)\s*<\/td>/g),
      (match) => [去除HTML標籤(match[1]), 去除HTML標籤(match[2])],
    ),
  );

  const aum = 取數字(所有欄位.get('基金淨資產價值(元)'));
  const nav = 取數字(所有欄位.get('每受益權單位淨資產價值(元)'));
  const units = 取數字(所有欄位.get('已發行受益權單位總數(單位)') ?? 所有欄位.get('已發行受益權單位總數'));
  const holdings = 排序持股(
    Array.from(
      html.matchAll(
        /<tr>\s*<td>\s*([A-Z0-9 ]+)\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>\s*<td>\s*([\d,.-]+)\s*<\/td>\s*<td>\s*([\d.]+)%\s*<\/td>\s*<\/tr>/gms,
      ),
      (match) => ({
        code: 壓縮文字(match[1]).replace(/\s+TT$/i, ''),
        name: 壓縮文字(match[2]),
        shares: 取數字(match[3]),
        weight: 取數字(match[4]),
      }),
    ).filter((item) => item.code && item.name),
  );

  if (!disclosureDate || !holdings.length) {
    throw new Error('台新 ETF 持股解析失敗');
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

async function 抓取Yuanta快照(etf) {
  const html = await 抓取HTML(etf.sourceUrl);
  const script = html.match(/window\.__NUXT__=\(function[\s\S]+?\);<\/script>/)?.[0]?.replace(/<\/script>$/, '');

  if (!script) {
    throw new Error('元大 ETF 頁面資料節點不存在');
  }

  const context = { window: {} };
  vm.runInNewContext(script, context);
  const weightData = context.window.__NUXT__?.data?.find((item) => item?.weightData)?.weightData;
  const pcf = weightData?.PCF;
  const stockWeights = weightData?.FundWeights?.StockWeights;

  if (!pcf || !Array.isArray(stockWeights)) {
    throw new Error('元大 ETF 資料格式已變更');
  }

  const holdings = 排序持股(
    stockWeights.map((item) => ({
      code: 壓縮文字(item.code),
      name: 壓縮文字(item.name || item.ename),
      shares: 取數字(item.qty),
      weight: 取數字(item.weights),
    })),
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
    disclosureDate: 正規化日期(pcf.anndate),
    aum: 取數字(pcf.totalav),
    nav: 取數字(pcf.nav),
    units: 取數字(pcf.osunit),
    holdingsCount: holdings.length,
    holdings,
    fetchedAt: 取得現在ISO(),
  };
}

async function 抓取FH快照(etf) {
  const html = await 抓取HTML(etf.sourceUrl);
  const 所有欄位 = new Map(
    Array.from(
      html.matchAll(/<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g),
      (match) => [去除HTML標籤(match[1]), 去除HTML標籤(match[2])],
    ),
  );
  const 所有日期 = Array.from(html.matchAll(/\d{4}\/\d{2}\/\d{2}/g), (match) => match[0]);
  const disclosureDate = 所有日期.sort().at(-1) ?? null;

  const aum = 取數字(所有欄位.get('基金資產淨值'));
  const nav = 取數字(所有欄位.get('基金每單位淨值'));
  const units = 取數字(所有欄位.get('基金在外流通單位數'));
  const holdings = 排序持股(
    Array.from(
      html.matchAll(
        /<tr[^>]*>\s*<td[^>]*>\s*<span[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]*?<td[^>]*>\s*<span[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]*?<td[^>]*>\s*<span[^>]*>\s*([\d,.-]+)\s*<\/span>[\s\S]*?<td[^>]*>\s*<span[^>]*>\s*([\d,.-]+)\s*<\/span>[\s\S]*?<td[^>]*>\s*<span[^>]*>\s*([\d.]+)%\s*<\/span>[\s\S]*?<\/tr>/gms,
      ),
      (match) => ({
        code: 壓縮文字(match[1]),
        name: 壓縮文字(match[2]),
        shares: 取數字(match[3]),
        weight: 取數字(match[5]),
      }),
    ).filter((item) => item.code && item.name),
  );

  if (!disclosureDate || !holdings.length) {
    throw new Error('復華 ETF 持股解析失敗');
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

async function 抓取第一金快照(etf) {
  const fundApiId = etf.providerConfig?.fundApiId;

  if (!fundApiId) {
    throw new Error('第一金 ETF 缺少 fundApiId 設定');
  }

  const [summaryPayload, holdingsPayload] = await Promise.all([
    POST抓取JSON資料('https://www.fsitc.com.tw/WebAPI.aspx/Get_BuySellA', { pStrFundID: fundApiId, pStrDate: '' }, etf.sourceUrl),
    POST抓取JSON資料('https://www.fsitc.com.tw/WebAPI.aspx/Get_hd', { pStrFundID: fundApiId, pStrDate: '' }, etf.sourceUrl),
  ]);

  const summaryRows = JSON.parse(summaryPayload?.d ?? '[]');
  const holdingsRows = JSON.parse(holdingsPayload?.d ?? '[]');
  const summaryMap = new Map(
    summaryRows
      .filter((row) => row?.A && row?.B)
      .map((row) => [壓縮文字(row.A), 壓縮文字(row.B)]),
  );
  const holdings = holdingsRows
    .filter((row) => row?.group === '1' && row?.A && row?.B)
    .map((row) => ({
      code: 壓縮文字(row.A),
      name: 壓縮文字(row.B),
      shares: 取數字(row.D),
      weight: 取數字(row.C),
    }))
    .filter((item) => item.code && item.name);

  if (!holdings.length) {
    throw new Error('第一金 ETF 持股解析失敗');
  }

  return 建立ETF快照(etf, {
    disclosureDate: holdingsRows.find((row) => row?.sdate)?.sdate ?? summaryRows.find((row) => row?.sdate)?.sdate,
    aum: 取數字(summaryMap.get('基金淨資產價值(元)')),
    nav: 取數字(summaryMap.get('每受益權單位淨資產價值(元)-台幣交易')),
    units: 取數字(summaryMap.get('已發行受益權單位總數-台幣交易')),
    holdings,
  });
}

async function 抓取兆豐快照(etf) {
  const html = await 抓取HTML(etf.sourceUrl);
  const 資產欄位 = new Map(
    Array.from(
      html.matchAll(/<div class="si-title">\s*([\s\S]*?)\s*<\/div>\s*<div class="si-amount">\s*([\d,.-]+)\s*<\/div>/g),
      (match) => [去除HTML標籤(match[1]), 去除HTML標籤(match[2])],
    ),
  );
  const holdings = Array.from(
    html.matchAll(
      /<div class="common-mobile-table">[\s\S]*?<div class="item-title">股票代號<\/div>\s*<div class="item-content">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="common-table-item">[\s\S]*?<div class="item-title">股票名稱<\/div>\s*<div class="item-content">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="common-table-item">[\s\S]*?<div class="item-title">股數<\/div>\s*<div class="item-content">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="common-table-item">[\s\S]*?<div class="item-title">持股權重<\/div>\s*<div class="item-content">([\d.,\s%-]+)<\/div>/g,
    ),
    (match) => ({
      code: 去除HTML標籤(match[1]),
      name: 去除HTML標籤(match[2]),
      shares: 取數字(match[3]),
      weight: 取數字(match[4]),
    }),
  ).filter((item) => item.code && item.name);

  if (!holdings.length) {
    throw new Error('兆豐 ETF 持股解析失敗');
  }

  return 建立ETF快照(etf, {
    disclosureDate: html.match(/資料來源：[^，]+，\s*(\d{4}\/\d{2}\/\d{2})/)?.[1],
    aum: 取數字(資產欄位.get('淨資產價值')),
    nav: 取數字(資產欄位.get('每單位淨值')),
    units: 取數字(資產欄位.get('在外流通單位數')),
    holdings,
  });
}

async function 抓取國泰快照(etf) {
  const fundCode = etf.providerConfig?.fundCode;

  if (!fundCode) {
    throw new Error('國泰 ETF 缺少 fundCode 設定');
  }

  const baseUrl = 'https://cwapi.cathaysite.com.tw/api/ETF';
  const query = `fundCode=${encodeURIComponent(fundCode)}`;
  const [assetsPayload, weightsPayload] = await Promise.all([
    抓取JSON資料(`${baseUrl}/GetETFAssets?${query}`),
    抓取JSON資料(`${baseUrl}/GetIndexStockWeights?${query}`),
  ]);

  const assets = assetsPayload?.result;
  const weights = weightsPayload?.result?.stockWeights ?? [];

  if (!assets || !weights.length) {
    throw new Error('國泰 ETF 官方 API 回傳格式已變更');
  }

  const holdings = weights
    .map((item) => ({
      code: 壓縮文字(item.stockCode),
      name: 壓縮文字(item.stockName),
      shares: null,
      weight: 取數字(item.weights),
    }))
    .filter((item) => item.code && item.name);

  return 建立ETF快照(etf, {
    disclosureDate: weightsPayload?.result?.date ?? assets.preDate,
    aum: 取數字(assets.fundNav),
    nav: 取數字(assets.fundPerNav),
    units: 取數字(assets.fundOutstandingShares),
    holdings,
  });
}

async function 抓取摩根快照(etf) {
  const xlsxUrl = etf.providerConfig?.xlsxUrl;

  if (!xlsxUrl) {
    throw new Error('摩根 ETF 缺少 xlsxUrl 設定');
  }

  const response = await fetch(xlsxUrl, {
    headers: {
      'user-agent': 使用者代理,
      'accept-language': 'zh-TW,zh;q=0.9',
      referer: etf.sourceUrl,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
  const summaryHeaderIndex = rows.findIndex((row) => row?.[0] === 'Record Type' && row.includes('Fund Ticker'));
  const detailHeaderIndex = rows.findIndex(
    (row, index) => index > summaryHeaderIndex && row?.[0] === 'Record Type' && row.includes('Constituent Ticker'),
  );

  if (summaryHeaderIndex < 0 || detailHeaderIndex < 0) {
    throw new Error('摩根 ETF XLSX 欄位格式已變更');
  }

  const summaryHeaders = rows[summaryHeaderIndex];
  const summaryValues = rows[summaryHeaderIndex + 1];
  const detailHeaders = rows[detailHeaderIndex];
  const summary = Object.fromEntries(summaryHeaders.map((header, index) => [header, summaryValues?.[index] ?? null]));
  const totalMarketValue =
    取數字(summary['Estimated Total Market Value']) ?? 取數字(summary['Estimated NAV']) ?? null;
  const holdings = rows
    .slice(detailHeaderIndex + 1)
    .filter((row) => row?.[0] === 'D')
    .map((row) => Object.fromEntries(detailHeaders.map((header, index) => [header, row[index] ?? null])))
    .map((item) => {
      const marketValue = 取數字(item['Market Value Base']);
      const weight = totalMarketValue && marketValue !== null ? Number(((marketValue / totalMarketValue) * 100).toFixed(4)) : null;

      return {
        code: 壓縮文字(item['Constituent Ticker']),
        name: 壓縮文字(item['Constituent Description']),
        shares: 取數字(item['Shares or PAR Amount']),
        weight,
      };
    })
    .filter((item) => item.code && item.name);

  if (!holdings.length) {
    throw new Error('摩根 ETF XLSX 持股解析失敗');
  }

  return 建立ETF快照(etf, {
    disclosureDate: summary['Valuation Date'],
    aum: 取數字(summary['Estimated NAV']),
    nav: 取數字(summary['Estimated NAV per Share']),
    units: 取數字(summary['Outstanding Shares']),
    holdings,
  });
}

async function 抓取ETF快照(etf) {
  if (etf.provider === 'nomura') return 抓取Nomura快照(etf);
  if (etf.provider === 'capital') return 抓取Capital快照(etf);
  if (etf.provider === 'ctbc') return 抓取CTBC快照(etf);
  if (etf.provider === 'taishin') return 抓取Taishin快照(etf);
  if (etf.provider === 'yuanta') return 抓取Yuanta快照(etf);
  if (etf.provider === 'fh') return 抓取FH快照(etf);
  if (etf.provider === 'first') return 抓取第一金快照(etf);
  if (etf.provider === 'mega') return 抓取兆豐快照(etf);
  if (etf.provider === 'cathay') return 抓取國泰快照(etf);
  if (etf.provider === 'jpm') return 抓取摩根快照(etf);
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
  return 是否台股證券代號(code);
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

async function 抓取文字資料(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 使用者代理,
      'accept-language': 'zh-TW,zh;q=0.9',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function POST抓取JSON資料(url, body, referer) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'user-agent': 使用者代理,
      'accept-language': 'zh-TW,zh;q=0.9',
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json; charset=utf-8',
      ...(referer ? { referer } : {}),
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function 建立ETF快照(etf, { disclosureDate, aum = null, nav = null, units = null, holdings = [] }) {
  const 排序後持股 = 排序持股(holdings);

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
    holdingsCount: 排序後持股.length,
    holdings: 排序後持股,
    fetchedAt: 取得現在ISO(),
  };
}

function 取得Yahoo區間(monthCount) {
  if (monthCount >= 12) return '1y';
  if (monthCount >= 6) return '6mo';
  return '3mo';
}

function 補上日線漲跌資料(rows) {
  return rows
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((item, index, list) => {
      const previousClose = index > 0 ? list[index - 1]?.close ?? null : null;
      const change = item.close !== null && previousClose !== null ? item.close - previousClose : null;
      const changePercent = previousClose ? (change / previousClose) * 100 : null;

      return {
        ...item,
        change,
        changePercent,
      };
    });
}

async function 抓取Yahoo歷史日線(代號清單, monthCount = 6) {
  const range = 取得Yahoo區間(monthCount);
  let payload = null;
  let result = null;
  let quote = null;
  let timestamps = [];
  let 最後錯誤 = null;

  for (const 代號 of 代號清單) {
    try {
      payload = await 抓取JSON資料(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(代號)}?interval=1d&range=${range}&includeAdjustedClose=true`,
      );
      result = payload.chart?.result?.[0];
      quote = result?.indicators?.quote?.[0];
      timestamps = result?.timestamp ?? [];

      if (quote && timestamps.length) {
        break;
      }
    } catch (error) {
      最後錯誤 = error;
    }
  }

  if (!quote || !timestamps.length) {
    throw 最後錯誤 ?? new Error(`${代號清單.join(', ')} 歷史日線資料不足`);
  }

  const rows = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: quote.open?.[index] ?? null,
      high: quote.high?.[index] ?? null,
      low: quote.low?.[index] ?? null,
      close: quote.close?.[index] ?? null,
      volume: quote.volume?.[index] ?? null,
      turnover: null,
      transactions: null,
    }))
    .filter((item) => item.date && item.close !== null && item.open !== null && item.high !== null && item.low !== null);

  return 補上日線漲跌資料(rows);
}

function 解析CSV欄位(line) {
  const cells = [];
  let current = '';
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuote && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }

    if (char === ',' && !inQuote) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((item) => item.trim());
}

function 解析CSV文字(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(解析CSV欄位);
}

function 格式化期交所下載日期(date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function 加入天數(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function 抓取證券歷史日線(code, monthCount = 6) {
  return 抓取Yahoo歷史日線([`${code}.TW`, `${code}.TWO`], monthCount);
}

async function 抓取指數歷史日線(symbol, monthCount = 6) {
  return 抓取Yahoo歷史日線([symbol], monthCount);
}

async function 抓取Yahoo盤中分時(代號清單) {
  let payload = null;
  let result = null;
  let quote = null;
  let timestamps = [];
  let 最後錯誤 = null;

  for (const 代號 of 代號清單) {
    try {
      payload = await 抓取JSON資料(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(代號)}?interval=5m&range=1d&includePrePost=false`,
      );
      result = payload.chart?.result?.[0];
      quote = result?.indicators?.quote?.[0];
      timestamps = result?.timestamp ?? [];

      if (quote && timestamps.length) {
        break;
      }
    } catch (error) {
      最後錯誤 = error;
    }
  }

  if (!quote || !timestamps.length) {
    throw 最後錯誤 ?? new Error(`${代號清單.join(', ')} 盤中分時資料不足`);
  }

  const previousClose = result.meta?.chartPreviousClose ?? result.meta?.previousClose ?? null;
  const points = timestamps
    .map((timestamp, index) => {
      const price = quote.close?.[index] ?? null;
      if (price === null) return null;

      const change = previousClose !== null ? price - previousClose : null;
      const changePercent = previousClose ? (change / previousClose) * 100 : null;

      return {
        timestamp,
        dateTime: new Date(timestamp * 1000).toISOString(),
        time: 轉台北時間(new Date(timestamp * 1000)).slice(0, 5),
        price,
        high: quote.high?.[index] ?? null,
        low: quote.low?.[index] ?? null,
        volume: quote.volume?.[index] ?? null,
        change,
        changePercent,
      };
    })
    .filter(Boolean);

  if (!points.length) {
    throw new Error(`${代號清單.join(', ')} 盤中分時資料為空`);
  }

  return {
    interval: '5m',
    marketDate: points.at(-1)?.dateTime?.slice(0, 10) ?? null,
    updatedAt: result.meta?.regularMarketTime
      ? new Date(result.meta.regularMarketTime * 1000).toISOString()
      : points.at(-1)?.dateTime ?? null,
    previousClose,
    latestPrice: result.meta?.regularMarketPrice ?? points.at(-1)?.price ?? null,
    high: result.meta?.regularMarketDayHigh ?? null,
    low: result.meta?.regularMarketDayLow ?? null,
    volume: result.meta?.regularMarketVolume ?? null,
    points,
    資料來源: ['Yahoo Finance Chart API'],
  };
}

async function 抓取期貨歷史日線(商品代碼, 優先日期 = null, monthCount = 6) {
  const 行情代碼映射 = {
    MXF: 'MTX',
    TMF: 'TMF',
  };
  const 行情代碼 = 行情代碼映射[商品代碼] ?? 商品代碼;
  const 結束日期 = 優先日期 ? new Date(`${優先日期}T12:00:00+08:00`) : new Date();
  const 開始日期 = new Date(結束日期);
  開始日期.setMonth(開始日期.getMonth() - monthCount);
  const 依日期索引 = new Map();

  for (let 區間起點 = new Date(開始日期); 區間起點 <= 結束日期; ) {
    const 區間終點 = 加入天數(區間起點, 27);
    if (區間終點 > 結束日期) {
      區間終點.setTime(結束日期.getTime());
    }

    const response = await fetch('https://www.taifex.com.tw/cht/3/futDataDown', {
      method: 'POST',
      headers: {
        'user-agent': 使用者代理,
        'accept-language': 'zh-TW,zh;q=0.9',
        accept: 'text/csv,*/*',
        'content-type': 'application/x-www-form-urlencoded',
        referer: 'https://www.taifex.com.tw/cht/3/futDailyMarketView',
      },
      body: new URLSearchParams({
        down_type: '1',
        queryStartDate: 格式化期交所下載日期(區間起點),
        queryEndDate: 格式化期交所下載日期(區間終點),
        commodity_id: 行情代碼,
        commodity_id2: '',
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`${商品代碼} 行情下載失敗：HTTP ${response.status} ${response.statusText}`);
    }

    const csvText = new TextDecoder('big5').decode(await response.arrayBuffer());
    const [header, ...rows] = 解析CSV文字(csvText);

    if (!header?.length) {
      區間起點 = 加入天數(區間終點, 1);
      continue;
    }

    const 欄位索引 = Object.fromEntries(header.map((item, index) => [item, index]));

    for (const row of rows) {
      const 交易日期 = 正規化日期(row[欄位索引['交易日期']]);
      const 交易時段 = 壓縮文字(row[欄位索引['交易時段']]);

      if (!交易日期 || 交易時段 !== '一般') {
        continue;
      }

      const 成交量 = 取數字(row[欄位索引['成交量']]);
      const 收盤價 = 取數字(row[欄位索引['收盤價']]);
      const 結算價 = 取數字(row[欄位索引['結算價']]);
      const 有效結算價 = 結算價 !== null && 結算價 > 0 ? 結算價 : null;
      const 有效收盤價 = 收盤價 !== null && 收盤價 > 0 ? 收盤價 : null;
      const 候選資料 = {
        date: 交易日期,
        contractMonth: 壓縮文字(row[欄位索引['到期月份(週別)']]),
        open: 取數字(row[欄位索引['開盤價']]),
        high: 取數字(row[欄位索引['最高價']]),
        low: 取數字(row[欄位索引['最低價']]),
        close: 有效結算價 ?? 有效收盤價,
        volume: 成交量,
        turnover: null,
        transactions: null,
      };

      if (
        候選資料.open === null ||
        候選資料.high === null ||
        候選資料.low === null ||
        候選資料.close === null ||
        候選資料.open <= 0 ||
        候選資料.high <= 0 ||
        候選資料.low <= 0 ||
        候選資料.close <= 0
      ) {
        continue;
      }

      const 舊資料 = 依日期索引.get(交易日期);
      if (!舊資料 || (候選資料.volume ?? 0) > (舊資料.volume ?? 0)) {
        依日期索引.set(交易日期, 候選資料);
      }
    }

    區間起點 = 加入天數(區間終點, 1);
  }

  const rows = [...依日期索引.values()];
  if (!rows.length) {
    throw new Error(`${商品代碼} 期貨歷史日線資料不足`);
  }

  return 補上日線漲跌資料(rows);
}

function 建立技術觀察摘要(name, 歷史資料) {
  const latest = 歷史資料.at(-1);
  if (!latest) return [];
  const bullets = [];

  if (latest.close > (latest.maMedium ?? Infinity) && (latest.maMedium ?? 0) > (latest.maLong ?? Infinity)) {
    bullets.push(`${name} 目前站在 MA20 與 MA60 之上，短中期均線仍偏向多方排列。`);
  } else if (latest.close < (latest.maMedium ?? -Infinity) && (latest.maMedium ?? 0) < (latest.maLong ?? -Infinity)) {
    bullets.push(`${name} 收盤落在 MA20 與 MA60 下方，現階段仍屬偏弱整理格局。`);
  } else {
    bullets.push(`${name} 目前位在均線交錯區，短線偏向震盪整理，宜觀察下一段量價方向。`);
  }

  if ((latest.rsi ?? 50) >= 70) {
    bullets.push('RSI14 已進入偏熱區，若後續量能沒有跟上，容易出現高檔震盪。');
  } else if ((latest.rsi ?? 50) <= 30) {
    bullets.push('RSI14 落在偏低區，若出現量縮止跌，反而可以留意技術性反彈。');
  } else {
    bullets.push('RSI14 仍在中性帶，代表價格慣性延續，但還沒有極端過熱或過冷。');
  }

  if ((latest.macdHist ?? 0) > 0) {
    bullets.push('MACD 柱體維持正值，短線動能仍偏向多方。');
  } else if ((latest.macdHist ?? 0) < 0) {
    bullets.push('MACD 柱體位於負值區，代表短線修正力道仍在。');
  }

  const return20 = calculateWindowReturn(歷史資料, 20);
  if (return20 !== null) {
    bullets.push(`近 20 個交易日報酬 ${return20.toFixed(2)}%，可用來觀察波段資金是否持續留在主線。`);
  }

  return bullets.slice(0, 4);
}

function 建立技術分析資料({ code, name, kind, 歷史資料 }) {
  const settings = { ...defaultIndicatorSettings };
  const enriched = buildIndicatorRows(歷史資料, settings)
    .slice(-120)
    .map((row) => ({
      ...row,
      ma5: row.maFast ?? null,
      ma10: row.maShort ?? null,
      ma20: row.maMedium ?? null,
      ma60: row.maLong ?? null,
      rsi14: row.rsi ?? null,
      k9: row.stochasticK ?? null,
      d9: row.stochasticD ?? null,
    }));
  const latest = enriched.at(-1) ?? {};
  const technicalSignals = buildTechnicalSignalSummary(enriched, settings, { name });

  return {
    code,
    name,
    kind,
    priceDate: latest.date ?? null,
    generatedAt: 取得現在ISO(),
    indicatorSettings: settings,
    歷史資料: enriched,
    technicalSignals,
    訊號摘要: summarizeSignalTitles(technicalSignals),
    最新摘要: {
      close: latest.close ?? null,
      change: latest.change ?? null,
      changePercent: latest.changePercent ?? null,
      volume: latest.volume ?? null,
      turnover: latest.turnover ?? null,
      return5: calculateWindowReturn(enriched, 5),
      return20: calculateWindowReturn(enriched, 20),
      return60: calculateWindowReturn(enriched, 60),
    },
    最新指標: {
      maFast: latest.maFast ?? null,
      maShort: latest.maShort ?? null,
      maMedium: latest.maMedium ?? null,
      maLong: latest.maLong ?? null,
      ma5: latest.ma5 ?? null,
      ma10: latest.ma10 ?? null,
      ma20: latest.ma20 ?? null,
      ma60: latest.ma60 ?? null,
      rsi: latest.rsi ?? null,
      rsi14: latest.rsi14 ?? null,
      stochasticK: latest.stochasticK ?? null,
      stochasticD: latest.stochasticD ?? null,
      k9: latest.k9 ?? null,
      d9: latest.d9 ?? null,
      macd: latest.macd ?? null,
      macdSignal: latest.macdSignal ?? null,
      macdHist: latest.macdHist ?? null,
    },
    觀察摘要: 建立技術觀察摘要(name, enriched),
    資料來源: ['Yahoo Finance Chart API'],
  };
}

const 持股分級標籤 = {
  1: '1 張以下',
  2: '1-5 張',
  3: '5-10 張',
  4: '10-15 張',
  5: '15-20 張',
  6: '20-30 張',
  7: '30-40 張',
  8: '40-50 張',
  9: '50-100 張',
  10: '100-200 張',
  11: '200-400 張',
  12: '400-600 張',
  13: '600-800 張',
  14: '800-1,000 張',
  15: '1,000 張以上',
  16: '差異數調整',
  17: '合計',
};

async function 抓取TDCC持股分級索引() {
  const response = await fetch('https://opendata.tdcc.com.tw/getOD.ashx?id=1-5', {
    headers: {
      'user-agent': 使用者代理,
      'accept-language': 'zh-TW,zh;q=0.9',
      accept: 'text/csv,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`TDCC HTTP ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.trim().split(/\r?\n/).slice(1);
  const map = new Map();

  for (const line of lines) {
    const [date, codeRaw, levelRaw, holdersRaw, sharesRaw, ratioRaw] = line.split(',');
    const code = String(codeRaw ?? '').trim();
    const level = Number(levelRaw);

    if (!code || !Number.isFinite(level)) continue;

    if (!map.has(code)) {
      map.set(code, { date, bands: [] });
    }

    map.get(code).bands.push({
      level,
      label: 持股分級標籤[level] ?? `分級 ${level}`,
      holders: 取數字(holdersRaw),
      shares: 取數字(sharesRaw),
      ratio: 取數字(ratioRaw),
    });
  }

  for (const entry of map.values()) {
    entry.bands.sort((left, right) => left.level - right.level);
  }

  return map;
}

function 建立持股分散摘要(entry, previousSummary = null) {
  if (!entry) return null;

  const bands = entry.bands;
  const retailRatio = bands
    .filter((item) => item.level >= 1 && item.level <= 3)
    .reduce((total, item) => total + (item.ratio ?? 0), 0);
  const largeHolderRatio = bands
    .filter((item) => item.level >= 12 && item.level <= 15)
    .reduce((total, item) => total + (item.ratio ?? 0), 0);
  const totalRow = bands.find((item) => item.level === 17);

  return {
    date: 正規化日期(entry.date),
    retailRatio,
    largeHolderRatio,
    retailRatioDelta:
      previousSummary?.retailRatio !== undefined && previousSummary?.retailRatio !== null
        ? retailRatio - previousSummary.retailRatio
        : null,
    largeHolderRatioDelta:
      previousSummary?.largeHolderRatio !== undefined && previousSummary?.largeHolderRatio !== null
        ? largeHolderRatio - previousSummary.largeHolderRatio
        : null,
    totalHolders: totalRow?.holders ?? null,
    totalRatio: totalRow?.ratio ?? null,
    bands,
    資料說明: '依 TDCC 持股分級，散戶定義為 10 張以下，大戶定義為 400 張以上。',
  };
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

function 建立市場廣度資料(rows) {
  const 解析單列 = (matcher) => {
    const row = rows.find((item) => matcher(壓縮文字(item['類型'])));
    if (!row) return null;

    const 上漲 = 取數字(row['上漲']);
    const 下跌 = 取數字(row['下跌']);

    return {
      類型: 壓縮文字(row['類型']),
      資料日期: 民國日期轉西元(row['出表日期']),
      上漲,
      漲停: 取數字(row['漲停']),
      下跌,
      跌停: 取數字(row['跌停']),
      持平: 取數字(row['持平']),
      未成交: 取數字(row['未成交']),
      無比價: 取數字(row['無比價']),
      強弱比: 下跌 ? 上漲 / 下跌 : 上漲 ? null : 1,
      淨上漲家數: (上漲 ?? 0) - (下跌 ?? 0),
    };
  };

  const 股票市場 = 解析單列((value) => value.includes('股票'));
  const 整體市場 = 解析單列((value) => value.includes('整體市場') || value === '整體');
  const 主體 = 股票市場 ?? 整體市場;

  if (!主體) return null;

  return {
    資料日期: 主體.資料日期,
    股票市場,
    整體市場,
    強弱比: 股票市場?.強弱比 ?? 整體市場?.強弱比 ?? null,
    淨上漲家數: 股票市場?.淨上漲家數 ?? 整體市場?.淨上漲家數 ?? null,
    市場情緒:
      (股票市場?.強弱比 ?? 整體市場?.強弱比 ?? 1) >= 1.15
        ? '多方擴散'
        : (股票市場?.強弱比 ?? 整體市場?.強弱比 ?? 1) <= 0.85
          ? '空方擴散'
          : '輪動整理',
  };
}

function 建立外資類股焦點(rows) {
  const 全部類股 = rows
    .map((item) => ({
      產業名稱: 壓縮文字(item.IndustryCat),
      上市檔數: 取數字(item.Numbers),
      總股數: 取數字(item.ShareNumber),
      外資持股數: 取數字(item.ForeignMainlandAreaShare),
      外資持股比: 取數字(item.Percentage),
    }))
    .filter((item) => item.產業名稱 && item.產業名稱 !== 'ETF');

  const 高比重類股 = [...全部類股]
    .sort((left, right) => (right.外資持股比 ?? 0) - (left.外資持股比 ?? 0))
    .slice(0, 8);
  const 低比重類股 = [...全部類股]
    .filter((item) => (item.上市檔數 ?? 0) >= 5)
    .sort((left, right) => (left.外資持股比 ?? Infinity) - (right.外資持股比 ?? Infinity))
    .slice(0, 6);

  return {
    高比重類股,
    低比重類股,
  };
}

function 建立外資持股焦點(rows) {
  return rows
    .filter((item) => 是否一般股票(item.Code))
    .map((item) => ({
      排名: 取數字(item.Rank),
      代號: 壓縮文字(item.Code),
      名稱: 壓縮文字(item.Name),
      發行股數: 取數字(item.ShareNumber),
      外資持有股數: 取數字(item.SharesHeld),
      外資持股比: 取數字(item.SharesHeldPer),
      尚可投資比: 取數字(item.AvailableInvestPer),
      投資上限: 取數字(item.Upperlimit),
    }))
    .slice(0, 10);
}

function 建立市場觀察摘要({ 大盤摘要, 近五日節奏, 熱門股, 指數卡片, 市場廣度, 外資類股焦點 }) {
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

  if (市場廣度?.股票市場?.上漲 && 市場廣度?.股票市場?.下跌) {
    const 強弱比 = 市場廣度.股票市場.強弱比 ?? 1;
    const 文字 = `上市股票上漲 ${市場廣度.股票市場.上漲} 家、下跌 ${市場廣度.股票市場.下跌} 家`;

    if (強弱比 >= 1.15) {
      摘要.push(`${文字}，市場廣度轉佳，盤面不是只靠權值股撐盤。`);
    } else if (強弱比 <= 0.85) {
      摘要.push(`${文字}，市場廣度偏弱，短線宜留意輪動是否只剩少數族群。`);
    }
  }

  if (電子類 && (電子類.漲跌百分比 ?? 0) > (大盤摘要.漲跌幅 ?? 0)) {
    摘要.push('電子類指數表現優於大盤，科技股仍是短線人氣核心。');
  }

  if (外資類股焦點?.高比重類股?.length) {
    const 類股 = 外資類股焦點.高比重類股
      .slice(0, 2)
      .map((item) => item.產業名稱)
      .join('、');
    摘要.push(`外資持股比相對集中的類股落在 ${類股}，可當作中期資金偏好的參考座標。`);
  }

  if (強勢股.length) {
    摘要.push(`熱門股以 ${強勢股.map((item) => item.名稱).join('、')} 最具人氣，短線可留意是否延續量價結構。`);
  }

  return 摘要.slice(0, 5);
}

async function 抓取市場總覽() {
  const [indexRows, hotRows, intradayRows, trendRows, stockRows, valuationRows, breadthRows, foreignIndustryRows, foreignTopRows] = await Promise.all([
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX20'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/MI_5MINS'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/opendata/twtazu_od'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/fund/MI_QFIIS_cat'),
    抓取JSON資料('https://openapi.twse.com.tw/v1/fund/MI_QFIIS_sort_20'),
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
  const 評價索引 = new Map(
    valuationRows
      .filter((item) => 是否一般股票(item.Code))
      .map((item) => [
        壓縮文字(item.Code),
        {
          本益比: 取數字(item.PEratio),
          殖利率: 取數字(item.DividendYield),
          股價淨值比: 取數字(item.PBratio),
        },
      ]),
  );
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
  const 市場廣度 = 建立市場廣度資料(breadthRows);
  const 外資類股焦點 = 建立外資類股焦點(foreignIndustryRows);
  const 外資持股焦點 = 建立外資持股焦點(foreignTopRows);

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
  let 技術面資料 = null;
  let 盤中走勢 = null;

  try {
    技術面資料 = 建立技術分析資料({
      code: '^TWII',
      name: '加權指數',
      kind: 'index',
      歷史資料: await 抓取指數歷史日線('^TWII', 6),
    });
  } catch (error) {
    技術面資料 = {
      code: '^TWII',
      name: '加權指數',
      kind: 'index',
      priceDate: 最新大盤.日期 ?? null,
      generatedAt: 取得現在ISO(),
      歷史資料: [],
      最新摘要: {},
      最新指標: {},
      觀察摘要: [`大盤技術資料暫時無法更新：${error instanceof Error ? error.message : String(error)}`],
      資料來源: ['Yahoo Finance Chart API'],
    };
  }

  try {
    盤中走勢 = await 抓取Yahoo盤中分時(['^TWII']);
  } catch (error) {
    盤中走勢 = {
      interval: '5m',
      marketDate: 最新大盤.日期 ?? null,
      updatedAt: null,
      previousClose: null,
      latestPrice: null,
      high: null,
      low: null,
      volume: null,
      points: [],
      錯誤訊息: error instanceof Error ? error.message : String(error),
      資料來源: ['Yahoo Finance Chart API'],
    };
  }

  return {
    市場總覽: {
      資料日期: 最新大盤.日期 ?? null,
      指數卡片,
      大盤摘要,
      技術面資料,
      盤中走勢,
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
      市場廣度,
      外資類股焦點,
      外資持股焦點,
      熱門股,
      成交排行,
      強勢股,
      近五日節奏,
      觀察摘要: 建立市場觀察摘要({ 大盤摘要, 近五日節奏, 熱門股, 指數卡片, 市場廣度, 外資類股焦點 }),
      資料說明: [
        'TWSE OpenAPI：MI_INDEX、MI_5MINS、FMTQIK、MI_INDEX20、STOCK_DAY_ALL、twtazu_od、MI_QFIIS_cat、MI_QFIIS_sort_20',
        '熱門股以成交量與成交值為主，並排除 ETF 與受益證券，聚焦上市一般股票。',
      ],
    },
    全部個股,
    個股索引,
    評價索引,
  };
}

function 建立公司概況資料(row) {
  if (!row) return null;

  return {
    公司名稱: 取第一個文字(row, ['公司名稱']),
    公司簡稱: 取第一個文字(row, ['公司簡稱']),
    產業代碼: 取第一個文字(row, ['產業別']),
    董事長: 取第一個文字(row, ['董事長']),
    總經理: 取第一個文字(row, ['總經理']),
    發言人: 取第一個文字(row, ['發言人']),
    成立日期: 民國日期轉西元(row['成立日期']),
    上市日期: 民國日期轉西元(row['上市日期']),
    實收資本額: 取數字(row['實收資本額']),
    已發行股數: 取數字(row['已發行普通股數或TDR原股發行股數']),
    面額: 取第一個文字(row, ['普通股每股面額']),
    住址: 取第一個文字(row, ['住址']),
    網址: 取第一個文字(row, ['網址']),
    更新日期: 民國日期轉西元(row['出表日期']),
  };
}

function 建立月營收資料(row) {
  if (!row) return null;

  return {
    出表日期: 民國日期轉西元(row['出表日期']),
    資料年月: 正規化年月(row['資料年月']),
    產業名稱: 取第一個文字(row, ['產業別']),
    當月營收: 取數字(row['營業收入-當月營收']),
    上月營收: 取數字(row['營業收入-上月營收']),
    去年同月營收: 取數字(row['營業收入-去年當月營收']),
    月增率: 取數字(row['營業收入-上月比較增減(%)']),
    年增率: 取數字(row['營業收入-去年同月增減(%)']),
    累計營收: 取數字(row['累計營業收入-當月累計營收']),
    去年累計營收: 取數字(row['累計營業收入-去年累計營收']),
    累計年增率: 取數字(row['累計營業收入-前期比較增減(%)']),
    備註: 取第一個文字(row, ['備註']),
  };
}

function 建立綜合損益資料(row, 報表類別) {
  if (!row) return null;

  const 年度 = 取數字(row['年度']);

  return {
    出表日期: 民國日期轉西元(row['出表日期']),
    年度: 年度 !== null ? 年度 + 1911 : null,
    季別: 取數字(row['季別']),
    報表類別,
    主要收益欄位: ['營業收入', '收益', '收入', '利息淨收益', '淨收益'].find((key) => row[key] !== undefined) ?? null,
    主要收益: 取第一個數字(row, ['營業收入', '收益', '收入', '利息淨收益', '淨收益']),
    營業毛利: 取第一個數字(row, ['營業毛利（毛損）淨額', '營業毛利（毛損）']),
    營業利益: 取第一個數字(row, ['營業利益（損失）', '營業利益']),
    稅前淨利: 取第一個數字(row, [
      '稅前淨利（淨損）',
      '繼續營業單位稅前淨利（淨損）',
      '繼續營業單位稅前損益',
      '繼續營業單位稅前純益（純損）',
    ]),
    本期淨利: 取第一個數字(row, [
      '本期淨利（淨損）',
      '本期稅後淨利（淨損）',
      '繼續營業單位本期淨利（淨損）',
      '繼續營業單位本期純益（純損）',
    ]),
    母公司淨利: 取第一個數字(row, ['淨利（淨損）歸屬於母公司業主', '淨利（損）歸屬於母公司業主']),
    每股盈餘: 取數字(row['基本每股盈餘（元）']),
  };
}

function 建立資產負債資料(row, 報表類別) {
  if (!row) return null;

  const 年度 = 取數字(row['年度']);
  const 資產總額 = 取第一個數字(row, ['資產總額', '資產總計']);
  const 負債總額 = 取第一個數字(row, ['負債總額', '負債總計']);
  const 權益總額 = 取第一個數字(row, ['權益總額', '權益總計']);

  return {
    出表日期: 民國日期轉西元(row['出表日期']),
    年度: 年度 !== null ? 年度 + 1911 : null,
    季別: 取數字(row['季別']),
    報表類別,
    資產總額,
    負債總額,
    權益總額,
    歸母權益: 取第一個數字(row, ['歸屬於母公司業主之權益合計', '歸屬於母公司業主之權益', '權益總計']),
    股本: 取數字(row['股本']),
    保留盈餘: 取數字(row['保留盈餘']),
    每股參考淨值: 取數字(row['每股參考淨值']),
    負債比: 資產總額 ? ((負債總額 ?? 0) / 資產總額) * 100 : null,
  };
}

function 建立財務觀察摘要({ 月營收, 綜合損益表, 資產負債表, 評價面 }) {
  const 摘要 = [];

  if (月營收?.年增率 !== null && 月營收?.年增率 !== undefined) {
    if (月營收.年增率 >= 15) {
      摘要.push(`最新月營收年增 ${月營收.年增率.toFixed(2)}%，營收動能明顯轉強。`);
    } else if (月營收.年增率 > 0) {
      摘要.push(`最新月營收年增 ${月營收.年增率.toFixed(2)}%，營收仍維持溫和成長。`);
    } else {
      摘要.push(`最新月營收年減 ${Math.abs(月營收.年增率).toFixed(2)}%，短線要留意營運動能是否放緩。`);
    }
  }

  if (綜合損益表?.每股盈餘 !== null && 綜合損益表?.每股盈餘 !== undefined) {
    if (綜合損益表.每股盈餘 > 0) {
      摘要.push(`最新季報 EPS ${綜合損益表.每股盈餘.toFixed(2)} 元，仍具獲利能力。`);
    } else {
      摘要.push(`最新季報 EPS ${綜合損益表.每股盈餘.toFixed(2)} 元，獲利表現偏弱。`);
    }
  }

  if (資產負債表?.負債比 !== null && 資產負債表?.負債比 !== undefined) {
    if (資產負債表.負債比 >= 65) {
      摘要.push(`負債比約 ${資產負債表.負債比.toFixed(2)}%，財務槓桿相對偏高。`);
    } else {
      摘要.push(`負債比約 ${資產負債表.負債比.toFixed(2)}%，資本結構仍在可觀察區間。`);
    }
  }

  if (評價面?.本益比 !== null && 評價面?.本益比 !== undefined) {
    摘要.push(`官方估值顯示本益比 ${評價面.本益比.toFixed(2)} 倍、股價淨值比 ${評價面.股價淨值比?.toFixed(2) ?? '-'} 倍。`);
  }

  return 摘要.slice(0, 4);
}

async function 抓取多組財務資料(端點清單) {
  const 結果 = await Promise.allSettled(
    端點清單.map(async (item) => ({
      ...item,
      rows: await 抓取JSON資料(item.url),
    })),
  );

  return 結果.flatMap((result) => {
    if (result.status === 'fulfilled') {
      return [result.value];
    }

    console.warn(`[財務端點略過] ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    return [];
  });
}

async function 抓取單一財務資料(url, 錯誤標籤) {
  try {
    return await 抓取JSON資料(url);
  } catch (error) {
    console.warn(`[財務端點略過] ${錯誤標籤}：${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

async function 抓取個股財務索引() {
  const [公司基本資料列, 月營收列, 綜合損益資料組, 資產負債資料組] = await Promise.all([
    抓取單一財務資料('https://openapi.twse.com.tw/v1/opendata/t187ap03_L', '上市公司基本資料'),
    抓取單一財務資料('https://openapi.twse.com.tw/v1/opendata/t187ap05_L', '上市公司月營收'),
    抓取多組財務資料(上市公司綜合損益端點),
    抓取多組財務資料(上市公司資產負債端點),
  ]);

  const 公司概況索引 = new Map(
    公司基本資料列
      .filter((row) => 是否一般股票(row['公司代號']))
      .map((row) => [壓縮文字(row['公司代號']), 建立公司概況資料(row)]),
  );

  const 月營收索引 = new Map(
    月營收列
      .filter((row) => 是否一般股票(row['公司代號']))
      .map((row) => [壓縮文字(row['公司代號']), 建立月營收資料(row)]),
  );

  const 綜合損益索引 = new Map();
  for (const 資料組 of 綜合損益資料組) {
    for (const row of 資料組.rows ?? []) {
      const code = 壓縮文字(row['公司代號']);
      if (!是否一般股票(code)) continue;
      綜合損益索引.set(code, 建立綜合損益資料(row, 資料組.類別));
    }
  }

  const 資產負債索引 = new Map();
  for (const 資料組 of 資產負債資料組) {
    for (const row of 資料組.rows ?? []) {
      const code = 壓縮文字(row['公司代號']);
      if (!是否一般股票(code)) continue;
      資產負債索引.set(code, 建立資產負債資料(row, 資料組.類別));
    }
  }

  return {
    公司概況索引,
    月營收索引,
    綜合損益索引,
    資產負債索引,
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

function 建立連買資料(日資料清單, key) {
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

async function 抓取近期法人資料(個股索引, 目標交易日數 = 5) {
  const 日資料清單 = [];
  const 起始日 = new Date();

  for (let offset = 1; offset <= 12 && 日資料清單.length < 目標交易日數; offset += 1) {
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

  return 日資料清單;
}

function 抓取法人追蹤(日資料清單) {
  if (!日資料清單.length) {
    throw new Error('三大法人資料暫時無法取得');
  }

  const 外資連買 = 建立連買資料(日資料清單, '外資買賣超');
  const 投信連買 = 建立連買資料(日資料清單, '投信買賣超');
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
      const 技術資料列表 = await Promise.all(
        契約列表.map(async (item) => {
          try {
            return 建立技術分析資料({
              code: item.商品代碼,
              name: item.契約名稱,
              kind: 'futures',
              歷史資料: await 抓取期貨歷史日線(item.商品代碼, 查詢日期.replaceAll('/', '-'), 6),
            });
          } catch (error) {
            return {
              code: item.商品代碼,
              name: item.契約名稱,
              kind: 'futures',
              priceDate: 查詢日期.replaceAll('/', '-'),
              generatedAt: 取得現在ISO(),
              歷史資料: [],
              最新摘要: {},
              最新指標: {},
              觀察摘要: [`${item.契約名稱} 技術資料暫時無法更新：${error instanceof Error ? error.message : String(error)}`],
              資料來源: ['TAIFEX 期貨每日交易行情下載'],
            };
          }
        }),
      );

      const 強化後契約列表 = 契約列表.map((item, index) => ({
        ...item,
        行情代碼: item.商品代碼 === 'MXF' ? 'MTX' : item.商品代碼,
        技術面資料: 技術資料列表[index],
        ...建立期貨觀察建議(item),
      }));

      const 整體建議 = 強化後契約列表.map((item) => `${item.契約名稱}：${item.觀察建議.at(-1)}`);

      return {
        資料日期: 查詢日期.replaceAll('/', '-'),
        契約列表: 強化後契約列表,
        整體建議,
        資料說明: [
          '資料來源：臺灣期貨交易所三大法人區分各商品每日交易資訊。',
          '技術走勢來源：臺灣期貨交易所期貨每日交易行情下載。',
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

function 建立主動ETF曝光索引(ETF結果) {
  const map = new Map();

  for (const result of ETF結果) {
    for (const [index, holding] of (result.snapshot?.holdings ?? []).entries()) {
      if (!是否一般股票(holding.code)) continue;

      if (!map.has(holding.code)) {
        map.set(holding.code, []);
      }

      map.get(holding.code).push({
        etfCode: result.etf.code,
        etfName: result.etf.name,
        providerLabel: result.etf.providerLabel,
        disclosureDate: result.snapshot?.disclosureDate ?? null,
        weight: holding.weight ?? null,
        shares: holding.shares ?? null,
        rank: index + 1,
      });
    }
  }

  return new Map(
    [...map.entries()].map(([code, items]) => {
      const 已排序 = [...items].sort(
        (left, right) => (right.weight ?? 0) - (left.weight ?? 0) || (left.rank ?? Infinity) - (right.rank ?? Infinity),
      );
      const 權重合計 = 已排序.reduce((total, item) => total + (item.weight ?? 0), 0);

      return [
        code,
        {
          count: 已排序.length,
          averageWeight: 已排序.length ? 權重合計 / 已排序.length : null,
          totalWeight: 權重合計 || null,
          latestDisclosureDate: 已排序.map((item) => item.disclosureDate).sort().at(-1) ?? null,
          items: 已排序,
        },
      ];
    }),
  );
}

function 建立融資融券索引(rows, 資料日期 = null) {
  const map = new Map();

  for (const row of rows) {
    const code = 壓縮文字(row['股票代號']);

    if (!是否一般股票(code)) continue;

    const 融資今日餘額 = 取數字(row['融資今日餘額']);
    const 融資前日餘額 = 取數字(row['融資前日餘額']);
    const 融券今日餘額 = 取數字(row['融券今日餘額']);
    const 融券前日餘額 = 取數字(row['融券前日餘額']);
    const 融資限額 = 取數字(row['融資限額']);
    const 融券限額 = 取數字(row['融券限額']);
    const 融資增減 = 融資今日餘額 !== null && 融資前日餘額 !== null ? 融資今日餘額 - 融資前日餘額 : null;
    const 融券增減 = 融券今日餘額 !== null && 融券前日餘額 !== null ? 融券今日餘額 - 融券前日餘額 : null;
    const 券資比 =
      融資今日餘額 && 融券今日餘額 !== null ? (融券今日餘額 / 融資今日餘額) * 100 : null;
    const 觀察摘要 = [];

    if (融資增減 !== null) {
      if (融資增減 > 0) {
        觀察摘要.push(`融資餘額單日增加 ${融資增減.toLocaleString('zh-TW')} 張，短線追價意願升溫。`);
      } else if (融資增減 < 0) {
        觀察摘要.push(`融資餘額單日減少 ${Math.abs(融資增減).toLocaleString('zh-TW')} 張，浮額略有清洗。`);
      }
    }

    if (融券增減 !== null) {
      if (融券增減 > 0) {
        觀察摘要.push(`融券餘額增加 ${融券增減.toLocaleString('zh-TW')} 張，留意空方避險同步升高。`);
      } else if (融券增減 < 0) {
        觀察摘要.push(`融券餘額減少 ${Math.abs(融券增減).toLocaleString('zh-TW')} 張，空方回補力道偏強。`);
      }
    }

    if (券資比 !== null) {
      if (券資比 >= 30) {
        觀察摘要.push(`券資比約 ${券資比.toFixed(2)}%，多空分歧相對明顯。`);
      } else if (券資比 <= 10) {
        觀察摘要.push(`券資比約 ${券資比.toFixed(2)}%，市場籌碼仍以多方槓桿為主。`);
      }
    }

    map.set(code, {
      date: 資料日期,
      marginBuy: 取數字(row['融資買進']),
      marginSell: 取數字(row['融資賣出']),
      marginRepay: 取數字(row['融資現金償還']),
      marginPrevious: 融資前日餘額,
      marginToday: 融資今日餘額,
      marginLimit: 融資限額,
      marginChange: 融資增減,
      marginUsage: 融資限額 ? ((融資今日餘額 ?? 0) / 融資限額) * 100 : null,
      shortBuy: 取數字(row['融券買進']),
      shortSell: 取數字(row['融券賣出']),
      shortRepay: 取數字(row['融券現券償還']),
      shortPrevious: 融券前日餘額,
      shortToday: 融券今日餘額,
      shortLimit: 融券限額,
      shortChange: 融券增減,
      shortUsage: 融券限額 ? ((融券今日餘額 ?? 0) / 融券限額) * 100 : null,
      offset: 取數字(row['資券互抵']),
      shortToMarginRatio: 券資比,
      note: 壓縮文字(row['註記']),
      觀察摘要,
    });
  }

  return map;
}

function 建立個股摘要資料({ code, name, 公司概況, 技術資料, 法人買賣, 持股分散, 融資融券, 主動ETF曝光 }) {
  return {
    code,
    name,
    industryName: 公司概況?.產業名稱 ?? null,
    priceDate: 技術資料?.priceDate ?? null,
    close: 技術資料?.最新摘要?.close ?? null,
    change: 技術資料?.最新摘要?.change ?? null,
    changePercent: 技術資料?.最新摘要?.changePercent ?? null,
    return20: 技術資料?.最新摘要?.return20 ?? null,
    return60: 技術資料?.最新摘要?.return60 ?? null,
    volume: 技術資料?.最新摘要?.volume ?? null,
    turnover: 技術資料?.最新摘要?.turnover ?? null,
    foreign5Day: 法人買賣?.summary?.foreign5Day ?? null,
    investmentTrust5Day: 法人買賣?.summary?.investmentTrust5Day ?? null,
    total5Day: 法人買賣?.summary?.total5Day ?? null,
    largeHolderRatio: 持股分散?.largeHolderRatio ?? null,
    retailRatio: 持股分散?.retailRatio ?? null,
    shortToMarginRatio: 融資融券?.shortToMarginRatio ?? null,
    activeEtfCount: 主動ETF曝光?.count ?? 0,
    sparkline20: (技術資料?.歷史資料 ?? [])
      .slice(-20)
      .map((item) => Number(item.close))
      .filter((value) => Number.isFinite(value) && value > 0),
    technicalSignals: 技術資料?.technicalSignals ?? [],
    technicalSignalTitles: 技術資料?.訊號摘要 ?? [],
    topSignalTitle: 技術資料?.technicalSignals?.[0]?.title ?? null,
    topSignalTone: 技術資料?.technicalSignals?.[0]?.tone ?? null,
    signalCount: 技術資料?.technicalSignals?.length ?? 0,
  };
}

function 建立股票搜尋索引({ 全部個股, 公司概況索引, 評價索引, 個股摘要清單 }) {
  const 明細索引 = new Map(個股摘要清單.map((item) => [item.code, item]));

  return 全部個股.map((item) => {
    const 明細摘要 = 明細索引.get(item.代號);
    const 公司概況 = 公司概況索引.get(item.代號);
    const 評價面 = 評價索引.get(item.代號);

    return {
      code: item.代號,
      name: item.名稱,
      industryName: 公司概況?.產業名稱 ?? null,
      close: item.收盤價 ?? null,
      change: item.漲跌值 ?? null,
      changePercent: item.漲跌幅 ?? null,
      volume: item.成交量 ?? null,
      turnover: item.成交值 ?? null,
      peRatio: 評價面?.本益比 ?? null,
      dividendYield: 評價面?.殖利率 ?? null,
      pbRatio: 評價面?.股價淨值比 ?? null,
      hasLocalDetail: Boolean(明細摘要),
      return20: 明細摘要?.return20 ?? null,
      return60: 明細摘要?.return60 ?? null,
      topSignalTitle: 明細摘要?.topSignalTitle ?? null,
      topSignalTone: 明細摘要?.topSignalTone ?? null,
      signalCount: 明細摘要?.signalCount ?? 0,
      activeEtfCount: 明細摘要?.activeEtfCount ?? 0,
    };
  });
}

function 建立同產業比較索引(摘要清單) {
  const 產業分組 = new Map();

  for (const item of 摘要清單) {
    const industryName = 壓縮文字(item.industryName);
    if (!industryName) continue;

    if (!產業分組.has(industryName)) {
      產業分組.set(industryName, []);
    }

    產業分組.get(industryName).push(item);
  }

  const 比較索引 = new Map();

  for (const [industryName, items] of 產業分組.entries()) {
    const 依20日報酬排序 = [...items].sort(
      (left, right) =>
        (right.return20 ?? -Infinity) - (left.return20 ?? -Infinity) ||
        (right.changePercent ?? -Infinity) - (left.changePercent ?? -Infinity) ||
        (right.total5Day ?? -Infinity) - (left.total5Day ?? -Infinity),
    );
    const 依單日強度排序 = [...items].sort(
      (left, right) =>
        (right.changePercent ?? -Infinity) - (left.changePercent ?? -Infinity) ||
        (right.return20 ?? -Infinity) - (left.return20 ?? -Infinity),
    );
    const 平均20日報酬 =
      items.reduce((total, item) => total + (item.return20 ?? 0), 0) / Math.max(items.length, 1);
    const 平均單日漲跌 =
      items.reduce((total, item) => total + (item.changePercent ?? 0), 0) / Math.max(items.length, 1);
    const 平均法人五日 =
      items.reduce((total, item) => total + (item.total5Day ?? 0), 0) / Math.max(items.length, 1);
    const 領先名單 = 依20日報酬排序.slice(0, 8);
    const 落後名單 = [...依20日報酬排序]
      .sort((left, right) => (left.return20 ?? Infinity) - (right.return20 ?? Infinity))
      .slice(0, Math.min(3, items.length));

    for (const stock of items) {
      const 二十日排名 = 依20日報酬排序.findIndex((item) => item.code === stock.code) + 1;
      const 單日排名 = 依單日強度排序.findIndex((item) => item.code === stock.code) + 1;
      const 觀察摘要 = [];

      if (items.length <= 1) {
        觀察摘要.push('目前追蹤池中同產業可比較標的有限，先以本身技術面與籌碼面為主。');
      } else {
        if ((stock.return20 ?? -Infinity) > 平均20日報酬) {
          觀察摘要.push(`近 20 日報酬優於同產業平均 ${平均20日報酬.toFixed(2)}%，在同族群相對偏強。`);
        } else if ((stock.return20 ?? Infinity) < 平均20日報酬) {
          觀察摘要.push(`近 20 日報酬低於同產業平均 ${平均20日報酬.toFixed(2)}%，短線強度落後族群。`);
        }

        if ((stock.total5Day ?? 0) > 平均法人五日) {
          觀察摘要.push('最近五日法人買盤強於同產業平均，可留意是否持續吸金。');
        } else if ((stock.total5Day ?? 0) < 平均法人五日) {
          觀察摘要.push('最近五日法人力道弱於同產業平均，需留意資金是否轉往同族群其他標的。');
        }
      }

      比較索引.set(stock.code, {
        industryName,
        peerCount: items.length,
        rank20Day: 二十日排名,
        rankDaily: 單日排名,
        averageReturn20: 平均20日報酬,
        averageChangePercent: 平均單日漲跌,
        leaders: 領先名單,
        laggards: 落後名單,
        觀察摘要,
      });
    }
  }

  return 比較索引;
}

function 修正ETF快照文字(snapshot, etf, 個股索引) {
  if (!snapshot) return null;

  return {
    ...snapshot,
    name: etf.name,
    fullName: etf.fullName,
    providerLabel: etf.providerLabel,
    sourceName: etf.sourceName,
    sourceUrl: etf.sourceUrl,
    holdings: (snapshot.holdings ?? []).map((item) => ({
      ...item,
      name: 是否一般股票(item.code) ? 個股索引.get(item.code)?.名稱 ?? item.name : item.name,
    })),
  };
}

function 修正ETF異動文字(diff, 個股索引) {
  if (!diff) return null;

  const 修正清單 = (items) =>
    (items ?? []).map((item) => ({
      ...item,
      name: 是否一般股票(item.code) ? 個股索引.get(item.code)?.名稱 ?? item.name : item.name,
    }));

  return {
    ...diff,
    name: diff.name,
    added: 修正清單(diff.added),
    removed: 修正清單(diff.removed),
    increased: 修正清單(diff.increased),
    decreased: 修正清單(diff.decreased),
  };
}

function 建立證券候選清單({ 市場總覽, 法人追蹤, ETF結果 }) {
  const map = new Map();

  const 收納 = (code, name) => {
    if (!是否一般股票(code)) return;
    if (!map.has(code)) {
      map.set(code, { code, name });
    }
  };

  for (const key of ['熱門股', '成交排行', '強勢股']) {
    for (const item of 市場總覽[key] ?? []) {
      收納(item.代號, item.名稱);
    }
  }

  for (const key of ['外資連買', '投信連買', '土洋對作']) {
    for (const item of 法人追蹤[key] ?? []) {
      收納(item.代號, item.名稱);
    }
  }

  for (const item of 市場總覽.外資持股焦點 ?? []) {
    收納(item.代號, item.名稱);
  }

  for (const result of ETF結果) {
    for (const holding of result.snapshot?.holdings ?? []) {
      收納(holding.code, holding.name);
    }
  }

  return [...map.values()].sort((left, right) => left.code.localeCompare(right.code));
}

function 建立個股法人明細(code, 日資料清單) {
  const days = 日資料清單
    .map((day) => ({
      date: day.日期,
      foreign: day.索引.get(code)?.外資買賣超 ?? null,
      investmentTrust: day.索引.get(code)?.投信買賣超 ?? null,
      dealer: day.索引.get(code)?.自營商買賣超 ?? null,
      total: day.索引.get(code)?.三大法人買賣超 ?? null,
    }))
    .filter((item) => item.foreign !== null || item.investmentTrust !== null || item.dealer !== null || item.total !== null);

  return {
    days,
    summary: {
      foreign5Day: days.reduce((total, item) => total + (item.foreign ?? 0), 0),
      investmentTrust5Day: days.reduce((total, item) => total + (item.investmentTrust ?? 0), 0),
      dealer5Day: days.reduce((total, item) => total + (item.dealer ?? 0), 0),
      total5Day: days.reduce((total, item) => total + (item.total ?? 0), 0),
    },
  };
}

async function 寫入ETF市場資料(追蹤清單, tdcc索引) {
  for (const etf of 追蹤清單) {
    const 舊資料 = await 讀取JSON存在則回傳(path.join(ETF資料目錄, etf.code, 'market.json'));
    try {
      const [歷史資料, 盤中走勢] = await Promise.all([
        抓取證券歷史日線(etf.code, 6),
        抓取Yahoo盤中分時([`${etf.code}.TW`, `${etf.code}.TWO`]),
      ]);
      const 市場資料 = 建立技術分析資料({
        code: etf.code,
        name: etf.name,
        kind: 'etf',
        歷史資料,
      });
      市場資料.盤中走勢 = 盤中走勢;

      const 持股分散 = 建立持股分散摘要(tdcc索引.get(etf.code), 舊資料?.持股分散 ?? null);
      if (持股分散) {
        市場資料.持股分散 = 持股分散;
      }

      await 寫入JSON(path.join(ETF資料目錄, etf.code, 'market.json'), 市場資料);
    } catch (error) {
      if (舊資料) {
        continue;
      }

      await 寫入JSON(path.join(ETF資料目錄, etf.code, 'market.json'), {
        code: etf.code,
        name: etf.name,
        kind: 'etf',
        generatedAt: 取得現在ISO(),
        priceDate: null,
        歷史資料: [],
        盤中走勢: 舊資料?.盤中走勢 ?? null,
        最新摘要: {},
        最新指標: {},
        觀察摘要: [`技術資料暫時無法更新：${error instanceof Error ? error.message : String(error)}`],
        資料來源: ['Yahoo Finance Chart API'],
      });
    }
  }
}

async function 寫入個股明細資料(候選清單, 日資料清單, tdcc索引, 財務索引, 其他索引) {
  const 股票資料目錄 = path.join(資料目錄, 'stocks');
  await mkdir(股票資料目錄, { recursive: true });
  const 待寫入資料 = [];

  for (const item of 候選清單) {
    try {
      const [歷史資料, 盤中走勢] = await Promise.all([
        抓取證券歷史日線(item.code, 6),
        抓取Yahoo盤中分時([`${item.code}.TW`, `${item.code}.TWO`]),
      ]);
      const 舊資料 = await 讀取JSON存在則回傳(path.join(股票資料目錄, `${item.code}.json`));
      const 法人買賣 = 建立個股法人明細(item.code, 日資料清單);
      const 持股分散 = 建立持股分散摘要(tdcc索引.get(item.code), 舊資料?.持股分散 ?? null);
      const 融資融券 = 其他索引.融資融券索引.get(item.code) ?? null;
      const 主動ETF曝光 = 其他索引.主動ETF曝光索引.get(item.code) ?? null;
      const 公司概況原始 = 財務索引.公司概況索引.get(item.code) ?? null;
      const 月營收 = 財務索引.月營收索引.get(item.code) ?? null;
      const 綜合損益表 = 財務索引.綜合損益索引.get(item.code) ?? null;
      const 資產負債表 = 財務索引.資產負債索引.get(item.code) ?? null;
      const 評價面 = 財務索引.評價索引.get(item.code) ?? null;
      const 公司概況 =
        公司概況原始 || 月營收
          ? {
              公司名稱: 公司概況原始?.公司名稱 ?? item.name,
              公司簡稱: 公司概況原始?.公司簡稱 ?? item.name,
              產業名稱: 月營收?.產業名稱 ?? null,
              產業代碼: 公司概況原始?.產業代碼 ?? null,
              董事長: 公司概況原始?.董事長 ?? null,
              總經理: 公司概況原始?.總經理 ?? null,
              發言人: 公司概況原始?.發言人 ?? null,
              成立日期: 公司概況原始?.成立日期 ?? null,
              上市日期: 公司概況原始?.上市日期 ?? null,
              實收資本額: 公司概況原始?.實收資本額 ?? null,
              已發行股數: 公司概況原始?.已發行股數 ?? null,
              面額: 公司概況原始?.面額 ?? null,
              住址: 公司概況原始?.住址 ?? null,
              網址: 公司概況原始?.網址 ?? null,
              更新日期: 公司概況原始?.更新日期 ?? 月營收?.出表日期 ?? null,
            }
          : null;
      const 財務資料 =
        月營收 || 綜合損益表 || 資產負債表 || 評價面
          ? {
              月營收,
              綜合損益表,
              資產負債表,
              觀察摘要: 建立財務觀察摘要({ 月營收, 綜合損益表, 資產負債表, 評價面 }),
              資料說明: [
                '財務與公司基本資料來源：TWSE OpenAPI（上市公司基本資料、月營收、綜合損益表、資產負債表）。',
                '估值欄位來源：TWSE OpenAPI BWIBBU_ALL。',
              ],
            }
          : null;
      const 技術資料 = 建立技術分析資料({
        code: item.code,
        name: item.name,
        kind: 'stock',
        歷史資料,
      });
      const 觀察摘要 = [...技術資料.觀察摘要];

      if (法人買賣.days.length && 法人買賣.summary.total5Day > 0) {
        觀察摘要.push(`最近 ${法人買賣.days.length} 個交易日三大法人合計買超 ${法人買賣.summary.total5Day.toLocaleString('zh-TW')} 股。`);
      } else if (法人買賣.days.length && 法人買賣.summary.total5Day < 0) {
        觀察摘要.push(`最近 ${法人買賣.days.length} 個交易日三大法人合計賣超 ${Math.abs(法人買賣.summary.total5Day).toLocaleString('zh-TW')} 股。`);
      }

      if (持股分散?.largeHolderRatioDelta !== null) {
        觀察摘要.push(
          `大戶持股比 ${持股分散.largeHolderRatio.toFixed(2)}%，相較前次 ${持股分散.largeHolderRatioDelta >= 0 ? '增加' : '減少'} ${Math.abs(持股分散.largeHolderRatioDelta).toFixed(2)} 個百分點。`,
        );
      }

      if (融資融券?.觀察摘要?.length) {
        觀察摘要.push(融資融券.觀察摘要[0]);
      }

      if (主動ETF曝光?.count) {
        const 最高權重ETF = 主動ETF曝光.items?.[0];
        const 描述 =
          最高權重ETF?.weight !== null && 最高權重ETF?.weight !== undefined
            ? `${最高權重ETF.etfName} 權重 ${最高權重ETF.weight.toFixed(2)}%`
            : 最高權重ETF?.etfName ?? '已串接主動式 ETF';
        觀察摘要.push(`目前有 ${主動ETF曝光.count} 檔已串接主動式 ETF 持有這檔個股，最高權重來自 ${描述}。`);
      }

      const 個股資料 = {
        ...技術資料,
        盤中走勢,
        name: item.name,
        priceDate: 技術資料.priceDate,
        公司概況,
        評價面,
        財務資料,
        法人買賣,
        持股分散,
        融資融券,
        主動ETF曝光,
        觀察摘要: 觀察摘要.slice(0, 5),
        資料來源: [
          'Yahoo Finance Chart API',
          'TWSE T86',
          'TDCC 1-5',
          'TWSE OpenAPI MI_MARGN',
          'TWSE OpenAPI t187ap03_L',
          'TWSE OpenAPI t187ap05_L',
          'TWSE OpenAPI t187ap06_L_*',
          'TWSE OpenAPI t187ap07_L_*',
          'TWSE OpenAPI BWIBBU_ALL',
        ],
      };

      待寫入資料.push({
        code: item.code,
        name: item.name,
        filePath: path.join(股票資料目錄, `${item.code}.json`),
        data: 個股資料,
        summary: 建立個股摘要資料({
          code: item.code,
          name: item.name,
          公司概況,
          技術資料,
          法人買賣,
          持股分散,
          融資融券,
          主動ETF曝光,
        }),
      });
    } catch (error) {
      console.error(`[股票略過] ${item.code}`, error instanceof Error ? error.message : String(error));
    }
  }

  const 摘要清單 = 待寫入資料.map((item) => item.summary);
  const 同產業比較索引 = 建立同產業比較索引(摘要清單);

  for (const item of 待寫入資料) {
    await 寫入JSON(item.filePath, {
      ...item.data,
      同產業比較: 同產業比較索引.get(item.code) ?? null,
    });
  }

  await 寫入JSON(path.join(股票資料目錄, 'index.json'), 摘要清單);
  return 摘要清單;
}

async function main() {
  await mkdir(ETF資料目錄, { recursive: true });
  await mkdir(個股新聞資料目錄, { recursive: true });

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
        detailAvailability: 'market',
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
  const 既有儀表板 = await 讀取JSON存在則回傳(path.join(資料目錄, 'dashboard.json'));
  const { 市場總覽, 全部個股, 個股索引, 評價索引 } = await 抓取市場總覽();
  const { 公司概況索引, 月營收索引, 綜合損益索引, 資產負債索引 } = await 抓取個股財務索引();
  let 日資料清單 = [];
  let 法人追蹤;

  try {
    日資料清單 = await 抓取近期法人資料(個股索引, 5);
    法人追蹤 = 抓取法人追蹤(日資料清單);
  } catch (error) {
    法人追蹤 = 既有儀表板?.法人追蹤 ?? {
      資料日期: null,
      回溯交易日: [],
      外資連買: [],
      投信連買: [],
      土洋對作: [],
      觀察摘要: ['法人日報暫時無法更新，先沿用前一次成功快照或改以技術面觀察。'],
      資料說明: [],
    };
    法人追蹤.資料說明 = [
      ...(法人追蹤.資料說明 ?? []),
      `本次更新未能重新抓取 T86：${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  const 期貨籌碼 = await 抓取期貨籌碼(市場總覽.資料日期);
  const tdcc索引 = await 抓取TDCC持股分級索引();

  for (const result of successes) {
    result.snapshot = 修正ETF快照文字(result.snapshot, result.etf, 個股索引);
    result.diff = 修正ETF異動文字(result.diff, 個股索引);

    await 寫入JSON(path.join(ETF資料目錄, result.etf.code, 'latest.json'), result.snapshot);
    await 寫入JSON(path.join(ETF資料目錄, result.etf.code, 'diff-latest.json'), result.diff);
  }

  await 寫入ETF市場資料(追蹤ETF清單, tdcc索引);
  const 個股候選清單 = 建立證券候選清單({ 市場總覽, 法人追蹤, ETF結果: successes });
  let 融資融券索引 = new Map();
  try {
    融資融券索引 = 建立融資融券索引(
      await 抓取JSON資料('https://openapi.twse.com.tw/v1/exchangeReport/MI_MARGN'),
      市場總覽.資料日期,
    );
  } catch (error) {
    console.warn(`[融資融券略過] ${error instanceof Error ? error.message : String(error)}`);
  }
  const 主動ETF曝光索引 = 建立主動ETF曝光索引(successes);
  const 個股摘要清單 = await 寫入個股明細資料(個股候選清單, 日資料清單, tdcc索引, {
    評價索引,
    公司概況索引,
    月營收索引,
    綜合損益索引,
    資產負債索引,
  }, {
    融資融券索引,
    主動ETF曝光索引,
  });
  await 批次抓取個股新聞(個股候選清單);
  const 股票搜尋索引 = 建立股票搜尋索引({
    全部個股,
    公司概況索引,
    評價索引,
    個股摘要清單,
  });
  const 主動ETF總覽 = 建立主動ETF總覽(successes, pending);
  const ETF重疊分析 = 建立ETF重疊分析(successes);
  const dashboard = {
    appName: '台股主動通',
    generatedAt: 取得現在ISO(現在),
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
    generatedAt: 取得現在ISO(現在),
    generatedAtLocalDate: 轉台北日期(現在),
    generatedAtLocalTime: 轉台北時間(現在),
    dashboardPath: 'data/dashboard.json',
    overlapPath: 'data/etf-overlap.json',
    stockIndexPath: 'data/stocks/index.json',
    stockSearchPath: 'data/stocks/search.json',
    stockNewsPathTemplate: 'data/stocks/news/{code}.json',
    trackedEtfs: 追蹤ETF清單,
    latestOverview: 追蹤ETF清單.map((etf) => {
      const result = successes.find((item) => item.etf.code === etf.code);
      const detailAvailability = result?.snapshot ? 'full' : 'market';
      return {
        code: etf.code,
        name: etf.name,
        fullName: etf.fullName,
        provider: etf.provider,
        providerLabel: etf.providerLabel,
        sourceName: etf.sourceName,
        sourceUrl: etf.sourceUrl,
        trackingStatus: etf.trackingStatus,
        detailAvailability,
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
    stockDetailCount: 個股候選清單.length,
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
  await 寫入JSON(path.join(資料目錄, 'stocks', 'search.json'), 股票搜尋索引);
  await 寫入JSON(path.join(資料目錄, 'manifest.json'), manifest);

  if (failures.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

