import { formatNumber, formatPercent, formatSigned } from './close-digest.mjs';
import { buildRatingText } from './watch-groups.mjs';

const siteUrl = 'https://joe94113.github.io/TW_Active_Tracker/';

function createText(text, options = {}) {
  return {
    type: 'text',
    text,
    wrap: options.wrap ?? true,
    size: options.size ?? 'sm',
    color: options.color ?? '#10202d',
    weight: options.weight ?? 'regular',
    flex: options.flex ?? 0,
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

function createMetricRows(metrics = []) {
  return metrics
    .filter((metric) => metric?.value)
    .map((metric) => createMetric(metric.label, metric.value));
}

function createSectionBox(contents, options = {}) {
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

function createMiniMetric(label, value, options = {}) {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: '2px',
    paddingAll: '10px',
    backgroundColor: options.backgroundColor ?? '#ffffff',
    cornerRadius: '12px',
    flex: 1,
    contents: [
      createText(label, {
        size: 'xxs',
        color: '#6b7a86',
      }),
      createText(value, {
        size: options.size ?? 'sm',
        color: '#10202d',
        weight: 'bold',
      }),
    ],
  };
}

function createMetricGrid(items = []) {
  const validItems = items.filter((item) => item?.value);

  if (!validItems.length) {
    return [];
  }

  const rows = [];

  for (let index = 0; index < validItems.length; index += 2) {
    const rowItems = validItems.slice(index, index + 2);
    rows.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: rowItems.map((item) =>
        createMiniMetric(item.label, item.value, {
          backgroundColor: item.backgroundColor,
          size: item.size,
        }),
      ),
    });
  }

  return rows;
}

function getOutlookPalette(summary) {
  const changePercent = Number(summary?.marketSummary?.漲跌幅 ?? 0);

  if (changePercent >= 1) {
    return {
      accentColor: '#13885e',
      bodyBackgroundColor: '#f7fdf9',
      primarySectionBackground: '#edf8f2',
      primarySectionBorder: '#cfe7d8',
      secondarySectionBackground: '#ffffff',
      secondarySectionBorder: '#deece5',
    };
  }

  if (changePercent <= -1) {
    return {
      accentColor: '#8a5a7b',
      bodyBackgroundColor: '#fdf9fb',
      primarySectionBackground: '#f7eef4',
      primarySectionBorder: '#ead6e1',
      secondarySectionBackground: '#ffffff',
      secondarySectionBorder: '#eee1e8',
    };
  }

  return {
    accentColor: '#0b699b',
    bodyBackgroundColor: '#f9fcff',
    primarySectionBackground: '#f4f9fd',
    primarySectionBorder: '#d7e7f1',
    secondarySectionBackground: '#ffffff',
    secondarySectionBorder: '#e4eef5',
  };
}

function formatLots(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }

  const lots = Number(value) / 1000;
  const absoluteLots = Math.abs(lots);

  if (absoluteLots >= 10000) {
    return `${(lots / 10000).toFixed(2)} 萬張`;
  }

  return `${formatNumber(lots, digits)} 張`;
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

function getSetupTagStyle(setupTag, accentColor) {
  switch (String(setupTag ?? '').trim()) {
    case '量縮型':
      return {
        backgroundColor: '#fff3eb',
        color: '#c75b39',
      };
    case '盤整型':
      return {
        backgroundColor: '#fff8df',
        color: '#b9770e',
      };
    case '突破型':
      return {
        backgroundColor: '#ffe7e7',
        color: '#c0392b',
      };
    case '法人型':
      return {
        backgroundColor: '#eef6fb',
        color: '#0b699b',
      };
    case '趨勢型':
      return {
        backgroundColor: '#edf8f2',
        color: '#13885e',
      };
    default:
      return {
        backgroundColor: `${accentColor}14`,
        color: accentColor,
      };
  }
}

function createBubble({
  title,
  accentColor,
  contents = [],
  linkUrl = siteUrl,
  footerText = '打開台股主動通',
  bodyBackgroundColor = '#ffffff',
}) {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: accentColor,
      contents: [
        createText(title, {
          size: 'md',
          weight: 'bold',
          color: '#ffffff',
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
    footer: {
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
    },
  };
}

function getBubblePalette(variant) {
  if (variant === 'aggressive') {
    return {
      bodyBackgroundColor: '#fffaf6',
      primarySectionBackground: '#fff5ee',
      primarySectionBorder: '#f3d9ca',
      secondarySectionBackground: '#fffdfb',
      secondarySectionBorder: '#f2e5dc',
    };
  }

  return {
    bodyBackgroundColor: '#f9fcff',
    primarySectionBackground: '#f4f9fd',
    primarySectionBorder: '#d7e7f1',
    secondarySectionBackground: '#ffffff',
    secondarySectionBorder: '#e4eef5',
  };
}

function createStockCard(item, options = {}) {
  const accentColor = options.accentColor ?? '#0b699b';
  const priceText =
    item.close === null || item.close === undefined
      ? '—'
      : `${formatNumber(item.close)}｜單日 ${formatPercent(item.changePercent)}`;
  const trendText =
    item.volumeLots === null || item.volumeLots === undefined
      ? `20日 ${formatPercent(item.return20)}｜量能 —`
      : `20日 ${formatPercent(item.return20)}｜量 ${formatNumber(item.volumeLots, 0)} 張`;

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    paddingAll: '12px',
    cornerRadius: '16px',
    backgroundColor: options.backgroundColor ?? '#f6fbff',
    borderColor: options.borderColor ?? '#d7e7f1',
    borderWidth: '1px',
    action: {
      type: 'uri',
      uri: `${siteUrl}#/stocks/${item.code}`,
    },
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        justifyContent: 'space-between',
        alignItems: 'center',
        contents: [
          createText(`${item.code} ${item.name}`, {
            size: 'sm',
            weight: 'bold',
            color: '#10202d',
            flex: 1,
          }),
          createPill(buildRatingText(item.rating), {
            backgroundColor: `${accentColor}1a`,
            color: accentColor,
          }),
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          createPill(item.label, {
            backgroundColor: `${accentColor}14`,
            color: accentColor,
          }),
          createPill(
            item.changePercent === null || item.changePercent === undefined
              ? '—'
              : formatPercent(item.changePercent),
            {
              backgroundColor: (item.changePercent ?? 0) >= 0 ? '#eef8f2' : '#fff1ed',
              color: (item.changePercent ?? 0) >= 0 ? '#13885e' : '#c75b39',
            },
          ),
        ],
      },
      {
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        contents: [
          createText('價格', { size: 'xs', color: '#6b7a86', flex: 2 }),
          createText(priceText, { size: 'xs', color: '#10202d', weight: 'bold', flex: 5 }),
        ],
      },
      {
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        contents: [
          createText('觀察', { size: 'xs', color: '#6b7a86', flex: 2 }),
          createText(trendText, { size: 'xs', color: '#10202d', flex: 5 }),
        ],
      },
      createText(item.detail, {
        size: 'xs',
        color: '#4b5c68',
      }),
    ],
  };
}

function createStockBubble(item, options = {}) {
  const accentColor = options.accentColor ?? '#0b699b';
  const dailyTone = (item.changePercent ?? 0) >= 0 ? '#13885e' : '#c75b39';
  const dailyBackground = (item.changePercent ?? 0) >= 0 ? '#eef8f2' : '#fff1ed';
  const palette = getBubblePalette(options.variant);
  const setupStyle = getSetupTagStyle(item.setupTag, accentColor);
  const topicText = item.topicTag ?? item.industryName ?? null;
  const foreignLotsText =
    Number.isFinite(Number(item.foreign5Day)) && Number(item.foreign5Day) !== 0 ? formatLots(item.foreign5Day) : null;
  const trustLotsText =
    Number.isFinite(Number(item.investmentTrust5Day)) && Number(item.investmentTrust5Day) !== 0
      ? formatLots(item.investmentTrust5Day)
      : null;
  const targetText =
    item.foreignTargetPrice === null || item.foreignTargetPrice === undefined
      ? null
      : `${formatNumber(item.foreignTargetPrice)} 元${
          item.foreignTargetPricePremium === null || item.foreignTargetPricePremium === undefined
            ? ''
            : `｜空間 ${formatPercent(item.foreignTargetPricePremium)}`
        }`;
  const signalPills = [];

  if (String(item.detail ?? '').includes('外資')) {
    signalPills.push(
      createPill('外資', {
        backgroundColor: '#eef6fb',
        color: '#0b699b',
      }),
    );
  }

  if (String(item.detail ?? '').includes('投信')) {
    signalPills.push(
      createPill('投信', {
        backgroundColor: '#eef8f2',
        color: '#13885e',
      }),
    );
  }

  return createBubble({
    title: `${item.code} ${item.name}`,
    accentColor,
    bodyBackgroundColor: palette.bodyBackgroundColor,
    linkUrl: `${siteUrl}#/stocks/${item.code}`,
    footerText: '打開個股頁',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          createPill(item.label, {
            backgroundColor: `${accentColor}14`,
            color: accentColor,
          }),
          ...(item.setupTag
            ? [
                createPill(item.setupTag, {
                  backgroundColor: setupStyle.backgroundColor,
                  color: setupStyle.color,
                }),
              ]
            : []),
          createPill(buildRatingText(item.rating), {
            backgroundColor: `${accentColor}1a`,
            color: accentColor,
          }),
        ],
      },
      createSectionBox(
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
                  createText('收盤價', {
                    size: 'xxs',
                    color: '#6b7a86',
                  }),
                  createText(item.close === null || item.close === undefined ? '—' : `${formatNumber(item.close)} 元`, {
                    size: 'xl',
                    weight: 'bold',
                    color: '#10202d',
                  }),
                ],
              },
              createPill(
                item.changePercent === null || item.changePercent === undefined ? '走勢待補' : `單日 ${formatPercent(item.changePercent)}`,
                {
                  backgroundColor: dailyBackground,
                  color: dailyTone,
                  size: 'xs',
                },
              ),
            ],
          },
          signalPills.length
            ? {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: signalPills,
              }
            : createText(item.label, {
                size: 'xs',
                color: accentColor,
              }),
          ...createMetricGrid([
            { label: '20日表現', value: formatPercent(item.return20) },
            {
              label: '量能',
              value: item.volumeLots === null || item.volumeLots === undefined ? null : `${formatNumber(item.volumeLots, 0)} 張`,
            },
            { label: '外資5日', value: foreignLotsText, backgroundColor: '#f5faff' },
            { label: '投信5日', value: trustLotsText, backgroundColor: '#f5fcf7' },
          ]),
        ],
        {
          backgroundColor: palette.primarySectionBackground,
          borderColor: palette.primarySectionBorder,
        },
      ),
      createSectionBox(
        [
          createText('選股觀察', {
            size: 'xxs',
            color: '#6b7a86',
            weight: 'bold',
          }),
          createText(item.detail, {
            size: 'xs',
            color: '#4b5c68',
          }),
          ...createMetricRows([
            { label: '題材', value: topicText },
            { label: '外資價', value: targetText },
          ]),
          item.foreignTargetBroker
            ? createText(`目標價來源：${item.foreignTargetBroker}${item.foreignTargetCount ? `｜近 7 日 ${item.foreignTargetCount} 則` : ''}`, {
                size: 'xxs',
                color: '#6b7a86',
              })
            : createText(topicText ? `目前歸類題材：${topicText}` : '目前以量價與籌碼訊號為主。', {
                size: 'xxs',
                color: '#6b7a86',
              }),
        ],
        {
          backgroundColor: palette.secondarySectionBackground,
          borderColor: palette.secondarySectionBorder,
        },
      ),
    ],
  });
}

function createOutlookBubble(summary) {
  const palette = getOutlookPalette(summary);
  const marketTone = summary.marketBreadth?.市場情緒 ?? '資料整理中';
  const topTheme = summary.themeMomentumTopics?.[0]?.title ?? '等待聚焦';
  const topRisk = summary.officialRiskRadar?.[0]?.code ? `${summary.officialRiskRadar[0].code} 需留意` : '風險平穩';
  const advancers = summary.marketBreadth?.股票市場?.上漲;
  const decliners = summary.marketBreadth?.股票市場?.下跌;

  return createBubble({
    title: `${summary.marketDate} 更新｜明日趨勢預測`,
    accentColor: palette.accentColor,
    bodyBackgroundColor: palette.bodyBackgroundColor,
    contents: [
      createSectionBox(
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
                  createText('加權指數', {
                    size: 'xxs',
                    color: '#6b7a86',
                  }),
                  createText(formatNumber(summary.marketSummary.加權指數), {
                    size: 'xl',
                    weight: 'bold',
                    color: '#10202d',
                  }),
                ],
              },
              createPill(
                `${formatSigned(summary.marketSummary.漲跌點數)} / ${formatPercent(summary.marketSummary.漲跌幅)}`,
                {
                  backgroundColor: Number(summary.marketSummary.漲跌點數 ?? 0) >= 0 ? '#eef8f2' : '#fff1ed',
                  color: Number(summary.marketSummary.漲跌點數 ?? 0) >= 0 ? '#13885e' : '#c75b39',
                  size: 'xs',
                },
              ),
            ],
          },
          ...createMetricGrid([
            { label: '市場情緒', value: marketTone, backgroundColor: '#ffffff' },
            { label: '強弱比', value: formatNumber(summary.marketBreadth?.強弱比), backgroundColor: '#ffffff' },
            {
              label: '上漲家數',
              value: advancers === null || advancers === undefined ? null : formatNumber(advancers, 0),
              backgroundColor: '#f5fcf7',
            },
            {
              label: '下跌家數',
              value: decliners === null || decliners === undefined ? null : formatNumber(decliners, 0),
              backgroundColor: '#fff6f3',
            },
          ]),
        ],
        {
          backgroundColor: palette.primarySectionBackground,
          borderColor: palette.primarySectionBorder,
        },
      ),
      createSectionBox(
        [
          createText('主線與風險', {
            size: 'xxs',
            color: '#6b7a86',
            weight: 'bold',
          }),
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              createPill(`主線 ${topTheme}`, {
                backgroundColor: '#eef6fb',
                color: '#0b699b',
              }),
              createPill(topRisk, {
                backgroundColor: summary.officialRiskRadar?.length ? '#fff1ed' : '#eef8f2',
                color: summary.officialRiskRadar?.length ? '#c75b39' : '#13885e',
              }),
            ],
          },
        ],
        {
          backgroundColor: palette.secondarySectionBackground,
          borderColor: palette.secondarySectionBorder,
        },
      ),
      createSectionBox(
        [
          createText('明日觀察', {
            size: 'xxs',
            color: '#6b7a86',
            weight: 'bold',
          }),
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: summary.tomorrowOutlook.length
              ? summary.tomorrowOutlook.slice(0, 4).map((item) => createText(`• ${item}`, { size: 'xs', color: '#4b5c68' }))
              : [createText('• 今天沒有額外的盤後觀察重點。', { size: 'xs', color: '#6b7a86' })],
          },
        ],
        {
          backgroundColor: palette.secondarySectionBackground,
          borderColor: palette.secondarySectionBorder,
        },
      ),
    ],
  });
}

function buildStockCards(items, emptyText, options = {}) {
  if (!items?.length) {
    return [createText(emptyText, { color: '#6b7a86' })];
  }

  return items.slice(0, 3).map((item, index) =>
    createStockCard(item, {
      accentColor: options.accentColor,
      backgroundColor: options.backgroundColors?.[index % (options.backgroundColors?.length || 1)] ?? '#f6fbff',
      borderColor: options.borderColor,
    }),
  );
}

function createFlexMessage(altText, contents) {
  return {
    type: 'flex',
    altText,
    contents,
  };
}

function buildStockCarouselMessage({ summary, title, accentColor, items, emptyText }) {
  const variant = title.includes('積極型') ? 'aggressive' : 'stable';
  const bubbles = items?.length
    ? items.slice(0, 3).map((item) =>
        createStockBubble(item, {
          accentColor,
          variant,
        }),
      )
    : [
        createBubble({
          title,
          accentColor,
          linkUrl: `${siteUrl}#/radar`,
          footerText: '打開選股雷達',
          contents: [createText(emptyText, { color: '#6b7a86' })],
        }),
      ];

  return createFlexMessage(`${summary.appName}｜${summary.marketDate}｜${title}`, {
    type: 'carousel',
    contents: bubbles,
  });
}

export function buildLineFlexMessages(summary) {
  if (!summary) {
    return null;
  }

  return {
    messages: [
      createFlexMessage(`${summary.appName}｜${summary.marketDate} 更新｜明日趨勢預測`, {
        type: 'carousel',
        contents: [createOutlookBubble(summary)],
      }),
      buildStockCarouselMessage({
        summary,
        title: '🛡 穩健型',
        accentColor: '#2f7ea1',
        items: summary.watchGroups.stable,
        emptyText: '今天沒有特別整齊的穩健型名單，先觀察雙法人是否重新聚焦。',
      }),
      buildStockCarouselMessage({
        summary,
        title: '🔥 積極型',
        accentColor: '#e07a4f',
        items: summary.watchGroups.aggressive,
        emptyText: '今天沒有額外的積極型名單，短線先等放量突破訊號再追。',
      }),
    ],
  };
}

export function buildLineFlexPayload(summary) {
  const payload = buildLineFlexMessages(summary);
  return payload?.messages?.[0] ?? null;
}
