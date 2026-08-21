<script setup>
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import DataFreshnessBadge from '../components/DataFreshnessBadge.vue';
import MiniTrendChart from '../components/MiniTrendChart.vue';
import StatusCard from '../components/StatusCard.vue';
import { useGlobalData } from '../composables/useGlobalData';
import { useSeoMeta } from '../composables/useSeoMeta';
import { getDataFreshnessStatus } from '../lib/dataFreshness';
import { formatDate, formatLots, formatNumber } from '../lib/formatters';
import { buildTaiwanMarketBias } from '../lib/taiwanMarketBias';

const CURRENCY_DEFINITIONS = [
  { symbol: 'USDJPY=X', code: 'JPY', name: '日圓', quoteLabel: '美元 / 日圓', digits: 3 },
  { symbol: 'USDKRW=X', code: 'KRW', name: '韓元', quoteLabel: '美元 / 韓元', digits: 2 },
  { symbol: 'USDCNY=X', code: 'CNY', name: '人民幣', quoteLabel: '美元 / 人民幣', digits: 4 },
  { symbol: 'USDTWD=X', code: 'TWD', name: '台幣', quoteLabel: '美元 / 台幣', digits: 3 },
];

const { dashboard, globalMarkets, manifest, isLoading, errorMessage, loadGlobalData } = useGlobalData();

const marketItemMap = computed(() => new Map(
  (globalMarkets.value?.sections ?? [])
    .flatMap((section) => section.items ?? [])
    .map((item) => [item.symbol, item]),
));

const currencyCards = computed(() => CURRENCY_DEFINITIONS.map((definition) => {
  const item = marketItemMap.value.get(definition.symbol) ?? {};
  const changePercent = toNumber(item.changePercent);
  const direction = getCurrencyDirection(changePercent);

  return {
    ...item,
    ...definition,
    changePercent,
    direction: direction.label,
    tone: direction.tone,
    sparklineValues: (item.sparkline ?? []).map((point) => point.close),
  };
}).filter((item) => toNumber(item.close) !== null));

const unavailableCurrencies = computed(() => CURRENCY_DEFINITIONS
  .filter((definition) => !currencyCards.value.some((item) => item.symbol === definition.symbol))
  .map((definition) => definition.name));

const nasdaq = computed(() => marketItemMap.value.get('^IXIC') ?? null);
const treasury10Year = computed(() => marketItemMap.value.get('^TNX') ?? null);
const foreignFlowRows = computed(() => [...(dashboard.value?.法人追蹤?.每日法人合計 ?? [])]
  .filter((row) => toNumber(row.外資買賣超) !== null)
  .sort((left, right) => String(right.日期 ?? '').localeCompare(String(left.日期 ?? ''))));
const latestForeignFlow = computed(() => foreignFlowRows.value[0] ?? null);
const foreignFiveDayTotal = computed(() => foreignFlowRows.value
  .slice(0, 5)
  .reduce((total, row) => total + (toNumber(row.外資買賣超) ?? 0), 0));

const hasData = computed(() => currencyCards.value.some((item) => toNumber(item.close) !== null)
  || toNumber(nasdaq.value?.close) !== null
  || toNumber(treasury10Year.value?.close) !== null
  || latestForeignFlow.value !== null);
const hasContextData = computed(() => latestForeignFlow.value !== null
  || toNumber(nasdaq.value?.close) !== null
  || toNumber(treasury10Year.value?.close) !== null);
const unavailableContextLabels = computed(() => [
  latestForeignFlow.value === null ? '外資' : null,
  toNumber(nasdaq.value?.close) === null ? 'NASDAQ' : null,
  toNumber(treasury10Year.value?.close) === null ? '美債 10Y' : null,
].filter(Boolean));

const latestMarketDate = computed(() => latestForeignFlow.value?.日期
  ?? globalMarkets.value?.marketDate
  ?? currencyCards.value.find((item) => item.marketDate)?.marketDate
  ?? null);

const pageFreshness = computed(() => getDataFreshnessStatus({
  generatedAt: globalMarkets.value?.generatedAt ?? dashboard.value?.generatedAt ?? manifest.value?.generatedAt,
  marketDate: latestMarketDate.value,
}));

const marketBias = computed(() => buildTaiwanMarketBias({
  currencies: currencyCards.value,
  foreignFlow: latestForeignFlow.value,
  nasdaq: nasdaq.value,
  treasury10Year: treasury10Year.value,
}));

const marketView = computed(() => {
  const bias = marketBias.value;
  if (!pageFreshness.value.isStale) return bias;

  return {
    ...bias,
    label: '暫不判斷',
    state: 'stale',
    confidence: '不足',
    summary: `目前資料停在 ${formatDate(latestMarketDate.value)}，為避免把歷史走勢當成今天，先不給多空方向。`,
  };
});

const displayBiasScore = computed(() => ['stale', 'insufficient'].includes(marketView.value.state)
  ? null
  : marketView.value.score);

const factorRows = computed(() => marketBias.value.factors
  .filter((factor) => factor.score !== null)
  .map((factor) => ({
    ...factor,
    displayValue: formatFactorValue(factor),
    status: getFactorStatus(factor.direction),
  })));

useSeoMeta(computed(() => ({
  title: '台股每日亞幣觀察',
  description: '集中查看日圓、韓元、人民幣、台幣、外資買賣超、NASDAQ 與美國 10 年期公債殖利率。',
  routePath: '/asian-currency-watch',
  keywords: ['台股', '亞幣', '日圓', '韓元', '人民幣', '台幣', '外資', 'NASDAQ', '美債殖利率'],
})));

onMounted(() => {
  loadGlobalData();
});

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getCurrencyDirection(changePercent) {
  if (changePercent === null) return { label: '待更新', tone: 'normal' };
  if (changePercent < 0) return { label: '升值', tone: 'up' };
  if (changePercent > 0) return { label: '貶值', tone: 'down' };
  return { label: '持平', tone: 'normal' };
}

function getForeignDirection(value) {
  const number = toNumber(value);
  if (number === null) return '等待資料';
  if (number > 0) return '買超';
  if (number < 0) return '賣超';
  return '持平';
}

function formatCurrencyValue(item) {
  const value = toNumber(item?.close);
  if (value === null) return '-';

  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: item.digits,
    maximumFractionDigits: item.digits,
  }).format(value);
}

function formatSignedPercent(value) {
  const number = toNumber(value);
  if (number === null) return '-';
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function formatYield(value) {
  const number = toNumber(value);
  return number === null ? '-' : `${number.toFixed(3)}%`;
}

function getBasisPointChange(item) {
  const directValue = toNumber(item?.changeBasisPoints);
  if (directValue !== null) return directValue;

  const change = toNumber(item?.change);
  return change === null ? null : change * 100;
}

function formatSignedBasisPoints(item) {
  const value = getBasisPointChange(item);
  if (value === null) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} bp`;
}

function formatSignedLots(value) {
  const number = toNumber(value);
  if (number === null) return '-';
  return `${number > 0 ? '+' : ''}${formatLots(number)}`;
}

function formatFactorValue(factor) {
  if (factor.kind === 'foreign') return formatSignedLots(factor.rawValue);
  if (factor.kind === 'basisPoints') {
    const value = toNumber(factor.rawValue);
    return value === null ? '-' : `${value > 0 ? '+' : ''}${value.toFixed(1)} bp`;
  }
  return formatSignedPercent(factor.rawValue);
}

function getFactorStatus(direction) {
  if (direction === 'bullish') return '偏多';
  if (direction === 'bearish') return '偏空';
  if (direction === 'neutral') return '中性';
  return '待更新';
}

function factorBarStyle(factor) {
  const score = toNumber(factor.score);
  if (score === null || score === 0) {
    return { '--factor-start': '50%', '--factor-width': '0%' };
  }

  const width = Math.max(3, Math.min(50, Math.abs(score) * 50));
  return {
    '--factor-start': score < 0 ? `${50 - width}%` : '50%',
    '--factor-width': `${width}%`,
  };
}

function toneClass(value) {
  const number = toNumber(value);
  if (number > 0) return 'text-up';
  if (number < 0) return 'text-down';
  return '';
}
</script>

<template>
  <section class="page-shell asian-currency-watch-page">
    <StatusCard
      :is-loading="isLoading"
      :error-message="errorMessage"
      :has-data="hasData"
      empty-message="亞幣觀察資料尚未整理完成。"
    />

    <template v-if="hasData">
      <section class="page-hero compact radar-page-hero asian-currency-hero">
        <div class="hero-copy">
          <span class="hero-kicker">Taiwan Daily Asia FX Watch</span>
          <h1>台股每日亞幣觀察</h1>
          <p class="page-subtitle">
            每天把亞幣、外資、NASDAQ 與美債放在一起看，先判斷台股面對的順風多，還是壓力多。
          </p>

          <article class="market-bias-summary" :class="`is-${marketView.state}`">
            <div class="bias-summary-head">
              <div>
                <span class="bias-summary-label">今日台股環境</span>
                <div class="bias-verdict-row">
                  <strong>{{ marketView.label }}</strong>
                  <span v-if="displayBiasScore !== null" class="bias-score">
                    {{ displayBiasScore > 0 ? '+' : '' }}{{ displayBiasScore }} 分
                  </span>
                </div>
              </div>
              <span class="bias-confidence">把握程度 {{ marketView.confidence }}</span>
            </div>

            <p class="bias-summary-copy">{{ marketView.summary }}</p>

            <div class="bias-meter" aria-label="台股多空方向刻度">
              <div class="bias-meter-track">
                <span class="is-bearish"></span>
                <span class="is-neutral"></span>
                <span class="is-bullish"></span>
                <i
                  v-if="displayBiasScore !== null"
                  class="bias-meter-marker"
                  :style="{ left: `${marketView.meterPosition}%` }"
                ></i>
              </div>
              <div class="bias-meter-labels">
                <span>偏空</span>
                <span>拉鋸</span>
                <span>偏多</span>
              </div>
            </div>

            <div class="bias-quick-facts">
              <div>
                <span>參考訊號</span>
                <strong>{{ marketView.availableCount }} / {{ marketView.totalCount }}</strong>
              </div>
              <div>
                <span>亞幣氣氛</span>
                <strong>{{ marketView.fxMood }}</strong>
              </div>
              <div>
                <span>最新資料</span>
                <strong>{{ formatDate(latestMarketDate) }}</strong>
              </div>
            </div>
          </article>
        </div>

        <aside class="radar-hero-board asian-currency-hero-board">
          <article class="theme-spotlight-card is-info">
            <span class="theme-spotlight-label">判讀提醒</span>
            <strong>看盤勢背景，不是猜漲跌</strong>
            <p>偏多代表順風訊號較多，偏空代表壓力訊號較多；仍要搭配大盤位置與個股走勢。</p>
            <DataFreshnessBadge
              :generated-at="globalMarkets?.generatedAt ?? dashboard?.generatedAt ?? manifest?.generatedAt"
              :market-date="latestMarketDate"
              size="compact"
            />
          </article>
          <RouterLink class="ghost-button" to="/global-markets">查看完整國際盤</RouterLink>
        </aside>
      </section>

      <section class="panel market-bias-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">今天為什麼這樣判斷？</h2>
            <p class="panel-subtitle">每一項都能回頭核對；偏多是支撐，偏空是壓力，待更新不列入判斷。</p>
          </div>
          <span class="meta-chip">{{ factorRows.length }} 項訊號</span>
        </div>

        <div class="bias-factor-grid">
          <article
            v-for="factor in factorRows"
            :key="factor.key"
            class="bias-factor-row"
            :class="`is-${factor.direction}`"
          >
            <div class="factor-row-head">
              <div class="factor-title">
                <strong>{{ factor.label }}</strong>
                <span>{{ factor.impact }}</span>
              </div>
              <span class="factor-status">{{ factor.status }}</span>
            </div>

            <div class="factor-value-row">
              <strong>{{ factor.displayValue }}</strong>
              <span v-if="factor.marketDate">資料日 {{ formatDate(factor.marketDate) }}</span>
            </div>

            <div class="factor-bar" :style="factorBarStyle(factor)" aria-hidden="true">
              <span class="factor-bar-center"></span>
              <span class="factor-bar-fill"></span>
            </div>

            <p>{{ factor.reason }}</p>
          </article>
        </div>

        <details class="bias-method-note">
          <summary>這個結論怎麼看？</summary>
          <p>外資與台幣最能反映台股資金，NASDAQ 反映電子股氣氛，美債反映成長股壓力；韓元、人民幣提供亞洲資金線索，日圓只作輔助。單一訊號不會直接決定漲跌。</p>
        </details>
      </section>

      <section class="panel asian-currency-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">亞幣今日表現</h2>
            <p class="panel-subtitle">報價統一為 1 美元可兌多少當地貨幣；數值下跌代表該亞幣升值。</p>
          </div>
          <span class="meta-chip">{{ currencyCards.length }} 種亞幣</span>
        </div>

        <p v-if="unavailableCurrencies.length" class="ir-data-note is-warning">
          {{ unavailableCurrencies.join('、') }}目前沒有可核對的報價，本次先不顯示。
        </p>

        <div class="asian-currency-grid">
          <article
            v-for="item in currencyCards"
            :key="item.symbol"
            class="currency-quote-card"
            :class="`is-${item.tone}`"
          >
            <div class="currency-card-head">
              <div class="currency-identity">
                <span class="currency-code">{{ item.code }}</span>
                <div>
                  <strong>{{ item.name }}</strong>
                  <p>{{ item.quoteLabel }}</p>
                </div>
              </div>
              <span v-if="item.changePercent !== null" class="status-badge" :class="`is-${item.tone}`">{{ item.direction }}</span>
            </div>

            <div class="currency-current">
              <div>
                <span>目前數值</span>
                <strong>{{ formatCurrencyValue(item) }}</strong>
              </div>
              <div v-if="item.changePercent !== null" class="currency-day-change">
                <span>今日漲跌</span>
                <strong :class="item.tone === 'up' ? 'text-up' : item.tone === 'down' ? 'text-down' : ''">
                  {{ formatSignedPercent(item.changePercent) }}
                </strong>
              </div>
            </div>

            <MiniTrendChart v-if="item.sparklineValues.length >= 2" :values="item.sparklineValues" :tone="item.tone" />

            <div class="currency-periods">
              <div v-if="toNumber(item.return5) !== null">
                <span>5 日</span>
                <strong :class="toneClass(item.return5)">{{ formatSignedPercent(item.return5) }}</strong>
              </div>
              <div v-if="toNumber(item.return20) !== null">
                <span>20 日</span>
                <strong :class="toneClass(item.return20)">{{ formatSignedPercent(item.return20) }}</strong>
              </div>
              <div v-if="item.marketDate">
                <span>資料日</span>
                <strong>{{ formatDate(item.marketDate) }}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-if="hasContextData" class="panel asian-context-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">台股關聯指標</h2>
            <p class="panel-subtitle">把資金、成長股風險偏好與美元利率壓力放在同一列比較。</p>
          </div>
        </div>

        <p v-if="unavailableContextLabels.length" class="ir-data-note is-warning">
          {{ unavailableContextLabels.join('、') }}目前沒有可核對的資料，本次先不顯示。
        </p>

        <div class="asian-context-grid">
          <article v-if="latestForeignFlow" class="asian-context-card">
            <div class="context-card-label">
              <span>台股資金</span>
              <strong>外資</strong>
            </div>
            <div class="context-main-value">
              <strong :class="toneClass(latestForeignFlow.外資買賣超)">
                {{ formatSignedLots(latestForeignFlow.外資買賣超) }}
              </strong>
              <span>{{ getForeignDirection(latestForeignFlow.外資買賣超) }}</span>
            </div>
            <div v-if="foreignFlowRows.length" class="context-stat-row">
              <span>5 日累計</span>
              <strong :class="toneClass(foreignFiveDayTotal)">{{ formatSignedLots(foreignFiveDayTotal) }}</strong>
            </div>
            <p>上市與上櫃一般股之外資淨買賣股數合計，單位換算為張。</p>
          </article>

          <article v-if="toNumber(nasdaq?.close) !== null" class="asian-context-card">
            <div class="context-card-label">
              <span>美股風險偏好</span>
              <strong>NASDAQ</strong>
            </div>
            <div class="context-main-value">
              <strong>{{ formatNumber(nasdaq?.close) }}</strong>
              <span v-if="toNumber(nasdaq?.changePercent) !== null" :class="toneClass(nasdaq.changePercent)">{{ formatSignedPercent(nasdaq.changePercent) }}</span>
            </div>
            <MiniTrendChart
              v-if="(nasdaq?.sparkline ?? []).length >= 2"
              :values="(nasdaq?.sparkline ?? []).map((point) => point.close)"
              :tone="(nasdaq?.changePercent ?? 0) > 0 ? 'up' : (nasdaq?.changePercent ?? 0) < 0 ? 'down' : 'normal'"
            />
            <div v-if="nasdaq?.marketDate" class="context-stat-row">
              <span>資料日</span>
              <strong>{{ formatDate(nasdaq.marketDate) }}</strong>
            </div>
          </article>

          <article v-if="toNumber(treasury10Year?.close) !== null" class="asian-context-card">
            <div class="context-card-label">
              <span>美元利率壓力</span>
              <strong>美債 10Y</strong>
            </div>
            <div class="context-main-value">
              <strong>{{ formatYield(treasury10Year?.close) }}</strong>
              <span v-if="getBasisPointChange(treasury10Year) !== null" :class="toneClass(treasury10Year?.change)">{{ formatSignedBasisPoints(treasury10Year) }}</span>
            </div>
            <MiniTrendChart
              v-if="(treasury10Year?.sparkline ?? []).length >= 2"
              :values="(treasury10Year?.sparkline ?? []).map((point) => point.close)"
              :tone="(treasury10Year?.change ?? 0) < 0 ? 'up' : (treasury10Year?.change ?? 0) > 0 ? 'down' : 'normal'"
            />
            <div v-if="treasury10Year?.marketDate" class="context-stat-row">
              <span>資料日</span>
              <strong>{{ formatDate(treasury10Year.marketDate) }}</strong>
            </div>
          </article>
        </div>
      </section>

      <p class="asian-source-note">
        匯率、NASDAQ 與美債採最近一個交易日收盤資料；外資採上市、上櫃法人日報。各市場收盤時間不同，僅供盤勢觀察，不構成投資建議。
      </p>
    </template>
  </section>
</template>

<style scoped>
.asian-currency-watch-page {
  display: grid;
  gap: 1.15rem;
}

.asian-currency-hero {
  align-items: stretch;
}

.asian-currency-hero-board {
  display: grid;
  align-self: stretch;
  gap: 0.7rem;
}

.market-bias-summary {
  --bias-color: #6b7c8d;
  display: grid;
  gap: 0.9rem;
  margin-top: 1.2rem;
  padding: 1rem;
  border: 1px solid rgba(16, 32, 45, 0.12);
  border-left: 4px solid var(--bias-color);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
}

.market-bias-summary.is-bullish {
  --bias-color: var(--up);
}

.market-bias-summary.is-bearish {
  --bias-color: var(--down);
}

.market-bias-summary.is-neutral {
  --bias-color: #b47816;
}

.market-bias-summary.is-stale,
.market-bias-summary.is-insufficient {
  --bias-color: #758494;
}

.bias-summary-head,
.bias-verdict-row,
.factor-row-head,
.factor-title,
.factor-value-row {
  display: flex;
  align-items: center;
}

.bias-summary-head,
.factor-row-head,
.factor-value-row {
  justify-content: space-between;
  gap: 0.8rem;
}

.bias-summary-label {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--text-soft);
  font-size: 0.78rem;
  font-weight: 800;
}

.bias-verdict-row {
  flex-wrap: wrap;
  gap: 0.55rem;
}

.bias-verdict-row > strong {
  color: var(--bias-color);
  font-size: 2rem;
  line-height: 1.05;
  letter-spacing: 0;
}

.bias-score,
.bias-confidence {
  color: var(--text-strong);
  font-size: 0.82rem;
  font-weight: 900;
}

.bias-confidence {
  flex: 0 0 auto;
  padding: 0.45rem 0.62rem;
  border: 1px solid color-mix(in srgb, var(--bias-color) 28%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bias-color) 8%, transparent);
}

.bias-summary-copy {
  margin: 0;
  color: var(--text-strong);
  font-size: 0.92rem;
  line-height: 1.65;
}

.bias-meter {
  display: grid;
  gap: 0.35rem;
}

.bias-meter-track {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 0.62fr 1fr;
  gap: 3px;
  height: 8px;
}

.bias-meter-track > span {
  border-radius: 3px;
}

.bias-meter-track .is-bearish {
  background: color-mix(in srgb, var(--down) 48%, transparent);
}

.bias-meter-track .is-neutral {
  background: rgba(117, 132, 148, 0.36);
}

.bias-meter-track .is-bullish {
  background: color-mix(in srgb, var(--up) 48%, transparent);
}

.bias-meter-marker {
  position: absolute;
  top: -4px;
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: var(--bias-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--bias-color) 16%, transparent);
  transform: translateX(-50%);
}

.bias-meter-labels {
  display: grid;
  grid-template-columns: 1fr 0.62fr 1fr;
  color: var(--text-soft);
  font-size: 0.7rem;
  font-weight: 800;
}

.bias-meter-labels span:nth-child(2) {
  text-align: center;
}

.bias-meter-labels span:last-child {
  text-align: right;
}

.bias-quick-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.bias-quick-facts > div {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
  padding: 0.62rem;
  border-radius: 6px;
  background: rgba(16, 32, 45, 0.045);
}

.bias-quick-facts span,
.factor-value-row span {
  color: var(--text-soft);
  font-size: 0.72rem;
}

.bias-quick-facts strong {
  color: var(--text-strong);
  font-size: 0.84rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.bias-factor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.bias-factor-row {
  --factor-color: #758494;
  display: grid;
  min-width: 0;
  gap: 0.62rem;
  padding: 0.85rem;
  border: 1px solid rgba(16, 32, 45, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
}

.bias-factor-row.is-bullish {
  --factor-color: var(--up);
}

.bias-factor-row.is-bearish {
  --factor-color: var(--down);
}

.bias-factor-row.is-neutral {
  --factor-color: #9a6a18;
}

.factor-title {
  min-width: 0;
  gap: 0.48rem;
}

.factor-title strong {
  color: var(--text-strong);
  font-size: 0.92rem;
}

.factor-title span {
  padding: 0.18rem 0.35rem;
  border-radius: 4px;
  background: rgba(16, 32, 45, 0.06);
  color: var(--text-soft);
  font-size: 0.66rem;
  font-weight: 800;
}

.factor-status {
  flex: 0 0 auto;
  color: var(--factor-color);
  font-size: 0.78rem;
  font-weight: 900;
}

.factor-value-row {
  align-items: baseline;
}

.factor-value-row strong {
  color: var(--text-strong);
  font-size: 1.12rem;
  line-height: 1.15;
  letter-spacing: 0;
}

.factor-value-row span {
  text-align: right;
}

.factor-bar {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: rgba(117, 132, 148, 0.14);
  overflow: hidden;
}

.factor-bar-center {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: rgba(16, 32, 45, 0.25);
}

.factor-bar-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--factor-start);
  width: var(--factor-width);
  background: var(--factor-color);
}

.bias-factor-row p,
.bias-method-note p {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.76rem;
  line-height: 1.55;
}

.bias-method-note {
  margin-top: 0.8rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(16, 32, 45, 0.09);
}

.bias-method-note summary {
  width: fit-content;
  color: var(--brand-deep);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 900;
}

.bias-method-note p {
  max-width: 900px;
  margin-top: 0.55rem;
}

.asian-currency-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;
}

.currency-quote-card,
.asian-context-card {
  min-width: 0;
  border: 1px solid rgba(16, 32, 45, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 28px rgba(16, 32, 45, 0.06);
}

.currency-quote-card {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border-top: 3px solid rgba(11, 105, 155, 0.42);
}

.currency-quote-card.is-up {
  border-top-color: var(--up);
}

.currency-quote-card.is-down {
  border-top-color: var(--down);
}

.currency-card-head,
.currency-identity,
.currency-current,
.context-main-value,
.context-stat-row {
  display: flex;
  align-items: center;
}

.currency-card-head,
.currency-current,
.context-main-value,
.context-stat-row {
  justify-content: space-between;
  gap: 0.75rem;
}

.currency-identity {
  min-width: 0;
  gap: 0.65rem;
}

.currency-code {
  display: grid;
  width: 42px;
  height: 34px;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid rgba(11, 105, 155, 0.18);
  border-radius: 6px;
  background: rgba(11, 105, 155, 0.07);
  color: var(--brand-deep);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0;
}

.currency-identity strong,
.context-card-label strong {
  display: block;
  color: var(--text-strong);
  font-size: 1rem;
  line-height: 1.35;
}

.currency-identity p,
.asian-context-card p,
.asian-source-note {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.78rem;
  line-height: 1.6;
}

.currency-current {
  align-items: flex-end;
}

.currency-current > div,
.currency-day-change,
.context-card-label {
  display: grid;
  gap: 0.2rem;
}

.currency-current span,
.currency-periods span,
.context-card-label span,
.context-stat-row span {
  color: var(--text-soft);
  font-size: 0.74rem;
}

.currency-current > div > strong {
  color: var(--text-strong);
  font-size: 1.65rem;
  line-height: 1;
  letter-spacing: 0;
}

.currency-day-change {
  justify-items: end;
  text-align: right;
}

.currency-day-change strong {
  font-size: 0.92rem;
}

.currency-periods {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.currency-periods > div {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
  padding: 0.6rem;
  border-radius: 6px;
  background: rgba(244, 249, 253, 0.86);
}

.currency-periods strong {
  overflow-wrap: anywhere;
  color: var(--text-strong);
  font-size: 0.78rem;
  line-height: 1.35;
}

.asian-context-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
}

.asian-context-card {
  display: grid;
  align-content: start;
  gap: 0.9rem;
  padding: 1rem;
}

.context-main-value {
  align-items: baseline;
}

.context-main-value > strong {
  min-width: 0;
  color: var(--text-strong);
  font-size: 1.6rem;
  line-height: 1.1;
  overflow-wrap: anywhere;
  letter-spacing: 0;
}

.context-main-value > span {
  flex: 0 0 auto;
  font-size: 0.9rem;
  font-weight: 800;
}

.context-stat-row {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(16, 32, 45, 0.08);
}

.context-stat-row strong {
  color: var(--text-strong);
  font-size: 0.85rem;
}

.asian-source-note {
  padding: 0 0.2rem;
}

@media (max-width: 1180px) {
  .asian-currency-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .bias-factor-grid,
  .asian-currency-grid,
  .asian-context-grid {
    grid-template-columns: 1fr;
  }

  .bias-summary-head {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .market-bias-summary {
    padding: 0.85rem;
  }

  .bias-quick-facts {
    grid-template-columns: 1fr;
  }

  .factor-value-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.25rem;
  }

  .factor-value-row span {
    text-align: left;
  }
}
</style>

<style>
html[data-theme="dark"] .asian-currency-watch-page .currency-quote-card,
html[data-theme="dark"] .asian-currency-watch-page .asian-context-card,
html[data-theme="dark"] .asian-currency-watch-page .market-bias-summary,
html[data-theme="dark"] .asian-currency-watch-page .bias-factor-row {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(10, 18, 29, 0.9);
  box-shadow: 0 14px 30px rgba(2, 6, 23, 0.24);
}

html[data-theme="dark"] .asian-currency-watch-page .currency-code,
html[data-theme="dark"] .asian-currency-watch-page .currency-periods > div,
html[data-theme="dark"] .asian-currency-watch-page .bias-quick-facts > div,
html[data-theme="dark"] .asian-currency-watch-page .factor-title span {
  border-color: rgba(103, 201, 255, 0.16);
  background: rgba(21, 38, 55, 0.72);
}

html[data-theme="dark"] .asian-currency-watch-page .context-stat-row,
html[data-theme="dark"] .asian-currency-watch-page .bias-method-note {
  border-color: rgba(148, 163, 184, 0.18);
}

html[data-theme="dark"] .asian-currency-watch-page .factor-bar-center {
  background: rgba(226, 232, 240, 0.34);
}
</style>
