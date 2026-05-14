const BRAND_NAME = '台股主動通';
const BRAND_ICON_URL = 'https://joe94113.github.io/TW_Active_Tracker/icon-128.png';

const PALETTE = {
  brand: '#0f4c81',
  brandSoft: '#e9f3fb',
  bullish: '#13885e',
  bullishSoft: '#edf8f2',
  bearish: '#c75b39',
  bearishSoft: '#fff0eb',
  warning: '#c48b15',
  warningSoft: '#fff7e3',
  purple: '#6b46c1',
  purpleSoft: '#f2edff',
  neutral: '#5a6e82',
  neutralSoft: '#f3f6f9',
  text: '#10202d',
  muted: '#6a7d90',
  line: '#dce7ef',
  card: '#ffffff',
  cardSoft: '#f8fbff',
  darkText: '#0b1620',
};

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 2) {
  const number = asNumber(value);
  if (number === null) {
    return '資料不足';
  }

  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(number);
}

function formatSigned(value, digits = 2) {
  const number = asNumber(value);
  if (number === null) {
    return '資料不足';
  }

  const prefix = number > 0 ? '+' : '';
  return `${prefix}${formatNumber(number, digits)}`;
}

function formatPercent(value, digits = 2) {
  const number = asNumber(value);
  if (number === null) {
    return '資料不足';
  }

  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}%`;
}

function formatLots(value, digits = 0) {
  const number = asNumber(value);
  if (number === null) {
    return '資料不足';
  }

  const lots = number / 1000;
  const absLots = Math.abs(lots);
  if (absLots >= 10000) {
    return `${formatNumber(lots / 10000, 2)} 萬張`;
  }
  return `${formatNumber(lots, digits)} 張`;
}

function formatBillions(value, digits = 2) {
  const number = asNumber(value);
  if (number === null) {
    return '資料不足';
  }

  return `${formatNumber(number / 100000000, digits)} 億`;
}

function formatPrice(value, digits = 2) {
  const number = asNumber(value);
  if (number === null) {
    return '資料不足';
  }
  return `${formatNumber(number, digits)} 元`;
}

function formatDateLabel(value) {
  if (!value) {
    return '資料日未更新';
  }
  return String(value);
}

function toneColor(tone) {
  switch (tone) {
    case 'up':
    case 'bullish':
    case 'positive':
      return PALETTE.bullish;
    case 'down':
    case 'bearish':
    case 'negative':
      return PALETTE.bearish;
    case 'warning':
      return PALETTE.warning;
    default:
      return PALETTE.brand;
  }
}

function toneSoftColor(tone) {
  switch (tone) {
    case 'up':
    case 'bullish':
    case 'positive':
      return PALETTE.bullishSoft;
    case 'down':
    case 'bearish':
    case 'negative':
      return PALETTE.bearishSoft;
    case 'warning':
      return PALETTE.warningSoft;
    default:
      return PALETTE.brandSoft;
  }
}

function createText(text, options = {}) {
  return {
    type: 'text',
    text: String(text ?? ''),
    wrap: options.wrap ?? true,
    size: options.size ?? 'sm',
    color: options.color ?? PALETTE.text,
    weight: options.weight ?? 'regular',
    flex: options.flex ?? 0,
    align: options.align,
    gravity: options.gravity,
    maxLines: options.maxLines,
    margin: options.margin,
  };
}

function createPill(text, options = {}) {
  if (!text) {
    return null;
  }

  return {
    type: 'box',
    layout: 'baseline',
    paddingAll: options.paddingAll ?? '6px',
    paddingStart: options.paddingStart ?? '10px',
    paddingEnd: options.paddingEnd ?? '10px',
    backgroundColor: options.backgroundColor ?? toneSoftColor(options.tone),
    cornerRadius: '999px',
    contents: [
      createText(text, {
        size: options.size ?? 'xxs',
        color: options.color ?? toneColor(options.tone),
        weight: options.weight ?? 'bold',
      }),
    ],
  };
}

function createMetricBox(label, value, options = {}) {
  if (!value) {
    return null;
  }

  return {
    type: 'box',
    layout: 'vertical',
    spacing: '4px',
    paddingAll: '12px',
    backgroundColor: options.backgroundColor ?? PALETTE.card,
    borderColor: PALETTE.line,
    borderWidth: '1px',
    cornerRadius: '14px',
    flex: 1,
    contents: [
      createText(label, { size: 'xxs', color: PALETTE.muted, weight: 'bold' }),
      createText(value, {
        size: options.valueSize ?? 'md',
        weight: 'bold',
        color: options.valueColor ?? PALETTE.text,
      }),
      options.helper
        ? createText(options.helper, {
            size: 'xxs',
            color: PALETTE.muted,
            wrap: true,
          })
        : null,
    ].filter(Boolean),
  };
}

function createMetricGrid(items = []) {
  const validItems = items.filter((item) => item?.value);
  const rows = [];

  for (let index = 0; index < validItems.length; index += 2) {
    rows.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: validItems
        .slice(index, index + 2)
        .map((item) =>
          createMetricBox(item.label, item.value, {
            valueSize: item.valueSize,
            valueColor: item.valueColor,
            helper: item.helper,
            backgroundColor: item.backgroundColor,
          }),
        ),
    });
  }

  return rows;
}

function createBulletList(items = [], options = {}) {
  const validItems = items.filter(Boolean).slice(0, options.limit ?? 4);
  return validItems.map((item) =>
    createText(`• ${item}`, {
      size: options.size ?? 'xs',
      color: options.color ?? '#425363',
      wrap: true,
    }),
  );
}

function createSummaryRow(label, value, options = {}) {
  if (!value) {
    return null;
  }

  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      createText(label, {
        size: options.labelSize ?? 'xs',
        color: PALETTE.muted,
        flex: 4,
      }),
      createText(value, {
        size: options.valueSize ?? 'sm',
        color: options.valueColor ?? PALETTE.text,
        weight: options.valueWeight ?? 'bold',
        align: 'end',
        flex: 6,
      }),
    ],
  };
}

function createSection(title, contents, options = {}) {
  const sectionContents = [];

  if (title) {
    sectionContents.push(
      createText(title, {
        size: 'xxs',
        color: options.titleColor ?? PALETTE.muted,
        weight: 'bold',
      }),
    );
  }

  sectionContents.push(...contents.filter(Boolean));

  return {
    type: 'box',
    layout: 'vertical',
    spacing: options.spacing ?? 'sm',
    paddingAll: options.paddingAll ?? '14px',
    backgroundColor: options.backgroundColor ?? PALETTE.cardSoft,
    borderColor: options.borderColor ?? PALETTE.line,
    borderWidth: '1px',
    cornerRadius: options.cornerRadius ?? '16px',
    contents: sectionContents,
  };
}

function createLinkButton(label, url, options = {}) {
  if (!url) {
    return null;
  }

  return {
    type: 'button',
    style: options.style ?? 'primary',
    height: 'sm',
    color: options.color ?? PALETTE.brand,
    action: {
      type: 'uri',
      label,
      uri: url,
    },
  };
}

function createBubble({
  title,
  subtitle,
  subtitleColor,
  subtitleSize,
  subtitleWeight,
  accentColor,
  accentSoft,
  badges = [],
  sections = [],
  footerLabel = '打開完整頁面',
  footerUrl,
  bodyBackgroundColor = '#ffffff',
}) {
  return {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: '8px',
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
              flex: 0,
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: '2px',
              flex: 1,
              contents: [
                createText(BRAND_NAME, {
                  size: 'xxs',
                  color: '#dcedf8',
                  weight: 'bold',
                }),
                createText(title, {
                  size: 'lg',
                  weight: 'bold',
                  color: '#ffffff',
                  wrap: true,
                }),
              ],
            },
          ],
        },
        subtitle
          ? createText(subtitle, {
              size: subtitleSize ?? 'xs',
              color: subtitleColor ?? '#ecf5fb',
              weight: subtitleWeight ?? 'regular',
              wrap: true,
            })
          : null,
        badges.filter(Boolean).length
          ? {
              type: 'box',
              layout: 'horizontal',
              spacing: 'sm',
              flex: 0,
              contents: badges.filter(Boolean),
            }
          : null,
      ].filter(Boolean),
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'md',
      backgroundColor: bodyBackgroundColor,
      contents: sections.filter(Boolean),
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '14px',
      backgroundColor: accentSoft ?? PALETTE.brandSoft,
      contents: [createLinkButton(footerLabel, footerUrl, { color: accentColor })].filter(Boolean),
    },
  };
}

function createFlexMessage(altText, contents) {
  return {
    type: 'flex',
    altText,
    contents,
  };
}

function createTextMessage(text, siteUrl) {
  return attachQuickReply(
    {
      type: 'text',
      text: String(text ?? ''),
    },
    siteUrl,
  );
}

function attachQuickReply(message, siteUrl) {
  if (!message) {
    return message;
  }

  message.quickReply = getQuickReplyPreset(siteUrl);
  return message;
}

function getQuickReplyPreset(siteUrl) {
  return {
    items: [
      { label: '盤勢', text: '盤勢' },
      { label: '選股', text: '選股' },
      { label: '雙法人', text: '雙法人連買' },
      { label: '外資', text: '外資買超' },
      { label: '投信', text: '投信買超' },
      { label: '起漲', text: '起漲' },
      { label: '題材', text: '題材' },
      { label: 'ETF', text: 'ETF' },
      { label: '分點', text: '分點' },
      { label: '教學', text: '教學' },
    ].map((item) => ({
      type: 'action',
      action: {
        type: 'message',
        label: item.label,
        text: item.text,
      },
    })),
  };
}

function resolveMarketObjects(dashboard) {
  const marketOverview = dashboard?.['市場總覽'] ?? {};
  return {
    summary: marketOverview?.['大盤摘要'] ?? {},
    breadth: marketOverview?.['市場廣度'] ?? {},
    intraday: marketOverview?.['盤中脈動'] ?? {},
  };
}

function summarizeTargetPrice(targetPrice) {
  if (!targetPrice || typeof targetPrice !== 'object') {
    return null;
  }

  const target = asNumber(targetPrice.targetPrice ?? targetPrice.price);
  if (target === null) {
    return null;
  }

  const provider = targetPrice.provider || targetPrice.source || '法人目標價';
  const upside = asNumber(targetPrice.upsidePercent);
  const targetText = formatPrice(target, 1);
  const upsideText = upside === null ? null : formatPercent(upside, 1);
  return upsideText ? `${provider}｜${targetText}｜空間 ${upsideText}` : `${provider}｜${targetText}`;
}

function isUsableStockName(name, code) {
  const normalizedName = String(name ?? '').trim();
  const normalizedCode = String(code ?? '').trim();
  return Boolean(normalizedName && normalizedName !== normalizedCode);
}

function pickStockDisplayName(code, ...candidates) {
  return candidates.find((name) => isUsableStockName(name, code)) ?? String(code ?? '').trim();
}

function createStockCardBubble(stock, siteUrl, options = {}) {
  const accentColor = options.accentColor ?? PALETTE.brand;
  const accentSoft = options.accentSoft ?? PALETTE.brandSoft;
  const code = stock.code || stock.代號;
  const name = pickStockDisplayName(code, stock.name, stock.名稱);
  const signal = stock.label || stock.標籤 || stock.reasonType || '觀察名單';
  const theme = stock.themeTitle || stock.theme || stock.topic || stock.industryName || stock.industry || null;
  const note =
    stock.note ||
    stock.觀察 ||
    stock.observation ||
    stock.reason ||
    stock.topWarningTitle ||
    stock.topSignalTitle ||
    '留意量價、籌碼與題材是否同步。';
  const footerUrl = code ? `${siteUrl}/#/stocks/${code}` : siteUrl;

  const badges = [
    createPill(signal, { tone: options.tone ?? 'neutral' }),
    theme ? createPill(theme, { backgroundColor: PALETTE.neutralSoft, color: PALETTE.neutral }) : null,
    stock.healthGrade ? createPill(`體檢 ${stock.healthGrade}`) : null,
  ];

  const metrics = createMetricGrid([
    {
      label: '收盤價',
      value: stock.close ? formatPrice(stock.close, 1) : null,
      valueColor: accentColor,
    },
    {
      label: '單日漲跌',
      value: stock.changePercent !== undefined ? formatPercent(stock.changePercent, 2) : null,
      valueColor: asNumber(stock.changePercent) >= 0 ? PALETTE.bullish : PALETTE.bearish,
    },
    {
      label: '20 日表現',
      value: stock.return20 !== undefined ? formatPercent(stock.return20, 2) : null,
      valueColor: asNumber(stock.return20) >= 0 ? PALETTE.bullish : PALETTE.bearish,
    },
    {
      label: '成交量',
      value:
        stock.volume !== undefined
          ? formatLots(stock.volume, 0)
          : stock.amount !== undefined
            ? formatBillions(stock.amount)
            : null,
    },
    {
      label: '外資 5 日',
      value: stock.foreign5Day !== undefined ? formatLots(stock.foreign5Day, 0) : null,
      valueColor: asNumber(stock.foreign5Day) >= 0 ? PALETTE.bullish : PALETTE.bearish,
    },
    {
      label: '投信 5 日',
      value: stock.investmentTrust5Day !== undefined ? formatLots(stock.investmentTrust5Day, 0) : null,
      valueColor: asNumber(stock.investmentTrust5Day) >= 0 ? PALETTE.bullish : PALETTE.bearish,
    },
  ]);

  const detailRows = [
    createSummaryRow('題材 / 產業', theme || stock.category || stock.產業別),
    createSummaryRow('本益比', stock.peRatio ? formatNumber(stock.peRatio, 1) : null),
    createSummaryRow('殖利率', stock.dividendYield ? formatPercent(stock.dividendYield, 2) : null),
    createSummaryRow(
      '技術面',
      stock.signalSummary ||
        [
          stock.metrics?.distanceToBreakout ? `距突破 ${stock.metrics.distanceToBreakout}` : null,
          stock.metrics?.distanceToMa240 ? `MA240 ${stock.metrics.distanceToMa240}` : null,
          stock.rsi ? `RSI ${formatNumber(stock.rsi, 1)}` : null,
        ]
          .filter(Boolean)
          .join('｜'),
    ),
    createSummaryRow('法人目標價', summarizeTargetPrice(stock.foreignTargetPrice || stock.targetPrice), {
      valueColor: PALETTE.brand,
      valueWeight: 'regular',
      valueSize: 'xs',
    }),
  ].filter(Boolean);

  return createBubble({
    title: `${code} ${name}`,
    subtitle: '個股快讀卡',
    accentColor,
    accentSoft,
    badges,
    footerUrl,
    sections: [
      ...metrics,
      createSection('研究摘要', [
        createText(note, {
          size: 'sm',
          color: PALETTE.darkText,
          weight: 'bold',
          wrap: true,
        }),
        ...detailRows,
      ]),
    ],
  });
}

export function buildWelcomeFlex(siteUrl) {
  const bubble = createBubble({
    title: '功能導覽',
    subtitle: '點圖文選單，或直接傳關鍵字與股票代號，我就會回你對應的研究卡片。',
    accentColor: PALETTE.brand,
    accentSoft: PALETTE.brandSoft,
    footerUrl: siteUrl,
    footerLabel: '打開網站總覽',
    badges: [createPill('LINE 智能回覆', { tone: 'neutral' })],
    sections: [
      createSection('你可以這樣用', [
        ...createBulletList([
          '盤勢：大盤、成交值、廣度與明日趨勢預測',
          '選股 / 起漲：看剛轉強、待突破與追蹤名單',
          '題材 / ETF / 分點：看主線、共識持股與強分點',
          '直接輸入 2330、2455：快速回個股快讀卡',
        ]),
      ]),
      createSection('法人籌碼查詢', [
        ...createBulletList([
          '雙法人連買：看外資與投信同時偏多的名單',
          '外資買超：看外資連買焦點股',
          '投信買超：看投信連買與中線偏多個股',
        ]),
      ]),
    ],
  });

  return attachQuickReply(createFlexMessage('台股主動通｜功能導覽', bubble), siteUrl);
}

export function buildInstitutionalFocusFlex({ dashboard, siteUrl, mode = 'dual' }) {
  const tracking = dashboard?.['法人追蹤'] ?? {};
  const configMap = {
    dual: {
      key: '雙法人同買超',
      title: '雙法人連買',
      alt: '台股主動通｜雙法人連買',
      subtitle: '外資與投信同時偏多，先看隔日是否續強。',
      accentColor: PALETTE.brand,
      accentSoft: PALETTE.brandSoft,
      badge: '雙法人',
      totalLabel: '累計雙法人',
      streakLabel: '同買焦點',
    },
    foreign: {
      key: '外資連買',
      title: '外資買超',
      alt: '台股主動通｜外資買超',
      subtitle: '外資連買股偏短中線資金，適合搭配技術面確認。',
      accentColor: PALETTE.bullish,
      accentSoft: PALETTE.bullishSoft,
      badge: '外資偏多',
      totalLabel: '累計外資',
      streakLabel: '外資連買',
    },
    trust: {
      key: '投信連買',
      title: '投信買超',
      alt: '台股主動通｜投信買超',
      subtitle: '投信連買通常偏中線布局，適合留意趨勢延續。',
      accentColor: PALETTE.warning,
      accentSoft: PALETTE.warningSoft,
      badge: '投信偏多',
      totalLabel: '累計投信',
      streakLabel: '投信連買',
    },
  };

  const config = configMap[mode] ?? configMap.dual;
  const list = Array.isArray(tracking?.[config.key]) ? tracking[config.key].slice(0, 5) : [];

  if (!list.length) {
    const empty = createBubble({
      title: config.title,
      subtitle: '今天這一類名單暫時沒有明顯焦點股，可以先改看題材或起漲卡位。',
      accentColor: config.accentColor,
      accentSoft: config.accentSoft,
      footerUrl: `${siteUrl}/#/`,
      footerLabel: '打開首頁儀表板',
      badges: [createPill(config.badge, { tone: 'neutral' })],
      sections: [
        createSection('今日狀態', [
          createText('目前沒有符合條件的名單，建議先看盤勢、題材或分點雷達。', {
            size: 'sm',
            color: PALETTE.darkText,
          }),
        ]),
      ],
    });
    return attachQuickReply(createFlexMessage(config.alt, empty), siteUrl);
  }

  const bubbles = list.map((item) => {
    const code = item?.['代號'];
    const name = item?.['名稱'];
    const foreignNet = item?.['外資買賣超'];
    const trustNet = item?.['投信買賣超'];
    const totalNet = item?.['累計雙法人買超股數'] ?? item?.['累計買超股數'];
    const streak = item?.['連買天數'] ?? item?.['外資連買天數'] ?? item?.['投信連買天數'];

    return createBubble({
      title: `${code} ${name}`,
      subtitle: item?.['觀察'] || config.subtitle,
      accentColor: config.accentColor,
      accentSoft: config.accentSoft,
      footerUrl: `${siteUrl}/#/stocks/${code}`,
      footerLabel: '打開個股快讀',
      badges: [
        createPill(config.badge, { tone: mode === 'foreign' ? 'up' : mode === 'trust' ? 'warning' : 'neutral' }),
        streak ? createPill(`${config.streakLabel} ${formatNumber(streak, 0)} 天`, { backgroundColor: PALETTE.neutralSoft, color: PALETTE.neutral }) : null,
      ],
      sections: [
        ...createMetricGrid([
          { label: '收盤價', value: item?.['收盤價'] ? formatPrice(item['收盤價'], 1) : null, valueColor: config.accentColor },
          {
            label: '單日漲跌',
            value: item?.['漲跌幅'] !== undefined ? formatPercent(item['漲跌幅'], 2) : null,
            valueColor: asNumber(item?.['漲跌幅']) >= 0 ? PALETTE.bullish : PALETTE.bearish,
          },
          { label: '成交量', value: item?.['成交量'] !== undefined ? formatLots(item['成交量'], 0) : null },
          { label: config.totalLabel, value: totalNet !== undefined ? formatLots(totalNet, 0) : null, valueColor: PALETTE.brand },
          { label: '外資', value: foreignNet !== undefined ? formatLots(foreignNet, 0) : null, valueColor: asNumber(foreignNet) >= 0 ? PALETTE.bullish : PALETTE.bearish },
          { label: '投信', value: trustNet !== undefined ? formatLots(trustNet, 0) : null, valueColor: asNumber(trustNet) >= 0 ? PALETTE.bullish : PALETTE.bearish },
        ]),
        createSection('觀察重點', [
          createText(item?.['其他法人態度'] || config.subtitle, {
            size: 'sm',
            color: PALETTE.darkText,
            weight: 'bold',
          }),
        ]),
      ],
    });
  });

  return attachQuickReply(createFlexMessage(config.alt, {
    type: 'carousel',
    contents: bubbles,
  }), siteUrl);
}

export function buildHumorFallbackMessages({ siteUrl, kind = 'non-text' }) {
  const pool = kind === 'unknown'
    ? [
        '這句話很有玄機，我先不亂解讀。改傳「盤勢」或股票代號，我就能直接回研究卡。',
        '我感受到主力的暗號了，但目前只吃得懂關鍵字。試試看：盤勢、選股、題材、2330。',
      ]
    : [
        '這是致富密碼嗎？我先裝懂一下。直接傳文字關鍵字，我才能回你完整研究卡。',
        '我收到神祕訊號了，但目前只聽得懂文字。試試：盤勢、起漲、ETF、分點。',
      ];

  const text = pool[Math.floor(Math.random() * pool.length)];
  return [createTextMessage(text, siteUrl), buildWelcomeFlex(siteUrl)];
}

export function buildMarketFlex({ dashboard, siteUrl }) {
  const { summary, breadth, intraday } = resolveMarketObjects(dashboard);
  const marketDate = formatDateLabel(summary?.資料日期 || intraday?.資料日期);
  const breadthStock = breadth?.股票市場 ?? {};
  const futures = dashboard?.['期貨籌碼'] ?? {};
  const legal = dashboard?.['法人追蹤'] ?? {};
  const focus = Array.isArray(legal?.雙法人同買超) ? legal.雙法人同買超.slice(0, 3) : [];

  const sections = [
    ...createMetricGrid([
      {
        label: '加權指數',
        value: summary?.加權指數 ? formatNumber(summary.加權指數, 2) : null,
        valueColor: PALETTE.brand,
      },
      {
        label: '單日漲跌',
        value: summary?.漲跌點數 !== undefined ? `${formatSigned(summary.漲跌點數, 2)}｜${formatPercent(summary.漲跌幅, 2)}` : null,
        valueColor: asNumber(summary?.漲跌點數) >= 0 ? PALETTE.bullish : PALETTE.bearish,
      },
      {
        label: '成交值',
        value: summary?.成交值 ? formatBillions(summary.成交值, 2) : null,
      },
      {
        label: '市場情緒',
        value: breadth?.市場情緒 || null,
      },
      {
        label: '強弱比',
        value: breadth?.強弱比 ? formatNumber(breadth.強弱比, 2) : null,
      },
      {
        label: '上漲 / 下跌',
        value:
          breadthStock?.上漲 !== undefined && breadthStock?.下跌 !== undefined
            ? `${formatNumber(breadthStock.上漲, 0)} / ${formatNumber(breadthStock.下跌, 0)}`
            : null,
      },
    ]),
    createSection('明日盤勢預測', [
      ...createBulletList([
        summary?.加權指數
          ? `加權指數收在 ${formatNumber(summary.加權指數, 2)} 點，先看量能能否延續。`
          : null,
        breadth?.市場情緒 ? `市場情緒目前偏向 ${breadth.市場情緒}，留意主線是否延伸。` : null,
        intraday?.累計成交值 ? `盤中累計成交值 ${formatBillions(intraday.累計成交值, 2)}，觀察隔日量能是否續強。` : null,
        futures?.觀察摘要 || null,
      ]),
    ]),
    focus.length
      ? createSection(
          '雙法人焦點',
          focus.map((item) =>
            createText(
              `${item.代號} ${item.名稱}｜外資 ${formatLots(item.外資買賣超 ?? 0, 0)}｜投信 ${formatLots(item.投信買賣超 ?? 0, 0)}`,
              {
                size: 'xs',
                color: PALETTE.darkText,
              },
            ),
          ),
        )
      : null,
  ].filter(Boolean);

  const bubble = createBubble({
    title: `${marketDate} 更新｜明日趨勢預測`,
    subtitle: '先看大盤、廣度、量能與雙法人焦點，再決定隔日追蹤名單。',
    accentColor: PALETTE.brand,
    accentSoft: PALETTE.brandSoft,
    footerUrl: `${siteUrl}/#/`,
    footerLabel: '打開首頁儀表板',
    badges: [
      createPill(`資料日 ${marketDate}`, { tone: 'neutral' }),
      breadth?.市場情緒 ? createPill(breadth.市場情緒, { tone: breadth?.強弱比 >= 1 ? 'up' : 'warning' }) : null,
    ],
    sections,
  });

  return attachQuickReply(createFlexMessage(`台股主動通｜${marketDate} 更新｜明日趨勢預測`, bubble), siteUrl);
}

function normalizeKeywordLabel(item) {
  if (!item) {
    return null;
  }

  if (typeof item === 'string') {
    return item.trim() || null;
  }

  if (typeof item === 'object') {
    return String(item.keyword || item.label || item.name || '').trim() || null;
  }

  return null;
}

function normalizeHeadlineLabel(item) {
  if (!item) {
    return null;
  }

  if (typeof item === 'string') {
    return item.trim() || null;
  }

  if (typeof item === 'object') {
    const title = String(item.title || item.headline || item.name || '').trim();
    const source = String(item.source || '').trim();
    if (!title) {
      return null;
    }

    return source ? `${title}｜${source}` : title;
  }

  return null;
}

export function buildThemeFlex({ topicIndex, siteUrl }) {
  const topics = Array.isArray(topicIndex?.topics) ? topicIndex.topics.slice(0, 3) : [];

  if (!topics.length) {
    return buildMenuHintFlex(siteUrl);
  }

  const bubbles = topics.map((topic) =>
    createBubble({
      title: topic.title,
      subtitle: topic.observation || '從題材熱度、新聞與代表股快速掌握主線資金。',
      accentColor: toneColor(topic.tone),
      accentSoft: toneSoftColor(topic.tone),
      footerUrl: `${siteUrl}/#/themes`,
      footerLabel: '打開資金題材雷達',
      badges: [
        createPill(`題材分數 ${formatNumber(topic.score, 0)}`, { tone: topic.tone }),
        topic.newsCount ? createPill(`新聞 ${formatNumber(topic.newsCount, 0)} 則`, { backgroundColor: PALETTE.neutralSoft, color: PALETTE.neutral }) : null,
      ],
      sections: [
        ...createMetricGrid([
          {
            label: '龍頭股',
            value: topic.leaderStocks?.[0] ? `${topic.leaderStocks[0].code} ${topic.leaderStocks[0].name}` : null,
          },
          {
            label: '補漲股',
            value: topic.catchUpStocks?.[0] ? `${topic.catchUpStocks[0].code} ${topic.catchUpStocks[0].name}` : null,
          },
        ]),
        createSection('關鍵詞', [
          createText(
            (topic.keywords || [])
              .map(normalizeKeywordLabel)
              .filter(Boolean)
              .slice(0, 5)
              .join(' / ') || '近期新聞仍在整理中。',
            {
              size: 'sm',
              color: PALETTE.darkText,
            },
          ),
        ]),
        topic.headlines?.length
          ? createSection(
              '近期 headline',
              topic.headlines
                .map(normalizeHeadlineLabel)
                .filter(Boolean)
                .slice(0, 3)
                .map((headline) =>
                createText(`• ${headline}`, {
                  size: 'xs',
                  color: '#425363',
                  wrap: true,
                }),
              ),
            )
          : null,
      ].filter(Boolean),
    }),
  );

  return attachQuickReply(createFlexMessage('台股主動通｜資金題材雷達', {
    type: 'carousel',
    contents: bubbles,
  }), siteUrl);
}

export function buildEntryFlex({ entryRadar, siteUrl }) {
  const sections = entryRadar?.sections ?? {};
  const fresh = Array.isArray(sections.freshStarters) ? sections.freshStarters.slice(0, 2) : [];
  const breakout = Array.isArray(sections.nearBreakouts) ? sections.nearBreakouts.slice(0, 2) : [];
  const institutional = Array.isArray(sections.institutionalTurns) ? sections.institutionalTurns.slice(0, 1) : [];
  const candidates = [...fresh, ...breakout, ...institutional].filter(Boolean).slice(0, 5);

  if (!candidates.length) {
    return buildMenuHintFlex(siteUrl);
  }

  const bubbles = candidates.map((item) =>
    createStockCardBubble(item, siteUrl, {
      accentColor: item.label?.includes('法人') ? PALETTE.brand : PALETTE.bullish,
      accentSoft: item.label?.includes('法人') ? PALETTE.brandSoft : PALETTE.bullishSoft,
      tone: item.label?.includes('突破') ? 'warning' : 'up',
    }),
  );

  return attachQuickReply(createFlexMessage('台股主動通｜起漲卡位雷達', {
    type: 'carousel',
    contents: bubbles,
  }), siteUrl);
}

export function buildEtfFlex({ manifest, highDividendFlow, siteUrl }) {
  const tracked = Array.isArray(manifest?.trackedEtfs) ? manifest.trackedEtfs : [];
  const fullCount = tracked.length;
  const connectedCount = tracked.filter((item) => item?.trackingStatus === '完整').length;
  const buyConsensus = Array.isArray(highDividendFlow?.buyConsensus) ? highDividendFlow.buyConsensus.slice(0, 2) : [];
  const sellConsensus = Array.isArray(highDividendFlow?.sellConsensus) ? highDividendFlow.sellConsensus.slice(0, 1) : [];

  const bubble = createBubble({
    title: '主動式 ETF 追蹤',
    subtitle: '從完整覆蓋率、高股息共識與最近換股方向，快速掌握 ETF 資金動向。',
    accentColor: PALETTE.warning,
    accentSoft: PALETTE.warningSoft,
    footerUrl: `${siteUrl}/#/etfs`,
    footerLabel: '打開主動式 ETF 研究',
    badges: [
      createPill(`${connectedCount} / ${fullCount} 已完整`, { tone: 'warning' }),
      manifest?.generatedAtLocalDate ? createPill(`更新 ${manifest.generatedAtLocalDate}`, { backgroundColor: PALETTE.neutralSoft, color: PALETTE.neutral }) : null,
    ],
    sections: [
      ...createMetricGrid([
        { label: '追蹤檔數', value: fullCount ? `${formatNumber(fullCount, 0)} 檔` : null },
        { label: '完整串接', value: connectedCount ? `${formatNumber(connectedCount, 0)} 檔` : null },
        { label: '高息共同買入', value: buyConsensus[0] ? `${buyConsensus[0].code} ${buyConsensus[0].name}` : null },
        { label: '高息共同賣出', value: sellConsensus[0] ? `${sellConsensus[0].code} ${sellConsensus[0].name}` : null },
      ]),
      createSection(
        '近期共識',
        [
          ...buyConsensus.map((item) =>
            createText(`• 買入共識｜${item.code} ${item.name}｜${item.actionLabel || item.momentumLabel || '高息偏多'}`, {
              size: 'xs',
              color: PALETTE.darkText,
            }),
          ),
          ...sellConsensus.map((item) =>
            createText(`• 賣出共識｜${item.code} ${item.name}｜${item.actionLabel || item.momentumLabel || '高息調節'}`, {
              size: 'xs',
              color: PALETTE.darkText,
            }),
          ),
        ].filter(Boolean),
      ),
    ],
  });

  return attachQuickReply(createFlexMessage('台股主動通｜主動式 ETF 追蹤', bubble), siteUrl);
}

export function buildClassroomFlex({ siteUrl }) {
  const bubble = createBubble({
    title: '股票小教室',
    subtitle: '從看盤順序、技術面、籌碼面到事件風控，用白話方式快速上手。',
    subtitleColor: '#efe6ff',
    subtitleSize: 'sm',
    subtitleWeight: 'bold',
    accentColor: PALETTE.purple,
    accentSoft: PALETTE.purpleSoft,
    footerUrl: `${siteUrl}/#/classroom`,
    footerLabel: '打開股票小教室',
    badges: [createPill('新手也能快速讀懂', { backgroundColor: PALETTE.purpleSoft, color: PALETTE.purple })],
    sections: [
      createSection('你可以先學這些', [
        ...createBulletList([
          'RSI、MACD、量縮價揚是什麼意思',
          '五日線、十日線、月線怎麼看',
          '內外盤、大戶散戶、雙法人在看什麼',
          '期貨、小台、微台和盤勢有什麼關係',
        ]),
      ]),
      createSection('最常用入口', [
        createText('輸入「教學」可快速叫出這張卡；輸入股票代號則會回個股快讀卡。', {
          size: 'xs',
          color: PALETTE.darkText,
        }),
      ]),
    ],
  });

  return attachQuickReply(createFlexMessage('台股主動通｜股票小教室', bubble), siteUrl);
}

export function buildGlobalFlex({ globalMarkets, siteUrl }) {
  const sections = Array.isArray(globalMarkets?.sections) ? globalMarkets.sections : [];
  const group = sections.find((section) => section.key === 'indices') ?? sections[0];
  const items = Array.isArray(group?.items) ? group.items.slice(0, 3) : [];

  if (!items.length) {
    return buildMenuHintFlex(siteUrl);
  }

  const bubbles = items.map((item) =>
    createBubble({
      title: item.label,
      subtitle: `${group?.title || '國際盤'}｜${formatDateLabel(item.marketDate)}`,
      accentColor: toneColor(item.status === 'up' ? 'up' : item.status === 'down' ? 'down' : 'neutral'),
      accentSoft: toneSoftColor(item.status === 'up' ? 'up' : item.status === 'down' ? 'down' : 'neutral'),
      footerUrl: `${siteUrl}/#/global-markets`,
      footerLabel: '打開全球市場儀表板',
      badges: [createPill(item.status === 'up' ? '偏強' : item.status === 'down' ? '偏弱' : '持平', { tone: item.status })],
      sections: [
        ...createMetricGrid([
          { label: '最新點位', value: item.close ? formatNumber(item.close, 2) : null },
          {
            label: '單日漲跌',
            value: item.changePercent !== undefined ? formatPercent(item.changePercent, 2) : null,
            valueColor: asNumber(item.changePercent) >= 0 ? PALETTE.bullish : PALETTE.bearish,
          },
          { label: '5 日', value: item.return5 !== undefined ? formatPercent(item.return5, 2) : null },
          { label: '20 日', value: item.return20 !== undefined ? formatPercent(item.return20, 2) : null },
        ]),
      ],
    }),
  );

  return attachQuickReply(createFlexMessage('台股主動通｜國際盤儀表板', {
    type: 'carousel',
    contents: bubbles,
  }), siteUrl);
}

export function buildBranchFlex({ brokerRadar, siteUrl }) {
  const branches = Array.isArray(brokerRadar?.topBranches) ? brokerRadar.topBranches.slice(0, 3) : [];

  if (!branches.length) {
    return buildMenuHintFlex(siteUrl);
  }

  const bubbles = branches.map((branch) => {
    const stats = branch.historicalStats ?? {};
    return createBubble({
      title: branch.name,
      subtitle: '高關注分點近期買賣焦點',
      accentColor: PALETTE.brand,
      accentSoft: PALETTE.brandSoft,
      footerUrl: `${siteUrl}/#/broker-branches`,
      footerLabel: '打開勝率分點雷達',
      badges: [
        createPill(`分點分數 ${formatNumber(branch.score, 0)}`, { tone: 'neutral' }),
        branch.candidateHits ? createPill(`命中 ${formatNumber(branch.candidateHits, 0)} 檔`, { backgroundColor: PALETTE.neutralSoft, color: PALETTE.neutral }) : null,
      ],
      sections: [
        ...createMetricGrid([
          {
            label: '近 20 次勝率',
            value: stats.winRate5 !== undefined ? formatPercent(stats.winRate5, 1) : stats.sampleCount ? '樣本累積中' : null,
          },
          {
            label: '平均 5 日',
            value: stats.avgReturn5 !== undefined ? formatPercent(stats.avgReturn5, 2) : null,
            valueColor: asNumber(stats.avgReturn5) >= 0 ? PALETTE.bullish : PALETTE.bearish,
          },
        ]),
        createSection(
          '最近偏多',
          (branch.latestBuys || []).slice(0, 3).map((item) =>
            createText(`• ${item.code} ${item.name}｜買超 ${formatLots(item.netShares ?? item.netLots ?? 0, 0)}`, {
              size: 'xs',
              color: PALETTE.darkText,
            }),
          ),
        ),
        branch.latestSells?.length
          ? createSection(
              '最近偏空',
              branch.latestSells.slice(0, 2).map((item) =>
                createText(`• ${item.code} ${item.name}｜賣超 ${formatLots(Math.abs(item.netShares ?? item.netLots ?? 0), 0)}`, {
                  size: 'xs',
                  color: PALETTE.darkText,
                }),
              ),
            )
          : null,
      ].filter(Boolean),
    });
  });

  return attachQuickReply(createFlexMessage('台股主動通｜勝率分點雷達', {
    type: 'carousel',
    contents: bubbles,
  }), siteUrl);
}

export function buildStockFlex({ stock, detail, siteUrl }) {
  const summary = detail?.['最新摘要'] ?? {};
  const indicators = detail?.['最新指標'] ?? {};
  const valuation = detail?.['評價面'] ?? {};
  const legal = detail?.['法人買賣'] ?? {};
  const observations = detail?.['觀察摘要'] ?? [];
  const alerts = detail?.['交易提醒'] ?? [];

  const merged = {
    code: stock?.code,
    name: pickStockDisplayName(
      stock?.code,
      detail?.name,
      detail?.['公司概況']?.公司簡稱,
      detail?.['公司概況']?.公司名稱,
      stock?.name,
      stock?.名稱,
    ),
    close: summary?.收盤價 ?? stock?.close,
    changePercent: summary?.漲跌幅 ?? stock?.changePercent,
    return20: stock?.return20,
    volume: summary?.成交量 ?? stock?.volume,
    foreign5Day: legal?.外資近五日累計 ?? stock?.foreign5Day,
    investmentTrust5Day: legal?.投信近五日累計 ?? stock?.investmentTrust5Day,
    peRatio: valuation?.本益比,
    dividendYield: valuation?.殖利率,
    foreignTargetPrice: detail?.foreignTargetPrice,
    label: stock?.label || indicators?.訊號摘要 || '個股快讀',
    themeTitle: stock?.themeTitle || stock?.theme || detail?.['公司概況']?.產業別,
    note: observations[0] || alerts[0]?.說明 || stock?.note,
    healthGrade: detail?.['體檢分數']?.總評 || stock?.healthGrade,
    signalSummary:
      [
        indicators?.RSI ? `RSI ${formatNumber(indicators.RSI, 1)}` : null,
        indicators?.MACD柱體 ? `MACD ${formatNumber(indicators.MACD柱體, 1)}` : null,
        indicators?.均線結構 ? `均線 ${indicators.均線結構}` : null,
      ]
        .filter(Boolean)
        .join('｜') || null,
  };

  const bubble = createStockCardBubble(merged, siteUrl, {
    accentColor: PALETTE.brand,
    accentSoft: PALETTE.brandSoft,
    tone: asNumber(merged.changePercent) >= 0 ? 'up' : 'down',
  });

  return attachQuickReply(createFlexMessage(`台股主動通｜${merged.code} ${merged.name}`, bubble), siteUrl);
}

export function buildMenuHintFlex(siteUrl) {
  const bubble = createBubble({
    title: '沒有找到完全對應的內容',
    subtitle: '你可以改輸入常用關鍵字，或直接輸入股票代號。',
    accentColor: PALETTE.neutral,
    accentSoft: PALETTE.neutralSoft,
    footerUrl: siteUrl,
    footerLabel: '打開網站首頁',
    badges: [createPill('快速入口', { backgroundColor: PALETTE.neutralSoft, color: PALETTE.neutral })],
    sections: [
      createSection('建議你這樣問', [
        ...createBulletList(['盤勢', '選股', '起漲', '題材', 'ETF', '分點', '國際盤', '教學', '2330']),
      ]),
    ],
  });

  return attachQuickReply(createFlexMessage('台股主動通｜快速入口', bubble), siteUrl);
}
