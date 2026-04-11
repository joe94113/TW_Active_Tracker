<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import { useEtfDetail } from '../composables/useEtfDetail';
import StatusCard from '../components/StatusCard.vue';
import InfoCard from '../components/InfoCard.vue';
import IntradayChart from '../components/IntradayChart.vue';
import TechnicalChart from '../components/TechnicalChart.vue';
import HolderStructureChart from '../components/HolderStructureChart.vue';
import { createStockRoute, isStockCode } from '../lib/stockRouting';
import { getEtfAvailabilityLabel, getEtfAvailabilityNote } from '../lib/etfDisplay';
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatPriceDelta,
  formatAmount,
} from '../lib/formatters';

const route = useRoute();
const router = useRouter();
const etfCode = ref(String(route.params.code ?? ''));

watch(
  () => route.params.code,
  (value) => {
    etfCode.value = String(value ?? '');
  },
);

const { etfOverviewList, loadGlobalData } = useGlobalData();
const { latestSnapshot, diffData, marketData, isLoading, errorMessage } = useEtfDetail(etfCode);

onMounted(() => {
  loadGlobalData();
});

const overviewItem = computed(() => etfOverviewList.value.find((item) => item.code === etfCode.value) ?? null);
const heroPills = computed(() => [
  overviewItem.value?.providerLabel ?? '主動式 ETF',
  getEtfAvailabilityLabel(overviewItem.value),
  `資料日 ${formatDate(marketData.value?.priceDate ?? latestSnapshot.value?.disclosureDate)}`,
]);

const summaryCards = computed(() => [
  {
    title: '最新收盤',
    value: formatNumber(marketData.value?.最新摘要?.close),
    description: `日變動 ${formatPriceDelta(marketData.value?.最新摘要?.change)} / ${formatPercent(marketData.value?.最新摘要?.changePercent)}`,
    status:
      (marketData.value?.最新摘要?.change ?? 0) > 0
        ? 'up'
        : (marketData.value?.最新摘要?.change ?? 0) < 0
          ? 'down'
          : 'normal',
  },
  {
    title: '揭露日期',
    value: formatDate(latestSnapshot.value?.disclosureDate ?? overviewItem.value?.disclosureDate),
    description: latestSnapshot.value ? '成分股快照' : '目前先提供行情與技術面',
  },
  {
    title: 'NAV',
    value: formatNumber(latestSnapshot.value?.nav ?? overviewItem.value?.nav),
    description: `基金規模 ${formatAmount(latestSnapshot.value?.aum ?? overviewItem.value?.aum)}`,
  },
  {
    title: '持股檔數',
    value: formatNumber(latestSnapshot.value?.holdingsCount ?? overviewItem.value?.holdingsCount),
    description: `20 日報酬 ${formatPercent(marketData.value?.最新摘要?.return20)}`,
  },
]);

const diffSummaryCards = computed(() => [
  {
    title: '新增檔數',
    value: formatNumber(diffData.value?.summary?.addedCount),
    description: diffData.value?.comparisonReady ? '新納入最新成分股' : '首日建檔',
    status: 'up',
  },
  {
    title: '刪除檔數',
    value: formatNumber(diffData.value?.summary?.removedCount),
    description: diffData.value?.comparisonReady ? '從前一版移出' : '首日建檔',
    status: 'down',
  },
  {
    title: '加碼檔數',
    value: formatNumber(diffData.value?.summary?.increasedCount),
    description: diffData.value?.comparisonReady ? '權重或股數提高' : '首日建檔',
    status: 'up',
  },
  {
    title: '減碼檔數',
    value: formatNumber(diffData.value?.summary?.decreasedCount),
    description: diffData.value?.comparisonReady ? '權重或股數下降' : '首日建檔',
    status: 'down',
  },
]);

const diffSections = computed(() => [
  {
    key: 'added',
    title: '新增',
    items: diffData.value?.added ?? [],
    statusClass: 'text-up',
    emptyMessage: '本次沒有新增成分股。',
  },
  {
    key: 'removed',
    title: '刪除',
    items: diffData.value?.removed ?? [],
    statusClass: 'text-down',
    emptyMessage: '本次沒有移出成分股。',
  },
  {
    key: 'increased',
    title: '加碼',
    items: diffData.value?.increased ?? [],
    statusClass: 'text-up',
    emptyMessage: '本次沒有加碼持股。',
  },
  {
    key: 'decreased',
    title: '減碼',
    items: diffData.value?.decreased ?? [],
    statusClass: 'text-down',
    emptyMessage: '本次沒有減碼持股。',
  },
]);

function openStockDetail(code) {
  if (!isStockCode(code)) return;
  router.push(createStockRoute(code));
}
</script>

<template>
  <section class="page-shell">
    <div class="page-hero compact">
      <div>
        <p class="page-kicker">ETF 明細</p>
        <h1 class="page-title">{{ overviewItem?.name ?? etfCode }}</h1>
        <p class="page-text">
          這裡把官方成分股、前一日異動和技術面放在同一頁，方便直接追 ETF 今天在押哪些方向。
        </p>
        <div class="hero-feature-row">
          <span v-for="item in heroPills" :key="item" class="hero-feature-pill">{{ item }}</span>
        </div>
      </div>
      <div class="hero-side-actions">
        <a
          v-if="overviewItem?.sourceUrl"
          class="action-link"
          :href="overviewItem.sourceUrl"
          target="_blank"
          rel="noreferrer"
        >
          官方來源
        </a>
      </div>
    </div>

    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(overviewItem || marketData)"
      empty-message="ETF 明細資料尚未就緒。"
    />

    <template v-if="overviewItem || marketData">
      <section class="card-grid">
        <InfoCard
          v-for="item in summaryCards"
          :key="item.title"
          :title="item.title"
          :value="item.value"
          :description="item.description"
          :status="item.status"
        />
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">資料覆蓋說明</h2>
            <p class="panel-subtitle">{{ getEtfAvailabilityLabel(overviewItem) }}</p>
          </div>
        </div>
        <p class="muted">{{ getEtfAvailabilityNote(overviewItem) }}</p>
      </section>

      <IntradayChart
        v-if="marketData?.盤中走勢"
        :data="marketData.盤中走勢"
        title="ETF 盤中分時圖"
      />

      <TechnicalChart v-if="marketData" :data="marketData" title="ETF 技術分析圖表" />

      <HolderStructureChart
        v-if="marketData?.持股分散"
        :data="marketData.持股分散"
        title="ETF 大戶 / 散戶拆解圖表"
      />

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">ETF 觀察</h2>
              <p class="panel-subtitle">技術面與籌碼補充</p>
            </div>
          </div>
          <ul class="bullet-list">
            <li v-for="item in marketData?.觀察摘要 ?? []" :key="item">{{ item }}</li>
          </ul>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">持股分散</h2>
              <p class="panel-subtitle">TDCC 最新週資料</p>
            </div>
          </div>
          <ul class="bullet-list compact">
            <li>大戶持股比：{{ formatPercent(marketData?.持股分散?.largeHolderRatio) }}</li>
            <li>散戶持股比：{{ formatPercent(marketData?.持股分散?.retailRatio) }}</li>
            <li>更新日期：{{ formatDate(marketData?.持股分散?.date) }}</li>
            <li>總持有人數：{{ formatAmount(marketData?.持股分散?.totalHolders) }}</li>
          </ul>
        </article>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">最新成分股</h2>
            <p class="panel-subtitle">揭露日期 {{ formatDate(latestSnapshot?.disclosureDate) }}</p>
          </div>
        </div>
        <div v-if="latestSnapshot?.holdings?.length" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>代號</th>
                <th>名稱</th>
                <th>股數</th>
                <th>權重</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in latestSnapshot.holdings"
                :key="item.code"
                :class="{ 'clickable-row': isStockCode(item.code) }"
                :tabindex="isStockCode(item.code) ? 0 : undefined"
                @click="openStockDetail(item.code)"
                @keydown.enter="openStockDetail(item.code)"
              >
                <td>
                  <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">
                    {{ item.code }}
                  </RouterLink>
                  <span v-else>{{ item.code }}</span>
                </td>
                <td>
                  <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">
                    {{ item.name }}
                  </RouterLink>
                  <span v-else>{{ item.name }}</span>
                </td>
                <td>{{ formatAmount(item.shares) }}</td>
                <td>{{ formatPercent(item.weight) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state compact">
          <strong>成分股清單整理中</strong>
          <p>這檔 ETF 目前先提供行情與技術面，官方成分股與異動資料會在後續補齊。</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">與前一日相比</h2>
            <p class="panel-subtitle">
              {{ formatDate(diffData?.fromDisclosureDate) }} 到 {{ formatDate(diffData?.toDisclosureDate) }}
            </p>
          </div>
        </div>
        <div v-if="diffData" class="etf-diff-layout">
          <div class="card-grid">
            <InfoCard
              v-for="item in diffSummaryCards"
              :key="`diff-${item.title}`"
              :title="item.title"
              :value="item.value"
              :description="item.description"
              :status="item.status"
            />
          </div>

          <div v-if="diffData.comparisonReady" class="quad-grid">
            <article v-for="section in diffSections" :key="section.key" class="sub-panel">
              <div class="panel-header">
                <div>
                  <h3 class="sub-panel-title">{{ section.title }}</h3>
                  <p class="panel-subtitle">共 {{ formatNumber(section.items.length) }} 檔</p>
                </div>
              </div>

              <div v-if="section.items.length" class="table-wrap">
                <table class="data-table compact-table">
                  <thead>
                    <tr>
                      <th>代號</th>
                      <th>名稱</th>
                      <th>前一日</th>
                      <th>最新</th>
                      <th>權重差</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in section.items" :key="`${section.key}-${item.code}`">
                      <td>
                        <RouterLink
                          v-if="isStockCode(item.code)"
                          class="code-link"
                          :to="createStockRoute(item.code)"
                        >
                          {{ item.code }}
                        </RouterLink>
                        <span v-else>{{ item.code }}</span>
                      </td>
                      <td>{{ item.name }}</td>
                      <td>
                        <div>{{ formatPercent(item.previousWeight) }}</div>
                        <div class="muted">{{ formatAmount(item.previousShares) }}</div>
                      </td>
                      <td>
                        <div>{{ formatPercent(item.currentWeight) }}</div>
                        <div class="muted">{{ formatAmount(item.currentShares) }}</div>
                      </td>
                      <td :class="section.statusClass">
                        <div>{{ formatPercent(item.weightDelta) }}</div>
                        <div class="muted">{{ formatAmount(item.sharesDelta) }}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty-state compact">
                <strong>{{ section.title }} 0 檔</strong>
                <p>{{ section.emptyMessage }}</p>
              </div>
            </article>
          </div>
          <div v-else class="empty-state compact">
            <strong>首日建檔完成</strong>
            <p>這檔 ETF 已有最新成分股快照，待下一個揭露日就會自動產出和前一版相比的完整異動。</p>
          </div>
        </div>
        <div v-else class="empty-state compact">
          <strong>異動資料整理中</strong>
          <p>目前尚未提供可比較的前一日成分異動，先參考這檔 ETF 的行情與技術面。</p>
        </div>
      </section>
    </template>
  </section>
</template>
