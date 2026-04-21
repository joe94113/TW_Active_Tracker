<script setup>
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useSeoMeta } from '../composables/useSeoMeta';

const quickStartCards = [
  {
    title: '先看大盤',
    body: '先確認今天是偏多、偏空，還是震盪。大盤很弱時，個股再漂亮也容易被拖下來。',
  },
  {
    title: '再看主線題材',
    body: '先找市場資金正在看的題材，例如 CPO、PCB、AI 伺服器。主線題材裡的股票，比較容易有續航力。',
  },
  {
    title: '最後才挑個股',
    body: '同一個題材裡，再挑籌碼、技術面、基本面都比較順的股票，不要一看到漲就衝。',
  },
];

const researchSteps = [
  {
    step: '01',
    title: '先看市場氣氛',
    body: '先判斷今天資金敢不敢進場。大盤上漲家數多、成交值放大、主線題材明確，個股才比較容易有表現。',
    checks: ['大盤是偏多、偏空還是震盪', '今天主線題材是什麼', '成交值有沒有放大'],
  },
  {
    step: '02',
    title: '再看個股趨勢',
    body: '先看股價是不是站在 5 日、10 日、20 日線之上。如果連短線均線都站不穩，就先不要急著進。',
    checks: ['股價有沒有站回 5 / 10 / 20 日線', '最近高點有沒有慢慢墊高', '量價配合是不是自然'],
  },
  {
    step: '03',
    title: '搭配籌碼確認',
    body: '技術面看起來不錯後，再看外資、投信有沒有同步站在買方。如果兩邊都沒有買，勝率通常會差很多。',
    checks: ['外資近 5 日是不是買超', '投信近 5 日是不是買超', '有沒有注意股或處置風險'],
  },
  {
    step: '04',
    title: '最後才決定要不要買',
    body: '不是看起來會漲就直接追。要先想好：如果看錯，哪裡停損；如果看對，哪裡先不要再追。',
    checks: ['先找支撐，不要只看目標價', '先想停損點，再想獲利點', '短線過熱時先等，不要硬追'],
  },
];

const chartExamples = [
  {
    title: '量縮價漲',
    subtitle: '股價慢慢往上，量能反而變小',
    summary: '這通常代表賣壓不重，股價是被慢慢墊高，不是靠短線爆量亂衝。',
    tags: ['常見起漲型', '先看支撐'],
    linePoints: [42, 44, 45, 47, 48, 50, 52, 54],
    volumePoints: [88, 82, 76, 72, 64, 58, 54, 50],
    note: '如果之後補一根溫和放量紅 K，常常就是很多人會開始注意的時間點。',
  },
  {
    title: '盤整待突破',
    subtitle: '價格在小區間橫著走很久',
    summary: '這表示市場在等方向。如果最後往上帶量突破，常會出現一段短線動能。',
    tags: ['箱型整理', '等突破'],
    linePoints: [60, 62, 61, 63, 62, 63, 64, 69],
    volumePoints: [70, 62, 58, 50, 42, 38, 36, 94],
    note: '重點不是提早猜突破，而是等真的突破後，再確認量能有沒有跟上。',
  },
  {
    title: '五日線重新站回十日線',
    subtitle: '短線弱過後重新轉強',
    summary: '這種圖常見在整理後的再發動，適合拿來觀察是不是準備走第二段。',
    tags: ['均線轉強', '第二波'],
    linePoints: [58, 56, 54, 55, 57, 60, 62, 64],
    volumePoints: [56, 52, 48, 50, 58, 66, 72, 70],
    movingAveragePoints: [59, 58, 57, 56, 56, 57, 59, 61],
    note: '如果站回均線後，外資或投信也開始買，通常比單看均線更有用。',
  },
  {
    title: '爆量長黑先不要接',
    subtitle: '看起來跌很兇，但不一定是便宜',
    summary: '爆量長黑通常代表有人急著賣，短線情緒很亂。這時最怕的是你以為便宜，結果接到下一根跌。',
    tags: ['先避開', '等止穩'],
    linePoints: [74, 76, 75, 77, 69, 67, 66, 68],
    volumePoints: [44, 46, 42, 48, 98, 82, 60, 55],
    note: '先等它止穩、量縮、重新站回短線均線，再來考慮，不要看到跌就想撿。',
  },
  {
    title: '支撐回測守住',
    subtitle: '拉回不破前低，再重新走強',
    summary: '這種圖常出現在主升段中間休息。拉回時沒有破壞結構，反而是比較安全的觀察點。',
    tags: ['拉回找點', '支撐有效'],
    linePoints: [48, 54, 58, 62, 60, 57, 58, 64],
    volumePoints: [62, 70, 78, 84, 60, 48, 44, 82],
    note: '如果回測時量縮、守住支撐，再轉強，通常比追高舒服很多。',
  },
  {
    title: '假突破跌回整理區',
    subtitle: '突破了，但站不穩',
    summary: '這代表市場追價意願不夠。很多新手最容易在這裡買進，結果一買就套。',
    tags: ['假突破', '先觀察'],
    linePoints: [52, 54, 55, 56, 58, 61, 57, 55],
    volumePoints: [40, 38, 36, 34, 46, 68, 56, 48],
    note: '突破後如果很快跌回整理區，代表這次突破不夠強，先不要急著再進。',
  },
];

const quickChecklistCards = [
  {
    title: '開盤前 30 秒看什麼',
    body: '先看大盤紅黑、成交值、主線題材，再看你手上的股票是不是還在主線裡。',
  },
  {
    title: '什麼時候先不要買',
    body: '大盤弱、股價離月線太遠、RSI 已經很高、又是注意股或處置股，這種先不要追。',
  },
  {
    title: '什麼時候可以放進觀察',
    body: '量縮整理、剛站回均線、法人剛轉買、題材剛升溫，這種比較像準備要動。',
  },
];

const strategyCards = [
  {
    title: '穩健型選股',
    tag: '適合先做',
    body: '優先找雙法人偏多、站在月線之上、不是注意股，這種通常比較穩。',
    checks: ['外資或投信持續買', '股價不要離月線太遠', '不要太過熱'],
  },
  {
    title: '積極型選股',
    tag: '偏短線',
    body: '找量縮整理、剛突破、題材剛升溫的股票。重點是位置要早，不要已經漲很大一段。',
    checks: ['量縮後補量', '距前高不遠', '有主線題材加持'],
  },
  {
    title: '高息型選股',
    tag: '偏防守',
    body: '適合想穩一點的人。先看殖利率，再看配息穩定度，不要只看到殖利率高就買。',
    checks: ['配息穩不穩', '獲利有沒有維持', '股價是不是跌爛才變高殖利率'],
  },
  {
    title: '題材型選股',
    tag: '跟資金走',
    body: '先找主線題材，再挑龍頭或剛起漲的第二梯隊。題材有資金，股票才比較容易動。',
    checks: ['題材熱度有上升', '龍頭有表態', '補漲股剛開始被注意'],
  },
];

const caseStudyCards = [
  {
    title: '案例 1｜2345 智邦',
    theme: 'CPO / 矽光子',
    summary: '這種股票通常不是先從股價看，而是先從題材熱度和龍頭地位開始看。',
    steps: [
      '先看題材：如果 CPO / 矽光子是主線，智邦通常會是先被看的龍頭股。',
      '再看技術面：如果股價站穩月線，回測不破，表示主升結構還在。',
      '再看籌碼：外資持續偏多時，代表大資金還願意留在這個方向。',
      '最後看風險：如果已經連漲很多天、RSI 很高，就算看好也不要亂追。',
    ],
  },
  {
    title: '案例 2｜2376 技嘉',
    theme: 'AI 伺服器 / 高階硬體',
    summary: '這種股票常常不是最低點最好買，而是整理完再轉強時，勝率比較高。',
    steps: [
      '先看大盤和主線：AI 伺服器如果還是市場主線，題材就有續航力。',
      '再看圖：盤整很久後如果重新站回 5 日和 10 日線，通常比追長紅更舒服。',
      '再看籌碼：雙法人偏多時，會比只有單一法人買更穩。',
      '最後想停損：如果跌回整理區，表示這次轉強可能失敗，就不要硬抱。',
    ],
  },
  {
    title: '案例 3｜8150 南茂',
    theme: '封測 / 低位階補漲',
    summary: '這種股票比較像補漲觀察，不是全市場最熱，但有時反而比較適合卡位。',
    steps: [
      '先看族群：如果封測股開始有輪動，南茂這類股票就值得看。',
      '再看位置：20 日漲幅不要太誇張，代表還不算過熱。',
      '再看籌碼：如果外資和投信都開始買，這種低位階補漲股常常比較有感。',
      '最後看壓力：如果上方壓力很近，就先不要想太遠，先看能不能站穩。',
    ],
  },
];

const technicalCards = [
  {
    title: 'RSI 是什麼',
    body: 'RSI 可以想成股價最近是熱還是冷。數字高，代表最近漲很快；數字低，代表最近跌比較多。',
    takeaway: '新手先記一件事：RSI 在 50 以上通常比較偏強，70 以上常常要小心不要追太快。',
  },
  {
    title: 'MACD 是什麼',
    body: 'MACD 可以拿來看趨勢有沒有慢慢轉強。你不用背公式，只要先看柱狀體是不是由負轉正。',
    takeaway: '柱狀體剛翻正，常是趨勢開始轉好的訊號；但還是要搭配股價和量能一起看。',
  },
  {
    title: '五日線、十日線、月線怎麼看',
    body: '五日線看短線節奏，十日線看一到兩週，月線大約是 20 日線，常被拿來看中短線多空。',
    takeaway: '先記住：股價站在這些均線上面，比較像偏多；跌破很多均線時，就先保守。',
  },
  {
    title: '量縮價漲是什麼意思',
    body: '量越來越小、價格卻慢慢往上，通常代表賣的人不多，主力不用花太多力氣就能把股價墊高。',
    takeaway: '這種型態常出現在剛起漲前，但還是要等後面補量確認，不要只看一天。',
  },
  {
    title: '內盤外盤怎麼看',
    body: '你可以先把它想成主動賣和主動買。外盤比較大，通常代表市場買盤比較積極；內盤大，代表賣壓比較重。',
    takeaway: '不要只看內外盤就下單，重點是它有沒有跟股價方向一致。',
  },
  {
    title: '什麼叫追價風險',
    body: '同一檔股票如果已經連漲很多天、離月線很遠、RSI 很高，這時你再買，勝率通常會變差。',
    takeaway: '不是漲很多就不能買，而是要先分清楚它是剛開始漲，還是已經漲一大段。',
  },
];

const fundamentalCards = [
  {
    title: '月營收怎麼看',
    body: '先看年增率有沒有轉正，再看是不是連續幾個月越來越好。只看單月很容易被誤導。',
    takeaway: '新手先記：月營收是看公司最近生意有沒有變好，不是看一天會不會漲。',
  },
  {
    title: 'EPS 怎麼看',
    body: 'EPS 可以想成公司每股賺多少錢。單季 EPS 高很好，但更重要的是趨勢有沒有變好。',
    takeaway: '比起只看一季很賺，連續幾季變好通常更有參考價值。',
  },
  {
    title: '殖利率怎麼看',
    body: '殖利率高不一定代表便宜，有時只是因為股價跌很多。還是要看公司配息穩不穩。',
    takeaway: '高殖利率股適合穩健型，但不一定適合短線衝刺。',
  },
  {
    title: '外資目標價怎麼看',
    body: '目標價比較像市場參考，不是保證會到的價格。重點是看它有沒有被上修，還是開始下修。',
    takeaway: '如果現價已經很接近目標價，追價空間就會比較小。',
  },
];

const chipCards = [
  {
    title: '外資連買代表什麼',
    body: '外資連買通常代表大資金願意慢慢進場，但不表示隔天一定漲。',
    takeaway: '連買第 1 到第 3 天通常比連買第 10 天更值得注意。',
  },
  {
    title: '投信連買代表什麼',
    body: '投信常會比較集中火力在某些族群，所以連買時，族群效應常會比較明顯。',
    takeaway: '如果外資和投信一起買，通常比只有一邊買更有參考價值。',
  },
  {
    title: '融資增加怎麼看',
    body: '融資增加不一定是壞事，但如果股價已經很熱、融資又暴增，就要小心追價風險。',
    takeaway: '你可以把它理解成散戶越追越多，這時波動也常會變大。',
  },
  {
    title: '籌碼面最簡單的用法',
    body: '先看外資、投信、融資、借券這幾個方向有沒有同時支持股價。',
    takeaway: '技術面像方向盤，籌碼面像引擎，兩個一起順才比較容易走遠。',
  },
];

const riskCards = [
  {
    title: '停損怎麼設',
    body: '先找一個你看錯就該退出的位置，例如跌破支撐、跌破前低、跌破月線。',
    takeaway: '停損不是認錯，是保護你下次還有子彈。',
  },
  {
    title: '資金怎麼分配',
    body: '不要一檔股票就壓太大。新手常見做法是先分批，第一筆先小，對了再加。',
    takeaway: '你如果一次壓太重，心態通常會先崩，後面就很難照計畫做。',
  },
  {
    title: '注意股和處置股要小心',
    body: '這些股票短線可能很熱，但也常常很容易大震盪，節奏一錯就很難受。',
    takeaway: '新手如果還不熟，先避開，等你更會看節奏再碰。',
  },
  {
    title: '什麼時候最容易買在山頭',
    body: '看到新聞一堆、股價連漲很多天、聊天室都在講、自己又很怕錯過時，最容易追在高點。',
    takeaway: '越怕錯過，越要先停一下，看看它是不是其實已經漲很大一段。',
  },
];

const futuresCards = [
  {
    title: '期貨是什麼',
    body: '你可以把期貨想成用比較少的保證金，去押大盤或商品未來的漲跌方向。',
  },
  {
    title: '小台和微台是什麼',
    body: '它們都是台指期的縮小版。微台的波動更小，比較適合新手先理解節奏。',
  },
  {
    title: '為什麼要看小台、微台',
    body: '因為它們能幫你看市場情緒。法人在期貨是偏多還是偏空，對隔日盤勢常有參考價值。',
  },
  {
    title: '新手怎麼用期貨資訊',
    body: '不用急著去做期貨，先把它當成市場風向球。看它偏多還偏空，就很有幫助了。',
  },
];

const playbookCards = [
  {
    title: '今天收盤後 5 分鐘',
    body: '先看大盤、主線題材、風險股，再把 3 到 5 檔最想看的股票記下來。',
  },
  {
    title: '晚上 10 分鐘',
    body: '把候選股的技術面、籌碼面、題材面快速確認，順便找支撐與壓力。',
  },
  {
    title: '隔天開盤前',
    body: '只看昨天整理好的名單，不要一早看到別的熱門股就亂換標的。',
  },
];

const mistakeCards = [
  {
    title: '看到大漲才開始注意',
    body: '很多人是看到大漲新聞才開始看，但那時候常常已經不是最舒服的位置。',
  },
  {
    title: '只看一個指標',
    body: 'RSI、MACD、KD 都只是工具，不能單獨決定買賣，還是要看股價、量能、籌碼。',
  },
  {
    title: '跌很多就覺得便宜',
    body: '跌很深不代表跌完，重點是有沒有止穩、有沒有量縮、有沒有重新站回結構。',
  },
  {
    title: '沒有交易計畫',
    body: '如果你進場前沒想好停損和停利，盤中一緊張通常就會亂做。',
  },
];

const quizQuestions = [
  {
    prompt: '一檔股票最近量越來越小，但股價慢慢墊高，你第一個想到什麼？',
    choices: ['主力已經完全出貨了', '賣壓可能不重，之後可以等補量確認', '一定會連噴好幾天'],
    answerIndex: 1,
    explanation: '量縮價漲比較像賣壓不重，不代表隔天一定大漲。重點是後面有沒有補量轉強。',
  },
  {
    prompt: '外資連買 5 天，但股價離月線很遠、RSI 也很高，怎麼看比較合理？',
    choices: ['代表很強，但先不要急著追', '看到外資買就一定要追', '外資買超完全沒用'],
    answerIndex: 0,
    explanation: '籌碼偏多是加分，但如果短線已經過熱，還是要小心買在高點。',
  },
  {
    prompt: '盤整很久的股票，今天帶量突破前高，接下來最值得確認什麼？',
    choices: ['是不是突破後站得住', '是不是聊天室很多人在討論', '是不是一定要當天追滿'],
    answerIndex: 0,
    explanation: '突破不是看一瞬間，重點是突破後有沒有站穩、量能有沒有跟上。',
  },
  {
    prompt: '什麼情況最容易買在山頭？',
    choices: ['自己有計畫地分批買', '新聞很多、股價連漲、自己又很怕錯過時', '大盤弱的時候完全不看股票'],
    answerIndex: 1,
    explanation: '最容易買在高點的時候，通常就是情緒很熱、你又怕錯過的時候。',
  },
];

const chartPracticeExamples = [
  {
    title: '圖表練習 A',
    subtitle: '量縮後帶量突破',
    linePoints: [52, 53, 52, 54, 53, 55, 56, 62],
    volumePoints: [38, 36, 34, 32, 34, 36, 44, 86],
    prompt: '這張圖最像哪一種狀態？',
    choices: ['高檔出貨', '整理後突破', '長空反彈結束'],
    answerIndex: 1,
    explanation: '前面量縮整理，最後一根放量往上，這就是很典型的整理後突破。',
  },
  {
    title: '圖表練習 B',
    subtitle: '爆量長黑跌回區間',
    linePoints: [68, 70, 69, 67, 63, 60, 58, 57],
    volumePoints: [34, 36, 38, 42, 80, 72, 58, 50],
    prompt: '看到這張圖，哪種做法比較保守？',
    choices: ['先等止穩再說', '覺得跌深直接搶反彈', '只看 RSI 就進場'],
    answerIndex: 0,
    explanation: '爆量長黑先不要急著接，等量縮止穩後再觀察，會比直接撿刀子安全。',
  },
  {
    title: '圖表練習 C',
    subtitle: '回測支撐後再往上',
    linePoints: [46, 49, 53, 58, 55, 54, 56, 61],
    volumePoints: [40, 48, 62, 76, 52, 44, 46, 72],
    prompt: '這張圖比較適合怎麼看？',
    choices: ['跌破結構，趕快逃', '拉回守住支撐，可放進觀察', '完全沒意義'],
    answerIndex: 1,
    explanation: '前面有上漲，後面拉回沒有破壞結構，再轉強時常是比較舒服的觀察點。',
  },
];

const glossaryRows = [
  ['RSI', '看股價最近是偏熱還偏冷的指標。'],
  ['MACD', '看趨勢有沒有慢慢轉強或轉弱的工具。'],
  ['月線', '通常指 20 日線，很多人拿來看中短線多空。'],
  ['量縮', '成交量變小，代表市場追價或殺價力道變弱。'],
  ['爆量', '成交量突然放很大，通常代表市場情緒很強。'],
  ['外資 / 投信', '兩種常見的大資金。連買時常是重要參考。'],
  ['支撐', '股價跌到這附近，常有人願意接。'],
  ['壓力', '股價漲到這附近，常有人想賣。'],
  ['題材', '最近市場資金在談、在追的方向，例如 CPO 或 PCB。'],
  ['假突破', '看起來突破了，但很快又跌回原本區間。'],
];

const quizSelections = ref(Array(quizQuestions.length).fill(null));
const quizRevealed = ref(Array(quizQuestions.length).fill(false));
const chartPracticeSelections = ref(Array(chartPracticeExamples.length).fill(null));
const chartPracticeRevealed = ref(Array(chartPracticeExamples.length).fill(false));

const pageSeo = computed(() => ({
  title: '股票小教室',
  description: '用簡單易懂的方式教新手看技術面、量價、籌碼、基本面、期貨與風險控管，並搭配假的趨勢圖與案例拆解直接示範。',
  routePath: '/classroom',
  keywords: ['股票小教室', 'RSI 教學', '量縮價漲', '微台指', '期貨入門', '新手看盤'],
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
          這頁不是教你背公式，而是教你怎麼用最簡單的方法先看懂市場。你會看到
          RSI 是什麼、量縮價漲是什麼、內外盤怎麼看、五日線十日線怎麼用、微台指和期貨是什麼，
          還會搭配假的趨勢圖和真實案例，讓你直接看圖理解。
        </p>
        <div class="theme-radar-summary">
          <span class="theme-observation-chip">技術面</span>
          <span class="theme-observation-chip">基本面</span>
          <span class="theme-observation-chip">籌碼面</span>
          <span class="theme-observation-chip">期貨入門</span>
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
      <a class="section-chip" href="#classroom-charts">看圖教學</a>
      <a class="section-chip" href="#classroom-checklist">實戰清單</a>
      <a class="section-chip" href="#classroom-style-guide">選股風格</a>
      <a class="section-chip" href="#classroom-case-study">案例拆解</a>
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
          <p class="panel-subtitle">先看市場方向，再挑個股，最後才決定進場點。照這個順序看，會比一開始就盯單一股票更穩。</p>
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
          <h2 class="panel-title">看圖教學</h2>
          <p class="panel-subtitle">先認識最常見的走勢型態，再搭配量價和均線一起看，判斷會比只背指標更準。</p>
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

    <section id="classroom-checklist" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">實戰清單</h2>
          <p class="panel-subtitle">盤前、盤中、準備進場前，先用這三張清單快速確認，能少掉很多衝動單。</p>
        </div>
      </div>

      <div class="classroom-card-grid classroom-tip-grid">
        <article v-for="item in quickChecklistCards" :key="item.title" class="sub-panel classroom-card classroom-tip-card">
          <h3 class="panel-title small">{{ item.title }}</h3>
          <p>{{ item.body }}</p>
        </article>
      </div>
    </section>

    <section id="classroom-style-guide" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">不同風格的選股法</h2>
          <p class="panel-subtitle">先分清楚自己偏穩健、偏短線、偏高息還是偏題材，選股方向會清楚很多。</p>
        </div>
      </div>

      <div class="classroom-card-grid classroom-style-grid">
        <article v-for="item in strategyCards" :key="item.title" class="sub-panel classroom-card classroom-style-card">
          <div class="classroom-style-head">
            <h3 class="panel-title small">{{ item.title }}</h3>
            <span class="theme-observation-chip">{{ item.tag }}</span>
          </div>
          <p>{{ item.body }}</p>
          <ul class="classroom-checklist">
            <li v-for="check in item.checks" :key="`${item.title}-${check}`">{{ check }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section id="classroom-case-study" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">真實案例拆解</h2>
          <p class="panel-subtitle">用常見台股案例示範，從題材、技術面到籌碼面，一步一步拆給你看。</p>
        </div>
      </div>

      <div class="classroom-case-grid">
        <article v-for="item in caseStudyCards" :key="item.title" class="sub-panel classroom-case-card">
          <div class="classroom-case-head">
            <div>
              <h3 class="panel-title small">{{ item.title }}</h3>
              <p class="panel-subtitle">{{ item.theme }}</p>
            </div>
            <span class="theme-observation-chip">案例</span>
          </div>
          <p>{{ item.summary }}</p>
          <ol class="classroom-case-steps">
            <li v-for="step in item.steps" :key="step">{{ step }}</li>
          </ol>
        </article>
      </div>
    </section>

    <section id="classroom-quiz" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">觀念小測驗</h2>
          <p class="panel-subtitle">用幾題簡單題目檢查自己是否真的理解觀念，答完記得看解析。</p>
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
            <strong>{{ quizSelections[index] === item.answerIndex ? '答對了' : '先不要緊，重點看解析' }}</strong>
            <p>{{ item.explanation }}</p>
          </div>
        </article>
      </div>
    </section>

    <section id="classroom-chart-practice" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">看圖判斷練習</h2>
          <p class="panel-subtitle">先自己判斷圖形代表什麼，再看解析，會比只讀文字更容易記住。</p>
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
            <strong>{{ chartPracticeSelections[index] === item.answerIndex ? '方向正確' : '再看一次重點' }}</strong>
            <p>{{ item.explanation }}</p>
          </div>
        </article>
      </div>
    </section>

    <section id="classroom-technical" class="panel classroom-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">技術面怎麼看</h2>
          <p class="panel-subtitle">技術面是用來判斷現在偏強、偏弱，還是正在整理，不是用來猜每一天的漲跌。</p>
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
          <p class="panel-subtitle">基本面用來看公司是不是越來越好，能幫你分辨這檔股票值不值得多花時間追蹤。</p>
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
          <h2 class="panel-title">籌碼面怎麼看</h2>
          <p class="panel-subtitle">籌碼面可以幫你看大資金站在哪一邊，常拿來確認技術面看到的方向是不是有人支持。</p>
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
          <h2 class="panel-title">風控與避雷</h2>
          <p class="panel-subtitle">先學會停損、分批和避開過熱股，比急著抓飆股更重要，這會直接影響你能不能長久做下去。</p>
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
          <p class="panel-subtitle">你不一定要做期貨，但先看懂小台、微台的方向，對判斷隔日盤勢很有幫助。</p>
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
          <h2 class="panel-title">簡單實戰流程</h2>
          <p class="panel-subtitle">如果你每天只有 15 分鐘看盤，就照這個順序做，資訊會更有重點，也比較不容易亂追。</p>
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
          <p class="panel-subtitle">很多虧損不是因為看不懂，而是太急著進場、太想一次賺到，或沒有先想好退場。</p>
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
          <h2 class="panel-title">名詞速查</h2>
          <p class="panel-subtitle">遇到不熟的名詞先回來查一次，先把基本語言看懂，後面研究頁面就會順很多。</p>
        </div>
        <div class="theme-page-links">
          <RouterLink class="ghost-button" to="/radar">前往選股雷達</RouterLink>
          <RouterLink class="ghost-button" to="/themes">前往題材雷達</RouterLink>
          <RouterLink class="ghost-button" to="/futures">前往期貨籌碼</RouterLink>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table classroom-glossary-table">
          <thead>
            <tr>
              <th>名詞</th>
              <th>白話解釋</th>
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
