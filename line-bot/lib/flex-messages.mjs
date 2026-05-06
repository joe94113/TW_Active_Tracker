const BRAND_NAME = '台股主動通';
const BRAND_ICON_URL = 'https://joe94113.github.io/TW_Active_Tracker/icon-128.png';

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}%`;
}

function formatSigned(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${formatNumber(number, digits)}`;
}

function formatLots(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const lots = Number(value) / 1000;
  const absoluteLots = Math.abs(lots);

  if (absoluteLots >= 10000) {
    return `${(lots / 10000).toFixed(2)} 萬張`;
  }

  return `${new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(lots)} 張`;
}

function createText(text, options = {}) {
  return {
    type: 'text',
    text,
    wrap: options.wrap ?? true,
    size: options.size ?? 'sm',
    color: options.color ?? '#10202d',
    weight: options.weight ?? 'regular',
    flex: options.flex ?? 0,
    align: options.align,
  };
}

function createPill(text, options = {}) {
  return {
    type: 'box',
    layout: 'baseline',
    paddingAll: '6px',
    paddingStart: '8px',
    paddingEnd: '8px',
    backgroundColor: options.backgroundColor ?? '#eef6fb',
    cornerRadius: '999px',
    contents: [
      createText(text, {
        size: options.size ?? 'xxs',
        color: options.color ?? '#0b699b',
        weight: options.weight ?? 'bold',
      }),
    ],
  };
}

function createMetric(label, value) {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      createText(label, { size: 'xs', color: '#6b7a86', flex: 3 }),
      createText(value, { size: 'sm', weight: 'bold', color: '#10202d', flex: 5 }),
    ],
  };
}

function createSection(contents, options = {}) {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: options.spacing ?? 'sm',
    paddingAll: options.paddingAll ?? '12px',
    backgroundColor: options.backgroundColor ?? '#f7fbff',
    borderColor: options.borderColor ?? '#d7e7f1',
    borderWidth: '1px',
    cornerRadius: options.cornerRadius ?? '16px',
    contents,
  };
}

function createMetricGrid(items = []) {
  const rows = [];
  const validItems = items.filter((item) => item?.value);

  for (let index = 0; index < validItems.length; index += 2) {
    rows.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: validItems.slice(index, index + 2).map((item) => ({
        type: 'box',
        layout: 'vertical',
        spacing: '2px',
        paddingAll: '10px',
        backgroundColor: item.backgroundColor ?? '#ffffff',
        cornerRadius: '12px',
        flex: 1,
        contents: [
          createText(item.label, { size: 'xxs', color: '#6b7a86' }),
          createText(item.value, { size: 'sm', color: '#10202d', weight: 'bold' }),
        ],
      })),
    });
  }

  return rows;
}

function createBubble({ title, accentColor, contents = [], linkUrl, footerText = '打開網站', bodyBackgroundColor = '#ffffff' }) {
  return {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '14px',
      backgroundColor: accentColor,
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          alignItems: 'center',
          contents: [
            {
              type: 'image',
              url: BRAND_ICON_URL,
              size: '28px',
              aspectMode: 'cover',
              aspectRatio: '1:1',
            },
            createText(BRAND_NAME, { size: 'xxs', color: '#dff4ff', weight: 'bold', flex: 1 }),
          ],
        },
        createText(title, {
          size: 'lg',
          color: '#ffffff',
          weight: 'bold',
        }),
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '16px',
      backgroundColor: bodyBackgroundColor,
      contents,
    },
    footer: linkUrl
      ? {
          type: 'box',
          layout: 'vertical',
          paddingAll: '12px',
          contents: [
            {
              type: 'button',
              style: 'link',
              height: 'sm',
              action: {
                type: 'uri',
                label: footerText,
                uri: linkUrl,
              },
            },
          ],
        }
      : undefined,
  };
}

function createFlexMessage(altText, contents, quickReplyItems) {
  const message = {
    type: 'flex',
    altText,
    contents,
  };

  if (quickReplyItems?.length) {
    message.quickReply = {
      items: quickReplyItems.map((item) => ({
        type: 'action',
        action: {
          type: 'message',
          label: item.label,
          text: item.text,
        },
      })),
    };
  }

  return message;
}

function getQuickReplyPreset() {
  return [
    { label: '盤勢', text: '盤勢' },
    { label: '選股', text: '選股' },
    { label: '起漲', text: '起漲' },
    { label: '題材', text: '題材' },
    { label: 'ETF', text: 'ETF' },
    { label: '分點', text: '分點' },
    { label: '國際盤', text: '國際盤' },
    { label: '教學', text: '教學' },
  ];
}

export function buildWelcomeFlex(siteUrl) {
  return createFlexMessage(
    `${BRAND_NAME}｜功能導覽`,
    createBubble({
      title: '關鍵字快速查',
      accentColor: '#0b699b',
      linkUrl: `${siteUrl}#/`,
      footerText: '打開台股主動通',
      bodyBackgroundColor: '#f9fcff',
      contents: [
        createText('直接傳關鍵字給我，就能回你對應的市場摘要與研究頁入口。', {
          size: 'xs',
          color: '#4b5c68',
        }),
        createSection(
          [
            createMetric('盤勢', '看加權、廣度、主線題材'),
            createMetric('選股', '看穩健型與積極型'),
            createMetric('起漲', '看剛轉強與待突破名單'),
            createMetric('題材', '看資金輪動與龍頭股'),
            createMetric('ETF', '看主動式 / 高息 ETF 觀察'),
            createMetric('教學', '新手快速上手股票研究'),
          ],
          {
            backgroundColor: '#f4f9fd',
            borderColor: '#d7e7f1',
          },
        ),
        createText('也可以直接輸入 4 碼股票代號，例如 2330、2455。', {
          size: 'xs',
          color: '#6b7a86',
        }),
      ],
    }),
    getQuickReplyPreset(),
  );
}

export function buildMarketFlex({ dashboard, siteUrl }) {
  const marketSummary = dashboard?.市場總覽?.大盤摘要 ?? {};
  const breadth = dashboard?.市場總覽?.市場廣度 ?? {};
  const mood = breadth?.情緒標籤 ?? breadth?.市場情緒 ?? '輪動整理';
  const advancers = breadth?.股票市場?.上漲 ?? breadth?.上漲家數 ?? null;
  const decliners = breadth?.股票市場?.下跌 ?? breadth?.下跌家數 ?? null;
  const topLines = (dashboard?.市場總覽?.盤後重點卡 ?? dashboard?.市場總覽?.觀察重點 ?? [])
    .map((item) => item?.觀察 ?? item?.重點 ?? item?.observation ?? item)
    .filter(Boolean)
    .slice(0, 4);

  return createFlexMessage(
    `${BRAND_NAME}｜盤勢`,
    createBubble({
      title: `${dashboard?.appName ?? BRAND_NAME}｜盤勢快讀`,
      accentColor: Number(marketSummary?.漲跌點數 ?? 0) >= 0 ? '#13885e' : '#8a5a7b',
      linkUrl: `${siteUrl}#/`,
      footerText: '打開首頁',
      bodyBackgroundColor: '#f9fcff',
      contents: [
        createSection(
          [
            {
              type: 'box',
              layout: 'horizontal',
              justifyContent: 'space-between',
              alignItems: 'center',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: '2px',
                  flex: 1,
                  contents: [
                    createText('加權指數', { size: 'xxs', color: '#6b7a86' }),
                    createText(formatNumber(marketSummary?.加權指數), {
                      size: 'xl',
                      weight: 'bold',
                      color: '#10202d',
                    }),
                  ],
                },
                createPill(`${formatSigned(marketSummary?.漲跌點數)} / ${formatPercent(marketSummary?.漲跌幅)}`, {
                  backgroundColor: Number(marketSummary?.漲跌點數 ?? 0) >= 0 ? '#eef8f2' : '#fff1ed',
                  color: Number(marketSummary?.漲跌點數 ?? 0) >= 0 ? '#13885e' : '#c75b39',
                }),
              ],
            },
            ...createMetricGrid([
              { label: '市場情緒', value: mood },
              { label: '強弱比', value: formatNumber(breadth?.強弱比) },
              { label: '上漲家數', value: advancers === null ? null : formatNumber(advancers, 0), backgroundColor: '#f5fcf7' },
              { label: '下跌家數', value: decliners === null ? null : formatNumber(decliners, 0), backgroundColor: '#fff6f3' },
            ]),
          ],
          {
            backgroundColor: '#f4f9fd',
            borderColor: '#d7e7f1',
          },
        ),
        createSection(
          [
            createText('今日重點', { size: 'xxs', color: '#6b7a86', weight: 'bold' }),
            ...(topLines.length
              ? topLines.map((line) => createText(`• ${line}`, { size: 'xs', color: '#4b5c68' }))
              : [createText('• 今日盤後重點整理中。', { size: 'xs', color: '#6b7a86' })]),
          ],
          {
            backgroundColor: '#ffffff',
            borderColor: '#e4eef5',
          },
        ),
      ],
    }),
    getQuickReplyPreset(),
  );
}

export function buildThemeFlex({ topicIndex, siteUrl }) {
  const topics = topicIndex?.topics?.slice(0, 3) ?? [];

  const contents = topics.length
    ? topics.map((topic) =>
        createBubble({
          title: topic.title,
          accentColor: topic.tone === 'up' ? '#13885e' : topic.tone === 'down' ? '#8a5a7b' : '#0b699b',
          linkUrl: `${siteUrl}#/themes`,
          footerText: '打開資金題材雷達',
          bodyBackgroundColor: '#f9fcff',
          contents: [
            createSection(
              [
                createText(topic.observation ?? '近期市場對這個題材有明顯關注。', {
                  size: 'xs',
                  color: '#4b5c68',
                }),
                ...createMetricGrid([
                  { label: '題材分數', value: formatNumber(topic.score, 0) },
                  { label: '新聞熱度', value: formatNumber(topic.newsCount, 0) },
                  { label: '龍頭股', value: topic.leaderStocks?.[0] ? `${topic.leaderStocks[0].code} ${topic.leaderStocks[0].name}` : null },
                  { label: '補漲股', value: topic.catchUpStocks?.[0] ? `${topic.catchUpStocks[0].code} ${topic.catchUpStocks[0].name}` : null },
                ]),
              ],
              {
                backgroundColor: '#f4f9fd',
                borderColor: '#d7e7f1',
              },
            ),
            createSection(
              [
                createText('關鍵詞', { size: 'xxs', color: '#6b7a86', weight: 'bold' }),
                createText(
                  (topic.keywords ?? [])
                    .slice(0, 3)
                    .map((keyword) => keyword.keyword ?? keyword)
                    .join(' / ') || '等待題材關鍵詞更新',
                  {
                    size: 'xs',
                    color: '#4b5c68',
                  },
                ),
              ],
              {
                backgroundColor: '#ffffff',
                borderColor: '#e4eef5',
              },
            ),
          ],
        }),
      )
    : [
        createBubble({
          title: '題材熱度整理中',
          accentColor: '#0b699b',
          linkUrl: `${siteUrl}#/themes`,
          footerText: '打開資金題材雷達',
          bodyBackgroundColor: '#f9fcff',
          contents: [createText('目前沒有可用的題材資料。', { size: 'xs', color: '#6b7a86' })],
        }),
      ];

  return createFlexMessage(
    `${BRAND_NAME}｜題材`,
    {
      type: 'carousel',
      contents,
    },
    getQuickReplyPreset(),
  );
}

function createStockCardBubble(item, options = {}) {
  const accentColor = options.accentColor ?? '#0b699b';
  const lotsLabel = item.volumeLots ?? item.volume ? formatLots(item.volume ?? item.volumeLots * 1000) : null;
  const targetText =
    item.foreignTargetPrice === null || item.foreignTargetPrice === undefined
      ? null
      : `${formatNumber(item.foreignTargetPrice)} 元${
          item.premiumToTarget === null || item.premiumToTarget === undefined
            ? ''
            : `｜空間 ${formatPercent(item.premiumToTarget)}`
        }`;

  return createBubble({
    title: `${item.code} ${item.name}`,
    accentColor,
    linkUrl: `${options.siteUrl}#/stocks/${item.code}`,
    footerText: '打開個股頁',
    bodyBackgroundColor: options.backgroundColor ?? '#f9fcff',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          createPill(item.label ?? item.topSignalTitle ?? '觀察', {
            backgroundColor: `${accentColor}18`,
            color: accentColor,
          }),
          ...(item.setupTag
            ? [
                createPill(item.setupTag, {
                  backgroundColor: '#fff3eb',
                  color: '#c75b39',
                }),
              ]
            : []),
        ],
      },
      createSection(
        [
          {
            type: 'box',
            layout: 'horizontal',
            justifyContent: 'space-between',
            alignItems: 'center',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                spacing: '2px',
                flex: 1,
                contents: [
                  createText('收盤價', { size: 'xxs', color: '#6b7a86' }),
                  createText(item.close === null || item.close === undefined ? '—' : `${formatNumber(item.close)} 元`, {
                    size: 'xl',
                    weight: 'bold',
                    color: '#10202d',
                  }),
                ],
              },
              createPill(`單日 ${formatPercent(item.changePercent)}`, {
                backgroundColor: (item.changePercent ?? 0) >= 0 ? '#eef8f2' : '#fff1ed',
                color: (item.changePercent ?? 0) >= 0 ? '#13885e' : '#c75b39',
              }),
            ],
          },
          ...createMetricGrid([
            { label: '20日', value: formatPercent(item.return20), backgroundColor: '#ffffff' },
            { label: '量能', value: lotsLabel, backgroundColor: '#ffffff' },
            { label: '題材', value: item.themeTitle ?? item.topicTag ?? null, backgroundColor: '#f5fcf7' },
            { label: '外資價', value: targetText, backgroundColor: '#fffdf6' },
          ]),
        ],
        {
          backgroundColor: '#f4f9fd',
          borderColor: '#d7e7f1',
        },
      ),
      createSection(
        [
          createText('觀察重點', { size: 'xxs', color: '#6b7a86', weight: 'bold' }),
          createText(item.note ?? item.detail ?? '先觀察量價與籌碼是否延續。', {
            size: 'xs',
            color: '#4b5c68',
          }),
        ],
        {
          backgroundColor: '#ffffff',
          borderColor: '#e4eef5',
        },
      ),
    ],
  });
}

export function buildEntryFlex({ entryRadar, siteUrl }) {
  const fresh = entryRadar?.sections?.freshStarters?.slice(0, 2) ?? [];
  const breakout = entryRadar?.sections?.nearBreakouts?.slice(0, 2) ?? [];
  const institutional = entryRadar?.sections?.institutionalTurns?.slice(0, 1) ?? [];
  const items = [...fresh, ...breakout, ...institutional].slice(0, 5);

  const contents = items.length
    ? items.map((item) =>
        createStockCardBubble(item, {
          accentColor: item.label?.includes('突破') ? '#e07a4f' : '#0b699b',
          siteUrl,
        }),
      )
    : [
        createBubble({
          title: '起漲名單整理中',
          accentColor: '#0b699b',
          linkUrl: `${siteUrl}#/entry-radar`,
          footerText: '打開起漲卡位雷達',
          bodyBackgroundColor: '#f9fcff',
          contents: [createText('目前沒有可用的起漲候選。', { size: 'xs', color: '#6b7a86' })],
        }),
      ];

  return createFlexMessage(
    `${BRAND_NAME}｜起漲`,
    {
      type: 'carousel',
      contents,
    },
    getQuickReplyPreset(),
  );
}

export function buildEtfFlex({ manifest, highDividendFlow, siteUrl }) {
  const trackedCount = manifest?.trackedEtfs?.length ?? 0;
  const connectedCount = manifest?.connectedCount ?? trackedCount;
  const topOfficial = highDividendFlow?.officialUniverse?.slice(0, 2) ?? [];

  return createFlexMessage(
    `${BRAND_NAME}｜ETF`,
    {
      type: 'carousel',
      contents: [
        createBubble({
          title: '主動式 ETF 快覽',
          accentColor: '#0b699b',
          linkUrl: `${siteUrl}#/etfs`,
          footerText: '打開主動式 ETF',
          bodyBackgroundColor: '#f9fcff',
          contents: [
            createSection(
              [
                createText('今天想先看 ETF，可以從這三條路線切進去。', {
                  size: 'xs',
                  color: '#4b5c68',
                }),
                ...createMetricGrid([
                  { label: '已串接', value: `${connectedCount} / ${trackedCount}` },
                  { label: '最新揭露', value: manifest?.latestDisclosureDate ?? null },
                ]),
              ],
              {
                backgroundColor: '#f4f9fd',
                borderColor: '#d7e7f1',
              },
            ),
            createSection(
              [
                createMetric('主動式 ETF', '看最新持股與前一日異動'),
                createMetric('ETF 重疊', '看共同持股與單股重壓'),
                createMetric('高息 ETF', '看高股息換股與資金方向'),
              ],
              {
                backgroundColor: '#ffffff',
                borderColor: '#e4eef5',
              },
            ),
          ],
        }),
        ...topOfficial.map((item) =>
          createBubble({
            title: `${item.code} ${item.name}`,
            accentColor: '#13885e',
            linkUrl: `${siteUrl}#/high-dividend-etfs`,
            footerText: '打開高息 ETF 雷達',
            bodyBackgroundColor: '#f9fcff',
            contents: [
              createSection(
                [
                  createText(item.isTracked ? '已納入站內追蹤，可直接看換股方向。' : '已收錄在高息 ETF 名單，可先看交易熱度。', {
                    size: 'xs',
                    color: '#4b5c68',
                  }),
                  ...createMetricGrid([
                    { label: '成交均價', value: item.averagePrice ? `${formatNumber(item.averagePrice)} 元` : null },
                    { label: '最近揭露', value: item.latestDisclosureDate ?? null },
                    { label: '交易量', value: item.tradeVolume ? formatLots(item.tradeVolume) : null, backgroundColor: '#f5fcf7' },
                    { label: '追蹤狀態', value: item.isTracked ? '可看異動' : '先看總覽', backgroundColor: '#fffdf6' },
                  ]),
                ],
                {
                  backgroundColor: '#f4f9fd',
                  borderColor: '#d7e7f1',
                },
              ),
            ],
          }),
        ),
      ].slice(0, 3),
    },
    getQuickReplyPreset(),
  );
}

export function buildClassroomFlex({ siteUrl }) {
  return createFlexMessage(
    `${BRAND_NAME}｜教學`,
    {
      type: 'carousel',
      contents: [
        createBubble({
          title: '股票小教室',
          accentColor: '#7c5cff',
          linkUrl: `${siteUrl}#/classroom`,
          footerText: '打開股票小教室',
          bodyBackgroundColor: '#fbfaff',
          contents: [
            createSection(
              [
                createText('如果你剛開始看股票，先學這四件事就夠用。', {
                  size: 'xs',
                  color: '#4b5c68',
                }),
                createMetric('RSI', '看短線過熱或回穩'),
                createMetric('量縮價漲', '看是不是剛轉強'),
                createMetric('5 / 10 / 20 日線', '看短中期趨勢'),
                createMetric('內外盤 / 期貨', '看資金節奏與隔日風向'),
              ],
              {
                backgroundColor: '#f5f0ff',
                borderColor: '#e1d5ff',
              },
            ),
          ],
        }),
      ],
    },
    getQuickReplyPreset(),
  );
}

export function buildGlobalFlex({ globalMarkets, siteUrl }) {
  const indices = globalMarkets?.sections?.find((section) => section.key === 'indices')?.items?.slice(0, 3) ?? [];

  return createFlexMessage(
    `${BRAND_NAME}｜國際盤`,
    {
      type: 'carousel',
      contents: indices.length
        ? indices.map((item) =>
            createBubble({
              title: item.label,
              accentColor: item.status === 'up' ? '#13885e' : item.status === 'down' ? '#8a5a7b' : '#0b699b',
              linkUrl: `${siteUrl}#/global-markets`,
              footerText: '打開國際盤儀表板',
              bodyBackgroundColor: '#f9fcff',
              contents: [
                createSection(
                  [
                    createText(item.marketDate ? `資料日 ${item.marketDate}` : '國際盤資料同步中', {
                      size: 'xs',
                      color: '#6b7a86',
                    }),
                    ...createMetricGrid([
                      { label: '最新', value: formatNumber(item.close) },
                      { label: '單日', value: formatPercent(item.changePercent) },
                      { label: '5 日', value: formatPercent(item.return5), backgroundColor: '#f5fcf7' },
                      { label: '20 日', value: formatPercent(item.return20), backgroundColor: '#fffdf6' },
                    ]),
                  ],
                  {
                    backgroundColor: '#f4f9fd',
                    borderColor: '#d7e7f1',
                  },
                ),
              ],
            }),
          )
        : [
            createBubble({
              title: '國際盤整理中',
              accentColor: '#0b699b',
              linkUrl: `${siteUrl}#/global-markets`,
              footerText: '打開國際盤儀表板',
              bodyBackgroundColor: '#f9fcff',
              contents: [createText('目前沒有可用的國際盤資料。', { size: 'xs', color: '#6b7a86' })],
            }),
          ],
    },
    getQuickReplyPreset(),
  );
}

export function buildBranchFlex({ brokerRadar, siteUrl }) {
  const topBranches = brokerRadar?.topBranches?.slice(0, 3) ?? [];

  return createFlexMessage(
    `${BRAND_NAME}｜分點`,
    {
      type: 'carousel',
      contents: topBranches.length
        ? topBranches.map((branch) =>
            createBubble({
              title: branch.name,
              accentColor: '#0b699b',
              linkUrl: `${siteUrl}#/broker-branches`,
              footerText: '打開分點雷達',
              bodyBackgroundColor: '#f9fcff',
              contents: [
                createSection(
                  [
                    createText(branch.latestBuys?.[0] ? `最近偏多先看 ${branch.latestBuys[0].code} ${branch.latestBuys[0].name}` : '近期偏多名單整理中。', {
                      size: 'xs',
                      color: '#4b5c68',
                    }),
                    ...createMetricGrid([
                      { label: '觀察分數', value: formatNumber(branch.score, 1) },
                      { label: '命中次數', value: formatNumber(branch.candidateHits, 0) },
                      { label: '近期買進', value: branch.latestBuys?.[0] ? `${branch.latestBuys[0].code} ${branch.latestBuys[0].name}` : null, backgroundColor: '#f5fcf7' },
                      { label: '近期賣出', value: branch.latestSells?.[0] ? `${branch.latestSells[0].code} ${branch.latestSells[0].name}` : null, backgroundColor: '#fffdf6' },
                    ]),
                  ],
                  {
                    backgroundColor: '#f4f9fd',
                    borderColor: '#d7e7f1',
                  },
                ),
              ],
            }),
          )
        : [
            createBubble({
              title: '分點雷達整理中',
              accentColor: '#0b699b',
              linkUrl: `${siteUrl}#/broker-branches`,
              footerText: '打開分點雷達',
              bodyBackgroundColor: '#f9fcff',
              contents: [createText('目前沒有可用的分點資料。', { size: 'xs', color: '#6b7a86' })],
            }),
          ],
    },
    getQuickReplyPreset(),
  );
}

export function buildStockFlex({ stock, detail, siteUrl }) {
  const latest = detail?.最新摘要 ?? {};
  const industry = detail?.產業名稱 ?? stock?.industryName ?? null;
  const topSignal = stock?.topSignalTitle ?? latest?.topSignalTitle ?? '技術面觀察';
  const topSignalTone = stock?.topSignalTone ?? latest?.topSignalTone ?? 'normal';
  const accentColor = topSignalTone === 'up' ? '#13885e' : topSignalTone === 'down' ? '#8a5a7b' : '#0b699b';
  const targetPrice = detail?.foreignTargetPrice?.目標價 ?? null;
  const targetPremium = detail?.foreignTargetPrice?.漲跌空間 ?? null;
  const targetBroker = detail?.foreignTargetPrice?.來源 ?? null;
  const targetCount = detail?.foreignTargetPrice?.近七日則數 ?? null;
  const monthlyRevenue = detail?.月營收觀察 ?? {};
  const chips = detail?.五日法人籌碼 ?? {};

  return createFlexMessage(
    `${BRAND_NAME}｜${stock.code} ${stock.name}`,
    createBubble({
      title: `${stock.code} ${stock.name}`,
      accentColor,
      linkUrl: `${siteUrl}#/stocks/${stock.code}`,
      footerText: '打開個股頁',
      bodyBackgroundColor: '#f9fcff',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            createPill(topSignal, {
              backgroundColor: `${accentColor}18`,
              color: accentColor,
            }),
            ...(industry
              ? [
                  createPill(industry, {
                    backgroundColor: '#eef6fb',
                    color: '#0b699b',
                  }),
                ]
              : []),
          ],
        },
        createSection(
          [
            {
              type: 'box',
              layout: 'horizontal',
              justifyContent: 'space-between',
              alignItems: 'center',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: '2px',
                  flex: 1,
                  contents: [
                    createText('收盤價', { size: 'xxs', color: '#6b7a86' }),
                    createText(stock.close === null || stock.close === undefined ? '—' : `${formatNumber(stock.close)} 元`, {
                      size: 'xl',
                      weight: 'bold',
                      color: '#10202d',
                    }),
                  ],
                },
                createPill(`單日 ${formatPercent(stock.changePercent)}`, {
                  backgroundColor: (stock.changePercent ?? 0) >= 0 ? '#eef8f2' : '#fff1ed',
                  color: (stock.changePercent ?? 0) >= 0 ? '#13885e' : '#c75b39',
                }),
              ],
            },
            ...createMetricGrid([
              { label: '20日', value: formatPercent(stock.return20), backgroundColor: '#ffffff' },
              { label: '成交量', value: stock.volume ? formatLots(stock.volume) : null, backgroundColor: '#ffffff' },
              { label: '外資5日', value: chips?.外資?.累計買賣超 ? formatLots(chips.外資.累計買賣超) : null, backgroundColor: '#f5faff' },
              { label: '投信5日', value: chips?.投信?.累計買賣超 ? formatLots(chips.投信.累計買賣超) : null, backgroundColor: '#f5fcf7' },
            ]),
          ],
          {
            backgroundColor: '#f4f9fd',
            borderColor: '#d7e7f1',
          },
        ),
        createSection(
          [
            createText('重點摘要', { size: 'xxs', color: '#6b7a86', weight: 'bold' }),
            createText(
              [
                industry ? `產業：${industry}` : null,
                monthlyRevenue?.重點觀察 ? `營收：${monthlyRevenue.重點觀察}` : null,
                targetPrice ? `外資價：${formatNumber(targetPrice)} 元${targetPremium ? `｜空間 ${formatPercent(targetPremium)}` : ''}` : null,
                targetBroker ? `來源：${targetBroker}${targetCount ? `｜近 7 日 ${targetCount} 則` : ''}` : null,
              ]
                .filter(Boolean)
                .join('\n') || '目前以技術面與籌碼面觀察為主。',
              {
                size: 'xs',
                color: '#4b5c68',
              },
            ),
          ],
          {
            backgroundColor: '#ffffff',
            borderColor: '#e4eef5',
          },
        ),
      ],
    }),
    getQuickReplyPreset(),
  );
}

export function buildMenuHintFlex(siteUrl) {
  return createFlexMessage(
    `${BRAND_NAME}｜功能導覽`,
    createBubble({
      title: '請選一個方向',
      accentColor: '#0b699b',
      linkUrl: `${siteUrl}#/`,
      footerText: '打開台股主動通',
      bodyBackgroundColor: '#f9fcff',
      contents: [
        createSection(
          [
            createText('你可以點下方圖文選單，或直接輸入關鍵字。', {
              size: 'xs',
              color: '#4b5c68',
            }),
            createMetric('盤勢', '看明日趨勢與市場廣度'),
            createMetric('題材', '看資金輪動與龍頭股'),
            createMetric('起漲', '看剛轉強與待突破'),
            createMetric('ETF', '看主動式與高息 ETF'),
            createMetric('教學', '看股票小教室'),
          ],
          {
            backgroundColor: '#f4f9fd',
            borderColor: '#d7e7f1',
          },
        ),
      ],
    }),
    getQuickReplyPreset(),
  );
}
