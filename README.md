# 台股主動通

台股主動通是一個以台股研究為核心的前端資訊平台，目標是把「大盤、題材、個股、ETF、法人、技術面、事件統計」整理成一條比較好走的研究路徑，讓使用者可以更快判斷：

- 現在市場資金正在往哪裡走
- 哪些股票剛轉強、值得先放進觀察名單
- 哪些股票已經過熱，不適合再追
- 主動式 ETF、高股息 ETF 最近在買什麼、賣什麼
- 個股在月營收、財報、法說之後，過去通常怎麼走

這個專案使用 `Vue 3 + Vite` 建構，資料會由排程自動更新，並部署到 GitHub Pages。

## 這個專案適合誰

- 想用一個頁面快速看台股盤勢與主線題材的人
- 想研究主動式 ETF / 高股息 ETF 換股方向的人
- 想找「剛起漲、可卡位」股票的人
- 想把技術面、籌碼面、基本面串起來看的人
- 想用比較白話方式學股票的新手

## 目前可以做什麼

### 1. 首頁與市場總覽

- 大盤重點與盤面排行
- 官方交易雷達
- 熱門股與自選股入口
- 搜尋股票後可直接進個股頁

### 2. 個股研究頁

- 技術分析圖表與指標參數
- 法人籌碼、持股分級、同產業比較
- 關鍵價位區、支撐壓力帶、事件日曆
- 近期新聞與關鍵字整理
- 外資目標價整理
- 個股體檢分數與過熱警示

### 3. ETF 研究

- 主動式 ETF 清單與明細
- ETF 重疊持股
- 高股息 ETF 換股雷達
- 高息角度 / 動能角度雙視角判讀

### 4. 題材與選股工具

- 資金題材雷達
- 題材輪動歷史
- 起漲卡位雷達
- 選股雷達
- 選股條件篩選器
- 隔日觀察清單
- 自選股健檢中心
- 事件後表現統計

### 5. 期貨與盤勢輔助

- 小型臺指期貨籌碼
- 微型臺指期貨籌碼
- 期貨技術走勢圖
- 用期貨方向輔助判斷隔日盤勢

### 6. 新手教學

- 股票小教室
- 技術面、基本面、籌碼面、風控入門
- 假圖表教學
- 看圖判斷練習
- 互動式小測驗

## 主要頁面

- `/` 首頁
- `/stocks/:code` 個股研究頁
- `/etfs` 主動式 ETF 清單
- `/etfs/:code` 主動式 ETF 明細
- `/etf-overlap` ETF 重疊持股
- `/themes` 資金題材雷達
- `/futures` 小台 / 微台期貨籌碼
- `/radar` 選股雷達
- `/entry-radar` 起漲卡位雷達
- `/high-dividend-etfs` 高股息 ETF 換股雷達
- `/watchlist` 隔日觀察清單
- `/favorites-health` 自選股健檢中心
- `/scanner` 選股條件篩選器
- `/event-stats` 事件後表現統計
- `/classroom` 股票小教室

## 通知與推播

目前支援：

- Telegram
- Discord
- LINE 官方帳號廣播

推播內容會以盤後摘要為主，整理成：

- 明日趨勢預測
- 穩健型名單
- 積極型名單

其中 LINE 會使用 `Flex Message`，Discord 會使用 `embed`，方便直接在訊息裡看重點。

## 資料更新頻率

GitHub Actions 會自動跑資料更新，時區為 `Asia/Taipei`：

- 平日 `09:00` 到 `14:45` 每 15 分鐘
- 平日 `14:50`
- 平日 `15:20`
- 平日 `18:35`

資料有變動時，會自動：

1. 重新整理 `public/data`
2. build 前端
3. deploy 到 GitHub Pages
4. 在收盤後發送通知

## 資料來源

資料來源以官方與可穩定取得的來源為主，包含：

- TWSE OpenAPI / TWSE 官方 JSON
- TPEx 公開資料
- TAIFEX 官方資料
- 各投信官方 ETF 持股 / 淨值來源
- Google News / 新聞摘要整理

不同資料欄位的更新速度，會受到上游來源公布時間影響。  
也就是說，系統會自動每日更新，但少數欄位是否能在收盤後立刻更新，仍取決於官方來源何時釋出。

## 專案技術

- `Vue 3`
- `Vue Router`
- `Vite`
- `lightweight-charts`

## 專案結構

- `src/`
  - 前端頁面、元件、樣式與資料整理邏輯
- `public/data/`
  - 每次更新後產生的靜態資料包
- `scripts/update-data.mjs`
  - 主要資料更新腳本
- `.github/workflows/`
  - 自動更新、部署與通知流程

## 本機開發

```bash
npm install
npm run dev
```

## 手動更新資料

```bash
npm run data:update
```

## 建置

```bash
npm run build
```

## GitHub Pages 部署

專案已附上 workflow，可直接部署到 GitHub Pages。

1. 將 repo push 到 GitHub
2. 到 `Settings -> Pages`
3. `Source` 選擇 `GitHub Actions`
4. 確認預設分支是 `main`

## 通知所需 Secrets

如果要啟用推播，需在 GitHub Actions Secrets 設定：

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `DISCORD_WEBHOOK_URL`
- `LINE_CHANNEL_ACCESS_TOKEN`

## 專案目前的定位

這不是單純的 ETF 清單站，也不是只看技術指標的圖表站。  
它更像是一個把台股研究常用資訊整合在一起的工作台，讓使用者可以從：

`盤勢 -> 題材 -> ETF -> 個股 -> 事件 -> 風險`

一路看下去，縮短研究時間，也降低追高與資訊分散的問題。
