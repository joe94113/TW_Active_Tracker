<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { formatDate } from '../lib/formatters';

const props = defineProps({
  generatedAt: { type: String, default: null },
  marketDate: { type: String, default: null },
  size: { type: String, default: 'normal' },
  variant: { type: String, default: 'inline' }, // inline | panel
});

const nowTick = ref(Date.now());
let timerId = null;

const SCHEDULED_SLOTS = [
  { hour: 9, minute: 15 },
  { hour: 10, minute: 0 },
  { hour: 11, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 13, minute: 0 },
  { hour: 13, minute: 45 },
  { hour: 14, minute: 0 },
  { hour: 14, minute: 30 },
  { hour: 14, minute: 50 },
  { hour: 15, minute: 20 },
  { hour: 18, minute: 35 },
];

function parseDateString(value) {
  if (!value) return null;
  const text = String(value).trim().replaceAll('/', '-');

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00+08:00`);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function toTaipeiDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toTaipeiWeekday(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
  }).format(date);
}

function addDays(base, days) {
  return new Date(base.getTime() + days * 86400000);
}

function isTradingDay(date) {
  const weekday = toTaipeiWeekday(date);
  return weekday !== 'Sat' && weekday !== 'Sun';
}

function getNextTradingUpdate(now) {
  for (let offset = 0; offset < 10; offset += 1) {
    const candidateDate = addDays(now, offset);
    if (!isTradingDay(candidateDate)) continue;

    for (const slot of SCHEDULED_SLOTS) {
      const taipeiDate = toTaipeiDate(candidateDate);
      const candidate = new Date(
        `${taipeiDate}T${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}:00+08:00`,
      );

      if (candidate.getTime() > now.getTime()) {
        return candidate;
      }
    }
  }

  return null;
}

function buildAgeLabel(daysOld, generatedAt) {
  if (daysOld === null) {
    if (!generatedAt) return '等待新資料';

    const minutes = Math.max(0, Math.round((nowTick.value - generatedAt.getTime()) / 60000));
    if (minutes < 60) return `${minutes} 分鐘前整理`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} 小時前整理`;
    return `${Math.floor(minutes / 1440)} 天前整理`;
  }

  if (daysOld <= 0) return '今日資料';
  if (daysOld === 1) return '1 天前更新';
  return `${daysOld} 天前更新`;
}

const freshness = computed(() => {
  const now = new Date(nowTick.value);
  const generatedAt = parseDateString(props.generatedAt);
  const marketDate = parseDateString(props.marketDate);
  const marketDateKey = marketDate ? toTaipeiDate(marketDate) : null;
  const todayKey = toTaipeiDate(now);
  const marketDayDate = marketDateKey ? parseDateString(marketDateKey) : null;
  const todayDate = parseDateString(todayKey);
  const daysOld =
    marketDayDate && todayDate
      ? Math.max(0, Math.round((todayDate.getTime() - marketDayDate.getTime()) / 86400000))
      : null;
  const isWeekendCarry = !isTradingDay(now) && (daysOld ?? 0) <= 2;

  let tone = 'up';
  let label = '資料已更新';

  if (!generatedAt && !marketDate) {
    tone = 'info';
    label = '等待資料';
  } else if (isWeekendCarry) {
    tone = 'normal';
    label = '週末沿用';
  } else if (daysOld !== null && daysOld >= 2) {
    tone = 'down';
    label = '資料過舊';
  } else if (generatedAt && now.getTime() - generatedAt.getTime() >= 6 * 60 * 60 * 1000) {
    tone = 'warning';
    label = '等待補抓';
  }

  const nextSlot = getNextTradingUpdate(now);
  const detail = marketDateKey
    ? `資料日 ${formatDate(marketDateKey)} · ${buildAgeLabel(daysOld, generatedAt)}`
    : buildAgeLabel(daysOld, generatedAt);
  const nextUpdate = nextSlot
    ? `預計 ${toTaipeiDate(nextSlot) === todayKey ? `${formatDateTime(nextSlot).slice(-5)} 起更新` : '下個交易日 09:15 起更新'}`
    : '預計下個交易日更新';

  return {
    tone,
    label,
    detail,
    nextUpdate,
    generatedText: generatedAt ? `資料包 ${formatDateTime(generatedAt)}` : null,
  };
});

const rootClass = computed(() => [
  'data-freshness-badge',
  `is-${freshness.value.tone}`,
  props.variant === 'panel' ? 'is-panel' : 'is-inline',
  props.size === 'compact' ? 'is-compact' : '',
]);

onMounted(() => {
  timerId = window.setInterval(() => {
    nowTick.value = Date.now();
  }, 60000);
});

onBeforeUnmount(() => {
  if (timerId) window.clearInterval(timerId);
});
</script>

<template>
  <div :class="rootClass">
    <span class="badge-dot" aria-hidden="true" />

    <template v-if="variant === 'panel'">
      <div class="badge-panel-copy">
        <div class="badge-panel-head">
          <strong class="badge-label">{{ freshness.label }}</strong>
          <span v-if="generatedAt" class="badge-inline-meta">{{ freshness.generatedText }}</span>
        </div>
        <p class="badge-detail">{{ freshness.detail }}</p>
        <p class="badge-next">{{ freshness.nextUpdate }}</p>
      </div>
    </template>

    <template v-else>
      <div class="badge-inline-copy">
        <strong class="badge-label">{{ freshness.label }}</strong>
        <span class="badge-detail">{{ freshness.detail }}</span>
        <span class="badge-next">{{ freshness.nextUpdate }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.data-freshness-badge {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.72rem;
  border: 1px solid rgba(11, 105, 155, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  color: #163650;
}

.data-freshness-badge.is-inline {
  padding: 0.72rem 0.9rem;
}

.data-freshness-badge.is-panel {
  width: 100%;
  padding: 1rem 1.1rem;
  box-shadow: 0 14px 28px rgba(20, 41, 61, 0.06);
}

.data-freshness-badge.is-compact {
  padding: 0.6rem 0.75rem;
}

.badge-dot {
  width: 0.72rem;
  height: 0.72rem;
  margin-top: 0.28rem;
  border-radius: 999px;
  background: currentColor;
  flex: 0 0 auto;
}

.badge-inline-copy,
.badge-panel-copy {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
}

.badge-panel-head {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.badge-label {
  font-size: 0.95rem;
  font-weight: 800;
}

.badge-detail,
.badge-next,
.badge-inline-meta {
  margin: 0;
  color: #4a6279;
  font-size: 0.88rem;
  line-height: 1.55;
}

.badge-inline-copy .badge-detail,
.badge-inline-copy .badge-next {
  display: block;
}

.is-up {
  color: #13885e;
}

.is-warning {
  color: #8a5b00;
}

.is-down {
  color: #d14b32;
}

.is-normal,
.is-info {
  color: #0b699b;
}
</style>
