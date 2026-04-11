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
  buildIndicatorRows,
  buildTechnicalSignalSummary,
  defaultIndicatorSettings,
  sanitizeIndicatorSettings,
} from '../lib/technicalAnalysis';
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
  comparisonSeries: {
    type: Array,
    default: () => [],
  },
  comparisonLoading: {
    type: Boolean,
    default: false,
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

const comparisonColors = ['#0b699b', '#8b5cf6', '#ef6c00', '#00897b', '#d81b60'];

const activeRange = ref('halfYear');
const activeIndicator = ref('macd');
const hoveredKey = ref(null);
const chartHost = ref(null);
const chartApi = shallowRef(null);
const selectedComparisonCodes = ref([]);

const rawIndicatorSettings = reactive({
  ...defaultIndicatorSettings,
});

const overlayState = reactive({
  maFast: true,
  maShort: true,
  maMedium: true,
  maLong: true,
  volume: true,
  zone: true,
});

watch(
  () => props.data?.indicatorSettings,
  (value) => {
    Object.assign(rawIndicatorSettings, {
      ...defaultIndicatorSettings,
      ...(value ?? {}),
    });
  },
  { immediate: true, deep: true },
);

const indicatorSettings = computed(() => sanitizeIndicatorSettings(rawIndicatorSettings));

const overlayOptions = computed(() => [
  { key: 'maFast', label: `MA${indicatorSettings.value.maFastPeriod}` },
  { key: 'maShort', label: `MA${indicatorSettings.value.maShortPeriod}` },
  { key: 'maMedium', label: `MA${indicatorSettings.value.maMediumPeriod}` },
  { key: 'maLong', label: `MA${indicatorSettings.value.maLongPeriod}` },
  { key: 'volume', label: '量能' },
  { key: 'zone', label: '漲跌區' },
]);

const movingAverageInputs = computed(() => [
  { key: 'maFastPeriod', label: 'MA1', min: 2, max: 90 },
  { key: 'maShortPeriod', label: 'MA2', min: 3, max: 120 },
  { key: 'maMediumPeriod', label: 'MA3', min: 5, max: 180 },
  { key: 'maLongPeriod', label: 'MA4', min: 10, max: 240 },
]);

const activeIndicatorInputs = computed(() => {
  if (activeIndicator.value === 'macd') {
    return [
      { key: 'macdFastPeriod', label: '快線', min: 2, max: 50 },
      { key: 'macdSlowPeriod', label: '慢線', min: 3, max: 100 },
      { key: 'macdSignalPeriod', label: '訊號', min: 2, max: 30 },
    ];
  }

  if (activeIndicator.value === 'rsi') {
    return [{ key: 'rsiPeriod', label: 'RSI', min: 2, max: 60 }];
  }

  return [
    { key: 'stochasticPeriod', label: 'KD 週期', min: 3, max: 30 },
    { key: 'stochasticKPeriod', label: 'K 平滑', min: 1, max: 10 },
    { key: 'stochasticDPeriod', label: 'D 平滑', min: 1, max: 10 },
  ];
});

const normalizedBaseRows = computed(() =>
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
        contractMonth: row.contractMonth ?? null,
      };
    })
    .filter(Boolean),
);

const enrichedRows = computed(() =>
  buildIndicatorRows(normalizedBaseRows.value, indicatorSettings.value).map((row) => ({
    ...row,
    ma5: row.maFast ?? null,
    ma10: row.maShort ?? null,
    ma20: row.maMedium ?? null,
    ma60: row.maLong ?? null,
    rsi14: row.rsi ?? null,
    k9: row.stochasticK ?? null,
    d9: row.stochasticD ?? null,
  })),
);

const activeRangeConfig = computed(() =>
  rangeOptions.find((item) => item.key === activeRange.value) ?? rangeOptions.at(-1),
);

const chartRows = computed(() =>
  enrichedRows.value.slice(-(activeRangeConfig.value?.size ?? enrichedRows.value.length)),
);

const rowMap = computed(() => new Map(chartRows.value.map((row) => [row.key, row])));
const latestRow = computed(() => chartRows.value.at(-1) ?? null);
const hoveredRow = computed(() => rowMap.value.get(hoveredKey.value) ?? null);
const displayRow = computed(() => hoveredRow.value ?? latestRow.value);
const volumeVisible = computed(() => overlayState.volume && chartRows.value.some((row) => row.volume > 0));
const chartModeSummary = computed(() => (hoveredRow.value ? '游標' : '最新'));
const hasFuturesContractMonth = computed(() => chartRows.value.some((row) => row.contractMonth));
const isInteractive = computed(() => chartRows.value.length > 1);

const overlaySignature = computed(() =>
  overlayOptions.value.map((item) => `${item.key}:${overlayState[item.key] ? '1' : '0'}`).join('|'),
);

const rangeReturn = computed(() => {
  const firstClose = chartRows.value.find((row) => row.close)?.close ?? null;
  const lastClose = latestRow.value?.close ?? null;

  if (firstClose === null || lastClose === null) {
    return null;
  }

  return ((lastClose - firstClose) / firstClose) * 100;
});

const technicalSignals = computed(() =>
  buildTechnicalSignalSummary(enrichedRows.value, indicatorSettings.value, {
    name: props.data?.name ?? props.data?.code ?? '',
  }),
);

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
  const settings = indicatorSettings.value;

  if (!row) {
    return [];
  }

  if (activeIndicator.value === 'macd') {
    return [
      { label: `MACD ${settings.macdFastPeriod}/${settings.macdSlowPeriod}`, value: formatNumber(row.macd) },
      { label: `訊號 ${settings.macdSignalPeriod}`, value: formatNumber(row.macdSignal) },
      {
        label: '柱狀體',
        value: formatNumber(row.macdHist),
        tone: (row.macdHist ?? 0) > 0 ? 'up' : (row.macdHist ?? 0) < 0 ? 'down' : undefined,
      },
    ];
  }

  if (activeIndicator.value === 'rsi') {
    return [{ label: `RSI${settings.rsiPeriod}`, value: formatNumber(row.rsi) }];
  }

  if (activeIndicator.value === 'kd') {
    return [
      { label: `K(${settings.stochasticPeriod})`, value: formatNumber(row.stochasticK) },
      { label: `D(${settings.stochasticPeriod})`, value: formatNumber(row.stochasticD) },
    ];
  }

  return [
    { label: `RSI${settings.rsiPeriod}`, value: formatNumber(row.rsi) },
    { label: `K(${settings.stochasticPeriod})`, value: formatNumber(row.stochasticK) },
    { label: `D(${settings.stochasticPeriod})`, value: formatNumber(row.stochasticD) },
  ];
});

const comparisonCandidates = computed(() =>
  (props.comparisonSeries ?? [])
    .map((item) => {
      const rows = (item?.歷史資料 ?? [])
        .map((row) => {
          const time = toBusinessDay(row.date);
          const close = normalizeNumber(row.close, true);

          if (!time || close === null) {
            return null;
          }

          return {
            key: time,
            time,
            date: row.date,
            close,
          };
        })
        .filter(Boolean);

      if (rows.length < 2) {
        return null;
      }

      return {
        code: String(item.code ?? '').trim(),
        name: item.name ?? String(item.code ?? '').trim(),
        rows,
      };
    })
    .filter(Boolean),
);

watch(
  comparisonCandidates,
  (candidates) => {
    const availableCodes = candidates.map((item) => item.code);
    const preserved = selectedComparisonCodes.value.filter((code) => availableCodes.includes(code));

    if (preserved.length) {
      selectedComparisonCodes.value = preserved.slice(0, 3);
      return;
    }

    selectedComparisonCodes.value = availableCodes.slice(0, Math.min(2, availableCodes.length));
  },
  { immediate: true },
);

const comparisonOverlays = computed(() => {
  const firstRow = chartRows.value[0];
  const lastRow = chartRows.value.at(-1);

  if (!firstRow || !lastRow) {
    return [];
  }

  return selectedComparisonCodes.value
    .map((code, index) => {
      const candidate = comparisonCandidates.value.find((item) => item.code === code);
      if (!candidate) {
        return null;
      }

      const rows = candidate.rows.filter((row) => row.key >= firstRow.key && row.key <= lastRow.key);
      const baseClose = rows[0]?.close ?? null;
      const latestClose = rows.at(-1)?.close ?? null;

      if (rows.length < 2 || baseClose === null || latestClose === null) {
        return null;
      }

      return {
        code: candidate.code,
        name: candidate.name,
        color: comparisonColors[index % comparisonColors.length],
        data: rows.map((row) => ({
          time: row.time,
          value: firstRow.close * (row.close / baseClose),
        })),
        returnPercent: ((latestClose - baseClose) / baseClose) * 100,
      };
    })
    .filter(Boolean);
});

const comparisonStats = computed(() =>
  comparisonOverlays.value.map((item) => ({
    ...item,
    value: formatPercent(item.returnPercent),
  })),
);

function resetIndicatorSettings() {
  Object.assign(rawIndicatorSettings, defaultIndicatorSettings);
}

function toggleOverlay(key) {
  overlayState[key] = !overlayState[key];
}

function toggleComparison(code) {
  if (selectedComparisonCodes.value.includes(code)) {
    selectedComparisonCodes.value = selectedComparisonCodes.value.filter((item) => item !== code);
    return;
  }

  selectedComparisonCodes.value = [...selectedComparisonCodes.value, code].slice(-3);
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
      rightOffset: chartRows.value.length <= 12 ? 1 : 0,
      timeVisible: false,
      interactive: isInteractive.value,
    }),
    timeScale: {
      ...createBaseChartOptions({
        timeVisible: false,
        interactive: isInteractive.value,
      }).timeScale,
      rightOffset: chartRows.value.length <= 12 ? 1 : 0,
      barSpacing: chartRows.value.length <= 12 ? 24 : chartRows.value.length <= 30 ? 14 : 9,
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

  [
    { key: 'maFast', color: chartPalette.ma5, accessor: (row) => row.maFast },
    { key: 'maShort', color: chartPalette.ma10, accessor: (row) => row.maShort },
    { key: 'maMedium', color: chartPalette.ma20, accessor: (row) => row.maMedium },
    { key: 'maLong', color: chartPalette.ma60, accessor: (row) => row.maLong },
  ].forEach((item) => {
    if (!overlayState[item.key]) {
      return;
    }

    addSegmentedLineSeries(
      chart,
      0,
      chartRows.value,
      item.accessor,
      {
        color: item.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      true,
    );
  });

  comparisonOverlays.value.forEach((item) => {
    const series = chart.addSeries(
      LineSeries,
      {
        color: item.color,
        lineWidth: 2,
        lineStyle: chartEnums.LineStyle.SparseDotted,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      },
      0,
    );
    series.setData(item.data);
  });

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
    const guideValues = showRsi && !showKd ? [30, 50, 70] : [20, 80];

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
        (row) => row.rsi,
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
        (row) => row.stochasticK,
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
        (row) => row.stochasticD,
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
  [chartRows, activeIndicator, overlaySignature, indicatorSettings, comparisonOverlays],
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
          {{ activeRangeConfig.description }}，已整合 K 線、量能、十字線同步 hover、可調指標參數與多檔比較疊圖。
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

      <div class="chart-parameter-panel">
        <div class="chart-parameter-group">
          <span class="toolbar-label">均線參數</span>
          <label
            v-for="item in movingAverageInputs"
            :key="item.key"
            class="chart-parameter-input"
          >
            <span>{{ item.label }}</span>
            <input
              v-model.number="rawIndicatorSettings[item.key]"
              type="number"
              :min="item.min"
              :max="item.max"
              inputmode="numeric"
            >
          </label>
        </div>

        <div class="chart-parameter-group">
          <span class="toolbar-label">目前指標參數</span>
          <label
            v-for="item in activeIndicatorInputs"
            :key="item.key"
            class="chart-parameter-input"
          >
            <span>{{ item.label }}</span>
            <input
              v-model.number="rawIndicatorSettings[item.key]"
              type="number"
              :min="item.min"
              :max="item.max"
              inputmode="numeric"
            >
          </label>
          <button type="button" class="ghost-button compact-button" @click="resetIndicatorSettings">
            回復預設
          </button>
        </div>
      </div>

      <div v-if="comparisonCandidates.length" class="chart-compare-panel">
        <div class="chart-compare-head">
          <div>
            <p class="comparison-stat-label">多檔比較疊圖</p>
            <p class="comparison-stat-note">以目前主圖第一根 K 線為共同基準做標準化疊圖，最多可同時比較 3 檔。</p>
          </div>
          <span v-if="comparisonLoading" class="meta-chip">比較標的載入中</span>
        </div>

        <div class="chart-compare-picker">
          <button
            v-for="item in comparisonCandidates"
            :key="item.code"
            type="button"
            class="chart-toggle"
            :class="{ 'is-active': selectedComparisonCodes.includes(item.code) }"
            @click="toggleComparison(item.code)"
          >
            {{ item.code }} {{ item.name }}
          </button>
        </div>

        <div v-if="comparisonStats.length" class="chart-compare-summary">
          <div
            v-for="item in comparisonStats"
            :key="item.code"
            class="comparison-stat-card"
          >
            <p class="comparison-stat-label">
              <span class="compare-dot" :style="{ backgroundColor: item.color }" />
              {{ item.code }} {{ item.name }}
            </p>
            <p class="comparison-stat-value" :class="{ 'text-up': item.returnPercent > 0, 'text-down': item.returnPercent < 0 }">
              {{ item.value }}
            </p>
            <p class="comparison-stat-note">同區間標準化報酬</p>
          </div>
        </div>
      </div>

      <div ref="chartHost" class="market-chart-host is-technical" />

      <div v-if="technicalSignals.length" class="chart-signal-grid">
        <article
          v-for="signal in technicalSignals"
          :key="signal.key"
          class="chart-signal-card"
          :class="signal.tone ? `is-${signal.tone}` : ''"
        >
          <div class="chart-signal-head">
            <strong>{{ signal.title }}</strong>
            <span class="meta-chip">{{ signal.importance >= 3 ? '高優先' : signal.importance === 2 ? '留意' : '觀察' }}</span>
          </div>
          <p>{{ signal.description }}</p>
        </article>
      </div>

      <p class="chart-footnote">
        十字線會同步顯示價量與指標數值，沒有資料的區段不開放額外縮放或捲動。
        <template v-if="hasFuturesContractMonth">期貨資料遇到換倉時，均線會自動斷開避免錯誤連線。</template>
      </p>
    </div>

    <p v-else class="muted">目前還沒有足夠的歷史價格資料可以繪製 {{ title }}。</p>
  </section>
</template>
