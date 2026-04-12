<script setup>
import { computed } from 'vue';
import { useStockNews } from '../composables/useStockNews';
import { formatDate } from '../lib/formatters';

const props = defineProps({
  codeRef: {
    type: Object,
    required: true,
  },
  stockName: {
    type: String,
    default: '',
  },
});

const { news, isLoading, errorMessage, hasLoaded, load } = useStockNews(props.codeRef);

const newsSearchUrl = computed(() => {
  const code = String(props.codeRef?.value ?? '').trim();
  const query = `${props.stockName || code} ${code}`.trim();
  return `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
});

const newsItems = computed(() => news.value?.items ?? []);
const keywords = computed(() => news.value?.keywords ?? []);
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">近期新聞與關鍵字</h2>
        <p class="panel-subtitle">需要時再載入，整理最近和這檔股票最相關的新聞標題與關鍵字。</p>
      </div>
      <div class="action-row">
        <button type="button" class="ghost-button" @click="load">
          {{ hasLoaded ? '重新整理新聞' : '整理近期新聞' }}
        </button>
        <a class="action-link muted-link" :href="newsSearchUrl" target="_blank" rel="noreferrer">更多新聞</a>
      </div>
    </div>

    <p v-if="isLoading" class="muted">正在整理近期新聞…</p>

    <template v-else-if="news">
      <div v-if="keywords.length" class="tag-row">
        <span v-for="item in keywords" :key="item.keyword" class="keyword-pill">
          {{ item.keyword }}
          <small>{{ item.count }}</small>
        </span>
      </div>

      <div v-if="newsItems.length" class="news-list">
        <article v-for="item in newsItems" :key="`${item.link}-${item.publishedAt}`" class="news-card">
          <div class="news-card-head">
            <strong>{{ item.title }}</strong>
            <span class="meta-chip">{{ item.source ?? '新聞來源' }}</span>
          </div>
          <p v-if="item.summary" class="muted">{{ item.summary }}</p>
          <div class="news-card-foot">
            <span class="muted">{{ formatDate(item.publishedAt?.slice(0, 10)) }}</span>
            <a class="action-link" :href="item.link" target="_blank" rel="noreferrer">閱讀原文</a>
          </div>
        </article>
      </div>

      <div v-else class="empty-state compact">
        <strong>目前沒有可顯示的站內新聞整理</strong>
        <p>可以先點上方的更多新聞，查看外部即時結果。</p>
      </div>
    </template>

    <div v-else-if="errorMessage" class="empty-state compact">
      <strong>新聞整理暫時不可用</strong>
      <p>{{ errorMessage }}</p>
    </div>
  </section>
</template>
