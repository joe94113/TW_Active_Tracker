<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useGlobalData } from '../composables/useGlobalData';
import StatusCard from '../components/StatusCard.vue';
import InfoCard from '../components/InfoCard.vue';
import { createStockRoute, isStockCode } from '../lib/stockRouting';
import { formatDate, formatLots, formatNumber, formatPercent } from '../lib/formatters';

const { overlap, isLoading, errorMessage, loadGlobalData } = useGlobalData();
const boardMode = ref('shared');

onMounted(() => {
  loadGlobalData();
});

const heavyHoldings = computed(() => (overlap.value?.['單股重壓'] ?? []).filter((item) => (item.maxWeight ?? 0) > 10));
const sharedHoldings = computed(() => overlap.value?.['共同持股'] ?? []);
const sharedAdds = computed(() => overlap.value?.['共同加碼'] ?? []);
const sharedCuts = computed(() => overlap.value?.['共同減碼'] ?? []);
const sharedNewPositions = computed(() => overlap.value?.['共同新增'] ?? []);
const sharedRemovals = computed(() => overlap.value?.['共同剔除'] ?? []);
const uniqueMoves = computed(() => overlap.value?.['不重複異動'] ?? {});
const etfMoveSummaries = computed(() => overlap.value?.['各ETF異動摘要'] ?? []);
const trackedEtfCount = computed(() => Number(overlap.value?.['已串接ETF數'] ?? 0));
const disclosureDate = computed(() => overlap.value?.['最新揭露日期'] ?? null);

const summaryCards = computed(() => [
  {
    title: '已串接 ETF',
    value: formatNumber(trackedEtfCount.value),
    description: disclosureDate.value ? `最新揭露 ${formatDate(disclosureDate.value)}` : '揭露日期整理中',
    status: 'info',
  },
  {
    title: '共同持股',
    value: formatNumber(sharedHoldings.value.length),
    description: '代表多檔主動式 ETF 同時持有，適合先看共識集中在哪些股票。',
    status: 'info',
  },
  {
    title: '共同加碼',
    value: formatNumber(sharedAdds.value.length),
    description: '看同一批 ETF 是否同步把部位往上加。',
    status: 'up',
  },
  {
    title: '單股重壓觀察',
    value: formatNumber(heavyHoldings.value.length),
    description: '只顯示單一持股權重大於 10% 的股票，方便先看可能接近限制的標的。',
    status: 'warning',
  },
]);

const boardConfigs = {
  shared: {
    label: '共同持股',
    title: '共識持股總表',
    subtitle: '這張表看的是目前哪些股票被多檔主動式 ETF 同時持有，重點是共識集中度，不是單日換股。',
    rows: sharedHoldings,
    helper: '共同持股表會顯示 ETF 數量與平均權重；如果你想看這次有沒有在加減碼，切到共同加碼或共同減碼會更有參考價值。',
    mode: 'shared',
  },
  increased: {
    label: '共同加碼',
    title: '共同加碼股票',
    subtitle: '看同一批主動式 ETF 是否把同一檔股票一起往上加，通常更能反映短線配置方向。',
    rows: sharedAdds,
    helper: '合計權重變化會把所有參與加碼的 ETF 變化加總，方便快速看哪幾檔被加碼得更明顯。',
    mode: 'moves',
  },
  decreased: {
    label: '共同減碼',
    title: '共同減碼股票',
    subtitle: '如果多檔主動式 ETF 同時降部位，通常代表這批股票短線上需要先保守一點。',
    rows: sharedCuts,
    helper: '這張表適合拿來看哪些股票短線可能面臨資金調節，而不是單純看股價漲跌。',
    mode: 'moves',
  },
  added: {
    label: '共同新增',
    title: '共同新進持股',
    subtitle: '有些股票會在同一輪換股中被多檔 ETF 一起納入，這類通常值得先放進觀察名單。',
    rows: sharedNewPositions,
    helper: '如果這裡沒有資料，不代表市場沒機會，只是這次沒有出現多檔 ETF 同步新建倉。',
    mode: 'moves',
  },
  removed: {
    label: '共同剔除',
    title: '共同剔除持股',
    subtitle: '這一區比較像避雷名單，適合先看哪些股票被多檔 ETF 同步退出。',
    rows: sharedRemovals,
    helper: '共同剔除通常比減碼更明確，代表 ETF 對這檔股票的配置已經降到零。',
    mode: 'moves',
  },
};

const activeBoardConfig = computed(() => boardConfigs[boardMode.value] ?? boardConfigs.shared);
const activeBoardRows = computed(() => activeBoardConfig.value.rows.value ?? []);

function createEtfRoute(code) {
  return `/etfs/${code}`;
}

function getRowEtfCount(row) {
  return Number(row?.['出現ETF數'] ?? row?.etfCount ?? row?.['ETF數'] ?? 0);
}

function getRowAverageWeight(row) {
  return Number(row?.['平均權重'] ?? row?.averageWeight ?? 0);
}

function getRowMoveItems(row) {
  if (Array.isArray(row?.['清單'])) return row['清單'];
  if (Array.isArray(row?.['持有ETF'])) return row['持有ETF'];
  return [];
}

function getRowWeightDelta(row) {
  return getRowMoveItems(row).reduce((sum, item) => sum + Number(item?.weightDelta ?? 0), 0);
}

function getRowSharesDelta(row) {
  return getRowMoveItems(row).reduce((sum, item) => {
    const value = Number(item?.sharesDelta);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function formatSignedPercent(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}%`;
}

function formatSignedLots(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  if (number === 0) return '0 張';
  const prefix = number > 0 ? '+' : '-';
  const lots = Math.abs(number) / 1000;
  if (lots >= 10000) return `${prefix}${(lots / 10000).toFixed(2)} 萬張`;
  return `${prefix}${new Intl.NumberFormat('zh-TW').format(lots)} 張`;
}

function buildRowEtfSummary(row, mode) {
  const items = getRowMoveItems(row);
  if (!items.length) return [];

  if (mode === 'shared') {
    return items.slice(0, 5).map((item) => ({
      etfCode: item.etfCode,
      etfName: item.etfName,
      line1: formatPercent(item.weight),
      line2: item.shares ? formatLots(item.shares) : null,
    }));
  }

  return items.slice(0, 5).map((item) => ({
    etfCode: item.etfCode,
    etfName: item.etfName,
    line1: formatSignedPercent(item.weightDelta),
    line2: Number.isFinite(Number(item.sharesDelta)) ? formatSignedLots(item.sharesDelta) : null,
  }));
}

function getLimitClass(item) {
  return item?.warningTone ? `is-${item.warningTone}` : 'is-warning';
}

function buildHeavyEtfSummary(item) {
  return (item?.limitEtfs?.length ? item.limitEtfs : item?.etfs ?? []).slice(0, 5);
}

function formatWeightCap(item) {
  if (!item) return '-';
  const cap = item.applicableSingleStockCap ?? item.generalCapLine ?? 10;
  const weight = item.taiexWeight ?? null;

  if (weight !== null && weight > (item.generalCapLine ?? 10)) {
    return `權值股放寬 ${formatPercent(cap)}`;
  }

  return `一般上限 ${formatPercent(cap)}`;
}

function getEtfMoveTone(summary) {
  const addCount = Number(summary?.summary?.addedCount ?? 0) + Number(summary?.summary?.increasedCount ?? 0);
  const cutCount = Number(summary?.summary?.removedCount ?? 0) + Number(summary?.summary?.decreasedCount ?? 0);

  if (addCount > cutCount) return 'up';
  if (cutCount > addCount) return 'down';
  return 'info';
}

function getEtfMoveLabel(summary) {
  const tone = getEtfMoveTone(summary);
  if (tone === 'up') return '偏向加碼';
  if (tone === 'down') return '偏向減碼';
  return '變化持平';
}
</script>

<template>
  <section class="page-shell etf-overlap-page">
    <section class="page-hero compact etf-overlap-hero">
      <div class="hero-copy">
        <p class="page-kicker">ETF 持股結構</p>
        <h1 class="page-title">主動式 ETF 共識持股與單股重壓觀察</h1>
        <p class="page-text">
          這頁把多檔主動式 ETF 的持股交集、同步加減碼與單股重壓集中在一起。先看哪些股票被共同持有，再看有沒有同步加碼，最後再回頭檢查是否出現單股配置過高的情況。
        </p>
      </div>
      <div class="etf-overlap-hero-board">
        <article class="etf-overlap-hero-card">
          <span class="etf-overlap-hero-label">最新揭露</span>
          <strong>{{ formatDate(disclosureDate) }}</strong>
          <p>目前整合的主動式 ETF 最新持股揭露日期。</p>
        </article>
        <article class="etf-overlap-hero-card">
          <span class="etf-overlap-hero-label">追蹤 ETF</span>
          <strong>{{ formatNumber(trackedEtfCount) }} 檔</strong>
          <p>已串接並可比較持股異動的主動式 ETF 數量。</p>
        </article>
        <article class="etf-overlap-hero-card">
          <span class="etf-overlap-hero-label">異動摘要</span>
          <strong>{{ formatNumber(etfMoveSummaries.length) }} 檔</strong>
          <p>可直接查看最近一次換股方向的 ETF 數量。</p>
        </article>
      </div>
    </section>

    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="Boolean(overlap)"
      empty-message="ETF 重疊資料尚未整理完成。"
    />

    <template v-if="overlap">
      <section class="card-grid compact-summary-grid etf-overlap-summary-grid">
        <InfoCard
          v-for="item in summaryCards"
          :key="item.title"
          :title="item.title"
          :value="item.value"
          :description="item.description"
          :status="item.status"
        />
      </section>

      <section class="panel etf-overlap-board-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">{{ activeBoardConfig.title }}</h2>
            <p class="panel-subtitle">{{ activeBoardConfig.subtitle }}</p>
          </div>
          <span class="meta-chip">{{ formatNumber(activeBoardRows.length) }} 檔</span>
        </div>

        <div class="etf-overlap-tabbar" role="tablist" aria-label="主動式 ETF 共識分頁">
          <button
            v-for="(config, key) in boardConfigs"
            :key="key"
            type="button"
            class="chip-button"
            :class="{ 'is-active': boardMode === key }"
            @click="boardMode = key"
          >
            <span>{{ config.label }}</span>
            <small>{{ formatNumber(config.rows.value?.length ?? 0) }}</small>
          </button>
        </div>

        <p class="panel-tip">{{ activeBoardConfig.helper }}</p>

        <div class="table-wrap">
          <table class="data-table etf-overlap-table">
            <thead>
              <tr v-if="activeBoardConfig.mode === 'shared'">
                <th>股票</th>
                <th>重疊 ETF 數</th>
                <th>平均權重</th>
                <th>前段 ETF</th>
              </tr>
              <tr v-else>
                <th>股票</th>
                <th>參與 ETF 數</th>
                <th>合計權重變化</th>
                <th>主要 ETF 動作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in activeBoardRows.slice(0, 40)" :key="`${boardMode}-${item.code}`">
                <td>
                  <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">
                    {{ item.code }}
                  </RouterLink>
                  <span v-else>{{ item.code }}</span>
                  <div class="muted">{{ item.name }}</div>
                </td>
                <td>{{ formatNumber(getRowEtfCount(item)) }}</td>
                <td v-if="activeBoardConfig.mode === 'shared'">{{ formatPercent(getRowAverageWeight(item)) }}</td>
                <td
                  v-else
                  :class="{ 'text-up': getRowWeightDelta(item) > 0, 'text-down': getRowWeightDelta(item) < 0 }"
                >
                  <strong>{{ formatSignedPercent(getRowWeightDelta(item)) }}</strong>
                  <div class="muted">張數 {{ formatSignedLots(getRowSharesDelta(item)) }}</div>
                </td>
                <td>
                  <div class="etf-overlap-inline-list">
                    <RouterLink
                      v-for="member in buildRowEtfSummary(item, activeBoardConfig.mode)"
                      :key="`${item.code}-${member.etfCode}`"
                      class="etf-overlap-inline-chip"
                      :to="createEtfRoute(member.etfCode)"
                    >
                      <strong>{{ member.etfCode }}</strong>
                      <span>{{ member.line1 }}</span>
                      <small v-if="member.line2">{{ member.line2 }}</small>
                    </RouterLink>
                  </div>
                </td>
              </tr>
              <tr v-if="!activeBoardRows.length">
                <td colspan="4" class="muted">目前這一類沒有可顯示的資料。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">單股重壓觀察</h2>
            <p class="panel-subtitle">只列出單一持股權重大於 10% 的股票，先看哪些標的可能已接近或超過一般配置上限。</p>
          </div>
          <span class="meta-chip is-warning">{{ formatNumber(heavyHoldings.length) }} 檔</span>
        </div>

        <div class="etf-overlap-heavy-grid">
          <article v-for="item in heavyHoldings" :key="`heavy-${item.code}`" class="etf-overlap-heavy-card">
            <div class="etf-overlap-heavy-head">
              <div>
                <strong>
                  <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">
                    {{ item.code }} {{ item.name }}
                  </RouterLink>
                  <span v-else>{{ item.code }} {{ item.name }}</span>
                </strong>
                <p class="muted">最高權重 {{ formatPercent(item.maxWeight) }} ・ {{ formatWeightCap(item) }}</p>
              </div>
              <span class="status-badge" :class="getLimitClass(item)">{{ item.warningLabel }}</span>
            </div>

            <p class="etf-overlap-heavy-note">{{ item.note }}</p>

            <div class="radar-stock-metrics etf-overlap-heavy-metrics">
              <div>
                <span>涉及 ETF</span>
                <strong>{{ formatNumber(item.etfCount) }}</strong>
              </div>
              <div>
                <span>平均權重</span>
                <strong>{{ formatPercent(item.averageWeight) }}</strong>
              </div>
              <div>
                <span>超過 10%</span>
                <strong>{{ formatNumber(item.aboveGeneralCapCount) }}</strong>
              </div>
              <div>
                <span>加權權重</span>
                <strong>{{ item.taiexWeight !== null ? formatPercent(item.taiexWeight) : '-' }}</strong>
              </div>
            </div>

            <div class="etf-overlap-inline-list is-heavy">
              <RouterLink
                v-for="member in buildHeavyEtfSummary(item)"
                :key="`${item.code}-${member.etfCode}`"
                class="etf-overlap-inline-chip"
                :to="createEtfRoute(member.etfCode)"
              >
                <strong>{{ member.etfCode }}</strong>
                <span>{{ formatPercent(member.weight) }}</span>
                <small v-if="member.shares">{{ formatLots(member.shares) }}</small>
              </RouterLink>
            </div>
          </article>
        </div>
      </section>

      <section class="dual-grid etf-overlap-detail-grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">不重複異動</h2>
              <p class="panel-subtitle">有些股票不是共同加減碼，而是只有某一檔 ETF 特別調整，這區適合看比較有個別判斷的動作。</p>
            </div>
          </div>

          <div class="triple-grid etf-overlap-unique-grid">
            <article class="focus-card">
              <div class="focus-card-head">
                <div>
                  <h3>單一 ETF 新增</h3>
                  <p class="panel-subtitle">只有單一 ETF 新進的股票。</p>
                </div>
              </div>
              <div class="focus-card-list">
                <div v-for="item in (uniqueMoves['新增'] ?? []).slice(0, 10)" :key="`${item.code}-add`" class="focus-card-item">
                  <div>
                    <strong>
                      <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">{{ item.code }} {{ item.name }}</RouterLink>
                      <span v-else>{{ item.code }} {{ item.name }}</span>
                    </strong>
                    <div class="muted">
                      <RouterLink class="code-link" :to="createEtfRoute(item.etfCode)">{{ item.etfCode }}</RouterLink>
                    </div>
                  </div>
                  <span class="text-up">{{ formatSignedPercent(item.weightDelta) }}</span>
                </div>
                <p v-if="!(uniqueMoves['新增'] ?? []).length" class="muted">這次沒有單一 ETF 特別新增的股票。</p>
              </div>
            </article>

            <article class="focus-card">
              <div class="focus-card-head">
                <div>
                  <h3>單一 ETF 加碼</h3>
                  <p class="panel-subtitle">只有單一 ETF 明顯加碼的股票。</p>
                </div>
              </div>
              <div class="focus-card-list">
                <div v-for="item in (uniqueMoves['加碼'] ?? []).slice(0, 10)" :key="`${item.code}-inc`" class="focus-card-item">
                  <div>
                    <strong>
                      <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">{{ item.code }} {{ item.name }}</RouterLink>
                      <span v-else>{{ item.code }} {{ item.name }}</span>
                    </strong>
                    <div class="muted">
                      <RouterLink class="code-link" :to="createEtfRoute(item.etfCode)">{{ item.etfCode }}</RouterLink>
                    </div>
                  </div>
                  <span class="text-up">{{ formatSignedPercent(item.weightDelta) }}</span>
                </div>
                <p v-if="!(uniqueMoves['加碼'] ?? []).length" class="muted">這次沒有單一 ETF 特別加碼的股票。</p>
              </div>
            </article>

            <article class="focus-card">
              <div class="focus-card-head">
                <div>
                  <h3>單一 ETF 減碼</h3>
                  <p class="panel-subtitle">只有單一 ETF 明顯調節的股票。</p>
                </div>
              </div>
              <div class="focus-card-list">
                <div v-for="item in (uniqueMoves['減碼'] ?? []).slice(0, 10)" :key="`${item.code}-dec`" class="focus-card-item">
                  <div>
                    <strong>
                      <RouterLink v-if="isStockCode(item.code)" class="code-link" :to="createStockRoute(item.code)">{{ item.code }} {{ item.name }}</RouterLink>
                      <span v-else>{{ item.code }} {{ item.name }}</span>
                    </strong>
                    <div class="muted">
                      <RouterLink class="code-link" :to="createEtfRoute(item.etfCode)">{{ item.etfCode }}</RouterLink>
                    </div>
                  </div>
                  <span class="text-down">{{ formatSignedPercent(item.weightDelta) }}</span>
                </div>
                <p v-if="!(uniqueMoves['減碼'] ?? []).length" class="muted">這次沒有單一 ETF 特別減碼的股票。</p>
              </div>
            </article>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">各 ETF 最近換股</h2>
              <p class="panel-subtitle">快速看每檔主動式 ETF 最近一次揭露是偏加碼還是偏減碼。</p>
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
                  <th>判讀</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in etfMoveSummaries" :key="`etf-move-${item.code}`">
                  <td>
                    <RouterLink class="code-link" :to="createEtfRoute(item.code)">{{ item.code }} {{ item.name }}</RouterLink>
                  </td>
                  <td>{{ formatDate(item.disclosureDate) }}</td>
                  <td>{{ formatNumber(item.summary?.addedCount ?? 0) }} / {{ formatNumber(item.summary?.removedCount ?? 0) }}</td>
                  <td>{{ formatNumber(item.summary?.increasedCount ?? 0) }} / {{ formatNumber(item.summary?.decreasedCount ?? 0) }}</td>
                  <td>
                    <span class="status-badge" :class="`is-${getEtfMoveTone(item)}`">{{ getEtfMoveLabel(item) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </template>
  </section>
</template>
