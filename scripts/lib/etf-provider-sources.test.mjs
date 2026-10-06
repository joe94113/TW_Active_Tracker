import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchMegaProviderData,
  fetchTaishinProviderData,
  parseMegaEtfHtml,
  parseTaishinEtfHtml,
} from './etf-provider-sources.mjs';

const sourceUrl = 'https://www.megafunds.com.tw/MEGA/etf/etf_product.aspx?id=23';
const holdings = [
  ['2330', '台積電', '147,000', '40.00'],
  ['2454', '聯發科', '56,000', '25.00'],
  ['2308', '台達電', '115,000', '15.00'],
  ['2327', '國巨', '352,000', '10.00'],
  ['NVDA US', 'NVIDIA', '1,200', '5.00'],
];

function makeTaishinFixture({ code = '00987A', date = '2026-10-06', rows = holdings } = {}) {
  return `
    <input id="ETF_ID" value="${code}">
    <input value="${date}" id="PUB_DATE">
    <table>
      <tr><th>基金淨資產價值(元)</th><td>TWD 2,649,048,148</td></tr>
      <tr><th>每受益權單位淨資產價值(元)</th><td>TWD 18.44</td></tr>
      <tr><th> 已發行受益權單位總數 </th><td>143,643,000</td></tr>
      ${rows.map(([codeValue, name, shares, weight]) => (
        `<tr><td class="code">${codeValue} TT</td><td>${name}</td><td>${shares}</td><td>${weight}%</td></tr>`
      )).join('\n')}
      <tr><td colspan="3">股票合計</td><td>95.00%</td></tr>
    </table>
  `;
}

function makeMegaHtmlFixture({
  code = '00996A',
  date = '2026/10/06',
  rows = holdings,
  declaredWeight = '95.00',
  includeDesktopTable = true,
  includeMobileTable = true,
  includeSentinel = true,
} = {}) {
  return `
    <div class="etfin-content"><div>彭博代碼</div><div>${code} TT Equity</div></div>
    <p>資料來源：兆豐投信，${date}</p>
    <div class="si-title">淨資產價值</div><div class="si-amount">4,298,382,142</div>
    <div class="si-title">在外流通單位數</div><div class="si-amount">280,399,000</div>
    <div class="si-title">每單位淨值</div><div class="si-amount">15.33</div>
    <div class="fund-title">股票 ( ${declaredWeight}% )</div>
    ${includeDesktopTable ? `<div id="fund_content_list_1">
      ${rows.map(([rowCode, name, shares, weight]) => `
        <div class="fund-info content-list-1">
          <div class="fund-content">${rowCode}</div>
          <div class="fund-content">${name}</div>
          <div class="fund-content txt-right">${shares}</div>
          <div class="fund-content txt-right">${weight}%</div>
        </div>
      `).join('\n')}
    </div>` : ''}
    ${includeMobileTable ? `<div id="fund_content_list_1_mobile">
      ${rows.map(([rowCode, name, shares, weight]) => `
        <div class="common-mobile-table">
          <div class="common-table-item"><div class="item-title">股票代號</div><div class="item-content">${rowCode}</div></div>
          <div class="common-table-item"><div class="item-title">股票名稱</div><div class="item-content">${name}</div></div>
          <div class="common-table-item"><div class="item-title">股數</div><div class="item-content">${shares}</div></div>
          <div class="common-table-item"><div class="item-title">持股權重</div><div class="item-content">${weight}%</div></div>
        </div>
      `).join('\n')}
    </div>` : ''}
    ${includeSentinel ? '<a id="more1">看更多</a>' : ''}
  `;
}

const megaParserOptions = { expectedCode: '00996A', requireMirroredTables: true };

test('parses Taishin rows, validates the fund code, and normalizes provider dates', () => {
  const snapshot = parseTaishinEtfHtml(
    makeTaishinFixture({ date: '2026/10/7 上午 12:00:00' }),
    { expectedCode: '00987A' },
  );
  assert.equal(snapshot.disclosureDate, '2026-10-07');
  assert.equal(snapshot.aum, 2_649_048_148);
  assert.equal(snapshot.nav, 18.44);
  assert.equal(snapshot.units, 143_643_000);
  assert.deepEqual(snapshot.holdings.map((item) => item.code), ['2330', '2454', '2308', '2327', 'NVDA US']);
});

test('rejects a Taishin response for a different fund', () => {
  assert.throws(
    () => parseTaishinEtfHtml(makeTaishinFixture({ code: '00970B' }), { expectedCode: '00987A' }),
    /基金代號不符/,
  );
});

test('Taishin provider requests the target date instead of accepting next-day PCF data', async () => {
  const calls = [];
  const result = await fetchTaishinProviderData({
    code: '00987A',
    sourceUrl: 'https://www.tsit.com.tw/ETF/Home/ETFSeriesDetail/00987A',
    targetDate: '2026-10-06',
    fetchHtml: async (url) => {
      calls.push(url);
      return url.includes('DataDate=2026-10-06')
        ? makeTaishinFixture({ date: '2026-10-06' })
        : makeTaishinFixture({ date: '2026-10-07' });
    },
  });

  assert.equal(result.data.disclosureDate, '2026-10-06');
  assert.equal(result.transport, 'pcf');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /DataDate=2026-10-06/);
});

test('Taishin provider falls back from an empty PCF response to the product page', async () => {
  const calls = [];
  const result = await fetchTaishinProviderData({
    code: '00987A',
    sourceUrl: 'https://www.tsit.com.tw/ETF/Home/ETFSeriesDetail/00987A',
    targetDate: '2026-10-06',
    fetchHtml: async (url) => {
      calls.push(url);
      return calls.length === 1
        ? '<input id="ETF_ID" value="00987A"><input id="PUB_DATE" value="2026-10-06"><table><tr><td colspan="3">股票合計</td><td>95.00%</td></tr></table>'
        : makeTaishinFixture();
    },
  });

  assert.equal(result.transport, 'product-page');
  assert.match(result.fallbackReason, /低於最低 5 筆/);
  assert.match(calls[0], /\/ETF\/Home\/Pcf\/00987A\?FundType=ALL&DataDate=2026-10-06$/);
});

test('Taishin provider rejects future-dated fallback data', async () => {
  await assert.rejects(
    fetchTaishinProviderData({
      code: '00987A',
      sourceUrl: 'https://www.tsit.com.tw/ETF/Home/ETFSeriesDetail/00987A',
      targetDate: '2026-10-06',
      fetchHtml: async (url) => url.includes('/Pcf/')
        ? '<input id="ETF_ID" value="00987A"><input id="PUB_DATE" value="2026-10-06">'
        : makeTaishinFixture({ date: '2026-10-07' }),
    }),
    /晚於目標日期/,
  );
});

test('rejects Taishin data truncated at a complete row boundary', () => {
  const partialRows = holdings.map((row, index) => (
    index === 0 ? [row[0], row[1], row[2], '10.00'] : row
  ));
  assert.throws(
    () => parseTaishinEtfHtml(makeTaishinFixture({ rows: partialRows }), { expectedCode: '00987A' }),
    /與頁面宣告 .* 不符/,
  );
});

test('parses and cross-checks Mega desktop and mobile tables', () => {
  const snapshot = parseMegaEtfHtml(makeMegaHtmlFixture(), megaParserOptions);
  assert.equal(snapshot.disclosureDate, '2026-10-06');
  assert.equal(snapshot.aum, 4_298_382_142);
  assert.equal(snapshot.nav, 15.33);
  assert.equal(snapshot.units, 280_399_000);
  assert.equal(snapshot.holdings.length, 5);
});

test('supports the mobile-only structure when mirrored validation is not requested', () => {
  const snapshot = parseMegaEtfHtml(makeMegaHtmlFixture({ includeDesktopTable: false }));
  assert.equal(snapshot.holdings.length, 5);
});

test('rejects wrong fund identity, missing mirrors, and a missing end marker', () => {
  assert.throws(
    () => parseMegaEtfHtml(makeMegaHtmlFixture({ code: '00999X' }), megaParserOptions),
    /基金代號不符/,
  );
  assert.throws(
    () => parseMegaEtfHtml(makeMegaHtmlFixture({ includeMobileTable: false }), megaParserOptions),
    /缺少桌面版或行動版持股表/,
  );
  assert.throws(
    () => parseMegaEtfHtml(makeMegaHtmlFixture({ includeSentinel: false }), megaParserOptions),
    /缺少持股表尾標記/,
  );
});

test('rejects mismatched mirrored Mega tables', () => {
  const html = makeMegaHtmlFixture().replace(
    '<div class="item-content">NVIDIA</div>',
    '<div class="item-content">WRONG</div>',
  );
  assert.throws(() => parseMegaEtfHtml(html, megaParserOptions), /桌面版與行動版持股內容不一致/);
});

test('rejects truncated Mega tables using the declared stock allocation', () => {
  const shortenedRows = [
    ['2330', '台積電', '147,000', '94.16'],
    ['2454', '聯發科', '56,000', '0.05'],
    ['2308', '台達電', '115,000', '0.04'],
    ['2327', '國巨', '352,000', '0.03'],
    ['3008', '大立光', '10,000', '0.02'],
  ];
  assert.throws(
    () => parseMegaEtfHtml(
      makeMegaHtmlFixture({ rows: shortenedRows, declaredWeight: '94.85' }),
      megaParserOptions,
    ),
    /與頁面宣告 .* 不符/,
  );
});

test('rejects malformed Mega dates, assets, and declared allocation', () => {
  assert.throws(
    () => parseMegaEtfHtml(makeMegaHtmlFixture({ date: '2026/99/99' }), megaParserOptions),
    /缺少揭露日期/,
  );
  assert.throws(
    () => parseMegaEtfHtml(
      makeMegaHtmlFixture().replace('4,298,382,142', 'not-a-number'),
      megaParserOptions,
    ),
    /資產數值缺漏或異常/,
  );
  assert.throws(
    () => parseMegaEtfHtml(makeMegaHtmlFixture({ declaredWeight: '500.00' }), megaParserOptions),
    /缺少有效的股票配置比重/,
  );
});

test('Mega provider does not call Reader when the direct official page succeeds', async () => {
  let readerCalls = 0;
  const result = await fetchMegaProviderData({
    code: '00996A',
    sourceUrl,
    fetchDirectHtml: async () => makeMegaHtmlFixture(),
    fetchReaderHtml: async () => {
      readerCalls += 1;
      return makeMegaHtmlFixture();
    },
  });

  assert.equal(result.transport, 'product-page');
  assert.equal(readerCalls, 0);
});

test('Mega provider uses validated Reader HTML only after the direct page fails', async () => {
  let readerCalls = 0;
  const result = await fetchMegaProviderData({
    code: '00996A',
    sourceUrl,
    fetchDirectHtml: async () => {
      throw Object.assign(new Error('HTTP 403 Forbidden'), { status: 403 });
    },
    fetchReaderHtml: async () => {
      readerCalls += 1;
      return makeMegaHtmlFixture();
    },
  });

  assert.equal(result.transport, 'reader-proxy');
  assert.match(result.fallbackReason, /403/);
  assert.equal(readerCalls, 1);
});

test('Mega provider reports both direct and Reader failures', async () => {
  await assert.rejects(
    fetchMegaProviderData({
      code: '00996A',
      sourceUrl,
      fetchDirectHtml: async () => { throw new Error('direct failed'); },
      fetchReaderHtml: async () => { throw new Error('reader failed'); },
    }),
    /產品頁：direct failed；Reader 備援：reader failed/,
  );
});
