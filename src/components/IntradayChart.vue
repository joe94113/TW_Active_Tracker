<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { BaselineSeries, HistogramSeries, LineSeries, createChart } from 'lightweight-charts';
import { formatAmount, formatDate, formatNumber, formatPercent } from '../lib/formatters';
import {
  buildConstantLineData,
  chartEnums,
  chartPalette,
  createBaseChartOptions,
  formatCrosshairLabel,
  formatTickMark,
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
    default: '盤中分時圖',
  },
});

const chartHost = ref(null);
const chartApi = shallowRef(null);
const hoveredKey = ref(null);

const points = computed(() =>
  (props.data?.points ?? [])
    .map((item) => {
      const time = toUtcTimestamp(item.timestamp);
      const price = normalizeNumber(item.price, true);

      if (time === null || price === null) {
        return null;
      }

      return {
        ...item,
        key: String(time),
        time,
        price,
        high: normalizeNumber(item.high, true) ?? price,
        low: normalizeNumber(item.low, true) ?? price,
        volume: normalizeNumber(item.volume, true) ?? 0,
        change: normalizeNumber(item.change),
        changePercent: normalizeNumber(item.changePercent),
      };
    })
    .filter(Boolean),
);

const pointMap = computed(() => new Map(points.value.map((item) => [item.key, item])));
const latestPoint = computed(() => points.value.at(-1) ?? null);
const hoveredPoint = computed(() => pointMap.value.get(hoveredKey.value) ?? null);
const displayPoint = computed(() => hoveredPoint.value ?? latestPoint.value);
const previousClose = computed(() => normalizeNumber(props.data?.previousClose, true));

const sessionRangePercent = computed(() => {
  const high = normalizeNumber(props.data?.high, true);
  const low = normalizeNumber(props.data?.low, true);
  const base = previousClose.value;

  if (high === null || low === null || base === null) {
    return null;
  }

  return ((high - low) / base) * 100;
});

const infoStats = computed(() => {
  const point = displayPoint.value;

  if (!point) {
    return [];
  }

  return [
    {
      label: hoveredPoint.value ? '游標' : '最新',
      value: formatCrosshairLabel(point.time),
      emphasis: true,
    },
    {
      label: '價格',
      value: formatNumber(point.price),
    },
    {
      label: '漲跌',
      value: `${formatNumber(point.change)} / ${formatPercent(point.changePercent)}`,
      tone: (point.change ?? 0) > 0 ? 'up' : (point.change ?? 0) < 0 ? 'down' : undefined,
    },
    {
      label: '高 / 低',
      value: `${formatNumber(point.high)} / ${formatNumber(point.low)}`,
    },
    {
      label: '量',
      value: formatAmount(point.volume),
    },
    {
      label: '振幅',
      value: formatPercent(sessionRangePercent.value),
    },
  ];
});

function handleCrosshairMove(event) {
  if (!event?.time) {
    hoveredKey.value = null;
    return;
  }

  const key = serializeChartTime(event.time);
  hoveredKey.value = pointMap.value.has(key) ? key : null;
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

  if (!points.value.length) {
    destroyChart();
    return;
  }

  destroyChart();

  const chart = createChart(chartHost.value, {
    ...createBaseChartOptions({
      rightOffset: 8,
      timeVisible: true,
    }),
    timeScale: {
      ...createBaseChartOptions({ timeVisible: true }).timeScale,
      rightOffset: 8,
      barSpacing: points.value.length <= 12 ? 24 : 11,
      minBarSpacing: 7,
      timeVisible: true,
      tickMarkFormatter: formatTickMark,
    },
  });

  chartApi.value = chart;

  const priceSeries = chart.addSeries(
    BaselineSeries,
    {
      baseValue: {
        type: 'price',
        price: previousClose.value ?? (points.value[0]?.price ?? 0),
      },
      topLineColor: chartPalette.up,
      topFillColor1: chartPalette.zoneUpTop,
      topFillColor2: chartPalette.zoneUpBottom,
      bottomLineColor: chartPalette.down,
      bottomFillColor1: chartPalette.zoneDownTop,
      bottomFillColor2: chartPalette.zoneDownBottom,
      lineWidth: 2,
      priceLineVisible: true,
      priceLineSource: chartEnums.PriceLineSource.LastBar,
      lastPriceAnimation: chartEnums.LastPriceAnimationMode.Disabled,
    },
    0,
  );

  priceSeries.setData(
    points.value.map((point) => ({
      time: point.time,
      value: point.price,
    })),
  );

  priceSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.08,
      bottom: 0.1,
    },
  });

  const referenceLine = chart.addSeries(
    LineSeries,
    {
      color: chartPalette.guide,
      lineWidth: 1,
      lineStyle: chartEnums.LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    },
    0,
  );

  referenceLine.setData(
    buildConstantLineData(
      points.value,
      previousClose.value ?? points.value[0]?.price ?? 0,
    ),
  );

  const volumeSeries = chart.addSeries(
    HistogramSeries,
    {
      priceFormat: {
        type: 'volume',
      },
      priceLineVisible: false,
      lastValueVisible: false,
    },
    1,
  );

  volumeSeries.setData(
    points.value.map((point) => ({
      time: point.time,
      value: point.volume,
      color: (point.change ?? 0) >= 0 ? chartPalette.volumeUp : chartPalette.volumeDown,
    })),
  );

  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.16,
      bottom: 0.04,
    },
  });

  if (chart.panes()[0]) {
    chart.panes()[0].setStretchFactor(0.72);
  }

  if (chart.panes()[1]) {
    chart.panes()[1].setStretchFactor(0.28);
  }

  chart.subscribeCrosshairMove(handleCrosshairMove);
  chart.timeScale().fitContent();
}

watch(
  points,
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
          盤中 5 分鐘資料，已補上十字線同步價量、前收基準線與漲跌背景區。
        </p>
      </div>
    </div>

    <div v-if="points.length" class="market-chart-shell">
      <div class="chart-info-strip">
        <div class="chart-info-grid">
          <div
            v-for="item in infoStats"
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
      </div>

      <div ref="chartHost" class="market-chart-host is-intraday" />

      <p class="chart-footnote">
        交易日 {{ formatDate(data?.marketDate) }}，十字線會同步對應價格與量能柱。
      </p>
    </div>

    <p v-else class="muted">
      {{ data?.錯誤訊息 ? `目前無法取得盤中分時資料：${data.錯誤訊息}` : '目前沒有足夠的盤中分時資料。' }}
    </p>
  </section>
</template>
