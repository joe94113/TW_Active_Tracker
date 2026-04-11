<script setup>
import { computed } from 'vue';
import { normalizeNumber } from '../lib/charting';

const props = defineProps({
  values: {
    type: Array,
    default: () => [],
  },
  tone: {
    type: String,
    default: 'normal',
  },
});

const normalizedValues = computed(() =>
  (props.values ?? []).map((value) => normalizeNumber(value, true)).filter((value) => value !== null),
);

const chartGeometry = computed(() => {
  const values = normalizedValues.value;

  if (values.length < 2) {
    return null;
  }

  const width = 160;
  const height = 58;
  const padding = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const step = (width - padding * 2) / Math.max(values.length - 1, 1);

  const points = values.map((value, index) => {
    const x = padding + step * index;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points.at(-1).x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return {
    width,
    height,
    linePath,
    areaPath,
  };
});

const chartClass = computed(() => `mini-trend-chart is-${props.tone}`);
</script>

<template>
  <div :class="chartClass" aria-hidden="true">
    <svg v-if="chartGeometry" :viewBox="`0 0 ${chartGeometry.width} ${chartGeometry.height}`" class="mini-trend-svg">
      <path :d="chartGeometry.areaPath" class="mini-trend-area" />
      <path :d="chartGeometry.linePath" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" />
    </svg>
    <div v-else class="mini-trend-empty" />
  </div>
</template>
