<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { 取得JSON } from './lib/api';
import {
  格式化日期,
  格式化差額,
  格式化數字,
  格式化百分比,
  格式化金額,
  格式化時間,
} from './lib/formatters';

const 頁籤清單 = ['市場總覽', 'ETF 重疊分析', '個別 ETF 成分'];

const 頁面載入中 = ref(true);
const 頁面錯誤 = ref('');
const manifest = ref(null);
const dashboard = ref(null);
const overlap = ref(null);
const 選中頁籤 = ref('市場總覽');
const selectedCode = ref('');
const ETF搜尋字串 = ref('');
const snapshot = ref(null);
const diff = ref(null);
const ETF載入中 = ref(false);
const ETF訊息 = ref('');

const ETF清單 = computed(() => manifest.value?.trackedEtfs ?? []);
const 市場總覽 = computed(() => dashboard.value?.市場總覽 ?? null);
const 法人追蹤 = computed(() => dashboard.value?.法人追蹤 ?? null);
const 期貨籌碼 = computed(() => dashboard.value?.期貨籌碼 ?? null);
const 主動ETF總覽 = computed(() => dashboard.value?.主動ETF總覽 ?? null);
const 大盤摘要 = computed(() => 市場總覽.value?.大盤摘要 ?? null);
const 盤中脈動 = computed(() => 市場總覽.value?.盤中脈動 ?? null);
const 指數卡片 = computed(() => 市場總覽.value?.指數卡片 ?? []);
const 熱門股 = computed(() => 市場總覽.value?.熱門股 ?? []);
const 成交排行 = computed(() => 市場總覽.value?.成交排行 ?? []);
const 強勢股 = computed(() => 市場總覽.value?.強勢股 ?? []);
const 搜尋後ETF清單 = computed(() => {
  const keyword = ETF搜尋字串.value.trim();

  if (!keyword) return ETF清單.value;

  return ETF清單.value.filter((item) =>
    [item.code, item.name, item.fullName, item.providerLabel].some((field) =>
      String(field ?? '').toLowerCase().includes(keyword.toLowerCase()),
    ),
  );
});

const selectedMeta = computed(() =>
  ETF清單.value.find((item) => item.code === selectedCode.value) ?? null,
);

const selectedOverview = computed(() =>
  manifest.value?.latestOverview?.find((item) => item.code === selectedCode.value) ?? null,
);

const diffSections = computed(() => [
  { key: 'added', title: '新增持股', items: diff.value?.added ?? [] },
  { key: 'removed', title: '剔除持股', items: diff.value?.removed ?? [] },
  { key: 'increased', title: '加碼持股', items: diff.value?.increased ?? [] },
  { key: 'decreased', title: '減碼持股', items: diff.value?.decreased ?? [] },
]);

const 首頁統計卡 = computed(() => {
  if (!大盤摘要.value) return [];

  return [
    {
      標題: '成交值',
      數值: 格式化金額(大盤摘要.value.成交值),
      註解: '上市單日成交值',
    },
    {
      標題: '成交量',
      數值: 格式化金額(大盤摘要.value.成交量),
      註解: '上市單日成交股數',
    },
    {
      標題: '成交筆數',
      數值: 格式化數字(大盤摘要.value.成交筆數),
      註解: '市場活躍度',
    },
    {
      標題: '盤中最後更新',
      數值: 格式化時間(盤中脈動.value?.更新時間),
      註解: 'TWSE 五分鐘累計',
    },
  ];
});

const 首頁狀態卡 = computed(() => {
  if (!主動ETF總覽.value) return [];

  return [
    {
      標題: '已串接主動式 ETF',
      數值: 格式化數字(主動ETF總覽.value.已串接檔數),
      註解: '目前可直接比對每日異動',
    },
    {
      標題: '待串接',
      數值: 格式化數字(主動ETF總覽.value.待串接檔數),
      註解: '清單已建好，後續可逐檔補資料源',
    },
    {
      標題: '最新揭露日期',
      數值: 格式化日期(manifest.value?.latestDisclosureDate),
      註解: '依已串接 ETF 持股揭露為準',
    },
  ];
});

const 重疊摘要卡 = computed(() => {
  if (!overlap.value) return [];

  return [
    {
      標題: '共同持股',
      數值: 格式化數字(overlap.value.共同持股?.length ?? 0),
      註解: '兩檔以上 ETF 同時持有',
    },
    {
      標題: '共同新增',
      數值: 格式化數字(overlap.value.共同新增?.length ?? 0),
      註解: '多檔 ETF 同步新買進',
    },
    {
      標題: '共同加碼',
      數值: 格式化數字(overlap.value.共同加碼?.length ?? 0),
      註解: '多檔 ETF 同步增持',
    },
    {
      標題: '不重複異動',
      數值: 格式化數字(
        (overlap.value.不重複異動?.新增?.length ?? 0) +
          (overlap.value.不重複異動?.剔除?.length ?? 0) +
          (overlap.value.不重複異動?.加碼?.length ?? 0) +
          (overlap.value.不重複異動?.減碼?.length ?? 0),
      ),
      註解: '單一 ETF 才有的特色持股',
    },
  ];
});

const 最新更新時間 = computed(() =>
  manifest.value ? `${manifest.value.generatedAtLocalDate} ${manifest.value.generatedAtLocalTime}` : '-',
);

function 取漲跌樣式(value) {
  const number = Number(value ?? 0);
  if (number > 0) return 'is-up';
  if (number < 0) return 'is-down';
  return 'is-neutral';
}

function 取狀態樣式(text) {
  if (/已串接|偏多|上攻|強勢|同步偏多/.test(String(text ?? ''))) return 'is-up';
  if (/待串接|偏空|回檔|剔除|減碼/.test(String(text ?? ''))) return 'is-down';
  return 'is-neutral';
}

function 格式化浮點差額(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}`;
}

function 格式化比重差(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(2)}%`;
}

async function 載入首頁資料() {
  頁面載入中.value = true;
  頁面錯誤.value = '';

  try {
    const manifestData = await 取得JSON('data/manifest.json');
    const [dashboardData, overlapData] = await Promise.all([
      取得JSON(manifestData.dashboardPath ?? 'data/dashboard.json'),
      取得JSON(manifestData.overlapPath ?? 'data/etf-overlap.json'),
    ]);

    manifest.value = manifestData;
    dashboard.value = dashboardData;
    overlap.value = overlapData;
    selectedCode.value =
      manifestData.latestOverview?.find((item) => item.trackingStatus === '已串接')?.code ??
      manifestData.trackedEtfs?.[0]?.code ??
      '';
  } catch (error) {
    頁面錯誤.value = error instanceof Error ? error.message : '首頁資料載入失敗';
  } finally {
    頁面載入中.value = false;
  }
}

async function 載入ETF明細(code) {
  if (!code || !manifest.value) return;

  const meta = manifest.value.trackedEtfs?.find((item) => item.code === code);

  if (meta?.trackingStatus !== '已串接') {
    snapshot.value = null;
    diff.value = null;
    ETF訊息.value = `${meta?.name ?? code} 的官方持股來源還在串接中，目前先保留商品清單與官方商品頁。`;
    ETF載入中.value = false;
    return;
  }

  ETF載入中.value = true;
  ETF訊息.value = '';

  try {
    const [latest, latestDiff] = await Promise.all([
      取得JSON(`data/etfs/${code}/latest.json`),
      取得JSON(`data/etfs/${code}/diff-latest.json`),
    ]);

    snapshot.value = latest;
    diff.value = latestDiff;
    ETF訊息.value = selectedOverview.value?.trackingMessage ?? '';
  } catch (error) {
    snapshot.value = null;
    diff.value = null;
    ETF訊息.value = error instanceof Error ? error.message : 'ETF 詳細資料載入失敗';
  } finally {
    ETF載入中.value = false;
  }
}

watch(selectedCode, (code) => {
  載入ETF明細(code);
});

onMounted(() => {
  載入首頁資料();
});
</script>

<template>
  <div class="app-shell">
    <header class="hero">
      <div class="hero-main">
        <p class="hero-kicker">TWSE OpenAPI × 主動式 ETF × 法人籌碼</p>
        <h1>台股主動通</h1>
        <p class="hero-text">
          把台股主動式 ETF 每日異動、熱門股、外資與投信連買、土洋對作，以及小台與微台籌碼整理成一站式繁中報表，方便你直接放上 GitHub Pages 持續更新。
        </p>
        <div class="hero-tags">
          <span>主動畫面採繁體中文</span>
          <span>ETF 僅保留前一日比較</span>
          <span>可搭配 GitHub Actions 每日更新</span>
        </div>
      </div>

      <div class="hero-side">
        <section class="panel feature-panel">
          <p class="panel-label">大盤核心</p>
          <strong class="feature-value">{{ 大盤摘要 ? 格式化數字(Math.round(大盤摘要.加權指數)) : '-' }}</strong>
          <div class="feature-meta">
            <span>加權指數</span>
            <span :class="['value-chip', 取漲跌樣式(大盤摘要?.漲跌點數)]">
              {{ 格式化浮點差額(大盤摘要?.漲跌點數) }} 點
            </span>
            <span :class="['value-chip', 取漲跌樣式(大盤摘要?.漲跌幅)]">
              {{ 大盤摘要?.漲跌幅 == null ? '-' : 格式化百分比(大盤摘要.漲跌幅, 2) }}
            </span>
          </div>
        </section>

        <div class="hero-side-grid">
          <section v-for="card in 首頁狀態卡" :key="card.標題" class="panel mini-panel">
            <p class="panel-label">{{ card.標題 }}</p>
            <strong>{{ card.數值 }}</strong>
            <p>{{ card.註解 }}</p>
          </section>
        </div>
      </div>
    </header>

    <section class="panel nav-panel">
      <div class="nav-panel-head">
        <div>
          <p class="panel-label">資料更新</p>
          <strong>{{ 最新更新時間 }}</strong>
        </div>
        <p>首頁含市場報表，第二分頁看 ETF 共同與不重複異動，第三分頁看個別 ETF 成分表。</p>
      </div>

      <nav class="tab-nav" aria-label="主要頁籤">
        <button
          v-for="tab in 頁籤清單"
          :key="tab"
          type="button"
          :class="['tab-button', { active: 選中頁籤 === tab }]"
          @click="選中頁籤 = tab"
        >
          {{ tab }}
        </button>
      </nav>
    </section>

    <section v-if="頁面載入中" class="panel empty-panel">
      <strong>正在整理首頁資料...</strong>
      <p>稍等一下，正在把市場資料、法人籌碼與 ETF 異動一起載入。</p>
    </section>

    <section v-else-if="頁面錯誤" class="panel empty-panel error-panel">
      <strong>首頁資料載入失敗</strong>
      <p>{{ 頁面錯誤 }}</p>
    </section>

    <template v-else>
      <main v-if="選中頁籤 === '市場總覽'" class="page-grid">
        <section class="panel spotlight-panel">
          <div>
            <p class="panel-label">今日盤勢節奏</p>
            <h2>
              {{ 大盤摘要 ? `${格式化數字(Math.round(大盤摘要.加權指數))} 點` : '尚無資料' }}
            </h2>
            <p class="section-text">
              {{
                大盤摘要
                  ? `資料日期 ${格式化日期(大盤摘要.資料日期)}，成交值 ${格式化金額(大盤摘要.成交值)}，成交筆數 ${格式化數字(大盤摘要.成交筆數)}。`
                  : '等待市場資料載入。'
              }}
            </p>
          </div>

          <ul class="bullet-list">
            <li v-for="item in 市場總覽?.觀察摘要 ?? []" :key="item">{{ item }}</li>
          </ul>
        </section>

        <section class="card-grid">
          <article v-for="card in 指數卡片" :key="card.名稱" class="panel stat-panel">
            <div class="card-top">
              <p class="panel-label">{{ card.簡稱 }}</p>
              <span :class="['badge', 取狀態樣式(card.走勢)]">{{ card.走勢 }}</span>
            </div>
            <strong>{{ 格式化數字(Math.round(card.指數值 ?? 0)) }}</strong>
            <div class="stat-meta">
              <span :class="取漲跌樣式(card.漲跌點數)">{{ 格式化浮點差額(card.漲跌點數) }} 點</span>
              <span :class="取漲跌樣式(card.漲跌百分比)">
                {{ card.漲跌百分比 == null ? '-' : 格式化百分比(card.漲跌百分比, 2) }}
              </span>
            </div>
          </article>
        </section>

        <section class="card-grid compact-grid">
          <article v-for="card in 首頁統計卡" :key="card.標題" class="panel stat-panel">
            <p class="panel-label">{{ card.標題 }}</p>
            <strong>{{ card.數值 }}</strong>
            <p>{{ card.註解 }}</p>
          </article>
        </section>

        <section class="two-column">
          <article class="panel table-panel">
            <div class="section-head">
              <div>
                <p class="panel-label">熱門股</p>
                <h3>市場人氣焦點</h3>
              </div>
              <span>依成交量排序</span>
            </div>

            <ul class="quote-list">
              <li v-for="item in 熱門股.slice(0, 8)" :key="item.代號">
                <div>
                  <strong>{{ item.名稱 }}</strong>
                  <span>{{ item.代號 }}</span>
                </div>
                <div class="quote-meta">
                  <span>{{ item.收盤價 == null ? '-' : item.收盤價.toFixed(2) }}</span>
                  <span :class="取漲跌樣式(item.漲跌幅)">
                    {{ item.漲跌幅 == null ? '-' : 格式化百分比(item.漲跌幅, 2) }}
                  </span>
                  <span>{{ 格式化金額(item.成交量) }}</span>
                </div>
              </li>
            </ul>
          </article>

          <div class="stack-column">
            <article class="panel table-panel">
              <div class="section-head">
                <div>
                  <p class="panel-label">成交排行</p>
                  <h3>資金集中區</h3>
                </div>
                <span>依成交值排序</span>
              </div>

              <ul class="quote-list">
                <li v-for="item in 成交排行.slice(0, 6)" :key="item.代號">
                  <div>
                    <strong>{{ item.名稱 }}</strong>
                    <span>{{ item.代號 }}</span>
                  </div>
                  <div class="quote-meta">
                    <span>{{ 格式化金額(item.成交值) }}</span>
                    <span :class="取漲跌樣式(item.漲跌幅)">
                      {{ item.漲跌幅 == null ? '-' : 格式化百分比(item.漲跌幅, 2) }}
                    </span>
                  </div>
                </li>
              </ul>
            </article>

            <article class="panel table-panel">
              <div class="section-head">
                <div>
                  <p class="panel-label">強勢股</p>
                  <h3>量價延續觀察</h3>
                </div>
                <span>高成交值搭配強勢漲幅</span>
              </div>

              <ul class="quote-list">
                <li v-for="item in 強勢股.slice(0, 6)" :key="item.代號">
                  <div>
                    <strong>{{ item.名稱 }}</strong>
                    <span>{{ item.代號 }}</span>
                  </div>
                  <div class="quote-meta">
                    <span>{{ item.收盤價 == null ? '-' : item.收盤價.toFixed(2) }}</span>
                    <span :class="取漲跌樣式(item.漲跌幅)">
                      {{ item.漲跌幅 == null ? '-' : 格式化百分比(item.漲跌幅, 2) }}
                    </span>
                  </div>
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="section-head">
            <div>
              <p class="panel-label">外資 / 投信 追蹤</p>
              <h3>連買與土洋對作</h3>
            </div>
            <span>最近交易日：{{ 格式化日期(法人追蹤?.資料日期) }}</span>
          </div>

          <div class="three-column">
            <article class="sub-panel">
              <div class="sub-panel-head">
                <h4>外資連買</h4>
                <span>最近 {{ 法人追蹤?.回溯交易日?.length ?? 0 }} 個交易日</span>
              </div>
              <ul class="quote-list compact">
                <li v-for="item in 法人追蹤?.外資連買?.slice(0, 8) ?? []" :key="item.代號">
                  <div>
                    <strong>{{ item.名稱 }}</strong>
                    <span>{{ item.代號 }}</span>
                  </div>
                  <div class="quote-meta">
                    <span>{{ 格式化差額(item.累計買超股數) }}</span>
                    <span :class="取漲跌樣式(item.漲跌幅)">
                      {{ item.漲跌幅 == null ? '-' : 格式化百分比(item.漲跌幅, 2) }}
                    </span>
                  </div>
                </li>
              </ul>
            </article>

            <article class="sub-panel">
              <div class="sub-panel-head">
                <h4>投信連買</h4>
                <span>偏中期布局</span>
              </div>
              <ul class="quote-list compact">
                <li v-for="item in 法人追蹤?.投信連買?.slice(0, 8) ?? []" :key="item.代號">
                  <div>
                    <strong>{{ item.名稱 }}</strong>
                    <span>{{ item.代號 }}</span>
                  </div>
                  <div class="quote-meta">
                    <span>{{ 格式化差額(item.累計買超股數) }}</span>
                    <span class="badge" :class="取狀態樣式(item.其他法人態度)">
                      {{ item.其他法人態度 }}
                    </span>
                  </div>
                </li>
              </ul>
            </article>

            <article class="sub-panel">
              <div class="sub-panel-head">
                <h4>土洋對作</h4>
                <span>外資與投信同日反向</span>
              </div>
              <ul class="quote-list compact">
                <li v-for="item in 法人追蹤?.土洋對作?.slice(0, 8) ?? []" :key="item.代號">
                  <div>
                    <strong>{{ item.名稱 }}</strong>
                    <span>{{ item.代號 }}</span>
                  </div>
                  <div class="quote-meta stacked">
                    <span :class="取漲跌樣式(item.外資買賣超)">外資 {{ 格式化差額(item.外資買賣超) }}</span>
                    <span :class="取漲跌樣式(item.投信買賣超)">投信 {{ 格式化差額(item.投信買賣超) }}</span>
                  </div>
                </li>
              </ul>
            </article>
          </div>

          <ul class="bullet-list slim">
            <li v-for="item in 法人追蹤?.觀察摘要 ?? []" :key="item">{{ item }}</li>
          </ul>
        </section>

        <section class="panel">
          <div class="section-head">
            <div>
              <p class="panel-label">小台與微台</p>
              <h3>期貨籌碼觀察</h3>
            </div>
            <span>資料日期：{{ 格式化日期(期貨籌碼?.資料日期) }}</span>
          </div>

          <div class="two-column">
            <article
              v-for="item in 期貨籌碼?.契約列表 ?? []"
              :key="item.商品代碼"
              class="sub-panel futures-panel"
            >
              <div class="sub-panel-head">
                <div>
                  <h4>{{ item.契約名稱 }}</h4>
                  <p>{{ item.商品代碼 }}</p>
                </div>
                <span :class="['badge', 取狀態樣式(item.方向)]">{{ item.方向 }}</span>
              </div>

              <div class="futures-grid">
                <div v-for="row in item.法人資料" :key="row.身份別" class="futures-row">
                  <strong>{{ row.身份別 }}</strong>
                  <span>交易淨口數 {{ 格式化差額(row.交易淨口數) }}</span>
                  <span>未平倉淨口數 {{ 格式化差額(row.未平倉淨口數) }}</span>
                </div>
              </div>

              <ul class="bullet-list slim">
                <li v-for="note in item.觀察建議" :key="note">{{ note }}</li>
              </ul>
            </article>
          </div>

          <ul class="bullet-list slim">
            <li v-for="item in 期貨籌碼?.整體建議 ?? []" :key="item">{{ item }}</li>
          </ul>
        </section>
      </main>

      <main v-else-if="選中頁籤 === 'ETF 重疊分析'" class="page-grid">
        <section class="panel spotlight-panel">
          <div>
            <p class="panel-label">重疊分析</p>
            <h2>共同持股與特色異動</h2>
            <p class="section-text">
              目前已串接 {{ overlap?.已串接ETF數 ?? 0 }} 檔主動式 ETF，最新揭露日期
              {{ 格式化日期(overlap?.最新揭露日期) }}。
            </p>
          </div>

          <ul class="bullet-list">
            <li v-for="item in overlap?.資料說明 ?? []" :key="item">{{ item }}</li>
          </ul>
        </section>

        <section class="card-grid compact-grid">
          <article v-for="card in 重疊摘要卡" :key="card.標題" class="panel stat-panel">
            <p class="panel-label">{{ card.標題 }}</p>
            <strong>{{ card.數值 }}</strong>
            <p>{{ card.註解 }}</p>
          </article>
        </section>

        <section class="two-column">
          <article class="panel table-panel">
            <div class="section-head">
              <div>
                <p class="panel-label">共同持股</p>
                <h3>多檔 ETF 同時持有</h3>
              </div>
              <span>依出現次數排序</span>
            </div>

            <ul class="overlap-list">
              <li v-for="item in overlap?.共同持股?.slice(0, 12) ?? []" :key="item.code">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.code }}</span>
                </div>
                <div class="overlap-meta">
                  <span>{{ item.出現ETF數 }} 檔</span>
                  <span>平均權重 {{ 格式化百分比(item.平均權重, 2) }}</span>
                </div>
                <div class="chip-row">
                  <span v-for="code in item.ETF代號" :key="code" class="chip">{{ code }}</span>
                </div>
              </li>
            </ul>
          </article>

          <div class="stack-column">
            <article class="panel table-panel">
              <div class="section-head">
                <div>
                  <p class="panel-label">共同新增 / 剔除</p>
                  <h3>多檔 ETF 同步調整</h3>
                </div>
              </div>

              <div class="double-list">
                <div>
                  <h4>共同新增</h4>
                  <ul class="overlap-list compact">
                    <li v-for="item in overlap?.共同新增?.slice(0, 6) ?? []" :key="`a-${item.code}`">
                      <strong>{{ item.name }}</strong>
                      <span>{{ item.code }}</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4>共同剔除</h4>
                  <ul class="overlap-list compact">
                    <li v-for="item in overlap?.共同剔除?.slice(0, 6) ?? []" :key="`r-${item.code}`">
                      <strong>{{ item.name }}</strong>
                      <span>{{ item.code }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </article>

            <article class="panel table-panel">
              <div class="section-head">
                <div>
                  <p class="panel-label">共同加碼 / 減碼</p>
                  <h3>調整方向重疊</h3>
                </div>
              </div>

              <div class="double-list">
                <div>
                  <h4>共同加碼</h4>
                  <ul class="overlap-list compact">
                    <li v-for="item in overlap?.共同加碼?.slice(0, 6) ?? []" :key="`i-${item.code}`">
                      <strong>{{ item.name }}</strong>
                      <span>{{ item.code }}</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4>共同減碼</h4>
                  <ul class="overlap-list compact">
                    <li v-for="item in overlap?.共同減碼?.slice(0, 6) ?? []" :key="`d-${item.code}`">
                      <strong>{{ item.name }}</strong>
                      <span>{{ item.code }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="four-column">
          <article class="sub-panel">
            <div class="sub-panel-head">
              <h4>不重複新增</h4>
              <span>單一 ETF 才出現</span>
            </div>
            <ul class="quote-list compact">
              <li v-for="item in overlap?.不重複異動?.新增?.slice(0, 8) ?? []" :key="`ua-${item.code}-${item.etfCode}`">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.code }}</span>
                </div>
                <div class="quote-meta stacked">
                  <span>{{ item.etfCode }}</span>
                  <span>{{ 格式化比重差(item.weightDelta) }}</span>
                </div>
              </li>
            </ul>
          </article>

          <article class="sub-panel">
            <div class="sub-panel-head">
              <h4>不重複剔除</h4>
              <span>單一 ETF 特有賣出</span>
            </div>
            <ul class="quote-list compact">
              <li v-for="item in overlap?.不重複異動?.剔除?.slice(0, 8) ?? []" :key="`ur-${item.code}-${item.etfCode}`">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.code }}</span>
                </div>
                <div class="quote-meta stacked">
                  <span>{{ item.etfCode }}</span>
                  <span>{{ 格式化比重差(item.weightDelta) }}</span>
                </div>
              </li>
            </ul>
          </article>

          <article class="sub-panel">
            <div class="sub-panel-head">
              <h4>不重複加碼</h4>
              <span>特色布局</span>
            </div>
            <ul class="quote-list compact">
              <li v-for="item in overlap?.不重複異動?.加碼?.slice(0, 8) ?? []" :key="`ui-${item.code}-${item.etfCode}`">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.code }}</span>
                </div>
                <div class="quote-meta stacked">
                  <span>{{ item.etfCode }}</span>
                  <span>{{ 格式化比重差(item.weightDelta) }}</span>
                </div>
              </li>
            </ul>
          </article>

          <article class="sub-panel">
            <div class="sub-panel-head">
              <h4>不重複減碼</h4>
              <span>特色調節</span>
            </div>
            <ul class="quote-list compact">
              <li v-for="item in overlap?.不重複異動?.減碼?.slice(0, 8) ?? []" :key="`ud-${item.code}-${item.etfCode}`">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.code }}</span>
                </div>
                <div class="quote-meta stacked">
                  <span>{{ item.etfCode }}</span>
                  <span>{{ 格式化比重差(item.weightDelta) }}</span>
                </div>
              </li>
            </ul>
          </article>
        </section>
      </main>

      <main v-else class="page-grid">
        <section class="panel search-panel">
          <div class="section-head">
            <div>
              <p class="panel-label">個別 ETF 成分</p>
              <h3>23 檔主動式 ETF 名單</h3>
            </div>
            <input
              v-model="ETF搜尋字串"
              class="search-input"
              type="search"
              placeholder="搜尋代號、名稱或投信公司"
            />
          </div>

          <div class="etf-grid">
            <button
              v-for="item in 搜尋後ETF清單"
              :key="item.code"
              type="button"
              :class="['etf-card', { active: selectedCode === item.code }]"
              @click="selectedCode = item.code"
            >
              <div class="card-top">
                <div>
                  <strong>{{ item.code }}</strong>
                  <p>{{ item.name }}</p>
                </div>
                <span :class="['badge', 取狀態樣式(item.trackingStatus)]">{{ item.trackingStatus }}</span>
              </div>
              <p>{{ item.providerLabel }}</p>
            </button>
          </div>
        </section>

        <section class="detail-grid">
          <article class="panel detail-panel">
            <div class="section-head">
              <div>
                <p class="panel-label">ETF 明細</p>
                <h3>{{ selectedMeta?.fullName ?? '請先選擇 ETF' }}</h3>
              </div>
              <span>{{ selectedMeta?.code ?? '-' }}</span>
            </div>

            <div v-if="ETF載入中" class="empty-block">
              <strong>正在讀取 ETF 成分資料...</strong>
            </div>

            <div v-else-if="!selectedMeta" class="empty-block">
              <strong>請先從上方選擇一檔 ETF</strong>
            </div>

            <div v-else-if="selectedMeta.trackingStatus !== '已串接'" class="empty-block">
              <strong>{{ selectedMeta.name }} 尚未串接持股來源</strong>
              <p>{{ ETF訊息 }}</p>
              <a :href="selectedMeta.sourceUrl" target="_blank" rel="noreferrer">前往官方商品頁</a>
            </div>

            <template v-else-if="snapshot">
              <section class="card-grid compact-grid">
                <article class="panel stat-panel slim-panel">
                  <p class="panel-label">揭露日期</p>
                  <strong>{{ 格式化日期(snapshot.disclosureDate) }}</strong>
                </article>
                <article class="panel stat-panel slim-panel">
                  <p class="panel-label">基金淨值</p>
                  <strong>{{ snapshot.nav == null ? '-' : snapshot.nav.toFixed(2) }}</strong>
                </article>
                <article class="panel stat-panel slim-panel">
                  <p class="panel-label">基金規模</p>
                  <strong>{{ 格式化金額(snapshot.aum) }}</strong>
                </article>
                <article class="panel stat-panel slim-panel">
                  <p class="panel-label">持股檔數</p>
                  <strong>{{ 格式化數字(snapshot.holdingsCount) }}</strong>
                </article>
              </section>

              <section class="four-column">
                <article v-for="section in diffSections" :key="section.key" class="sub-panel">
                  <div class="sub-panel-head">
                    <h4>{{ section.title }}</h4>
                    <span>{{ section.items.length }} 檔</span>
                  </div>
                  <ul class="quote-list compact">
                    <li v-for="item in section.items.slice(0, 8)" :key="`${section.key}-${item.code}`">
                      <div>
                        <strong>{{ item.name }}</strong>
                        <span>{{ item.code }}</span>
                      </div>
                      <div class="quote-meta stacked">
                        <span>{{ 格式化差額(item.sharesDelta) }}</span>
                        <span>{{ 格式化比重差(item.weightDelta) }}</span>
                      </div>
                    </li>
                  </ul>
                </article>
              </section>

              <section class="panel inner-table-panel">
                <div class="section-head">
                  <div>
                    <p class="panel-label">最新持股</p>
                    <h4>成分表</h4>
                  </div>
                  <span>依權重排序</span>
                </div>

                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>代號</th>
                        <th>名稱</th>
                        <th>股數</th>
                        <th>權重</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in snapshot.holdings" :key="item.code">
                        <td>{{ item.code }}</td>
                        <td>{{ item.name }}</td>
                        <td>{{ 格式化數字(item.shares) }}</td>
                        <td>{{ item.weight == null ? '-' : 格式化百分比(item.weight, 2) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </template>

            <div v-else class="empty-block">
              <strong>暫時沒有 ETF 明細資料</strong>
              <p>{{ ETF訊息 || '請稍後再試。' }}</p>
            </div>
          </article>

          <aside class="panel side-panel">
            <div class="side-card">
              <p class="panel-label">追蹤狀態</p>
              <strong>{{ selectedMeta?.name ?? '-' }}</strong>
              <p>{{ selectedOverview?.trackingMessage ?? ETF訊息 ?? '尚未選擇 ETF' }}</p>
            </div>

            <div class="side-card">
              <p class="panel-label">官方來源</p>
              <strong>{{ selectedMeta?.sourceName ?? '-' }}</strong>
              <a v-if="selectedMeta?.sourceUrl" :href="selectedMeta.sourceUrl" target="_blank" rel="noreferrer">
                開啟官方資料頁
              </a>
            </div>

            <div class="side-card">
              <p class="panel-label">異動摘要</p>
              <dl class="summary-list">
                <div>
                  <dt>新增</dt>
                  <dd>{{ selectedOverview?.changeSummary?.addedCount ?? 0 }}</dd>
                </div>
                <div>
                  <dt>剔除</dt>
                  <dd>{{ selectedOverview?.changeSummary?.removedCount ?? 0 }}</dd>
                </div>
                <div>
                  <dt>加碼</dt>
                  <dd>{{ selectedOverview?.changeSummary?.increasedCount ?? 0 }}</dd>
                </div>
                <div>
                  <dt>減碼</dt>
                  <dd>{{ selectedOverview?.changeSummary?.decreasedCount ?? 0 }}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </section>
      </main>
    </template>
  </div>
</template>
