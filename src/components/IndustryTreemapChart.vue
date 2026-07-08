<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { TreemapChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { formatAmount, formatNumber, formatPercent } from '../lib/formatters';

echarts.use([TreemapChart, TooltipComponent, CanvasRenderer]);

const props = defineProps({
  industries: {
    type: Array,
    default: () => [],
  },
});

const chartHost = ref(null);
const themeMode = ref('light');
const chartApi = ref(null);

let resizeObserver = null;
let themeObserver = null;

const palette = computed(() => {
  const isDark = themeMode.value === 'dark';

  return {
    isDark,
    up: isDark ? [255, 141, 116] : [190, 61, 42],
    upLow: isDark ? [174, 91, 80] : [226, 150, 138],
    upHigh: isDark ? [255, 116, 88] : [184, 48, 34],
    down: isDark ? [79, 209, 165] : [19, 136, 94],
    downLow: isDark ? [52, 136, 110] : [92, 176, 135],
    downHigh: isDark ? [63, 220, 160] : [16, 126, 82],
    neutral: isDark ? [99, 196, 255] : [11, 105, 155],
    activityLow: isDark ? [43, 111, 174] : [120, 184, 222],
    activityHigh: isDark ? [103, 201, 255] : [11, 105, 155],
    textStrong: isDark ? '#f2f7fb' : '#10202d',
    textSoft: isDark ? '#b8c7d8' : '#597086',
    border: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.94)',
    tooltipBackground: isDark ? 'rgba(8, 15, 24, 0.96)' : 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: isDark ? 'rgba(103, 201, 255, 0.24)' : 'rgba(11, 105, 155, 0.16)',
    shadow: isDark ? 'rgba(2, 6, 23, 0.4)' : 'rgba(20, 41, 61, 0.14)',
  };
});

const colorScale = computed(() => {
  const changes = props.industries
    .map((industry) => Math.abs(getColorMetricValue(industry)))
    .filter((value) => value > 0);
  const max = Math.max(...changes, 1);
  const min = Math.min(...changes, max);

  return {
    min,
    max,
    span: Math.max(max - min, 0.01),
  };
});

const colorIntensityByIndustry = computed(() => {
  const map = new Map();
  const hasActivityTone = props.industries.some((industry) => industry.metricTone === 'activity');
  const changes = props.industries.map((industry) => ({
    name: industry.industryName || '未分類',
    changePercent: getColorMetricValue(industry),
  }));

  if (hasActivityTone) {
    setSignedIntensity(map, changes);
  } else {
    setSignedIntensity(map, changes.filter((item) => item.changePercent > 0));
    setSignedIntensity(map, changes.filter((item) => item.changePercent < 0));
  }

  return map;
});

const chartData = computed(() =>
  props.industries.map((industry, index) => {
    const changePercent = normalizeNumber(industry.avgChangePercent) ?? 0;
    const tradeValue = normalizeNumber(industry.totalTradeValue) ?? 0;
    const heatScore = normalizeNumber(industry.heatScore) ?? 0;
    const metricValue = normalizeNumber(industry.metricValue) ?? changePercent;
    const metricColorValue = getColorMetricValue(industry);
    const metricTone = industry.metricTone === 'activity' ? 'activity' : 'signed';
    const metricLabel = industry.metricLabel ?? '平均漲跌';
    const metricText = industry.metricText ?? formatPercent(metricValue);
    const breadthPercent = normalizeNumber(industry.breadthPercent) ?? (
      industry.stockCount ? ((industry.advancingCount ?? 0) / industry.stockCount) * 100 : 0
    );
    const color = getTileColor(metricColorValue, industry.industryName || '未分類', metricTone);

    return {
      name: industry.industryName || '未分類',
      value: Math.max(tradeValue, heatScore * 100000000, 1),
      rank: index + 1,
      industryName: industry.industryName || '未分類',
      changePercent,
      heatScore,
      tradeValue,
      metricValue,
      metricColorValue,
      metricTone,
      metricLabel,
      metricText,
      metricLegendLabel: industry.metricLegendLabel ?? metricLabel,
      breadthPercent,
      advancingCount: industry.advancingCount ?? 0,
      stockCount: industry.stockCount ?? 0,
      leaders: industry.leaders ?? [],
      itemStyle: {
        color: color.fill,
        borderColor: palette.value.border,
      },
      label: {
        color: color.text,
        textShadowColor: color.shadow,
        textShadowBlur: 5,
      },
    };
  }),
);

const accessibleItems = computed(() =>
  chartData.value.map((item) => ({
    key: item.industryName,
    text: `${item.rank}. ${item.industryName}，${item.metricLabel} ${item.metricText}，成交值 ${formatAmount(item.tradeValue)}`,
  })),
);
const isActivityMetric = computed(() => chartData.value.some((item) => item.metricTone === 'activity'));
const legendMetricLabel = computed(() => chartData.value[0]?.metricLegendLabel ?? '漲跌幅');

watch([chartData, themeMode], () => {
  nextTick(renderChart);
}, { deep: true });

onMounted(async () => {
  readTheme();
  await nextTick();
  initChart();
  observeResize();
  observeTheme();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  window.removeEventListener('resize', resizeChart);
  chartApi.value?.dispose();
  chartApi.value = null;
});

function initChart() {
  if (!chartHost.value || chartApi.value) return;
  chartApi.value = echarts.init(chartHost.value, null, { renderer: 'canvas' });
  renderChart();
}

function renderChart() {
  if (!chartApi.value) return;

  chartApi.value.setOption(buildOption(), true);
  resizeChart();
}

function resizeChart() {
  chartApi.value?.resize();
}

function observeResize() {
  if (!chartHost.value) return;

  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', resizeChart);
    return;
  }

  resizeObserver = new ResizeObserver(resizeChart);
  resizeObserver.observe(chartHost.value);
}

function observeTheme() {
  themeObserver = new MutationObserver(readTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

function readTheme() {
  themeMode.value = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function buildOption() {
  const colors = palette.value;

  return {
    backgroundColor: 'transparent',
    animationDuration: 360,
    animationEasing: 'cubicOut',
    tooltip: {
      show: true,
      trigger: 'item',
      triggerOn: 'mousemove|click',
      showDelay: 0,
      confine: true,
      appendToBody: true,
      backgroundColor: colors.tooltipBackground,
      borderColor: colors.tooltipBorder,
      borderWidth: 1,
      padding: 12,
      textStyle: {
        color: colors.textStrong,
        fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
      },
      extraCssText: `border-radius: 14px; box-shadow: 0 18px 42px ${colors.shadow};`,
      formatter: formatTooltip,
    },
    series: [
      {
        type: 'treemap',
        name: '市場產業熱力圖',
        data: chartData.value,
        tooltip: {
          formatter: formatTooltip,
        },
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        roam: false,
        nodeClick: false,
        sort: 'desc',
        squareRatio: 1.18,
        visibleMin: 120,
        breadcrumb: {
          show: false,
        },
        label: {
          show: true,
          fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
          fontSize: 13,
          fontWeight: 850,
          lineHeight: 19,
          overflow: 'break',
          textShadowColor: 'rgba(2, 6, 23, 0.28)',
          textShadowBlur: 5,
          formatter: formatLabel,
        },
        upperLabel: {
          show: false,
        },
        itemStyle: {
          borderWidth: 2,
          borderColor: colors.border,
          borderRadius: 12,
          gapWidth: 6,
        },
        emphasis: {
          focus: 'self',
          itemStyle: {
            shadowBlur: 18,
            shadowColor: colors.shadow,
            borderWidth: 3,
          },
          label: {
            fontWeight: 950,
          },
        },
        levels: [
          {
            itemStyle: {
              borderWidth: 0,
              borderColor: colors.border,
              gapWidth: 0,
            },
          },
          {
            itemStyle: {
              borderWidth: 2,
              borderColor: colors.border,
              gapWidth: 6,
              borderRadius: 12,
            },
          },
        ],
      },
    ],
  };
}

function formatLabel(params) {
  const data = params.data ?? {};
  const lines = [
    data.industryName ?? data.name,
    data.metricText ?? formatPercent(data.changePercent),
  ];

  if (Number(data.rank) <= 6) {
    lines.push(`成交 ${formatAmount(data.tradeValue)}`);
  }

  return lines.join('\n');
}

function formatTooltip(params) {
  const data = params.data ?? {};
  const leaders = (data.leaders ?? [])
    .slice(0, 3)
    .map((stock) => {
      const changeClass = Number(stock.changePercent ?? 0) >= 0 ? '#f97361' : '#39c88f';
      return `<span style="display:inline-flex;gap:6px;align-items:center;padding:4px 8px;border-radius:999px;background:rgba(148,163,184,0.12);font-weight:800;">
        ${escapeHtml(stock.code)} <b style="color:${changeClass};">${escapeHtml(formatPercent(stock.changePercent))}</b>
      </span>`;
    })
    .join('');

  return `<div style="display:grid;gap:8px;min-width:210px;">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
      <strong style="font-size:15px;">${escapeHtml(data.industryName ?? data.name ?? '-')}</strong>
      <span style="font-size:12px;color:${palette.value.textSoft};">#${escapeHtml(formatNumber(data.rank))}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:12px;">
      ${tooltipMetric(data.metricLabel ?? '平均漲跌', data.metricText ?? formatPercent(data.changePercent), metricColor(data))}
      ${tooltipMetric('強度分數', formatNumber(Math.round(Number(data.heatScore ?? 0))))}
      ${tooltipMetric('上漲家數', `${escapeHtml(formatNumber(data.advancingCount))} / ${escapeHtml(formatNumber(data.stockCount))}`)}
      ${tooltipMetric('成交值', formatAmount(data.tradeValue))}
    </div>
    ${leaders ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${leaders}</div>` : ''}
  </div>`;
}

function tooltipMetric(label, value, color = palette.value.textStrong) {
  return `<div style="display:grid;gap:2px;min-width:0;">
    <span style="color:${palette.value.textSoft};">${escapeHtml(label)}</span>
    <b style="color:${color};font-size:13px;">${escapeHtml(value)}</b>
  </div>`;
}

function metricColor(data) {
  if (data.metricTone === 'activity') return palette.value.isDark ? '#8fd8ff' : '#0b699b';
  return Number(data.metricColorValue ?? data.changePercent ?? 0) >= 0 ? '#f97361' : '#39c88f';
}

function getTileColor(value, industryName, tone = 'signed') {
  const number = Number(value);
  const colors = palette.value;
  const scale = colorScale.value;
  const rawIntensity = Math.abs(number) <= 0 ? 0 : (Math.abs(number) - scale.min) / scale.span;
  const relativeIntensity = Math.max(0, Math.min(1, rawIntensity));
  const rankedIntensity = colorIntensityByIndustry.value.get(industryName) ?? 0;
  const intensity = Math.max(relativeIntensity, rankedIntensity);
  const contrast = 0.08 + intensity * 0.92;
  const channel =
    tone === 'activity'
      ? mixRgb(colors.activityLow, colors.activityHigh, contrast)
      : number > 0
        ? mixRgb(colors.upLow, colors.upHigh, contrast)
        : number < 0
          ? mixRgb(colors.downLow, colors.downHigh, contrast)
          : colors.neutral;
  const alpha = colors.isDark ? 0.82 : 0.92;

  return {
    fill: `rgba(${channel[0]}, ${channel[1]}, ${channel[2]}, ${alpha.toFixed(2)})`,
    text: '#ffffff',
    shadow: colors.isDark ? 'rgba(0, 0, 0, 0.34)' : 'rgba(78, 20, 16, 0.28)',
  };
}

function getColorMetricValue(industry) {
  return normalizeNumber(industry.metricColorValue ?? industry.metricValue ?? industry.avgChangePercent) ?? 0;
}

function setSignedIntensity(map, items) {
  const count = items.length;

  [...items]
    .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
    .forEach((item, index) => {
      const rankIntensity = count <= 1 ? 1 : 1 - index / (count - 1);
      map.set(item.name, 0.18 + rankIntensity * 0.82);
    });
}

function mixRgb(start, end, amount) {
  return start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
</script>

<template>
  <div class="industry-treemap-card" role="img" aria-label="市場產業熱力圖">
    <div class="industry-treemap-legend" aria-hidden="true">
      <template v-if="isActivityMetric">
        <span><i class="is-activity-low"></i>{{ legendMetricLabel }}低</span>
        <span><i class="is-activity-mid"></i>{{ legendMetricLabel }}中</span>
        <span><i class="is-activity-high"></i>{{ legendMetricLabel }}高</span>
      </template>
      <template v-else>
        <span><i class="is-down"></i>下跌</span>
        <span><i class="is-up-soft"></i>小漲</span>
        <span><i class="is-up-strong"></i>強漲</span>
      </template>
      <b>面積 = 成交值</b>
    </div>
    <div v-if="chartData.length" ref="chartHost" class="industry-treemap-host"></div>
    <div v-else class="industry-treemap-empty">等待產業資料</div>
    <ul class="industry-treemap-a11y">
      <li v-for="item in accessibleItems" :key="item.key">{{ item.text }}</li>
    </ul>
  </div>
</template>

<style scoped>
.industry-treemap-card {
  position: relative;
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--brand) 12%, transparent), transparent 36%),
    linear-gradient(180deg, var(--surface-strong), var(--surface-muted));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    var(--shadow);
}

.industry-treemap-host {
  width: 100%;
  height: clamp(360px, 40vw, 510px);
  min-height: 360px;
}

.industry-treemap-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  align-items: center;
  min-width: 0;
  color: var(--text-soft);
  font-size: 0.76rem;
  font-weight: 850;
}

.industry-treemap-legend span,
.industry-treemap-legend b {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 82%, transparent);
  white-space: nowrap;
}

.industry-treemap-legend b {
  color: var(--text-soft);
}

.industry-treemap-legend i {
  width: 24px;
  height: 8px;
  border-radius: 999px;
}

.industry-treemap-legend .is-down {
  background: linear-gradient(90deg, #5cb087, #107e52);
}

.industry-treemap-legend .is-up-soft {
  background: linear-gradient(90deg, #e2968a, #d16f62);
}

.industry-treemap-legend .is-up-strong {
  background: linear-gradient(90deg, #d16f62, #b83022);
}

.industry-treemap-legend .is-activity-low {
  background: linear-gradient(90deg, #78b8de, #65a9d0);
}

.industry-treemap-legend .is-activity-mid {
  background: linear-gradient(90deg, #65a9d0, #2f86bd);
}

.industry-treemap-legend .is-activity-high {
  background: linear-gradient(90deg, #2f86bd, #0b699b);
}

.industry-treemap-empty {
  display: grid;
  min-height: 280px;
  place-items: center;
  color: var(--text-soft);
  font-weight: 800;
}

.industry-treemap-a11y {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:global(html[data-theme="dark"] .industry-treemap-card) {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 18px 34px rgba(2, 6, 23, 0.26);
}

@media (max-width: 640px) {
  .industry-treemap-card {
    margin-inline: -4px;
    border-radius: 20px;
  }

  .industry-treemap-host {
    height: 390px;
    min-height: 390px;
  }

  .industry-treemap-legend {
    gap: 6px;
  }

  .industry-treemap-legend span,
  .industry-treemap-legend b {
    min-height: 24px;
    padding-inline: 7px;
    font-size: 0.72rem;
  }
}
</style>
