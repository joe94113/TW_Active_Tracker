<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import StatusCard from '../components/StatusCard.vue';
import { getEtfAvailabilityLabel, getEtfAvailabilityNote, getEtfDetailAvailability } from '../lib/etfDisplay';
import { formatDate, formatAmount, formatNumber } from '../lib/formatters';

const { manifest, etfOverviewList, isLoading, errorMessage, loadGlobalData } = useGlobalData();
const keyword = ref('');

onMounted(() => {
  loadGlobalData();
});

const filteredList = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  if (!normalizedKeyword) {
    return etfOverviewList.value;
  }

  return etfOverviewList.value.filter((item) =>
    [item.code, item.name, item.fullName, item.providerLabel].some((field) =>
      String(field ?? '').toLowerCase().includes(normalizedKeyword),
    ),
  );
});
</script>

<template>
  <section class="page-shell">
    <div class="page-hero compact">
      <div>
        <p class="page-kicker">主動式 ETF 清單</p>
        <h1 class="page-title">成分表、異動、技術面一次看</h1>
        <p class="page-text">
          這頁先看所有主動式 ETF 的資料覆蓋程度，再進個別頁面看官方成分股、異動與行情圖表。
        </p>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">ETF 篩選</h2>
          <p class="panel-subtitle">目前納入 {{ manifest?.trackedEtfs?.length ?? 0 }} 檔</p>
        </div>
      </div>
      <input v-model="keyword" class="search-input" type="text" placeholder="輸入代號、名稱或投信名稱" />
    </section>

    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(manifest)"
      empty-message="ETF 清單資料尚未就緒。"
    />

    <section v-if="manifest" class="etf-grid">
      <article
        v-for="item in filteredList"
        :key="item.code"
        class="panel etf-card"
      >
        <div class="etf-card-head">
          <div>
            <p class="ticker-code">{{ item.code }}</p>
            <h2 class="etf-card-title">{{ item.name }}</h2>
          </div>
          <span class="status-badge" :class="getEtfDetailAvailability(item) === 'full' ? 'is-up' : 'is-market'">
            {{ getEtfAvailabilityLabel(item) }}
          </span>
        </div>
        <p class="muted">{{ item.providerLabel }}</p>
        <div class="metric-line">
          <span>揭露日</span>
          <strong>{{ formatDate(item.disclosureDate) }}</strong>
        </div>
        <div class="metric-line">
          <span>NAV</span>
          <strong>{{ formatNumber(item.nav) }}</strong>
        </div>
        <div class="metric-line">
          <span>基金規模</span>
          <strong>{{ formatAmount(item.aum) }}</strong>
        </div>
        <div class="metric-line">
          <span>持股檔數</span>
          <strong>{{ formatNumber(item.holdingsCount) }}</strong>
        </div>
        <div class="etf-change-strip">
          <span>新增 {{ formatNumber(item.changeSummary?.addedCount) }}</span>
          <span>刪除 {{ formatNumber(item.changeSummary?.removedCount) }}</span>
          <span>加碼 {{ formatNumber(item.changeSummary?.increasedCount) }}</span>
          <span>減碼 {{ formatNumber(item.changeSummary?.decreasedCount) }}</span>
        </div>
        <p class="etf-card-note">{{ getEtfAvailabilityNote(item) }}</p>
        <div class="action-row">
          <RouterLink class="action-link" :to="`/etfs/${item.code}`">查看 ETF 明細</RouterLink>
          <a class="action-link muted-link" :href="item.sourceUrl" target="_blank" rel="noreferrer">官方來源</a>
        </div>
      </article>
    </section>
  </section>
</template>
