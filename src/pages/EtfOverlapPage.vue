<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import StatusCard from '../components/StatusCard.vue';
import InfoCard from '../components/InfoCard.vue';
import { createStockRoute, isStockCode } from '../lib/stockRouting';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';

const { overlap, isLoading, errorMessage, loadGlobalData } = useGlobalData();

onMounted(() => {
  loadGlobalData();
});

const summaryCards = computed(() => [
  {
    title: '已串接 ETF',
    value: String(overlap.value?.['已串接ETF數'] ?? 0),
    description: `最新揭露 ${formatDate(overlap.value?.['最新揭露日期'])}`,
  },
  {
    title: '共同持股',
    value: String(overlap.value?.['共同持股']?.length ?? 0),
    description: '至少兩檔主動式 ETF 同時持有的股票。',
  },
  {
    title: '共同加碼',
    value: String(overlap.value?.['共同加碼']?.length ?? 0),
    description: '兩檔以上 ETF 同步提高權重的標的。',
  },
  {
    title: '上限觀察',
    value: String((overlap.value?.['單股重壓'] ?? []).filter((item) => (item.maxWeight ?? 0) > 10).length),
    description: '單一持股權重大於 10% 的重壓名單。',
  },
]);

const policyCards = computed(() => [
  {
    title: '一般單股限制',
    value: `${formatNumber(overlap.value?.['單股一般上限線'] ?? 10, 0)}%`,
    description: overlap.value?.['單股上限判讀說明']?.['一般上限'] ?? '主動式 ETF 投資單一股票的預設上限。',
  },
  {
    title: '權值股放寬條件',
    value: '看加權權重',
    description:
      overlap.value?.['單股上限判讀說明']?.['放寬條件'] ??
      '若個股本身在加權指數的權重高於 10%，才可能適用放寬。',
  },
  {
    title: '股票加債券總曝險',
    value: `${formatNumber(overlap.value?.['股票加債券總曝險上限'] ?? 25, 0)}%`,
    description:
      overlap.value?.['單股上限判讀說明']?.['總曝險提醒'] ??
      '單一股票加上公司債或金融債的總金額仍有 25% 上限。',
  },
]);

const heavyHoldings = computed(() =>
  (overlap.value?.['單股重壓'] ?? []).filter((item) => (item.maxWeight ?? 0) > 10),
);
const commonHoldings = computed(() => overlap.value?.['共同持股'] ?? []);
const commonAdds = computed(() => overlap.value?.['共同加碼'] ?? []);
const uniqueMoves = computed(() => overlap.value?.['不重複異動'] ?? {});
const etfMoveSummaries = computed(() => overlap.value?.['各ETF異動摘要'] ?? []);

function getLimitClass(item) {
  return item?.warningTone ? `is-${item.warningTone}` : 'is-info';
}

function buildHeavyEtfSummary(item) {
  return (item?.limitEtfs?.length ? item.limitEtfs : item?.etfs ?? [])
    .slice(0, 3)
    .map((member) => `${member.etfCode} ${formatPercent(member.weight)}${member.shares ? ` / ${formatLots(member.shares)}` : ''}`)
    .join(' · ');
}

function formatWeightCap(item) {
  if (!item) return '-';
  const cap = item.applicableSingleStockCap ?? item.generalCapLine ?? 10;
  const weight = item.taiexWeight ?? null;

  if (weight !== null && weight > (item.generalCapLine ?? 10)) {
    return `推估上限 ${cap.toFixed(2)}%`;
  }

  return `一般上限 ${formatNumber(cap, 0)}%`;
}
</script>

<template>
  <section class="page-shell">
    <div class="page-hero compact etf-overlap-hero">
      <div>
        <p class="page-kicker">ETF 重疊分析</p>
        <h1 class="page-title">主動式 ETF 共識持股與單股上限觀察</h1>
        <p class="page-text">
          先看哪些股票被多檔主動式 ETF 一起持有、一起加碼，再看哪些持股已經貼近 10% 一般上限，或屬於可用加權指數權重放寬的權值股。
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

      <section class="triple-grid">
        <article
          v-for="item in policyCards"
          :key="item.title"
          class="panel etf-policy-card"
        >
          <span class="panel-eyebrow">{{ item.title }}</span>
          <strong class="etf-policy-value">{{ item.value }}</strong>
          <p class="panel-subtitle">{{ item.description }}</p>
        </article>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">單股上限觀察</h2>
            <p class="panel-subtitle">
              這裡只列單一持股權重大於 10% 的股票，先看哪些已經進入重壓區，哪些屬於權值股放寬內，哪些其實已經超過可投上限。
            </p>
          </div>
          <span class="meta-chip is-warning">
            一般上限 {{ formatNumber(overlap['單股一般上限線'] ?? 10, 0) }}%
          </span>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>代號</th>
                <th>名稱</th>
                <th>重壓 ETF 數</th>
                <th>最高權重</th>
                <th>法規解讀</th>
                <th>上限參考</th>
                <th>重點 ETF</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in heavyHoldings" :key="`heavy-${item.code}`">
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
                <td>{{ formatNumber(item.etfCount) }}</td>
                <td>{{ formatPercent(item.maxWeight) }}</td>
                <td>
                  <div class="stack-list compact etf-overlap-flag-list">
                    <span class="status-badge" :class="getLimitClass(item)">{{ item.warningLabel }}</span>
                    <span class="muted">{{ item.note }}</span>
                  </div>
                </td>
                <td class="etf-overlap-summary-cell">
                  <strong>{{ formatWeightCap(item) }}</strong>
                  <span v-if="item.taiexWeight !== null" class="muted">加權比重約 {{ formatPercent(item.taiexWeight) }}</span>
                </td>
                <td class="etf-overlap-summary-cell">
                  {{ buildHeavyEtfSummary(item) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="dual-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">共同持股</h2>
              <p class="panel-subtitle">至少兩檔主動式 ETF 同步持有的股票，先看市場共識最高的名單。</p>
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
                <tr v-for="item in commonHoldings" :key="`common-${item.code}`">
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
              <p class="panel-subtitle">兩檔以上 ETF 同步提高權重，通常代表近期主動資金看法更一致。</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>出現 ETF 數</th>
                  <th>ETF 名單</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in commonAdds" :key="`increase-${item.code}`">
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
                  <td>{{ item.ETF代號.join(' · ') }}</td>
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
              <h2 class="panel-title">特色新增</h2>
              <p class="panel-subtitle">只有單一 ETF 新納入的股票，通常比較能看出經理人的特色選股。</p>
            </div>
          </div>
          <ul class="stack-list">
            <li v-for="item in uniqueMoves['新增'] ?? []" :key="`${item.code}-add`">
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
              <h2 class="panel-title">特色加碼</h2>
              <p class="panel-subtitle">由單一 ETF 顯著提高權重，適合拿來追蹤主動經理人的新判斷。</p>
            </div>
          </div>
          <ul class="stack-list">
            <li v-for="item in uniqueMoves['加碼'] ?? []" :key="`${item.code}-inc`">
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
              <h2 class="panel-title">特色減碼</h2>
              <p class="panel-subtitle">由單一 ETF 先行調節的股票，常常可以提早看到風險或獲利了結訊號。</p>
            </div>
          </div>
          <ul class="stack-list">
            <li v-for="item in uniqueMoves['減碼'] ?? []" :key="`${item.code}-dec`">
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
            <h2 class="panel-title">各 ETF 最近換股</h2>
            <p class="panel-subtitle">先看每檔主動式 ETF 最近一次換股日期與加碼 / 減碼數量，快速掌握誰最近動作比較大。</p>
          </div>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>ETF</th>
                <th>揭露日</th>
                <th>新增 / 剔除</th>
                <th>加碼 / 減碼</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in etfMoveSummaries" :key="`etf-move-${item.code}`">
                <td>{{ item.code }} {{ item.name }}</td>
                <td>{{ formatDate(item.disclosureDate) }}</td>
                <td>{{ formatNumber(item.summary?.addedCount ?? 0) }} / {{ formatNumber(item.summary?.removedCount ?? 0) }}</td>
                <td>{{ formatNumber(item.summary?.increasedCount ?? 0) }} / {{ formatNumber(item.summary?.decreasedCount ?? 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
