<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import StatusCard from '../components/StatusCard.vue';
import TechnicalChart from '../components/TechnicalChart.vue';
import {
  formatAmount,
  formatDate,
  formatNumber,
} from '../lib/formatters';

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const REFRESH_MINUTES = [
  ...Array.from({ length: 24 }, (_, index) => (9 * 60) + (index * 15)),
  14 * 60 + 50,
  15 * 60 + 20,
  18 * 60 + 35,
];

const { dashboard, manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();
const nowTimestamp = ref(Date.now());
let clockHandle = null;

onMounted(() => {
  loadGlobalData();
  clockHandle = window.setInterval(() => {
    nowTimestamp.value = Date.now();
  }, 60000);
});

onBeforeUnmount(() => {
  if (clockHandle) {
    window.clearInterval(clockHandle);
    clockHandle = null;
  }
});

const futuresPositioning = computed(() => dashboard.value?.期貨籌碼 ?? null);
const futuresDailyDate = computed(() => futuresPositioning.value?.資料日期 ?? null);

const pageSeo = computed(() => ({
  title: '小台 / 微台期貨籌碼與走勢',
  description: '集中看小型臺指期貨與微型臺指期貨的法人未平倉、整體方向判讀與技術走勢圖，方便盤後單獨研究。',
  routePath: '/futures',
  keywords: ['小台', '微台', '期貨籌碼', '小型臺指', '微型臺指', '法人未平倉'],
}));

useSeoMeta(pageSeo);

const futuresStatusSummary = computed(() => {
  if (futuresDailyDate.value) {
    return `目前顯示期交所最新日資料 ${formatDate(futuresDailyDate.value)}，把小台與微台的法人未平倉、方向判讀和技術走勢集中在同一頁。`;
  }

  return '期貨日資料整理中。';
});

function toTaipeiShiftedDate(dateLike) {
  const baseDate = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return new Date(baseDate.getTime() + TAIPEI_OFFSET_MS);
}

function createTaipeiDate(year, month, day, minutesOfDay) {
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0));
}

function formatTaipeiDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getNextRefreshDate(now = new Date()) {
  const shiftedNow = toTaipeiShiftedDate(now);

  for (let offset = 0; offset < 10; offset += 1) {
    const shiftedDay = new Date(shiftedNow.getTime());
    shiftedDay.setUTCDate(shiftedNow.getUTCDate() + offset);
    const weekday = shiftedDay.getUTCDay();

    if (weekday === 0 || weekday === 6) {
      continue;
    }

    const year = shiftedDay.getUTCFullYear();
    const month = shiftedDay.getUTCMonth() + 1;
    const day = shiftedDay.getUTCDate();
    const currentMinutes = (shiftedNow.getUTCHours() * 60) + shiftedNow.getUTCMinutes();

    for (const minutesOfDay of REFRESH_MINUTES) {
      if (offset === 0 && minutesOfDay <= currentMinutes) {
        continue;
      }

      return createTaipeiDate(year, month, day, minutesOfDay);
    }
  }

  return null;
}

function getInstitutionalFlow(contract, identity) {
  return contract?.法人資料?.find((item) => item.身份別 === identity) ?? null;
}

const futuresLastUpdatedLabel = computed(() => formatTaipeiDateTime(manifest.value?.generatedAt));
const futuresNextRefreshLabel = computed(() => formatTaipeiDateTime(getNextRefreshDate(new Date(nowTimestamp.value))));
</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(futuresPositioning)"
      empty-message="期貨籌碼資料尚未整理完成。"
    />

    <template v-if="futuresPositioning">
      <section class="page-hero compact futures-page-hero">
        <div class="hero-copy">
          <span class="hero-kicker">期貨專頁</span>
          <h1>小台 / 微台籌碼與走勢</h1>
          <p>{{ futuresStatusSummary }}</p>
          <ul v-if="futuresPositioning.整體建議?.length" class="bullet-list">
            <li v-for="item in futuresPositioning.整體建議" :key="item">{{ item }}</li>
          </ul>
        </div>

        <aside class="hero-side-actions theme-hero-side">
          <div class="hero-stat-card">
            <span class="hero-stat-label">日線資料</span>
            <strong>{{ formatDate(futuresPositioning.資料日期) }}</strong>
          </div>
          <div class="hero-stat-card">
            <span class="hero-stat-label">最近整理</span>
            <strong>{{ futuresLastUpdatedLabel }}</strong>
          </div>
          <div class="hero-stat-card">
            <span class="hero-stat-label">下次預計更新</span>
            <strong>{{ futuresNextRefreshLabel }}</strong>
          </div>
        </aside>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">法人未平倉與方向</h2>
            <p class="panel-subtitle">先看外資、自營商未平倉方向，再搭配每個契約的觀察建議和走勢圖。</p>
          </div>
          <span class="meta-chip">資料日 {{ formatDate(futuresPositioning.資料日期) }}</span>
        </div>

        <div class="futures-grid">
          <article
            v-for="contract in futuresPositioning.契約列表 ?? []"
            :key="contract.商品代碼"
            class="sub-panel"
          >
            <div class="futures-card-head">
              <div>
                <h3>{{ contract.契約名稱 }}</h3>
                <p class="panel-subtitle">方向 {{ contract.方向 }}</p>
              </div>
              <span class="meta-chip">{{ contract.行情代碼 }}</span>
            </div>

            <div class="metric-line">
              <span>外資未平倉淨口數</span>
              <strong :class="{ 'text-up': (getInstitutionalFlow(contract, '外資')?.未平倉淨口數 ?? 0) > 0, 'text-down': (getInstitutionalFlow(contract, '外資')?.未平倉淨口數 ?? 0) < 0 }">
                {{ formatAmount(getInstitutionalFlow(contract, '外資')?.未平倉淨口數) }}
              </strong>
            </div>

            <div class="metric-line">
              <span>自營商未平倉淨口數</span>
              <strong :class="{ 'text-up': (getInstitutionalFlow(contract, '自營商')?.未平倉淨口數 ?? 0) > 0, 'text-down': (getInstitutionalFlow(contract, '自營商')?.未平倉淨口數 ?? 0) < 0 }">
                {{ formatAmount(getInstitutionalFlow(contract, '自營商')?.未平倉淨口數) }}
              </strong>
            </div>

            <div class="metric-line">
              <span>投信未平倉淨口數</span>
              <strong :class="{ 'text-up': (getInstitutionalFlow(contract, '投信')?.未平倉淨口數 ?? 0) > 0, 'text-down': (getInstitutionalFlow(contract, '投信')?.未平倉淨口數 ?? 0) < 0 }">
                {{ formatAmount(getInstitutionalFlow(contract, '投信')?.未平倉淨口數) }}
              </strong>
            </div>

            <ul class="bullet-list compact">
              <li v-for="item in contract.觀察建議 ?? []" :key="item">{{ item }}</li>
            </ul>
          </article>
        </div>
      </section>

      <TechnicalChart
        v-for="contract in futuresPositioning.契約列表 ?? []"
        :key="`${contract.商品代碼}-chart`"
        :data="contract.技術面資料"
        :title="`${contract.契約名稱}走勢圖表`"
      />
    </template>
  </section>
</template>
