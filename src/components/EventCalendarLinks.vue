<script setup>
import { computed } from 'vue';
import { buildCalendarLinks } from '../lib/calendarLinks';

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  startDate: {
    type: String,
    required: true,
  },
  endDate: {
    type: String,
    default: '',
  },
  note: {
    type: String,
    default: '',
  },
  sourceName: {
    type: String,
    default: '',
  },
  url: {
    type: String,
    default: '',
  },
  location: {
    type: String,
    default: '',
  },
  compact: {
    type: Boolean,
    default: false,
  },
});

const links = computed(() =>
  buildCalendarLinks({
    title: props.title,
    startDate: props.startDate,
    endDate: props.endDate || props.startDate,
    note: props.note,
    sourceName: props.sourceName,
    url: props.url,
    location: props.location,
  }),
);
</script>

<template>
  <div v-if="links.googleUrl || links.icsUrl" class="event-calendar-actions" :class="{ 'is-compact': compact }">
    <a
      v-if="links.googleUrl"
      :href="links.googleUrl"
      target="_blank"
      rel="noreferrer"
      class="ghost-button"
    >
      加入 Google 行事曆
    </a>
    <a
      v-if="links.icsUrl"
      :href="links.icsUrl"
      :download="`${title}.ics`"
      class="ghost-button"
    >
      下載 ICS
    </a>
  </div>
</template>
