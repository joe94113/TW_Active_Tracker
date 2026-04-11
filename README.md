# 台股主動通

這個專案使用 Vue + Vite 建立可部署到 GitHub Pages 的前端頁面，先提供主動式 ETF 每日持股異動追蹤，後續會再擴充成市場總覽、ETF 重疊分析與法人觀察儀表板。

## 目前功能

- 收錄 23 檔主動式 ETF 商品清單
- 已串接官方持股來源的 ETF 會輸出 `latest.json`、`previous.json`、`diff-latest.json`
- 待串接的 ETF 會保留商品清單與官方來源連結，前端會顯示狀態而不會白屏
- 可直接部署到 GitHub Pages

## 目前已串接官方持股來源

- `00980A` 主動野村臺灣優選主動式交易所交易基金
- `00982A` 主動群益台灣強棒主動式交易所交易基金
- `00985A` 主動野村台灣50主動式交易所交易基金
- `00992A` 主動群益科技創新主動式交易所交易基金

## 資料保留策略

每檔 ETF 目前只保留三個檔案：

- `public/data/etfs/<code>/latest.json`
- `public/data/etfs/<code>/previous.json`
- `public/data/etfs/<code>/diff-latest.json`

這樣可以直接跟前一日做比對，也能避免 repo 累積過多歷史快照。

## 專案結構

- `src/` Vue 前端
- `scripts/update-data.mjs` 每日更新腳本
- `public/data/manifest.json` ETF 清單、狀態與最新摘要
- `public/data/etfs/<code>/latest.json` 最新持股
- `public/data/etfs/<code>/previous.json` 前一日持股
- `public/data/etfs/<code>/diff-latest.json` 最新異動比較

## 本機開發

```bash
npm install
npm run dev
```

## 手動更新資料

```bash
npm run data:update
```

## GitHub Pages 部署

專案已附上 workflow，可持續部署到 GitHub Pages。

1. 將 repo push 到 GitHub。
2. 到 GitHub repo 的 `Settings -> Pages`。
3. `Source` 選擇 `GitHub Actions`。
4. 確認預設分支是 `main`。

## 資料來源說明

- 野村投信官方 ETF 頁面 / API
- 群益投信官方 ETF 頁面
- TWSE OpenAPI

目前不是所有投信的主動式 ETF 官方持股格式都已經串好，所以母名單會先完整收錄，已串接商品優先提供每日比對。後續會再逐家補齊其他投信來源。
