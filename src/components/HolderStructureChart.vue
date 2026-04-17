<script setup>
import { computed } from 'vue';
import { formatAmount, formatDate, formatLots, formatPercent } from '../lib/formatters';

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  title: {
    type: String,
    default: '大戶 / 散戶拆解圖表',
  },
});

const holderData = computed(() => props.data ?? null);

const segments = computed(() => {
  const retailRatio = holderData.value?.retailRatio ?? 0;
  const largeRatio = holderData.value?.largeHolderRatio ?? 0;
  const middleRatio = Math.max(100 - retailRatio - largeRatio, 0);

  return [
    {
      key: 'retail',
      label: '散戶',
      note: '10 張以下',
      ratio: retailRatio,
      delta: holderData.value?.retailRatioDelta ?? null,
      colorClass: 'is-retail',
    },
    {
      key: 'middle',
      label: '中實戶',
      note: '10 張到 400 張',
      ratio: middleRatio,
      delta:
        holderData.value?.retailRatioDelta !== null && holderData.value?.largeHolderRatioDelta !== null
          ? -((holderData.value?.retailRatioDelta ?? 0) + (holderData.value?.largeHolderRatioDelta ?? 0))
          : null,
      colorClass: 'is-middle',
    },
    {
      key: 'large',
      label: '大戶',
      note: '400 張以上',
      ratio: largeRatio,
      delta: holderData.value?.largeHolderRatioDelta ?? null,
      colorClass: 'is-large',
    },
  ];
});

const keyBands = computed(() =>
  (holderData.value?.bands ?? [])
    .filter((item) => item.level !== 17 && [1, 2, 3, 12, 13, 14, 15].includes(item.level))
    .map((item) => ({
      ...item,
      colorClass: item.level <= 3 ? 'is-retail' : 'is-large',
    })),
);

const maxBandRatio = computed(() => Math.max(...keyBands.value.map((item) => item.ratio ?? 0), 1));

function getBandWidth(value) {
  return `${Math.max(((value ?? 0) / maxBandRatio.value) * 100, 3)}%`;
}

function formatDelta(value) {
  if (value === null || value === undefined) return '暫無前次比較';
  const absoluteValue = Math.abs(value).toFixed(2);

  if (value > 0) return `較前次增加 ${absoluteValue} 個百分點`;
  if (value < 0) return `較前次減少 ${absoluteValue} 個百分點`;

  return '較前次持平';
}
</script>

<template>
  <section class="panel chart-panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p class="panel-subtitle">
          TDCC 最新週資料 {{ formatDate(holderData?.date) }}，把散戶、中實戶與大戶的籌碼結構直接展開。
        </p>
      </div>
      <div class="indicator-group">
        <span class="indicator-pill">總持有人數 {{ formatAmount(holderData?.totalHolders) }}</span>
        <span class="indicator-pill">庫存占比 {{ formatPercent(holderData?.totalRatio) }}</span>
      </div>
    </div>

    <div v-if="holderData?.bands?.length" class="holder-chart-layout">
      <div class="chart-card holder-summary-card">
        <div class="chart-card-head">
          <span>籌碼三層結構</span>
          <span>{{ holderData?.資料說明 ?? '依 TDCC 分級整理' }}</span>
        </div>

        <div class="holder-stacked-bar" aria-label="大戶散戶持股占比">
          <div
            v-for="item in segments"
            :key="item.key"
            class="holder-segment"
            :class="item.colorClass"
            :style="{ width: `${Math.max(item.ratio ?? 0, 2)}%` }"
          >
            <span v-if="(item.ratio ?? 0) >= 8" class="holder-segment-label">
              {{ item.label }} {{ formatPercent(item.ratio) }}
            </span>
          </div>
        </div>

        <div class="holder-metric-grid">
          <article
            v-for="item in segments"
            :key="`${item.key}-metric`"
            class="holder-metric-card"
            :class="item.colorClass"
          >
            <p class="holder-metric-title">{{ item.label }}</p>
            <strong class="holder-metric-value">{{ formatPercent(item.ratio) }}</strong>
            <p class="holder-metric-note">{{ item.note }}</p>
            <p class="holder-metric-delta">{{ formatDelta(item.delta) }}</p>
          </article>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-card-head">
          <span>關鍵級距分布</span>
          <span>散戶端與大戶端級距</span>
        </div>

        <div class="holder-band-list">
          <article
            v-for="item in keyBands"
            :key="item.level"
            class="holder-band-row"
          >
            <div class="holder-band-head">
              <strong>{{ item.label }}</strong>
              <span>{{ formatPercent(item.ratio) }}</span>
            </div>
            <div class="holder-band-track">
              <div
                class="holder-band-fill"
                :class="item.colorClass"
                :style="{ width: getBandWidth(item.ratio) }"
              />
            </div>
            <div class="holder-band-meta">
              <span>人數 {{ formatAmount(item.holders) }}</span>
              <span>張數 {{ formatLots(item.shares) }}</span>
            </div>
          </article>
        </div>
      </div>
    </div>

    <p v-else class="muted">目前還沒有足夠的持股分散資料可以繪製圖表。</p>
  </section>
</template>
