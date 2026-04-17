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

function createBubble({ title, accentColor, contents = [], linkUrl = siteUrl, footerText = '打開台股主動通' }) {
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

function createStockCard(item, options = {}) {
  const accentColor = options.accentColor ?? '#0b699b';

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
          createText('股價', { size: 'xs', color: '#6b7a86', flex: 2 }),
          createText(
            `${formatNumber(item.close)}｜20日 ${formatPercent(item.return20)}`,
            { size: 'xs', color: '#10202d', weight: 'bold', flex: 5 },
          ),
        ],
      },
      {
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        contents: [
          createText('成交量', { size: 'xs', color: '#6b7a86', flex: 2 }),
          createText(
            item.volumeLots === null || item.volumeLots === undefined ? '—' : `${formatNumber(item.volumeLots, 0)} 張`,
            { size: 'xs', color: '#10202d', flex: 5 },
          ),
        ],
      },
      createText(item.detail, {
        size: 'xs',
        color: '#4b5c68',
      }),
    ],
  };
}

function buildStockCards(items, emptyText, options = {}) {
  if (!items?.length) {
    return [createText(emptyText, { color: '#6b7a86' })];
  }

  return items.slice(0, 4).map((item, index) =>
    createStockCard(item, {
      accentColor: options.accentColor,
      backgroundColor: options.backgroundColors?.[index % (options.backgroundColors?.length || 1)] ?? '#f6fbff',
      borderColor: options.borderColor,
    }),
  );
}

export function buildLineFlexPayload(summary) {
  if (!summary) {
    return null;
  }

  return {
    type: 'flex',
    altText: `${summary.appName}｜${summary.marketDate} 更新｜明日趨勢預測`,
    contents: {
      type: 'carousel',
      contents: [
        createBubble({
          title: `${summary.marketDate} 更新｜明日趨勢預測`,
          accentColor: '#0b699b',
          contents: [
            createMetric('加權', `${formatNumber(summary.marketSummary.加權指數)}（${formatSigned(summary.marketSummary.漲跌點數)} / ${formatPercent(summary.marketSummary.漲跌幅)}）`),
            createMetric('廣度', `${summary.marketBreadth.市場情緒 ?? '資料整理中'}｜強弱比 ${formatNumber(summary.marketBreadth?.強弱比)}`),
            {
              type: 'box',
              layout: 'horizontal',
              spacing: 'sm',
              contents: [
                createPill(`主線 ${summary.themeMomentumTopics?.[0]?.title ?? '等待聚焦'}`),
                createPill(
                  summary.officialRiskRadar?.length ? `風險 ${summary.officialRiskRadar[0].code}` : '風險平穩',
                  {
                    backgroundColor: summary.officialRiskRadar?.length ? '#fff1ed' : '#eef8f2',
                    color: summary.officialRiskRadar?.length ? '#c75b39' : '#13885e',
                  },
                ),
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              margin: 'md',
              contents: summary.tomorrowOutlook.length
                ? summary.tomorrowOutlook.slice(0, 4).map((item) => createText(`• ${item}`, { size: 'xs', color: '#4b5c68' }))
                : [createText('今天沒有額外的盤後觀察重點。', { size: 'xs', color: '#6b7a86' })],
            },
          ],
        }),
        createBubble({
          title: '🛡 穩健型',
          accentColor: '#2f7ea1',
          linkUrl: `${siteUrl}#/radar`,
          footerText: '打開選股雷達',
          contents: buildStockCards(
            summary.watchGroups.stable,
            '今天沒有特別整齊的穩健型名單，先觀察雙法人是否重新聚焦。',
            {
              accentColor: '#2f7ea1',
              backgroundColors: ['#f7fbff', '#fdfefe'],
              borderColor: '#d7e7f1',
            },
          ),
        }),
        createBubble({
          title: '🔥 積極型',
          accentColor: '#e07a4f',
          linkUrl: `${siteUrl}#/radar`,
          footerText: '打開選股雷達',
          contents: buildStockCards(
            summary.watchGroups.aggressive,
            '今天沒有額外的積極型名單，短線先等放量突破訊號再追。',
            {
              accentColor: '#e07a4f',
              backgroundColors: ['#fff8f4', '#fffdfb'],
              borderColor: '#f0d6c8',
            },
          ),
        }),
      ],
    },
  };
}
