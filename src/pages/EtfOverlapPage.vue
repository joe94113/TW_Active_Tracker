<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import StatusCard from '../components/StatusCard.vue';
import InfoCard from '../components/InfoCard.vue';
import { createStockRoute, isStockCode } from '../lib/stockRouting';
import { formatDate, formatPercent, formatNumber } from '../lib/formatters';

const { overlap, isLoading, errorMessage, loadGlobalData } = useGlobalData();

onMounted(() => {
  loadGlobalData();
});

const summaryCards = computed(() => [
  {
    title: '已串接 ETF',
    value: String(overlap.value?.已串接ETF數 ?? 0),
    description: `最新揭露 ${formatDate(overlap.value?.最新揭露日期)}`,
  },
  {
    title: '共同持股',
    value: String(overlap.value?.共同持股?.length ?? 0),
    description: '至少出現在兩檔 ETF',
  },
  {
    title: '共同新增',
    value: String(overlap.value?.共同新增?.length ?? 0),
    description: '同日一起新增的持股',
  },
  {
    title: '共同加碼',
    value: String(overlap.value?.共同加碼?.length ?? 0),
    description: '同日一起提高權重的持股',
  },
]);
</script>

<template>
  <section class="page-shell">
    <div class="page-hero compact">
      <div>
        <p class="page-kicker">ETF 重疊分析</p>
        <h1 class="page-title">哪些持股被多檔主動式 ETF 同時看上</h1>
        <p class="page-text">
          這頁聚焦在共同持股、共同新增加碼與單一 ETF 的特色異動，方便快速找市場共識與差異化押注。
        </p>
      </div>
    </div>

    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(overlap)"
      empty-message="ETF 重疊資料尚未整理完成。"
    />

    <template v-if="overlap">
      <section class="card-grid">
        <InfoCard
          v-for="item in summaryCards"
          :key="item.title"
          :title="item.title"
          :value="item.value"
          :description="item.description"
        />
      </section>

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">共同持股</h2>
              <p class="panel-subtitle">被多檔 ETF 同時持有的台股</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>出現 ETF 數</th>
                  <th>平均權重</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in overlap.共同持股 ?? []" :key="item.code">
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
                  <td>{{ formatNumber(item.出現ETF數) }}</td>
                  <td>{{ formatPercent(item.平均權重) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">共同加碼</h2>
              <p class="panel-subtitle">多檔 ETF 同步提高權重</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>出現 ETF 數</th>
                  <th>ETF 清單</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in overlap.共同加碼 ?? []" :key="item.code">
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
                  <td>{{ formatNumber(item.出現ETF數) }}</td>
                  <td>{{ item.ETF代號?.join('、') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section class="triple-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">不重複新增</h2>
              <p class="panel-subtitle">只出現在單一 ETF</p>
            </div>
          </div>
          <ul class="stack-list">
            <li v-for="item in overlap.不重複異動?.新增 ?? []" :key="`${item.code}-add`">
              <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">
                {{ item.code }}
              </RouterLink>
              <span v-else>{{ item.code }}</span>
              <span>{{ item.name }}</span>
              <span class="text-up">{{ item.etfCode }}</span>
            </li>
          </ul>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">不重複加碼</h2>
              <p class="panel-subtitle">ETF 特色加碼股</p>
            </div>
          </div>
          <ul class="stack-list">
            <li v-for="item in overlap.不重複異動?.加碼 ?? []" :key="`${item.code}-inc`">
              <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">
                {{ item.code }}
              </RouterLink>
              <span v-else>{{ item.code }}</span>
              <span>{{ item.name }}</span>
              <span class="text-up">{{ formatPercent(item.weightDelta) }}</span>
            </li>
          </ul>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">不重複減碼</h2>
              <p class="panel-subtitle">ETF 特色減碼股</p>
            </div>
          </div>
          <ul class="stack-list">
            <li v-for="item in overlap.不重複異動?.減碼 ?? []" :key="`${item.code}-dec`">
              <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">
                {{ item.code }}
              </RouterLink>
              <span v-else>{{ item.code }}</span>
              <span>{{ item.name }}</span>
              <span class="text-down">{{ formatPercent(item.weightDelta) }}</span>
            </li>
          </ul>
        </article>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">各 ETF 異動摘要</h2>
            <p class="panel-subtitle">快速看哪一檔今天動得最多</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ETF</th>
                <th>揭露日</th>
                <th>新增</th>
                <th>刪除</th>
                <th>加碼</th>
                <th>減碼</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in overlap.各ETF異動摘要 ?? []" :key="item.code">
                <td><RouterLink class="code-link" :to="`/etfs/${item.code}`">{{ item.code }} {{ item.name }}</RouterLink></td>
                <td>{{ formatDate(item.disclosureDate) }}</td>
                <td>{{ formatNumber(item.summary?.addedCount) }}</td>
                <td>{{ formatNumber(item.summary?.removedCount) }}</td>
                <td>{{ formatNumber(item.summary?.increasedCount) }}</td>
                <td>{{ formatNumber(item.summary?.decreasedCount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
