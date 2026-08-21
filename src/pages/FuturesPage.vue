<script setup>
import { computed, onMounted } from 'vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import StatusCard from '../components/StatusCard.vue';
import TechnicalChart from '../components/TechnicalChart.vue';
import {
  formatAmount,
  formatDate,
  formatNumber,
} from '../lib/formatters';

const { dashboard, manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();

onMounted(() => {
  loadGlobalData();
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

function getInstitutionalFlow(contract, identity) {
  return contract?.法人資料?.find((item) => item.身份別 === identity) ?? null;
}

function formatDirection(value) {
  const text = String(value ?? '');
  if (text.includes('多')) return '偏多';
  if (text.includes('空')) return '偏空';
  return '觀望';
}

const overallDirection = computed(() => {
  const directions = (futuresPositioning.value?.契約列表 ?? []).map((item) => formatDirection(item.方向));
  if (!directions.length) return '觀望';
  if (directions.every((item) => item === '偏多')) return '偏多';
  if (directions.every((item) => item === '偏空')) return '偏空';
  return '觀望';
});
const overallDirectionTone = computed(() => {
  if (overallDirection.value === '偏多') return 'up';
  if (overallDirection.value === '偏空') return 'down';
  return 'neutral';
});
const overallDirectionNote = computed(() => {
  if (overallDirection.value === '偏多') return '小台與微台方向較偏多，仍要留意追價風險。';
  if (overallDirection.value === '偏空') return '小台與微台方向較偏空，操作先以保守為主。';
  return '法人方向尚未一致，先以區間與風險控管為主。';
});
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
      <section class="panel futures-direction-hero">
        <div class="futures-direction-copy">
          <h1>期貨籌碼</h1>
          <p>小台與微台 · 資料日 {{ formatDate(futuresDailyDate) }}</p>
        </div>

        <div class="futures-direction-reading" :class="`is-${overallDirectionTone}`">
          <span>目前方向</span>
          <strong>{{ overallDirection }}</strong>
          <p>{{ overallDirectionNote }}</p>
        </div>
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
                <p class="panel-subtitle">方向 {{ formatDirection(contract.方向) }}</p>
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
