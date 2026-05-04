<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { HistogramSeries, LineSeries, createChart } from 'lightweight-charts';
import { estimateIntradayChipFlow } from '../lib/intradayChipFlow';
import { formatDate, formatNumber } from '../lib/formatters';
import {
  chartPalette,
  createBaseChartOptions,
  normalizeNumber,
  serializeChartTime,
  toUtcTimestamp,
} from '../lib/charting';

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  title: {
    type: String,
    default: '盤中大戶 / 散戶估算圖',
  },
});

const flow = computed(() => estimateIntradayChipFlow(props.data));
const hoveredKey = ref(null);

const largeHost = ref(null);
const retailHost = ref(null);

const largeChart = shallowRef(null);
const retailChart = shallowRef(null);

const largeLineSeries = shallowRef(null);
const retailLineSeries = shallowRef(null);

const isInteractive = computed(() => (flow.value?.rows?.length ?? 0) > 1);

const summaryCards = computed(() => {
  if (!flow.value) {
    return [];
  }

  return [
    {
      title: '大戶累積',
      value: formatLotsValue(flow.value.summary.largeCumulativeLots),
      tone: getTone(flow.value.summary.largeCumulativeLots),
      note: `最近 5 分鐘 ${formatLotsValue(flow.value.summary.largeLatestLots)}`,
    },
    {
      title: '散戶累積',
      value: formatLotsValue(flow.value.summary.retailCumulativeLots),
      tone: getTone(flow.value.summary.retailCumulativeLots),
      note: `最近 5 分鐘 ${formatLotsValue(flow.value.summary.retailLatestLots)}`,
    },
    {
      title: '量能節奏',
      value: `${formatNumber(flow.value.summary.averageTurnoverRatio.toFixed(2))} 倍`,
      tone: flow.value.summary.averageTurnoverRatio >= 1.1 ? 'up' : 'normal',
      note: '相對當日中位量能',
    },
  ];
});

const rowMap = computed(() => new Map((flow.value?.rows ?? []).map((row) => [String(row.timestamp), row])));
const latestRow = computed(() => flow.value?.rows?.at(-1) ?? null);
const hoveredRow = computed(() => rowMap.value.get(hoveredKey.value ?? '') ?? null);

const panels = computed(() => {
  if (!flow.value?.rows?.length) {
    return [];
  }

  return [
    buildPanel(flow.value, hoveredRow.value, latestRow.value, 'large'),
    buildPanel(flow.value, hoveredRow.value, latestRow.value, 'retail'),
  ];
});

function formatLotsValue(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const lots = Number(value);
  const absoluteLots = Math.abs(lots);
  const prefix = lots > 0 ? '+' : '';

  if (absoluteLots >= 10000) {
    return `${prefix}${(lots / 10000).toFixed(2)} 萬張`;
  }

  return `${prefix}${new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(lots)} 張`;
}

function formatRatio(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return `${formatNumber((Number(value) * 100).toFixed(1))}%`;
}

function formatTurnoverRatio(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return `${formatNumber(Number(value).toFixed(2))} 倍`;
}

function getTone(value) {
  if ((value ?? 0) > 0) return 'up';
  if ((value ?? 0) < 0) return 'down';
  return 'normal';
}

function lotAxisFormatter(value) {
  const number = normalizeNumber(value);

  if (number === null) {
    return '-';
  }

  const absolute = Math.abs(number);

  if (absolute >= 10000) {
    return `${(number / 10000).toFixed(1)}萬`;
  }

  if (absolute >= 1000) {
    return `${Math.round(number)}`;
  }

  return `${number.toFixed(0)}`;
}

function buildPanel(flowData, hovered, latest, type) {
  const isLarge = type === 'large';
  const rows = flowData.rows;
  const netKey = isLarge ? 'largeNetLots' : 'retailNetLots';
  const cumulativeKey = isLarge ? 'largeCumulativeLots' : 'retailCumulativeLots';
  const shareKey = isLarge ? 'largeShare' : 'retailShare';
  const current = hovered ?? latest;

  return {
    type,
    title: isLarge ? '大戶估算' : '散戶估算',
    subtitle: isLarge
      ? '觀察盤中是否有明顯承接與拉抬，適合搭配分時圖一起看。'
      : '觀察追價與殺低情緒是否升溫，判斷短線換手品質。',
    total: latest?.[cumulativeKey] ?? 0,
    latest: latest?.[netKey] ?? 0,
    averageShare:
      rows.reduce((sum, row) => sum + Number(row[shareKey] ?? 0), 0) / Math.max(rows.length, 1),
    display: current
      ? {
          time: current.time,
          net: current[netKey] ?? 0,
          cumulative: current[cumulativeKey] ?? 0,
          share: current[shareKey] ?? 0,
          turnoverRatio: current.turnoverRatio ?? 0,
          isHovered: Boolean(hovered),
        }
      : null,
  };
}

function createPanelSeries(type) {
  const rows = flow.value?.rows ?? [];
  const isLarge = type === 'large';
  const netKey = isLarge ? 'largeNetLots' : 'retailNetLots';
  const cumulativeKey = isLarge ? 'largeCumulativeLots' : 'retailCumulativeLots';

  const histogramData = rows.map((row) => ({
    time: toUtcTimestamp(row.timestamp),
    value: Number((row[netKey] ?? 0).toFixed(2)),
    color: (row[netKey] ?? 0) >= 0 ? 'rgba(22, 163, 74, 0.8)' : 'rgba(209, 75, 50, 0.82)',
  }));

  const lineData = rows.map((row) => ({
    time: toUtcTimestamp(row.timestamp),
    value: Number((row[cumulativeKey] ?? 0).toFixed(2)),
  }));

  return { histogramData, lineData };
}

function handleCrosshairMove(event) {
  if (!event?.time) {
    hoveredKey.value = null;
    return;
  }

  const key = serializeChartTime(event.time);
  hoveredKey.value = rowMap.value.has(key) ? key : null;
}

function destroyChart(chartRef, lineRef) {
  lineRef.value = null;
  chartRef.value?.remove();
  chartRef.value = null;
}

function renderPanelChart(type, hostRef, chartRef, lineRef) {
  const host = hostRef.value;
  const rows = flow.value?.rows ?? [];

  if (!host || !rows.length) {
    destroyChart(chartRef, lineRef);
    return;
  }

  destroyChart(chartRef, lineRef);

  const baseOptions = createBaseChartOptions({
    rightOffset: 1,
    timeVisible: true,
    interactive: isInteractive.value,
  });

  const chart = createChart(host, {
    ...baseOptions,
    localization: {
      locale: 'zh-TW',
      priceFormatter: lotAxisFormatter,
    },
    leftPriceScale: {
      visible: false,
      borderColor: chartPalette.border,
      scaleMargins: {
        top: 0.08,
        bottom: 0.24,
      },
    },
    rightPriceScale: {
      visible: true,
      borderColor: chartPalette.border,
      scaleMargins: {
        top: 0.1,
        bottom: 0.28,
      },
    },
    timeScale: {
      ...baseOptions.timeScale,
      barSpacing: rows.length <= 18 ? 18 : 11,
      minBarSpacing: 6,
    },
  });

  chartRef.value = chart;

  const histogramSeries = chart.addSeries(HistogramSeries, {
    priceScaleId: 'left',
    priceFormat: {
      type: 'price',
      precision: 0,
      minMove: 1,
    },
    base: 0,
    lastValueVisible: false,
    priceLineVisible: false,
  });

  const lineSeries = chart.addSeries(LineSeries, {
    color: type === 'large' ? '#123b6d' : '#7a2846',
    lineWidth: 2.2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
    lastValueVisible: true,
    priceLineVisible: false,
    priceFormat: {
      type: 'price',
      precision: 0,
      minMove: 1,
    },
  });

  histogramSeries.setData(createPanelSeries(type).histogramData);
  lineSeries.setData(createPanelSeries(type).lineData);

  lineRef.value = lineSeries;
  chart.subscribeCrosshairMove(handleCrosshairMove);
}

function renderCharts() {
  renderPanelChart('large', largeHost, largeChart, largeLineSeries);
  renderPanelChart('retail', retailHost, retailChart, retailLineSeries);
}

function setLargeHost(element) {
  largeHost.value = element;
}

function setRetailHost(element) {
  retailHost.value = element;
}

onMounted(renderCharts);

watch(flow, () => {
  hoveredKey.value = null;
  renderCharts();
});

onBeforeUnmount(() => {
  destroyChart(largeChart, largeLineSeries);
  destroyChart(retailChart, retailLineSeries);
});
</script>

<template>
  <section v-if="flow" class="panel chart-panel chip-flow-panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p class="panel-subtitle">
          用 5 分鐘價量推估大戶與散戶的盤中方向，適合搭配分時圖一起看追價力道與換手節奏。
        </p>
      </div>
      <div class="indicator-group">
        <span class="indicator-pill">資料日 {{ formatDate(flow.marketDate) }}</span>
        <span class="indicator-pill">{{ flow.dominantSide }}</span>
      </div>
    </div>

    <section class="card-grid compact-summary-grid chip-flow-summary-grid">
      <article
        v-for="item in summaryCards"
        :key="item.title"
        class="info-card chip-flow-summary-card"
        :class="item.tone ? `is-${item.tone}` : ''"
      >
        <p class="info-card-title">{{ item.title }}</p>
        <p class="info-card-value">{{ item.value }}</p>
        <p class="info-card-note">{{ item.note }}</p>
      </article>
    </section>

    <div class="intraday-chip-layout">
      <article
        v-for="panel in panels"
        :key="panel.type"
        class="chart-card chip-flow-card"
      >
        <div class="chart-card-head">
          <span>{{ panel.title }}</span>
          <span>{{ panel.subtitle }}</span>
        </div>

        <div class="chip-flow-card-summary">
          <div>
            <span class="chip-flow-stat-label">累積估算</span>
            <strong :class="`text-${getTone(panel.total)}`">{{ formatLotsValue(panel.total) }}</strong>
          </div>
          <div>
            <span class="chip-flow-stat-label">最近 5 分鐘</span>
            <strong :class="`text-${getTone(panel.latest)}`">{{ formatLotsValue(panel.latest) }}</strong>
          </div>
          <div>
            <span class="chip-flow-stat-label">估算參與比重</span>
            <strong>{{ formatRatio(panel.averageShare) }}</strong>
          </div>
        </div>

        <div v-if="panel.display" class="chip-flow-hover-strip">
          <span class="chip-flow-hover-time">
            {{ panel.display.isHovered ? `游標 ${panel.display.time}` : `最新 ${panel.display.time}` }}
          </span>
          <span :class="`text-${getTone(panel.display.net)}`">
            區間 {{ formatLotsValue(panel.display.net, 1) }}
          </span>
          <span :class="`text-${getTone(panel.display.cumulative)}`">
            累積 {{ formatLotsValue(panel.display.cumulative, 1) }}
          </span>
          <span>參與 {{ formatRatio(panel.display.share) }}</span>
          <span>量能 {{ formatTurnoverRatio(panel.display.turnoverRatio) }}</span>
        </div>

        <div class="chip-flow-lightweight-wrap">
          <div
            v-if="panel.type === 'large'"
            :ref="setLargeHost"
            class="chip-flow-lightweight-chart"
          />
          <div
            v-else
            :ref="setRetailHost"
            class="chip-flow-lightweight-chart"
          />
        </div>
      </article>
    </div>

    <p class="chip-flow-footnote">
      {{ flow.methodology }}
    </p>
  </section>
</template>
