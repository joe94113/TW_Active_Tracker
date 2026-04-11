<script setup>
import { computed } from 'vue';
import InfoCard from './InfoCard.vue';
import {
  formatAmount,
  formatDate,
  formatNumber,
  formatPercent,
  formatYearMonth,
} from '../lib/formatters';

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
});

const companyProfile = computed(() => props.data?.公司概況 ?? null);
const valuation = computed(() => props.data?.評價面 ?? null);
const financials = computed(() => props.data?.財務資料 ?? null);
const monthlyRevenue = computed(() => financials.value?.月營收 ?? null);
const incomeStatement = computed(() => financials.value?.綜合損益表 ?? null);
const balanceSheet = computed(() => financials.value?.資產負債表 ?? null);

const hasData = computed(() =>
  Boolean(companyProfile.value || valuation.value || monthlyRevenue.value || incomeStatement.value || balanceSheet.value),
);

const summaryCards = computed(() => [
  {
    title: '本益比',
    value: formatNumber(valuation.value?.本益比),
    description: '官方估值資料',
  },
  {
    title: '殖利率',
    value: formatPercent(valuation.value?.殖利率),
    description: '現金殖利率',
  },
  {
    title: '股價淨值比',
    value: formatNumber(valuation.value?.股價淨值比),
    description: '官方估值資料',
  },
  {
    title: '每股淨值',
    value: formatNumber(balanceSheet.value?.每股參考淨值),
    description: `負債比 ${formatPercent(balanceSheet.value?.負債比)}`,
  },
]);

const reportPeriod = computed(() => {
  if (!incomeStatement.value?.年度 || !incomeStatement.value?.季別) return '尚無資料';
  return `${incomeStatement.value.年度} 年 Q${incomeStatement.value.季別}`;
});
</script>

<template>
  <template v-if="hasData">
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
            <h2 class="panel-title">公司概況</h2>
            <p class="panel-subtitle">公司基本資料摘要</p>
          </div>
        </div>
        <ul class="bullet-list compact">
          <li>公司簡稱：{{ companyProfile?.公司簡稱 ?? data.name ?? '-' }}</li>
          <li>產業：{{ companyProfile?.產業名稱 ?? companyProfile?.產業代碼 ?? '尚無資料' }}</li>
          <li>董事長：{{ companyProfile?.董事長 ?? '尚無資料' }}</li>
          <li>總經理：{{ companyProfile?.總經理 ?? '尚無資料' }}</li>
          <li>成立日期：{{ formatDate(companyProfile?.成立日期) }}</li>
          <li>上市日期：{{ formatDate(companyProfile?.上市日期) }}</li>
          <li>實收資本額：{{ formatAmount(companyProfile?.實收資本額) }}</li>
          <li>已發行股數：{{ formatAmount(companyProfile?.已發行股數) }}</li>
          <li v-if="companyProfile?.網址">
            公司網站：
            <a class="action-link" :href="companyProfile.網址" target="_blank" rel="noreferrer">前往官網</a>
          </li>
        </ul>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">財務觀察</h2>
            <p class="panel-subtitle">估值、營收與季報重點</p>
          </div>
        </div>
        <ul class="bullet-list">
          <li v-for="item in financials?.觀察摘要 ?? []" :key="item">{{ item }}</li>
          <li v-if="!(financials?.觀察摘要?.length)">目前尚無足夠欄位可整理財務摘要。</li>
        </ul>
      </article>
    </section>

    <section class="dual-grid">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">最新月營收</h2>
            <p class="panel-subtitle">資料年月 {{ formatYearMonth(monthlyRevenue?.資料年月) }}</p>
          </div>
        </div>
        <ul class="bullet-list compact">
          <li>當月營收：{{ formatAmount(monthlyRevenue?.當月營收) }}</li>
          <li>月增率：{{ formatPercent(monthlyRevenue?.月增率) }}</li>
          <li>年增率：{{ formatPercent(monthlyRevenue?.年增率) }}</li>
          <li>累計營收：{{ formatAmount(monthlyRevenue?.累計營收) }}</li>
          <li>累計年增率：{{ formatPercent(monthlyRevenue?.累計年增率) }}</li>
          <li>出表日期：{{ formatDate(monthlyRevenue?.出表日期) }}</li>
        </ul>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">最新季報</h2>
            <p class="panel-subtitle">{{ reportPeriod }} {{ incomeStatement?.報表類別 ? `・${incomeStatement.報表類別}` : '' }}</p>
          </div>
        </div>
        <ul class="bullet-list compact">
          <li>{{ incomeStatement?.主要收益欄位 ?? '主要收益' }}：{{ formatAmount(incomeStatement?.主要收益) }}</li>
          <li>營業利益：{{ formatAmount(incomeStatement?.營業利益) }}</li>
          <li>稅前淨利：{{ formatAmount(incomeStatement?.稅前淨利) }}</li>
          <li>本期淨利：{{ formatAmount(incomeStatement?.本期淨利) }}</li>
          <li>母公司淨利：{{ formatAmount(incomeStatement?.母公司淨利) }}</li>
          <li>EPS：{{ formatNumber(incomeStatement?.每股盈餘) }}</li>
        </ul>
      </article>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">資產負債摘要</h2>
          <p class="panel-subtitle">
            {{ balanceSheet?.年度 && balanceSheet?.季別 ? `${balanceSheet.年度} 年 Q${balanceSheet.季別}` : '尚無資料' }}
            {{ balanceSheet?.報表類別 ? `・${balanceSheet.報表類別}` : '' }}
          </p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>項目</th>
              <th>金額 / 比率</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>資產總額</td>
              <td>{{ formatAmount(balanceSheet?.資產總額) }}</td>
            </tr>
            <tr>
              <td>負債總額</td>
              <td>{{ formatAmount(balanceSheet?.負債總額) }}</td>
            </tr>
            <tr>
              <td>權益總額</td>
              <td>{{ formatAmount(balanceSheet?.權益總額) }}</td>
            </tr>
            <tr>
              <td>股本</td>
              <td>{{ formatAmount(balanceSheet?.股本) }}</td>
            </tr>
            <tr>
              <td>保留盈餘</td>
              <td>{{ formatAmount(balanceSheet?.保留盈餘) }}</td>
            </tr>
            <tr>
              <td>負債比</td>
              <td>{{ formatPercent(balanceSheet?.負債比) }}</td>
            </tr>
            <tr>
              <td>每股參考淨值</td>
              <td>{{ formatNumber(balanceSheet?.每股參考淨值) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted">{{ financials?.資料說明?.[0] }}</p>
    </section>
  </template>
</template>
