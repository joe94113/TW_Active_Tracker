<script setup>
import { computed, inject } from 'vue';
import { RouterLink } from 'vue-router';
import { MoonIcon, SunIcon } from '@heroicons/vue/24/outline';
import GlobalStockSearch from './GlobalStockSearch.vue';
import { getDataFreshnessStatus } from '../lib/dataFreshness';
import { formatDate } from '../lib/formatters';

const themeControl = inject('themeControl', null);

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  icon: {
    type: [Object, Function],
    default: null,
  },
  tabs: {
    type: Array,
    default: () => [],
  },
  activeKey: {
    type: String,
    default: '',
  },
  marketDate: {
    type: String,
    default: '',
  },
  generatedAt: {
    type: String,
    default: '',
  },
  summary: {
    type: String,
    default: '',
  },
  summaryTone: {
    type: String,
    default: 'info',
  },
});

const freshness = computed(() =>
  getDataFreshnessStatus({
    marketDate: props.marketDate,
    generatedAt: props.generatedAt,
  }),
);

const displayDate = computed(() => {
  const value = props.marketDate || String(props.generatedAt || '').slice(0, 10);
  return value ? formatDate(value) : '';
});

const freshnessLabel = computed(() => {
  if (freshness.value.isStale) return '歷史回看';
  if (freshness.value.isWarning) return '等待更新';
  return '今日資料';
});

const isDark = computed(() => themeControl?.resolvedTheme?.value === 'dark');
const canToggleTheme = computed(() => typeof themeControl?.toggleTheme === 'function');
const themeToggleHint = computed(() => themeControl?.themeToggleHint?.value ?? '切換顯示模式');
</script>

<template>
  <header class="investor-center-header">
    <div class="investor-center-headline-row">
      <div class="investor-center-title-row">
        <span v-if="icon" class="investor-center-icon" aria-hidden="true">
          <component :is="icon" />
        </span>
        <div>
          <h1>{{ title }}</h1>
        </div>
      </div>

      <button
        v-if="canToggleTheme"
        type="button"
        class="investor-center-theme-toggle"
        :aria-label="themeToggleHint"
        :title="themeToggleHint"
        :aria-pressed="String(isDark)"
        @click="themeControl.toggleTheme"
      >
        <SunIcon v-if="isDark" aria-hidden="true" />
        <MoonIcon v-else aria-hidden="true" />
      </button>
    </div>

    <GlobalStockSearch class="investor-center-search" />

    <p v-if="displayDate" class="investor-center-date">
      資料日 {{ displayDate }}<span aria-hidden="true">·</span>{{ freshnessLabel }}
    </p>

    <nav class="investor-center-tabs" :aria-label="`${title}分頁`">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.key"
        :to="tab.to"
        class="investor-center-tab"
        :class="{ 'is-active': activeKey === tab.key }"
        :aria-current="activeKey === tab.key ? 'page' : undefined"
      >
        {{ tab.label }}
        <span v-if="Number.isFinite(tab.count)" class="investor-center-tab-count">{{ tab.count }}</span>
      </RouterLink>
    </nav>

    <p v-if="summary" class="investor-center-summary" :class="`is-${summaryTone}`">
      {{ summary }}
    </p>
  </header>
</template>
