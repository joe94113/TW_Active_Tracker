<script setup>
defineProps({
  isLoading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  emptyMessage: {
    type: String,
    default: '',
  },
  hasData: {
    type: Boolean,
    default: true,
  },
});
</script>

<template>
  <div v-if="isLoading || errorMessage || !hasData" class="panel status-panel">
    <p v-if="isLoading" class="status-text">資料整理中，請稍候。</p>
    <p v-else-if="errorMessage" class="status-text is-error">{{ errorMessage }}</p>
    <p v-else class="status-text">{{ emptyMessage }}</p>
  </div>
</template>
