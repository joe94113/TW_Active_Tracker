<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import {
  BaselineSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
} from 'lightweight-charts';
import { formatAmount, formatDate, formatNumber, formatPercent, formatPriceDelta } from '../lib/formatters';
import {
  buildConstantLineData,
  buildSegmentedLineData,
  chartEnums,
  chartPalette,
  createBaseChartOptions,
  formatCrosshairLabel,
  formatTickMark,
  normalizeNumber,
  serializeChartTime,
  toBusinessDay,
} from '../lib/charting';

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  title: {
    type: String,
    default: '技術分析圖表',
  },
});

const rangeOptions = [
  { key: 'day', label: '天', description: '近 5 個交易日', size: 5 },
  { key: 'week', label: '週', description: '近 10 個交易日', size: 10 },
  { key: 'month', label: '月', description: '近 22 個交易日', size: 22 },
  { key: 'quarter', label: '季', description: '近 66 個交易日', size: 66 },
  { key: 'halfYear', label: '半年', description: '近 120 個交易日', size: 120 },
];

const indicatorOptions = [
  { key: 'macd', label: 'MACD' },
  { key: 'rsi', label: 'RSI' },
  { key: 'kd', label: 'KD' },
  { key: 'hybrid', label: 'RSI + KD' },
];

const overlayOptions = [
  { key: 'ma5', label: 'MA5' },
  { key: 'ma10', label: 'MA10' },
  { key: 'ma20', label: 'MA20' },
  { key: 'ma60', label: 'MA60' },
  { key: 'volume', label: '量能' },
  { key: 'zone', label: '漲跌區' },
];

const activeRange = ref('halfYear');
const activeIndicator = ref('macd');
const hoveredKey = ref(null);
const chartHost = ref(null);
const chartApi = shallowRef(null);

const overlayState = reactive({
  ma5: true,
  ma10: false,
  ma20: true,
  ma60: true,
  volume: true,
  zone: true,
});

const normalizedRows = computed(() =>
  (props.data?.歷史資料 ?? [])
    .map((row) => {
      const time = toBusinessDay(row.date);
      const open = normalizeNumber(row.open, true);
      const high = normalizeNumber(row.high, true);
      const low = normalizeNumber(row.low, true);
      const close = normalizeNumber(row.close, true);

      if (!time || open === null || high === null || low === null || close === null) {
        return null;
      }

      return {
        ...row,
        key: time,
        time,
        open,
        high,
        low,
        close,
        volume: normalizeNumber(row.volume, true) ?? 0,
        change: normalizeNumber(row.change),
        changePercent: normalizeNumber(row.changePercent),
        ma5: normalizeNumber(row.ma5, true),
        ma10: normalizeNumber(row.ma10, true),
        ma20: normalizeNumber(row.ma20, true),
        ma60: normalizeNumber(row.ma60, true),
        rsi14: normalizeNumber(row.rsi14),
        k9: normalizeNumber(row.k9),
        d9: normalizeNumber(row.d9),
        macd: normalizeNumber(row.macd),
        macdSignal: normalizeNumber(row.macdSignal),
        macdHist: normalizeNumber(row.macdHist),
        contractMonth: row.contractMonth ?? null,
      };
    })
    .filter(Boolean),
);

const activeRangeConfig = computed(() =>
  rangeOptions.find((item) => item.key === activeRange.value) ?? rangeOptions.at(-1),
);

const chartRows = computed(() =>
  normalizedRows.value.slice(-(activeRangeConfig.value?.size ?? normalizedRows.value.length)),
);

const rowMap = computed(() => new Map(chartRows.value.map((row) => [row.key, row])));
const latestRow = computed(() => chartRows.value.at(-1) ?? null);
const hoveredRow = computed(() => rowMap.value.get(hoveredKey.value) ?? null);
const displayRow = computed(() => hoveredRow.value ?? latestRow.value);
const volumeVisible = computed(() => overlayState.volume && chartRows.value.some((row) => row.volume > 0));
const chartModeSummary = computed(() => (hoveredRow.value ? '游標' : '最新'));
const hasFuturesContractMonth = computed(() => chartRows.value.some((row) => row.contractMonth));

const overlaySignature = computed(() =>
  overlayOptions.map((item) => `${item.key}:${overlayState[item.key] ? '1' : '0'}`).join('|'),
);

const rangeReturn = computed(() => {
  const firstClose = chartRows.value.find((row) => row.close)?.close ?? null;
  const lastClose = latestRow.value?.close ?? null;

  if (firstClose === null || lastClose === null) {
    return null;
  }

  return ((lastClose - firstClose) / firstClose) * 100;
});

const primaryStats = computed(() => {
  const row = displayRow.value;

  if (!row) {
    return [];
  }

  return [
    {
      label: chartModeSummary.value,
      value: hoveredRow.value ? formatCrosshairLabel(row.time) : formatDate(row.date),
      emphasis: true,
    },
    {
      label: '開',
      value: formatNumber(row.open),
    },
    {
      label: '高',
      value: formatNumber(row.high),
      tone: 'up',
    },
    {
      label: '低',
      value: formatNumber(row.low),
      tone: 'down',
    },
    {
      label: '收',
      value: formatNumber(row.close),
    },
    {
      label: '漲跌',
      value: `${formatPriceDelta(row.change)} / ${formatPercent(row.changePercent)}`,
      tone: (row.change ?? 0) > 0 ? 'up' : (row.change ?? 0) < 0 ? 'down' : undefined,
    },
    {
      label: '量',
      value: formatAmount(row.volume),
    },
    ...(row.contractMonth
      ? [
          {
            label: '契約月',
            value: row.contractMonth,
          },
        ]
      : []),
  ];
});

const indicatorStats = computed(() => {
  const row = displayRow.value;

  if (!row) {
    return [];
  }

  if (activeIndicator.value === 'macd') {
    return [
      { label: 'MACD', value: formatNumber(row.macd) },
      { label: '訊號', value: formatNumber(row.macdSignal) },
      {
        label: '柱狀體',
        value: formatNumber(row.macdHist),
        tone: (row.macdHist ?? 0) > 0 ? 'up' : (row.macdHist ?? 0) < 0 ? 'down' : undefined,
      },
    ];
  }

  if (activeIndicator.value === 'rsi') {
    return [{ label: 'RSI14', value: formatNumber(row.rsi14) }];
  }

  if (activeIndicator.value === 'kd') {
    return [
      { label: 'K', value: formatNumber(row.k9) },
      { label: 'D', value: formatNumber(row.d9) },
    ];
  }

  return [
    { label: 'RSI14', value: formatNumber(row.rsi14) },
    { label: 'K', value: formatNumber(row.k9) },
    { label: 'D', value: formatNumber(row.d9) },
  ];
});

function toggleOverlay(key) {
  overlayState[key] = !overlayState[key];
}

function addSegmentedLineSeries(chart, paneIndex, rows, accessor, options, positiveOnly = false) {
  const segments = buildSegmentedLineData(rows, accessor, positiveOnly);

  segments.forEach((segment) => {
    const series = chart.addSeries(LineSeries, options, paneIndex);
    series.setData(segment);
  });
}

function handleCrosshairMove(event) {
  if (!event?.time) {
    hoveredKey.value = null;
    return;
  }

  const key = serializeChartTime(event.time);
  hoveredKey.value = rowMap.value.has(key) ? key : null;
}

function destroyChart() {
  hoveredKey.value = null;
  chartApi.value?.remove();
  chartApi.value = null;
}

function renderChart() {
  if (!chartHost.value) {
    return;
  }

  if (!chartRows.value.length) {
    destroyChart();
    return;
  }

  destroyChart();

  const chart = createChart(chartHost.value, {
    ...createBaseChartOptions({
      rightOffset: chartRows.value.length <= 12 ? 10 : 6,
      timeVisible: false,
    }),
    timeScale: {
      ...createBaseChartOptions().timeScale,
      rightOffset: chartRows.value.length <= 12 ? 10 : 6,
      barSpacing: chartRows.value.length <= 12 ? 24 : chartRows.value.length <= 30 ? 16 : 9,
      minBarSpacing: chartRows.value.length <= 12 ? 18 : 6,
      timeVisible: false,
      tickMarkFormatter: formatTickMark,
    },
  });

  chartApi.value = chart;

  if (overlayState.zone && chartRows.value.length > 1) {
    const basePrice = chartRows.value[0]?.close ?? chartRows.value.at(-1)?.close ?? 0;
    const trendSeries = chart.addSeries(
      BaselineSeries,
      {
        baseValue: {
          type: 'price',
          price: basePrice,
        },
        topLineColor: chartPalette.zoneUpTop,
        topFillColor1: chartPalette.zoneUpTop,
        topFillColor2: chartPalette.zoneUpBottom,
        bottomLineColor: chartPalette.zoneDownTop,
        bottomFillColor1: chartPalette.zoneDownTop,
        bottomFillColor2: chartPalette.zoneDownBottom,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      },
      0,
    );
    trendSeries.setData(
      chartRows.value.map((row) => ({
        time: row.time,
        value: row.close,
      })),
    );
    trendSeries.setSeriesOrder(0);
  }

  const candleSeries = chart.addSeries(
    CandlestickSeries,
    {
      upColor: chartPalette.up,
      downColor: chartPalette.down,
      borderUpColor: chartPalette.up,
      borderDownColor: chartPalette.down,
      wickUpColor: chartPalette.up,
      wickDownColor: chartPalette.down,
      priceLineVisible: true,
      priceLineSource: chartEnums.PriceLineSource.LastBar,
      lastPriceAnimation: chartEnums.LastPriceAnimationMode.Disabled,
    },
    0,
  );

  candleSeries.setData(
    chartRows.value.map((row) => ({
      time: row.time,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    })),
  );

  candleSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.06,
      bottom: 0.08,
    },
  });

  if (overlayState.ma5) {
    addSegmentedLineSeries(
      chart,
      0,
      chartRows.value,
      (row) => row.ma5,
      {
        color: chartPalette.ma5,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      true,
    );
  }

  if (overlayState.ma10) {
    addSegmentedLineSeries(
      chart,
      0,
      chartRows.value,
      (row) => row.ma10,
      {
        color: chartPalette.ma10,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      true,
    );
  }

  if (overlayState.ma20) {
    addSegmentedLineSeries(
      chart,
      0,
      chartRows.value,
      (row) => row.ma20,
      {
        color: chartPalette.ma20,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      true,
    );
  }

  if (overlayState.ma60) {
    addSegmentedLineSeries(
      chart,
      0,
      chartRows.value,
      (row) => row.ma60,
      {
        color: chartPalette.ma60,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      true,
    );
  }

  const volumePaneIndex = 1;
  const indicatorPaneIndex = volumeVisible.value ? 2 : 1;

  if (volumeVisible.value) {
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: {
          type: 'volume',
        },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      volumePaneIndex,
    );

    volumeSeries.setData(
      chartRows.value.map((row) => ({
        time: row.time,
        value: row.volume,
        color: row.close >= row.open ? chartPalette.volumeUp : chartPalette.volumeDown,
      })),
    );

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.16,
        bottom: 0.02,
      },
    });
  }

  if (activeIndicator.value === 'macd') {
    const histogramSeries = chart.addSeries(
      HistogramSeries,
      {
        priceLineVisible: false,
        lastValueVisible: false,
      },
      indicatorPaneIndex,
    );

    histogramSeries.setData(
      chartRows.value.map((row) => ({
        time: row.time,
        value: row.macdHist ?? 0,
        color: (row.macdHist ?? 0) >= 0 ? chartPalette.histogramUp : chartPalette.histogramDown,
      })),
    );

    addSegmentedLineSeries(
      chart,
      indicatorPaneIndex,
      chartRows.value,
      (row) => row.macd,
      {
        color: chartPalette.macd,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
    );

    addSegmentedLineSeries(
      chart,
      indicatorPaneIndex,
      chartRows.value,
      (row) => row.macdSignal,
      {
        color: chartPalette.signal,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
    );

    const zeroLine = chart.addSeries(
      LineSeries,
      {
        color: chartPalette.guide,
        lineWidth: 1,
        lineStyle: chartEnums.LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      },
      indicatorPaneIndex,
    );

    zeroLine.setData(buildConstantLineData(chartRows.value, 0));
  } else {
    const showRsi = activeIndicator.value === 'rsi' || activeIndicator.value === 'hybrid';
    const showKd = activeIndicator.value === 'kd' || activeIndicator.value === 'hybrid';
    const guideValues = showRsi && !showKd ? [20, 50, 80] : [20, 80];

    guideValues.forEach((value) => {
      const guideLine = chart.addSeries(
        LineSeries,
        {
          color: chartPalette.guide,
          lineWidth: 1,
          lineStyle: chartEnums.LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        indicatorPaneIndex,
      );
      guideLine.setData(buildConstantLineData(chartRows.value, value));
    });

    if (showRsi) {
      addSegmentedLineSeries(
        chart,
        indicatorPaneIndex,
        chartRows.value,
        (row) => row.rsi14,
        {
          color: chartPalette.rsi,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
      );
    }

    if (showKd) {
      addSegmentedLineSeries(
        chart,
        indicatorPaneIndex,
        chartRows.value,
        (row) => row.k9,
        {
          color: chartPalette.k,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
      );

      addSegmentedLineSeries(
        chart,
        indicatorPaneIndex,
        chartRows.value,
        (row) => row.d9,
        {
          color: chartPalette.d,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
      );
    }
  }

  if (chart.panes()[0]) {
    chart.panes()[0].setStretchFactor(volumeVisible.value ? 0.62 : 0.74);
  }

  if (volumeVisible.value && chart.panes()[volumePaneIndex]) {
    chart.panes()[volumePaneIndex].setStretchFactor(0.16);
  }

  if (chart.panes()[indicatorPaneIndex]) {
    chart.panes()[indicatorPaneIndex].setStretchFactor(volumeVisible.value ? 0.22 : 0.26);
  }

  chart.subscribeCrosshairMove(handleCrosshairMove);
  chart.timeScale().fitContent();
}

watch(
  [chartRows, activeIndicator, overlaySignature],
  () => {
    renderChart();
  },
  { flush: 'post' },
);

onMounted(() => {
  renderChart();
});

onBeforeUnmount(() => {
  destroyChart();
});
</script>

<template>
  <section class="panel chart-panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p class="panel-subtitle">
          {{ activeRangeConfig.description }}，已整合 K 線、量能、十字線同步 hover 與 {{ indicatorOptions.find((item) => item.key === activeIndicator)?.label }} 指標。
        </p>
      </div>
      <div class="chart-header-actions">
        <div class="range-tabs" role="tablist" aria-label="圖表區間">
          <button
            v-for="item in rangeOptions"
            :key="item.key"
            type="button"
            class="range-tab"
            :class="{ 'is-active': activeRange === item.key }"
            @click="activeRange = item.key"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="chartRows.length" class="market-chart-shell">
      <div class="chart-info-strip">
        <div class="chart-info-grid">
          <div
            v-for="item in primaryStats"
            :key="`${item.label}-${item.value}`"
            class="chart-info-chip"
            :class="[
              item.emphasis ? 'is-emphasis' : '',
              item.tone ? `is-${item.tone}` : '',
            ]"
          >
            <span class="chart-info-label">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <div class="chart-info-grid compact">
          <div
            v-for="item in indicatorStats"
            :key="`${activeIndicator}-${item.label}`"
            class="chart-info-chip"
            :class="item.tone ? `is-${item.tone}` : ''"
          >
            <span class="chart-info-label">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
          <div class="chart-info-chip">
            <span class="chart-info-label">區間報酬</span>
            <strong :class="{ 'text-up': (rangeReturn ?? 0) > 0, 'text-down': (rangeReturn ?? 0) < 0 }">
              {{ formatPercent(rangeReturn) }}
            </strong>
          </div>
        </div>
      </div>

      <div class="chart-toolbar">
        <div class="toolbar-group">
          <span class="toolbar-label">指標</span>
          <button
            v-for="item in indicatorOptions"
            :key="item.key"
            type="button"
            class="chart-toggle"
            :class="{ 'is-active': activeIndicator === item.key }"
            @click="activeIndicator = item.key"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="toolbar-group">
          <span class="toolbar-label">圖層</span>
          <button
            v-for="item in overlayOptions"
            :key="item.key"
            type="button"
            class="chart-toggle"
            :class="{ 'is-active': overlayState[item.key] }"
            @click="toggleOverlay(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div ref="chartHost" class="market-chart-host is-technical" />

      <p class="chart-footnote">
        十字線會同步顯示價量與指標數值。
        <template v-if="hasFuturesContractMonth">期貨資料遇到換倉時，均線會自動斷開避免錯誤連線。</template>
      </p>
    </div>

    <p v-else class="muted">目前還沒有足夠的歷史價格資料可以繪製 {{ title }}。</p>
  </section>
</template>
