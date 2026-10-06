function compactText(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return compactText(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/,/g, '').replace(/[^\d.+-]/g, '');
  if (!cleaned || cleaned === '-') return null;
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : null;
}

function normalizeProviderDate(value) {
  const match = String(value ?? '').match(/(?:^|\D)(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\D|$)/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function findInputValue(html, id) {
  const input = String(html ?? '').match(new RegExp(`<input\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i'))?.[0];
  return input?.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? null;
}

function parseDefinitionTable(html) {
  return new Map(
    Array.from(
      String(html ?? '').matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi),
      (match) => [stripHtml(match[1]), stripHtml(match[2])],
    ),
  );
}

function normalizeHoldingCode(value) {
  return compactText(value).replace(/\s+TT$/i, '');
}

function isHoldingCode(value) {
  return /^[A-Z0-9][A-Z0-9./-]{0,15}(?:\s+[A-Z]{2,3})?$/.test(String(value ?? ''));
}

function parseFourColumnStockRows(html) {
  const holdings = [];

  for (const rowMatch of String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from(
      rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
      (match) => stripHtml(match[1]),
    );

    if (cells.length !== 4 || !/%/.test(cells[3])) continue;

    const code = normalizeHoldingCode(cells[0]);
    const shares = toNumber(cells[2]);
    const weight = toNumber(cells[3]);

    if (!isHoldingCode(code) || !cells[1] || shares === null || weight === null) continue;
    holdings.push({ code, name: cells[1], shares, weight });
  }

  return holdings;
}

function parseMegaDesktopRows(html) {
  return Array.from(
    String(html ?? '').matchAll(
      /<div\b[^>]*class=["'][^"']*(?:fund-info[^"']*content-list-1|content-list-1[^"']*fund-info)[^"']*["'][^>]*>\s*<div\b[^>]*class=["'][^"']*fund-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class=["'][^"']*fund-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class=["'][^"']*fund-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class=["'][^"']*fund-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
    ),
    (match) => ({
      code: normalizeHoldingCode(stripHtml(match[1])),
      name: stripHtml(match[2]),
      shares: toNumber(match[3]),
      weight: toNumber(match[4]),
    }),
  ).filter((item) => isHoldingCode(item.code) && item.name && item.shares !== null && item.weight !== null);
}

function assertMatchingHoldings(label, primary, secondary) {
  if (primary.length !== secondary.length) {
    throw new Error(`${label}桌面版與行動版持股筆數不一致：${primary.length} / ${secondary.length}`);
  }

  for (let index = 0; index < primary.length; index += 1) {
    const left = primary[index];
    const right = secondary[index];
    if (
      left.code !== right.code ||
      left.name !== right.name ||
      left.shares !== right.shares ||
      left.weight !== right.weight
    ) {
      throw new Error(`${label}桌面版與行動版持股內容不一致：第 ${index + 1} 筆`);
    }
  }
}

function assertParsedSnapshot(
  label,
  snapshot,
  responseLength,
  {
    minimumHoldings = 1,
    requirePositiveAssets = false,
    requirePositiveWeights = false,
    declaredStockWeight = null,
    declaredWeightTolerance = 0.75,
  } = {},
) {
  if (!snapshot.disclosureDate) {
    throw new Error(`${label}回應缺少揭露日期（回應 ${responseLength} 字元）`);
  }
  if (snapshot.holdings.length < minimumHoldings) {
    throw new Error(
      `${label}回應持股筆數僅 ${snapshot.holdings.length}，低於最低 ${minimumHoldings} 筆（回應 ${responseLength} 字元）`,
    );
  }

  if (
    requirePositiveAssets &&
    (![snapshot.aum, snapshot.nav, snapshot.units].every((value) => Number.isFinite(value) && value > 0))
  ) {
    throw new Error(`${label}回應資產數值缺漏或異常（回應 ${responseLength} 字元）`);
  }

  const seenCodes = new Set();
  for (const holding of snapshot.holdings) {
    if (seenCodes.has(holding.code)) {
      throw new Error(`${label}回應持股代號重複：${holding.code}`);
    }
    seenCodes.add(holding.code);
    if (!Number.isFinite(holding.shares) || holding.shares < 0) {
      throw new Error(`${label}回應持股股數異常：${holding.code}`);
    }
    if (
      !Number.isFinite(holding.weight) ||
      holding.weight < 0 ||
      holding.weight > 100 ||
      (requirePositiveWeights && holding.weight === 0)
    ) {
      throw new Error(`${label}回應持股權重異常：${holding.code}`);
    }
  }

  if (Number.isFinite(declaredStockWeight)) {
    const totalWeight = snapshot.holdings.reduce((total, item) => total + item.weight, 0);
    if (Math.abs(totalWeight - declaredStockWeight) > declaredWeightTolerance) {
      throw new Error(
        `${label}持股權重合計 ${totalWeight.toFixed(2)}% 與頁面宣告 ${declaredStockWeight.toFixed(2)}% 不符`,
      );
    }
  }
  return snapshot;
}

export function parseTaishinEtfHtml(html, { expectedCode, minimumHoldings = 5 } = {}) {
  const content = String(html ?? '');
  const actualCode = compactText(findInputValue(content, 'ETF_ID'));
  if (expectedCode && actualCode !== expectedCode) {
    throw new Error(`台新 ETF 回應基金代號不符：預期 ${expectedCode}，實際 ${actualCode || '<missing>'}`);
  }
  const fields = parseDefinitionTable(content);
  const declaredStockWeight = toNumber(
    content.match(/<td\b[^>]*>\s*股票合計\s*<\/td>\s*<td\b[^>]*>\s*([\d.]+)\s*%\s*<\/td>/i)?.[1],
  );
  if (!Number.isFinite(declaredStockWeight) || declaredStockWeight <= 0 || declaredStockWeight > 100) {
    throw new Error('台新 ETF 回應缺少有效的股票合計比重');
  }
  const snapshot = {
    disclosureDate: normalizeProviderDate(
      findInputValue(content, 'PUB_DATE') ?? findInputValue(content, 'DATA_DATE'),
    ),
    aum: toNumber(fields.get('基金淨資產價值(元)')),
    nav: toNumber(fields.get('每受益權單位淨資產價值(元)')),
    units: toNumber(fields.get('已發行受益權單位總數(單位)') ?? fields.get('已發行受益權單位總數')),
    holdings: parseFourColumnStockRows(content),
  };

  return assertParsedSnapshot('台新 ETF ', snapshot, content.length, {
    minimumHoldings,
    requirePositiveWeights: true,
    declaredStockWeight,
    declaredWeightTolerance: 0.01,
  });
}

export function parseMegaEtfHtml(
  html,
  { expectedCode = null, requireMirroredTables = false } = {},
) {
  const content = String(html ?? '');
  if (expectedCode) {
    const escapedCode = expectedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\b${escapedCode}\\s+TT\\s+Equity\\b`, 'i').test(stripHtml(content))) {
      throw new Error(`兆豐 ETF 回應基金代號不符：預期 ${expectedCode}`);
    }
  }
  const assetFields = new Map(
    Array.from(
      content.matchAll(
        /<div\b[^>]*class=["'][^"']*si-title[^"']*["'][^>]*>\s*([\s\S]*?)\s*<\/div>\s*<div\b[^>]*class=["'][^"']*si-amount[^"']*["'][^>]*>\s*([\s\S]*?)\s*<\/div>/gi,
      ),
      (match) => [stripHtml(match[1]), stripHtml(match[2])],
    ),
  );
  const tableHoldings = parseFourColumnStockRows(content);
  const desktopHoldings = tableHoldings.length ? tableHoldings : parseMegaDesktopRows(content);
  const mobileHoldings = Array.from(
    content.matchAll(
      /<div\b[^>]*class=["'][^"']*common-mobile-table[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*item-title[^"']*["'][^>]*>股票代號<\/div>\s*<div\b[^>]*class=["'][^"']*item-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div\b[^>]*class=["'][^"']*common-table-item[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*item-title[^"']*["'][^>]*>股票名稱<\/div>\s*<div\b[^>]*class=["'][^"']*item-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div\b[^>]*class=["'][^"']*common-table-item[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*item-title[^"']*["'][^>]*>股數<\/div>\s*<div\b[^>]*class=["'][^"']*item-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div\b[^>]*class=["'][^"']*common-table-item[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*item-title[^"']*["'][^>]*>持股權重<\/div>\s*<div\b[^>]*class=["'][^"']*item-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    ),
    (match) => ({
      code: normalizeHoldingCode(stripHtml(match[1])),
      name: stripHtml(match[2]),
      shares: toNumber(match[3]),
      weight: toNumber(match[4]),
    }),
  ).filter((item) => isHoldingCode(item.code) && item.name && item.shares !== null && item.weight !== null);
  if (requireMirroredTables && (!desktopHoldings.length || !mobileHoldings.length)) {
    throw new Error('兆豐 ETF 回應缺少桌面版或行動版持股表');
  }
  if (desktopHoldings.length && mobileHoldings.length) {
    assertMatchingHoldings('兆豐 ETF ', desktopHoldings, mobileHoldings);
  }
  const declaredStockWeight = toNumber(
    stripHtml(content).match(/股票\s*\(\s*([\d.]+)\s*%\s*\)/)?.[1],
  );
  if (!Number.isFinite(declaredStockWeight) || declaredStockWeight <= 0 || declaredStockWeight > 100) {
    throw new Error('兆豐 ETF 回應缺少有效的股票配置比重');
  }
  if (!/\bid=["']more1["']/i.test(content)) {
    throw new Error('兆豐 ETF 回應缺少持股表尾標記');
  }
  const snapshot = {
    disclosureDate: normalizeProviderDate(
      content.match(/資料來源：[^，]+，\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2})/)?.[1],
    ),
    aum: toNumber(assetFields.get('淨資產價值')),
    nav: toNumber(assetFields.get('每單位淨值')),
    units: toNumber(assetFields.get('在外流通單位數')),
    holdings: desktopHoldings.length ? desktopHoldings : mobileHoldings,
  };

  return assertParsedSnapshot('兆豐 ETF ', snapshot, content.length, {
    minimumHoldings: 5,
    requirePositiveAssets: true,
    requirePositiveWeights: true,
    declaredStockWeight,
    declaredWeightTolerance: 0.35,
  });
}

export async function fetchTaishinProviderData({ code, sourceUrl, targetDate, fetchHtml }) {
  const pcfUrl = new URL(`/ETF/Home/Pcf/${encodeURIComponent(code)}`, sourceUrl);
  pcfUrl.searchParams.set('FundType', 'ALL');
  const normalizedTargetDate = normalizeProviderDate(targetDate);
  if (targetDate && !normalizedTargetDate) {
    throw new Error(`台新 ETF 目標日期格式錯誤：${targetDate}`);
  }
  if (normalizedTargetDate) {
    pcfUrl.searchParams.set('DataDate', normalizedTargetDate);
  }
  const candidates = [
    { label: '申購買回清單', url: pcfUrl.toString(), transport: 'pcf' },
    { label: '產品頁', url: sourceUrl, transport: 'product-page' },
  ];
  const errors = [];

  for (const candidate of candidates) {
    try {
      const data = parseTaishinEtfHtml(await fetchHtml(candidate.url), {
        expectedCode: code,
        minimumHoldings: 5,
      });
      if (normalizedTargetDate && data.disclosureDate > normalizedTargetDate) {
        throw new Error(`回應日期 ${data.disclosureDate} 晚於目標日期 ${normalizedTargetDate}`);
      }
      return {
        data,
        transport: candidate.transport,
        fallbackReason: errors.length ? errors.join('；') : null,
      };
    } catch (error) {
      errors.push(`${candidate.label}：${getErrorMessage(error)}`);
    }
  }

  throw new Error(`台新 ETF 官方來源無法更新：${errors.join('；')}`);
}

export async function fetchMegaProviderData({ code, sourceUrl, fetchDirectHtml, fetchReaderHtml }) {
  let directError;
  try {
    return {
      data: parseMegaEtfHtml(await fetchDirectHtml(sourceUrl), {
        expectedCode: code,
        requireMirroredTables: true,
      }),
      transport: 'product-page',
      fallbackReason: null,
    };
  } catch (error) {
    directError = error;
  }

  try {
    return {
      data: parseMegaEtfHtml(await fetchReaderHtml(sourceUrl), {
        expectedCode: code,
        requireMirroredTables: true,
      }),
      transport: 'reader-proxy',
      fallbackReason: `產品頁：${getErrorMessage(directError)}`,
    };
  } catch (readerError) {
    throw new Error(
      `兆豐 ETF 官方來源無法更新：產品頁：${getErrorMessage(directError)}；Reader 備援：${getErrorMessage(readerError)}`,
    );
  }
}
