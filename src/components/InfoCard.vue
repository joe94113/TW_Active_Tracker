<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: 'normal',
  },
});
</script>

<template>
  <article class="info-card" :class="`is-${status}`">
    <p class="info-card-title">{{ title }}</p>
    <p class="info-card-value">{{ value }}</p>
    <p v-if="description" class="info-card-note">{{ description }}</p>
  </article>
</template>
