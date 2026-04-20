<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { fetchJson } from '../lib/api';
import { createStockRoute } from '../lib/stockRouting';
import {
  formatDate,
  formatLots,
  formatNumber,
  formatPercent,
} from '../lib/formatters';

const { manifest, isLoading: isGlobalLoading, errorMessage: globalErrorMessage, loadGlobalData } = useGlobalData();

const entryRadar = ref(null);
const isEntryLoading = ref(false);
const entryError = ref('');

const sectionConfigs = [
  {
    key: 'freshStarters',
    title: '剛轉強',
    description: '量能還沒完全放大、股價先墊高，適合盯下一段放量確認。',
    emptyMessage: '今天沒有特別明顯的量縮轉強名單。',
  },
  {
    key: 'nearBreakouts',
    title: '整理待突破',
    description: '箱型壓縮、均線收斂、距離前高不遠，適合隔日盯量價。',
    emptyMessage: '今天沒有特別明顯的整理待突破名單。',
  },
  {
    key: 'institutionalTurns',
    title: '法人剛轉買',
    description: '外資或投信剛從賣轉買，較適合放進第一批觀察清單。',
    emptyMessage: '今天沒有明顯的法人剛轉買名單。',
  },
  {
    key: 'themeIgnition',
    title: '題材剛升溫',
    description: '近 5 / 10 日資金明顯轉往該主題，適合先看龍頭與補漲節奏。',
    emptyMessage: '今天沒有明顯升溫的新主線題材。',
  },
  {
    key: 'catchUpCandidates',
    title: '補漲候選',
    description: '族群龍頭已先動，但這些個股漲幅還沒完全跟上。',
    emptyMessage: '今天沒有特別明顯的補漲候選。',
  },
];

const entrySections = computed(() =>
  sectionConfigs.map((section) => ({
    ...section,
    items: entryRadar.value?.sections?.[section.key] ?? [],
  })),
);

const heroCards = computed(() => {
  const spotlight = entryRadar.value?.spotlight ?? {};

  return [
    {
      key: 'fresh',
      label: '剛轉強',
      value: formatNumber(spotlight.freshStarterCount, 0),
      note: '先看量縮轉強與股價墊高。',
    },
    {
      key: 'breakout',
      label: '待突破',
      value: formatNumber(spotlight.nearBreakoutCount, 0),
      note: '離前高不遠，適合盯放量長紅。',
    },
    {
      key: 'institutional',
      label: '法人剛轉買',
      value: formatNumber(spotlight.institutionalTurnCount, 0),
      note: '外資或投信剛進場初段。',
    },
    {
      key: 'theme',
      label: '主線題材',
      value: spotlight.topThemeTitle ?? '等待新主線',
      note: '近 5 / 10 日明顯升溫的題材。',
    },
  ];
});

const themeHistoryCards = computed(() => {
  const themeHistory = entryRadar.value?.themeHistory ?? {};

  return [
    {
      key: 'warming5',
      title: '5 日升溫',
      items: themeHistory.warming5 ?? [],
      empty: '近 5 日沒有明顯升溫題材。',
    },
    {
      key: 'warming10',
      title: '10 日升溫',
      items: themeHistory.warming10 ?? [],
      empty: '近 10 日沒有明顯升溫題材。',
    },
  ];
});

const pageSeo = computed(() => ({
  title: '起漲卡位雷達',
  description: '用量縮轉強、整理待突破、法人剛轉買、題材剛升溫與補漲候選，快速找出台股剛起漲的標的。',
  routePath: '/entry-radar',
  keywords: ['起漲卡位雷達', '量縮轉強', '整理待突破', '法人剛轉買', '補漲候選', '題材剛升溫'],
}));

useSeoMeta(pageSeo);

const effectiveErrorMessage = computed(() => entryError.value || globalErrorMessage.value);
const hasData = computed(() => Boolean(entryRadar.value));

onMounted(async () => {
  await loadGlobalData();
  await loadEntryRadar();
});

watch(
  () => manifest.value?.entryRadarPath,
  async () => {
    await loadEntryRadar();
  },
);

async function loadEntryRadar() {
  const entryRadarPath = manifest.value?.entryRadarPath;

  if (!entryRadarPath) {
    return;
  }

  isEntryLoading.value = true;
  entryError.value = '';

  try {
    entryRadar.value = await fetchJson(entryRadarPath);
  } catch (error) {
    entryRadar.value = null;
    entryError.value = error instanceof Error ? error.message : '起漲卡位雷達載入失敗';
  } finally {
    isEntryLoading.value = false;
  }
}

function getSectionAnchor(key) {
  return `entry-${key}`;
}

function formatTargetPrice(item) {
  if (item?.foreignTargetPrice === null || item?.foreignTargetPrice === undefined || item.foreignTargetPrice <= 0) {
    return '暫無';
  }

  const premiumText =
    item?.premiumToTarget === null || item?.premiumToTarget === undefined ? '' : ` / ${formatPercent(item.premiumToTarget)}`;

  return `${formatNumber(item.foreignTargetPrice)}${premiumText}`;
}

function getItemTone(item) {
  if (item?.topSignalTone === 'up') return 'up';
  if ((item?.changePercent ?? 0) < 0) return 'down';
  return 'info';
}

function getSummaryLine(item) {
  const parts = [
    item?.themeTitle ? `題材 ${item.themeTitle}` : null,
    item?.industryName ? `產業 ${item.industryName}` : null,
    item?.topSignalTitle ? item.topSignalTitle : null,
  ].filter(Boolean);

  return parts.join('｜');
}
</script>

<template>
  <section class="page-shell">
    <StatusCard
      :is-loading="isGlobalLoading || isEntryLoading"
      :error-message="effectiveErrorMessage"
      :has-data="hasData"
      empty-message="起漲卡位雷達資料尚未整理完成。"
    />

    <template v-if="entryRadar">
      <section class="page-hero compact entry-radar-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Early Entry Radar</span>
          <h1>起漲卡位雷達</h1>
          <p>先抓剛起漲、還沒走太遠的候選，再配題材輪動與法人轉向，縮小明日優先觀察名單。</p>
          <div class="theme-radar-summary">
            <span class="theme-observation-chip">資料日 {{ formatDate(entryRadar.marketDate) }}</span>
            <span
              v-for="(item, index) in entryRadar.observations ?? []"
              :key="`entry-observation-${index}`"
              class="theme-observation-chip"
            >
              {{ item }}
            </span>
          </div>
        </div>

        <aside class="entry-radar-board">
          <div class="entry-radar-spotlight-grid">
            <article v-for="card in heroCards" :key="card.key" class="entry-radar-spotlight-card">
              <span class="theme-spotlight-label">{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.note }}</p>
            </article>
          </div>
        </aside>
      </section>

      <nav class="mobile-section-nav radar-section-nav" aria-label="起漲卡位雷達快速導覽">
        <a
          v-for="section in entrySections"
          :key="section.key"
          class="section-chip"
          :href="`#${getSectionAnchor(section.key)}`"
        >
          {{ section.title }}
        </a>
      </nav>

      <section class="entry-radar-layout">
        <div class="entry-radar-main">
          <section
            v-for="section in entrySections"
            :id="getSectionAnchor(section.key)"
            :key="section.key"
            class="panel entry-radar-section"
          >
            <div class="panel-header">
              <div>
                <h2 class="panel-title">{{ section.title }}</h2>
                <p class="panel-subtitle">{{ section.description }}</p>
              </div>
            </div>

            <div v-if="section.items.length" class="entry-card-grid">
              <RouterLink
                v-for="item in section.items"
                :key="`${section.key}-${item.code}`"
                class="entry-stock-card"
                :class="`is-${getItemTone(item)}`"
                :to="createStockRoute(item.code)"
              >
                <div class="entry-stock-head">
                  <div>
                    <div class="entry-stock-title-row">
                      <strong>{{ item.code }} {{ item.name }}</strong>
                      <span class="meta-chip">{{ item.label }}</span>
                    </div>
                    <p class="muted">{{ getSummaryLine(item) || '台股個股' }}</p>
                  </div>
                  <div class="entry-stock-price">
                    <strong>{{ formatNumber(item.close) }}</strong>
                    <span :class="{ 'text-up': (item.changePercent ?? 0) > 0, 'text-down': (item.changePercent ?? 0) < 0 }">
                      {{ formatPercent(item.changePercent) }}
                    </span>
                  </div>
                </div>

                <p class="entry-stock-note">{{ item.note }}</p>

                <div class="entry-stock-metric-grid">
                  <div class="entry-stock-metric">
                    <span>20 日</span>
                    <strong :class="{ 'text-up': (item.return20 ?? 0) > 0, 'text-down': (item.return20 ?? 0) < 0 }">
                      {{ formatPercent(item.return20) }}
                    </strong>
                  </div>
                  <div class="entry-stock-metric">
                    <span>外資 5 日</span>
                    <strong :class="{ 'text-up': (item.foreign5Day ?? 0) > 0, 'text-down': (item.foreign5Day ?? 0) < 0 }">
                      {{ formatLots(item.foreign5Day) }}
                    </strong>
                  </div>
                  <div class="entry-stock-metric">
                    <span>投信 5 日</span>
                    <strong :class="{ 'text-up': (item.investmentTrust5Day ?? 0) > 0, 'text-down': (item.investmentTrust5Day ?? 0) < 0 }">
                      {{ formatLots(item.investmentTrust5Day) }}
                    </strong>
                  </div>
                  <div class="entry-stock-metric">
                    <span>外資目標價</span>
                    <strong>{{ formatTargetPrice(item) }}</strong>
                  </div>
                </div>

                <div v-if="item.metrics?.length" class="entry-stock-metrics-row">
                  <span v-for="metric in item.metrics" :key="`${section.key}-${item.code}-${metric.label}`" class="keyword-pill">
                    {{ metric.label }} {{ metric.value }}
                  </span>
                </div>

                <div v-if="item.tags?.length" class="tag-row">
                  <span v-for="tag in item.tags" :key="`${section.key}-${item.code}-${tag}`" class="keyword-pill">
                    {{ tag }}
                  </span>
                </div>
              </RouterLink>
            </div>

            <div v-else class="empty-state compact">
              <strong>{{ section.title }}今天沒有明顯候選</strong>
              <p>{{ section.emptyMessage }}</p>
            </div>
          </section>
        </div>

        <aside class="entry-radar-sidebar">
          <article class="panel entry-sidebar-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">題材輪動快看</h2>
                <p class="panel-subtitle">先看近 5 / 10 日哪個題材在升溫</p>
              </div>
              <span class="meta-chip">{{ formatNumber(entryRadar.themeHistory?.snapshotCount, 0) }} 筆快照</span>
            </div>

            <div class="entry-theme-summary">
              <article v-for="card in themeHistoryCards" :key="card.key" class="sub-panel entry-theme-history-card">
                <span class="theme-spotlight-label">{{ card.title }}</span>
                <div v-if="card.items.length" class="entry-theme-history-list">
                  <div v-for="item in card.items" :key="`${card.key}-${item.slug}`" class="entry-theme-history-item">
                    <strong>{{ item.title }}</strong>
                    <span class="text-up">{{ formatNumber(item.delta, 0) }}</span>
                    <p class="muted">{{ item.leaderCode ? `龍頭 ${item.leaderCode} ${item.leaderName}` : '先看題材頁完整拆解' }}</p>
                  </div>
                </div>
                <p v-else class="muted">{{ card.empty }}</p>
              </article>
            </div>
          </article>

          <article class="panel entry-sidebar-card">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">卡位研究順序</h2>
                <p class="panel-subtitle">先看起漲，再回頭確認風險與題材</p>
              </div>
            </div>

            <ol class="theme-playbook-list">
              <li>先看量縮轉強與整理待突破，確認是不是剛起漲、還沒走太遠。</li>
              <li>再看法人剛轉買，避免追到只有技術面、沒有資金跟進的股票。</li>
              <li>如果題材剛升溫，先看龍頭，再看補漲，不要一開始就去接最弱的尾端股。</li>
              <li>最後進個股頁確認外資目標價、事件後表現統計與風險提醒。</li>
            </ol>

            <div class="theme-page-links">
              <RouterLink class="ghost-button" to="/themes">看完整題材頁</RouterLink>
              <RouterLink class="ghost-button" to="/radar">看選股雷達</RouterLink>
              <RouterLink class="ghost-button" to="/classroom">看股票小教室</RouterLink>
            </div>
          </article>
        </aside>
      </section>
    </template>
  </section>
</template>
