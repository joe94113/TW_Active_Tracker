<script setup>
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useSeoMeta } from '../composables/useSeoMeta';

const quickStartCards = [
  {
    title: '先看市場方向',
    body: '先確認大盤是偏多、震盪還是轉弱，再決定今天要找強勢追蹤股，還是先偏保守等待。',
  },
  {
    title: '再看主線題材',
    body: '主線題材代表資金正在集中。題材熱、成交值放大、法人同步加碼，通常比單看技術面更有延續性。',
  },
  {
    title: '最後才選個股',
    body: '把題材、技術、籌碼、事件一起對過一次，勝率通常會比只看一個指標更高。',
  },
];

const researchSteps = [
  {
    step: '01',
    title: '先看大盤與情緒',
    body: '先確認加權指數位置、成交值、上漲家數和熱門股表現。大盤偏多時，突破股比較容易延續；大盤轉弱時，追價容易被洗。',
    checks: ['加權是站上月線還是跌破月線', '成交值有沒有比近五日均量放大', '市場是普漲還是只剩少數族群撐盤'],
  },
  {
    step: '02',
    title: '找主線題材',
    body: '看題材雷達哪幾個題材正在升溫，再去看裡面的龍頭股和補漲股。先有題材，再找個股，通常會比亂槍打鳥更有效。',
    checks: ['題材近 5 / 10 / 20 日是否升溫', '新聞與成交值是否同步放大', '題材內是否有龍頭帶動補漲'],
  },
  {
    step: '03',
    title: '確認技術與籌碼',
    body: '個股至少要確認趨勢、量價、法人籌碼三件事。技術面在轉強，但籌碼面完全不支持，通常容易只是一日行情。',
    checks: ['股價是否站上 5 日、10 日、20 日線', '量縮整理後是否開始放量', '外資 / 投信近期是否偏多'],
  },
  {
    step: '04',
    title: '最後看風險與催化',
    body: '進場前要再看一次事件和風險。像法說、月營收、注意股、處置股、除權息，這些都會影響隔日節奏。',
    checks: ['有沒有法說、月營收、財報等事件', '是否為注意股或處置股', '停損點設在哪裡、錯了怎麼退'],
  },
];

const chartExamples = [
  {
    title: '量縮價漲',
    subtitle: '股價慢慢墊高，但量越來越縮',
    summary: '這通常代表賣壓不重，願意賣的人變少，股價在比較輕的籌碼結構下慢慢墊高。',
    tags: ['趨勢延續', '觀察補量'],
    linePoints: [42, 44, 45, 47, 48, 50, 52, 54],
    volumePoints: [88, 82, 76, 72, 64, 58, 54, 50],
    note: '如果後面再補一根量價齊揚，常常就會進入加速段。',
  },
  {
    title: '盤整待突破',
    subtitle: '高檔橫盤，波動變小',
    summary: '整理時間拉長、上下波動收斂，代表多空都在等方向。真正有用的訊號通常是突破時同步放量。',
    tags: ['收斂整理', '等突破'],
    linePoints: [60, 62, 61, 63, 62, 63, 64, 69],
    volumePoints: [70, 62, 58, 50, 42, 38, 36, 94],
    note: '最後一段若突破整理區上緣且量放大，會比盤中亂追更有依據。',
  },
  {
    title: '五日線重新站上十日線',
    subtitle: '短線動能開始回溫',
    summary: '這常出現在修正後第一波轉強階段。若同時站回月線，代表短中期趨勢都在改善。',
    tags: ['均線轉強', '短線轉折'],
    linePoints: [58, 56, 54, 55, 57, 60, 62, 64],
    volumePoints: [56, 52, 48, 50, 58, 66, 72, 70],
    movingAveragePoints: [59, 58, 57, 56, 56, 57, 59, 61],
    note: '均線翻揚時若又有法人回補，常會從反彈變成趨勢段。',
  },
  {
    title: '爆量長黑先不要硬接',
    subtitle: '量大但價格失守',
    summary: '這種不是強勢，而是籌碼快速鬆動。真正要等的是止跌、量縮，或重新站回關鍵均線之後。',
    tags: ['風險示範', '先等止穩'],
    linePoints: [74, 76, 75, 77, 69, 67, 66, 68],
    volumePoints: [44, 46, 42, 48, 98, 82, 60, 55],
    note: '爆量長黑之後立刻搶反彈，勝率通常不高，先等結構修好再說。',
  },
  {
    title: '支撐回測守住',
    subtitle: '拉回到關鍵區，量縮後止穩',
    summary: '很多強勢股不是一路直線上去，而是上漲後回測支撐，再決定是否續攻。回測時量縮、止跌，通常比高檔追價舒服。',
    tags: ['支撐回測', '等止穩'],
    linePoints: [48, 54, 58, 62, 60, 57, 58, 64],
    volumePoints: [62, 70, 78, 84, 60, 48, 44, 82],
    note: '真正有用的支撐不是畫線而已，而是跌到附近時賣壓有沒有縮、買盤有沒有接。',
  },
  {
    title: '假突破跌回整理區',
    subtitle: '突破後沒有量能承接',
    summary: '很多新手最容易追在這裡。股價看起來突破了，但量能不夠或隔天撐不住，很快就跌回原本整理區。',
    tags: ['假突破', '追高風險'],
    linePoints: [52, 54, 55, 56, 58, 61, 57, 55],
    volumePoints: [40, 38, 36, 34, 46, 68, 56, 48],
    note: '看到突破不要急著衝，先確認量有沒有跟上、收盤有沒有站穩區間上緣。',
  },
];

const technicalCards = [
  {
    title: 'RSI 是什麼',
    body: 'RSI 是相對強弱指標，常用來觀察短線漲跌的熱度。不是只要看到 70 就賣、看到 30 就買，而是看它和趨勢方向有沒有一致。',
    takeaway: '強勢股的 RSI 常常會在 50 以上震盪；弱勢股的 RSI 則常卡在 50 以下。',
  },
  {
    title: 'MACD 怎麼看',
    body: 'MACD 常用來看趨勢是否正在加速或減速。柱狀體翻正，通常代表短線動能在轉強；柱狀體縮短，代表攻擊力道開始降溫。',
    takeaway: 'MACD 最好搭配均線和量價一起看，單獨使用很容易太慢。',
  },
  {
    title: '五日線、十日線、月線',
    body: '五日線看短線節奏，十日線看短波段慣性，月線常被拿來看一檔股票是不是仍在健康趨勢內。',
    takeaway: '新手最實用的看法不是背數字，而是看股價目前站在哪幾條線之上。',
  },
  {
    title: '量縮價漲代表什麼',
    body: '常見於強勢整理或慢慢墊高。意思不是市場很熱，而是賣壓不大，股價在比較乾淨的籌碼下向上推進。',
    takeaway: '後續如果能補量上攻，通常比一開始就爆量更健康。',
  },
  {
    title: '爆量突破代表什麼',
    body: '如果股價突破前高或整理區上緣，成交量又同步放大，通常代表新的買盤願意在更高價格承接。',
    takeaway: '要注意是不是有效突破，隔天若立刻跌回整理區，就要小心是假突破。',
  },
  {
    title: '內外盤怎麼看',
    body: '外盤代表主動買進成交，內盤代表主動賣出成交。外盤大於內盤不一定就會漲，但可用來輔助判斷盤中攻擊力道。',
    takeaway: '真正有意義的是外盤強、股價也往上，量價要同方向。',
  },
];

const chipCards = [
  {
    title: '外資與投信連買',
    body: '當外資和投信都在買，而且買超不是只出現一天，通常比單一法人買超更有參考價值。',
    takeaway: '雙法人偏多常適合列入穩健型觀察名單。',
  },
  {
    title: '成交值的重要性',
    body: '成交值反映資金有沒有真的進來。只看漲跌幅容易被小型股騙線，搭配成交值更能看出市場是不是認真。',
    takeaway: '題材有熱度但沒有成交值，延續性通常比較差。',
  },
  {
    title: '融資與借券',
    body: '融資代表散戶資金，借券常被拿來觀察偏空壓力。股價創高但融資暴衝太快，反而要留意過熱風險。',
    takeaway: '好股票也會震盪，籌碼乾淨比短線一根長紅更重要。',
  },
  {
    title: '處置與注意股',
    body: '被列注意股或處置股，會改變撮合節奏與短線資金習慣。這不一定代表壞公司，但代表隔日波動可能更劇烈。',
    takeaway: '新手若還不熟悉節奏，處置股先少碰會更穩。',
  },
];

const fundamentalCards = [
  {
    title: '月營收要看什麼',
    body: '不是只看單月年增率，而是看最近 3 個月有沒有連續轉強、是否優於市場原本預期。',
    takeaway: '年增由負轉正、月增連續走強，通常比單月突然暴衝更有延續性。',
  },
  {
    title: 'EPS 與獲利趨勢',
    body: '單季 EPS 好不一定夠，要看近四季趨勢是否往上，還有毛利率、營益率有沒有同步改善。',
    takeaway: '營收增、毛利率也增，通常比只有營收增更值得追蹤。',
  },
  {
    title: '殖利率與估值',
    body: '高殖利率不代表一定安全，但能提供下檔參考。估值過高時，要更依賴題材與資金動能支撐。',
    takeaway: '便宜不一定會漲，但太貴又沒成長，通常更容易出現修正。',
  },
  {
    title: '法說與財報怎麼用',
    body: '法說和財報不是看數字而已，而是看市場怎麼解讀。公司講法比預期更樂觀，常會帶來評價調整。',
    takeaway: '同一份財報，數字普通但展望變好，股價也可能照樣漲。',
  },
];

const riskCards = [
  {
    title: '支撐壓力怎麼設',
    body: '支撐常看前低、月線、整理區下緣；壓力常看前高、套牢區、整理區上緣。不是精準一條線，而是區間。',
    takeaway: '先畫出大概區間，再看價格接近時量價如何反應，比只背數字更有用。',
  },
  {
    title: '停損不是承認失敗',
    body: '停損是保護本金。進場前就先想好錯了怎麼退，比跌下去才決定要不要賣重要很多。',
    takeaway: '如果原本買進的理由消失了，就該退，不要把短打硬抱成長投資。',
  },
  {
    title: '資金配置怎麼抓',
    body: '新手不要一檔壓滿。可以先把資金分成觀察、試單、確認三段，讓自己有修正空間。',
    takeaway: '比起一次重押，分批建立部位更容易活下來。',
  },
  {
    title: '什麼時候先不要碰',
    body: '大盤弱、題材退燒、股價遠離均線、處置剛開始、或爆量長黑破位時，通常都不適合硬接。',
    takeaway: '市場每天都有機會，最重要的是先避開明顯不划算的地方。',
  },
];

const mistakeCards = [
  {
    title: '只看一根長紅就追',
    body: '單日大漲很吸引人，但沒有題材、量能、法人支持的長紅，常常只是隔日沖高回落。',
  },
  {
    title: '把技術指標當聖杯',
    body: 'RSI、MACD、KD 都只是輔助，不是按下去就會贏的按鈕。要和趨勢、量價一起看。',
  },
  {
    title: '跌很多就覺得便宜',
    body: '很多股票不是跌深就會反彈，而是基本面或題材真的轉弱。先看為什麼跌，再想要不要撿。',
  },
  {
    title: '沒有交易計畫',
    body: '進場前不知道為何買、漲到哪邊要先收、錯了怎麼退，最後通常只能靠情緒決定。',
  },
];

const futuresCards = [
  {
    title: '期貨是什麼',
    body: '期貨是對未來價格做多空押注的工具。台指期反映市場對指數的預期，也常被拿來觀察隔日開盤情緒。',
  },
  {
    title: '微台指是什麼',
    body: '微台指是台指期的小型版本，保證金與波動金額都更小。對新手來說，它更像是用來學習市場節奏，而不是一開始就重押的工具。',
  },
  {
    title: '未平倉怎麼看',
    body: '外資、自營商的未平倉方向，可用來看大戶目前偏多還是偏空。若期貨偏多、現貨題材也轉強，通常更容易形成順風盤。',
  },
  {
    title: '小台與微台差在哪',
    body: '兩者看的是同一個方向，但小台更接近一般短線交易者的節奏，微台更適合拿來觀察情緒與學習。',
  },
];

const playbookCards = [
  {
    title: '盤前 5 分鐘',
    body: '先看美股、台指夜盤、昨天主線題材和今天可能有事件的股票，把可能關注的名單先縮小。',
  },
  {
    title: '盤中 10 分鐘',
    body: '看主線題材有沒有續強、熱門股是不是有量、外盤強不強。盤中先判斷今天是趨勢盤還是震盪盤。',
  },
  {
    title: '盤後 10 分鐘',
    body: '重新看一次選股雷達、題材輪動、雙法人偏多與風險提醒，為明天留下 3 到 5 檔追蹤名單。',
  },
];

const quizQuestions = [
  {
    prompt: '一檔股票量縮價漲、股價站上月線，最合理的初步判斷是什麼？',
    choices: [
      '代表股價一定會連續大漲，可以直接重押',
      '代表賣壓不重，若後續補量上攻，值得繼續追蹤',
      '代表主力正在出貨，應該立刻放空',
    ],
    answerIndex: 1,
    explanation: '量縮價漲通常偏向健康整理或慢慢墊高，但是否真的會攻，還要看後續量能和題材有沒有跟上。',
  },
  {
    prompt: '如果外資連買、投信也連買，但股價還沒有突破整理區，你比較應該怎麼做？',
    choices: [
      '先放進追蹤名單，等突破或量能轉強再考慮',
      '立刻梭哈，因為雙法人買超一定會漲',
      '完全忽略，因為技術面沒用',
    ],
    answerIndex: 0,
    explanation: '雙法人偏多是加分，但真正的進場節奏，還是最好等價格結構和量能一起確認。',
  },
  {
    prompt: '看到爆量長黑、跌破月線時，新手最適合的做法是什麼？',
    choices: [
      '馬上搶反彈，因為跌多一定會彈',
      '先等止跌、量縮、重新站回關鍵均線，再看是不是有修復',
      '繼續攤平，拉低成本就好',
    ],
    answerIndex: 1,
    explanation: '爆量長黑常代表結構鬆動，不是便宜。先等賣壓釋放完，再評估是否重回安全區比較穩。',
  },
];

const chartPracticeExamples = [
  {
    title: '練習題 A',
    subtitle: '整理區末端放量突破',
    linePoints: [52, 53, 52, 54, 53, 55, 56, 62],
    volumePoints: [38, 36, 34, 32, 34, 36, 44, 86],
    prompt: '這張圖最合理的解讀是？',
    choices: [
      '只是普通震盪，沒有觀察價值',
      '整理末端帶量突破，值得列入短線轉強觀察',
      '明顯轉空，應該直接避開',
    ],
    answerIndex: 1,
    explanation: '股價整理後向上突破，同時最後一段量能明顯放大，這通常是比較健康的轉強訊號。',
  },
  {
    title: '練習題 B',
    subtitle: '跌破支撐後沒有買盤接回',
    linePoints: [68, 70, 69, 67, 63, 60, 58, 57],
    volumePoints: [34, 36, 38, 42, 80, 72, 58, 50],
    prompt: '面對這種圖形，新手比較適合？',
    choices: [
      '先避開，等止穩訊號再回來看',
      '馬上買，因為跌深就是便宜',
      '忽略量能，只看 RSI 就好',
    ],
    answerIndex: 0,
    explanation: '跌破支撐後量放大、價格又沒有快速收回，通常先觀望比硬接更合理。',
  },
];

const glossaryRows = [
  ['RSI', '短線強弱熱度指標，常用來看股票是不是太熱或正在轉強。'],
  ['MACD', '趨勢動能指標，適合看股價是在加速、放緩，還是剛要翻多。'],
  ['月線', '20 日均線，常被拿來看股票中期趨勢是否仍健康。'],
  ['爆量', '成交量明顯高於平常，代表市場資金突然明顯集中。'],
  ['量縮', '成交量低於近期平均，常出現在整理、等待方向的階段。'],
  ['內盤 / 外盤', '主動賣出成交 / 主動買進成交，用來輔助判斷盤中攻擊力道。'],
  ['未平倉', '期貨部位還沒有平倉的總量，可用來觀察法人方向。'],
  ['補漲股', '同題材裡還沒大漲、但開始有跟上的股票。'],
  ['龍頭股', '題材內最先動、成交值最大、最能帶動市場注意力的股票。'],
  ['假突破', '股價突破後很快跌回整理區，代表追價買盤不足。'],
];

const quizSelections = ref(Array(quizQuestions.length).fill(null));
const quizRevealed = ref(Array(quizQuestions.length).fill(false));
const chartPracticeSelections = ref(Array(chartPracticeExamples.length).fill(null));
const chartPracticeRevealed = ref(Array(chartPracticeExamples.length).fill(false));

const pageSeo = computed(() => ({
  title: '股票小教室',
  description: '用簡單易懂的方式理解技術分析、量價、籌碼、期貨與微台指，建立新手友善的研究流程。',
  routePath: '/classroom',
  keywords: ['股票小教室', 'RSI 教學', '量縮價漲', '內外盤', '微台指', '期貨教學'],
}));

function createLinePath(points, xStart = 30, xEnd = 290, yTop = 24, yBottom = 112) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const step = points.length > 1 ? (xEnd - xStart) / (points.length - 1) : 0;

  return points
    .map((point, index) => {
      const x = xStart + step * index;
      const y = yBottom - ((point - min) / span) * (yBottom - yTop);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function createVolumeRects(points, xStart = 34, xEnd = 286, yBottom = 160, barHeight = 48) {
  const max = Math.max(...points, 1);
  const width = (xEnd - xStart) / points.length;

  return points.map((point, index) => {
    const height = (point / max) * barHeight;
    return {
      x: xStart + width * index,
      y: yBottom - height,
      width: Math.max(width - 8, 12),
      height,
    };
  });
}

const chartCards = computed(() =>
  chartExamples.map((item) => ({
    ...item,
    linePath: createLinePath(item.linePoints),
    movingAveragePath: item.movingAveragePoints ? createLinePath(item.movingAveragePoints) : null,
    volumeRects: createVolumeRects(item.volumePoints),
  })),
);

const chartPracticeCards = computed(() =>
  chartPracticeExamples.map((item) => ({
    ...item,
    linePath: createLinePath(item.linePoints),
    volumeRects: createVolumeRects(item.volumePoints),
  })),
);

function selectQuizAnswer(index, choiceIndex) {
  quizSelections.value[index] = choiceIndex;
}

function revealQuizAnswer(index) {
  quizRevealed.value[index] = true;
}

function selectChartPracticeAnswer(index, choiceIndex) {
  chartPracticeSelections.value[index] = choiceIndex;
}

function revealChartPracticeAnswer(index) {
  chartPracticeRevealed.value[index] = true;
}

useSeoMeta(pageSeo);
</script>

<template>
  <section class="page-shell classroom-page">
    <section class="page-hero compact classroom-page-hero">
      <div class="hero-copy">
        <span class="hero-kicker">Beginner Guide</span>
        <h1>股票小教室</h1>
        <p>
          把新手最常遇到的問題整理成一頁：先怎麼看盤、RSI 是什麼、量縮價漲代表什麼、
          內外盤怎麼看、五日線十日線怎麼用、期貨和微台指在看什麼。
        </p>
        <div class="theme-radar-summary">
          <span class="theme-observation-chip">技術面</span>
          <span class="theme-observation-chip">量價與籌碼</span>
          <span class="theme-observation-chip">期貨入門</span>
          <span class="theme-observation-chip">研究流程</span>
        </div>
      </div>

      <aside class="theme-hero-board classroom-hero-board">
        <div class="theme-spotlight-grid classroom-quick-grid">
          <article
            v-for="card in quickStartCards"
            :key="card.title"
            class="theme-spotlight-card is-info classroom-quick-card"
          >
            <span class="theme-spotlight-label">{{ card.title }}</span>
            <p>{{ card.body }}</p>
          </article>
        </div>
      </aside>
    </section>

    <nav class="mobile-section-nav classroom-nav" aria-label="股票小教室段落導覽">
      <a class="section-chip" href="#classroom-steps">研究順序</a>
      <a class="section-chip" href="#classroom-charts">實戰圖表</a>
      <a class="section-chip" href="#classroom-quiz">小測驗</a>
      <a class="section-chip" href="#classroom-chart-practice">看圖練習</a>
      <a class="section-chip" href="#classroom-technical">技術面</a>
      <a class="section-chip" href="#classroom-fundamental">基本面</a>
      <a class="section-chip" href="#classroom-chip">籌碼面</a>
      <a class="section-chip" href="#classroom-risk">風控</a>
      <a class="section-chip" href="#classroom-futures">期貨</a>
      <a class="section-chip" href="#classroom-glossary">名詞速查</a>
    </nav>

    <section id="classroom-steps" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">新手研究順序</h2>
          <p class="panel-subtitle">先從整體市場開始，再一路縮小到題材、個股與風險。</p>
        </div>
      </div>

      <div class="classroom-step-grid">
        <article v-for="item in researchSteps" :key="item.step" class="classroom-step-card">
          <div class="classroom-step-head">
            <span class="classroom-step-index">STEP {{ item.step }}</span>
            <strong>{{ item.title }}</strong>
          </div>
          <p>{{ item.body }}</p>
          <ul class="classroom-checklist">
            <li v-for="check in item.checks" :key="check">{{ check }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section id="classroom-charts" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">實戰圖表教學</h2>
          <p class="panel-subtitle">用示意圖直接教你看懂常見型態，先理解畫面，再套到真實股票。</p>
        </div>
      </div>

      <div class="classroom-chart-grid">
        <article v-for="item in chartCards" :key="item.title" class="sub-panel classroom-chart-card">
          <div class="classroom-chart-head">
            <div>
              <h3 class="panel-title small">{{ item.title }}</h3>
              <p class="panel-subtitle">{{ item.subtitle }}</p>
            </div>
            <div class="classroom-chart-tags">
              <span v-for="tag in item.tags" :key="tag" class="theme-observation-chip">{{ tag }}</span>
            </div>
          </div>

          <div class="classroom-chart-frame">
            <svg viewBox="0 0 320 180" class="classroom-chart-svg" role="img" :aria-label="item.title">
              <g class="classroom-chart-gridlines">
                <line x1="26" y1="32" x2="294" y2="32" />
                <line x1="26" y1="60" x2="294" y2="60" />
                <line x1="26" y1="88" x2="294" y2="88" />
                <line x1="26" y1="116" x2="294" y2="116" />
                <line x1="26" y1="140" x2="294" y2="140" />
              </g>

              <g class="classroom-chart-volume">
                <rect
                  v-for="(bar, index) in item.volumeRects"
                  :key="`${item.title}-bar-${index}`"
                  :x="bar.x"
                  :y="bar.y"
                  :width="bar.width"
                  :height="bar.height"
                  rx="3"
                />
              </g>

              <path v-if="item.movingAveragePath" :d="item.movingAveragePath" class="classroom-chart-ma" />
              <path :d="item.linePath" class="classroom-chart-line" />
              <circle cx="290" cy="40" r="4.5" class="classroom-chart-dot" />
            </svg>
          </div>

          <p>{{ item.summary }}</p>
          <p class="classroom-takeaway">{{ item.note }}</p>
        </article>
      </div>
    </section>

    <section id="classroom-quiz" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">互動式小測驗</h2>
          <p class="panel-subtitle">先用簡單題目確認觀念有沒有抓到，再往下看實戰圖形會更有感。</p>
        </div>
      </div>

      <div class="classroom-practice-grid">
        <article v-for="(item, index) in quizQuestions" :key="item.prompt" class="sub-panel classroom-practice-card">
          <div class="classroom-practice-head">
            <span class="classroom-step-index">QUIZ {{ index + 1 }}</span>
            <strong>{{ item.prompt }}</strong>
          </div>

          <div class="classroom-choice-list">
            <button
              v-for="(choice, choiceIndex) in item.choices"
              :key="choice"
              type="button"
              class="classroom-choice-button"
              :class="{
                'is-selected': quizSelections[index] === choiceIndex,
                'is-correct': quizRevealed[index] && item.answerIndex === choiceIndex,
                'is-wrong': quizRevealed[index] && quizSelections[index] === choiceIndex && item.answerIndex !== choiceIndex,
              }"
              @click="selectQuizAnswer(index, choiceIndex)"
            >
              {{ choice }}
            </button>
          </div>

          <div class="classroom-practice-actions">
            <button
              type="button"
              class="ghost-button classroom-action-button"
              :disabled="quizSelections[index] === null"
              @click="revealQuizAnswer(index)"
            >
              看答案
            </button>
          </div>

          <div v-if="quizRevealed[index]" class="classroom-answer-card">
            <strong>{{ quizSelections[index] === item.answerIndex ? '答對了' : '這題先記住重點' }}</strong>
            <p>{{ item.explanation }}</p>
          </div>
        </article>
      </div>
    </section>

    <section id="classroom-chart-practice" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">看圖判斷練習</h2>
          <p class="panel-subtitle">直接看示意圖做判斷，練習把型態、量能和動作連在一起。</p>
        </div>
      </div>

      <div class="classroom-practice-grid">
        <article
          v-for="(item, index) in chartPracticeCards"
          :key="item.title"
          class="sub-panel classroom-practice-card"
        >
          <div class="classroom-chart-head">
            <div>
              <span class="classroom-step-index">{{ item.title }}</span>
              <h3 class="panel-title small">{{ item.subtitle }}</h3>
            </div>
          </div>

          <div class="classroom-chart-frame">
            <svg viewBox="0 0 320 180" class="classroom-chart-svg" role="img" :aria-label="item.subtitle">
              <g class="classroom-chart-gridlines">
                <line x1="26" y1="32" x2="294" y2="32" />
                <line x1="26" y1="60" x2="294" y2="60" />
                <line x1="26" y1="88" x2="294" y2="88" />
                <line x1="26" y1="116" x2="294" y2="116" />
                <line x1="26" y1="140" x2="294" y2="140" />
              </g>
              <g class="classroom-chart-volume">
                <rect
                  v-for="(bar, barIndex) in item.volumeRects"
                  :key="`${item.title}-practice-bar-${barIndex}`"
                  :x="bar.x"
                  :y="bar.y"
                  :width="bar.width"
                  :height="bar.height"
                  rx="3"
                />
              </g>
              <path :d="item.linePath" class="classroom-chart-line" />
              <circle cx="290" cy="40" r="4.5" class="classroom-chart-dot" />
            </svg>
          </div>

          <strong class="classroom-practice-question">{{ item.prompt }}</strong>

          <div class="classroom-choice-list">
            <button
              v-for="(choice, choiceIndex) in item.choices"
              :key="choice"
              type="button"
              class="classroom-choice-button"
              :class="{
                'is-selected': chartPracticeSelections[index] === choiceIndex,
                'is-correct': chartPracticeRevealed[index] && item.answerIndex === choiceIndex,
                'is-wrong': chartPracticeRevealed[index] && chartPracticeSelections[index] === choiceIndex && item.answerIndex !== choiceIndex,
              }"
              @click="selectChartPracticeAnswer(index, choiceIndex)"
            >
              {{ choice }}
            </button>
          </div>

          <div class="classroom-practice-actions">
            <button
              type="button"
              class="ghost-button classroom-action-button"
              :disabled="chartPracticeSelections[index] === null"
              @click="revealChartPracticeAnswer(index)"
            >
              看解析
            </button>
          </div>

          <div v-if="chartPracticeRevealed[index]" class="classroom-answer-card">
            <strong>{{ chartPracticeSelections[index] === item.answerIndex ? '方向抓對了' : '這張圖的重點在這裡' }}</strong>
            <p>{{ item.explanation }}</p>
          </div>
        </article>
      </div>
    </section>

    <section id="classroom-technical" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">技術面怎麼看</h2>
          <p class="panel-subtitle">先看趨勢，再看動能，最後才看是不是有量能與籌碼支持。</p>
        </div>
      </div>

      <div class="classroom-card-grid">
        <article v-for="item in technicalCards" :key="item.title" class="sub-panel classroom-card">
          <h3 class="panel-title small">{{ item.title }}</h3>
          <p>{{ item.body }}</p>
          <p class="classroom-takeaway">{{ item.takeaway }}</p>
        </article>
      </div>
    </section>

    <section id="classroom-fundamental" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">基本面怎麼看</h2>
          <p class="panel-subtitle">題材和技術在前面，基本面決定一檔股票能不能走得更長、更穩。</p>
        </div>
      </div>

      <div class="classroom-card-grid">
        <article v-for="item in fundamentalCards" :key="item.title" class="sub-panel classroom-card">
          <h3 class="panel-title small">{{ item.title }}</h3>
          <p>{{ item.body }}</p>
          <p class="classroom-takeaway">{{ item.takeaway }}</p>
        </article>
      </div>
    </section>

    <section id="classroom-chip" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">量價與籌碼面</h2>
          <p class="panel-subtitle">技術面是畫面，籌碼面則是在看這個畫面後面到底有沒有資金支持。</p>
        </div>
      </div>

      <div class="classroom-card-grid">
        <article v-for="item in chipCards" :key="item.title" class="sub-panel classroom-card">
          <h3 class="panel-title small">{{ item.title }}</h3>
          <p>{{ item.body }}</p>
          <p class="classroom-takeaway">{{ item.takeaway }}</p>
        </article>
      </div>
    </section>

    <section id="classroom-risk" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">支撐壓力與風險控管</h2>
          <p class="panel-subtitle">會看標的不夠，還要知道什麼地方適合等、什麼地方應該避開。</p>
        </div>
      </div>

      <div class="classroom-card-grid">
        <article v-for="item in riskCards" :key="item.title" class="sub-panel classroom-card">
          <h3 class="panel-title small">{{ item.title }}</h3>
          <p>{{ item.body }}</p>
          <p class="classroom-takeaway">{{ item.takeaway }}</p>
        </article>
      </div>
    </section>

    <section id="classroom-futures" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">期貨 / 微台指入門</h2>
          <p class="panel-subtitle">不一定要交易期貨，但要知道期貨在市場情緒上扮演什麼角色。</p>
        </div>
      </div>

      <div class="classroom-card-grid">
        <article v-for="item in futuresCards" :key="item.title" class="sub-panel classroom-card">
          <h3 class="panel-title small">{{ item.title }}</h3>
          <p>{{ item.body }}</p>
        </article>
      </div>
    </section>

    <section id="classroom-playbook" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">看盤實戰節奏</h2>
          <p class="panel-subtitle">把看盤切成盤前、盤中、盤後三段，新手會比整天盯盤更有效率。</p>
        </div>
      </div>

      <div class="dual-grid classroom-playbook-grid">
        <article v-for="item in playbookCards" :key="item.title" class="sub-panel classroom-playbook-card">
          <h3 class="panel-title small">{{ item.title }}</h3>
          <p>{{ item.body }}</p>
        </article>
      </div>
    </section>

    <section class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">新手最常犯的錯</h2>
          <p class="panel-subtitle">很多虧損不是看不懂，而是太快、太急、沒有先把節奏想清楚。</p>
        </div>
      </div>

      <div class="classroom-card-grid">
        <article v-for="item in mistakeCards" :key="item.title" class="sub-panel classroom-card">
          <h3 class="panel-title small">{{ item.title }}</h3>
          <p>{{ item.body }}</p>
        </article>
      </div>
    </section>

    <section id="classroom-glossary" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">常見名詞速查</h2>
          <p class="panel-subtitle">遇到不熟的詞先查一下，很快就能跟上市場在講什麼。</p>
        </div>
        <div class="theme-page-links">
          <RouterLink class="ghost-button" to="/radar">去看選股雷達</RouterLink>
          <RouterLink class="ghost-button" to="/themes">去看資金題材</RouterLink>
          <RouterLink class="ghost-button" to="/futures">去看期貨籌碼</RouterLink>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table classroom-glossary-table">
          <thead>
            <tr>
              <th>名詞</th>
              <th>簡單解釋</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="[term, meaning] in glossaryRows" :key="term">
              <td><strong>{{ term }}</strong></td>
              <td>{{ meaning }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
